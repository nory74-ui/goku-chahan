/**
 * 極・炒飯道 (Goku Chahandou) - Game Engine & Sensor Controller
 */

// --- 音響エンジン (Web Audio API によるプロシージャル効果音) ---
class SoundFx {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 煽り音（金属音 ＋ 風切り音）
  playToss() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 金属の「シャン！」
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.18);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);

    // 風切りノイズ
    this.playNoise(0.2, 0.25, 400, 1200);
  }

  // 具材投入音
  playAdd() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  // 醤油のジュワァッ！
  playSizzle() {
    this.playNoise(0.8, 0.5, 600, 3000);
  }

  // パカッ！（皿盛り音）
  playPlating() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.25);
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  playNoise(duration, volume, lowFreq, highFreq) {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = (lowFreq + highFreq) / 2;
    filter.Q.value = 1.0;

    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
  }
}

// --- メインゲームクラス ---
class FriedRiceGame {
  constructor() {
    this.canvas = document.getElementById('wok-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.sfx = new SoundFx();

    this.gameState = 'START'; // START, COOKING, LADLED, RESULT
    this.timeRemaining = 45.0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;

    // 調理ステータス
    this.dryness = 0;      // 0〜100 (パラパラ度)
    this.heat = 20;        // 0〜100 (鍋底の熱量)
    this.burnAmount = 0;   // 焦げ累積値
    this.tossCount = 0;
    this.lastTossTime = 0;
    this.tossIntervals = [];

    // 具材フラグ・タイミング (秒)
    this.ingredients = {
      egg: false,
      rice: false,
      meat: false,
      greenonion: false,
      soy: false,
      ladled: false
    };
    this.timings = {
      egg: 0,
      rice: 0,
      meat: 0,
      greenonion: 0,
      soy: 0
    };
    this.wokHeiActive = false;
    this.wokHeiTossCount = 0;

    // パーティクル配列
    this.riceGrains = [];
    this.smokeParticles = [];

    // センサー検知用
    this.lastAccelY = 0;
    this.lastAccelZ = 0;
    this.lastTossDetectTime = 0;
    this.deviceFlipped = false;

    this.initCanvasSize();
    this.bindEvents();
    this.setupSensors();

    // アニメーションループ開始
    this.lastFrameTime = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  initCanvasSize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.centerX = this.canvas.width / 2;
    this.centerY = this.canvas.height / 2;
    this.wokRadius = Math.min(this.canvas.width, this.canvas.height) * 0.44;
  }

  bindEvents() {
    window.addEventListener('resize', () => this.initCanvasSize());

    // スタートボタン
    document.getElementById('btn-start').addEventListener('click', () => {
      this.sfx.init();
      this.requestDevicePermissions().then(() => {
        this.startGame();
      });
    });

    // リトライボタン
    document.getElementById('btn-retry').addEventListener('click', () => {
      this.resetGame();
      this.startGame();
    });

    // 具材投入ボタン群
    document.getElementById('btn-egg').addEventListener('click', () => this.addIngredient('egg'));
    document.getElementById('btn-rice').addEventListener('click', () => this.addIngredient('rice'));
    document.getElementById('btn-meat').addEventListener('click', () => this.addIngredient('meat'));
    document.getElementById('btn-greenonion').addEventListener('click', () => this.addIngredient('greenonion'));
    document.getElementById('btn-soy').addEventListener('click', () => this.addSoy());
    document.getElementById('btn-ladle').addEventListener('click', () => this.gatherLadle());

    // デバッグボタン (PC検証用)
    document.getElementById('btn-debug-toss').addEventListener('click', () => this.handleToss(1.0));
    document.getElementById('btn-debug-flip').addEventListener('click', () => this.handleFlip());

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.handleToss(1.0);
      } else if (e.code === 'KeyF') {
        this.handleFlip();
      }
    });
  }

  // センサー許可 (iOS 13+ 対応)
  async requestDevicePermissions() {
    const statusEl = document.getElementById('sensor-status');
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const response = await DeviceMotionEvent.requestPermission();
        if (response === 'granted') {
          statusEl.textContent = 'センサー許可済み (iOS)';
        } else {
          statusEl.textContent = 'センサーが拒否されました。ボタン操作でプレイ可能です。';
        }
      } catch (err) {
        console.warn('DeviceMotion permission error:', err);
      }
    }
  }

  setupSensors() {
    // 加速度センサー (煽り検知)
    window.addEventListener('devicemotion', (event) => {
      if (this.gameState !== 'COOKING' && this.gameState !== 'LADLED') return;

      const acc = event.acceleration || event.accelerationIncludingGravity;
      const accG = event.accelerationIncludingGravity;
      if (!acc) return;

      const ay = acc.y || 0;
      const az = acc.z || 0;

      // デバッグ表示更新
      const dbgAy = document.getElementById('dbg-ay');
      const dbgAz = document.getElementById('dbg-az');
      if (dbgAy) dbgAy.textContent = ay.toFixed(1);
      if (dbgAz) dbgAz.textContent = az.toFixed(1);

      const now = performance.now();

      // --- 鍋あおり判定 ---
      // スマホを上向きに持ち、手前に引く(-ay) かつ 上へ持ち上げる(+az) の急激な変化
      const jerkY = ay - this.lastAccelY;
      const jerkZ = az - this.lastAccelZ;

      // 閾値判定 (手前に引く・上に跳ね上げる)
      if (this.gameState === 'COOKING') {
        if ((ay < -2.8 || jerkY < -4.0) && (az > 2.5 || jerkZ > 3.5)) {
          if (now - this.lastTossDetectTime > 220) { // チャタリング防止
            const power = Math.min(2.0, Math.max(0.6, (Math.abs(ay) + Math.abs(az)) / 8.0));
            this.handleToss(power);
            this.lastTossDetectTime = now;
          }
        }
      }

      // --- ひっくり返し判定 (お玉まとめ後) ---
      if (this.gameState === 'LADLED' && accG) {
        // 通常上向きは az ≈ +9.8。下向きに反転すると az ≈ -9.8 (または負の値)
        if (accG.z < -3.5) {
          this.handleFlip();
        }
      }

      this.lastAccelY = ay;
      this.lastAccelZ = az;
    });

    // 傾きジャイロセンサー
    window.addEventListener('deviceorientation', (event) => {
      const pitch = event.beta || 0; // 手前-奥の傾き
      const dbgPitch = document.getElementById('dbg-pitch');
      if (dbgPitch) dbgPitch.textContent = pitch.toFixed(0);

      // お玉まとめ後に手前へ大きく90度以上傾けても皿盛りを許可
      if (this.gameState === 'LADLED' && Math.abs(pitch) > 110) {
        this.handleFlip();
      }
    });
  }

  startGame() {
    this.gameState = 'COOKING';
    document.getElementById('start-screen').classList.remove('active');
    document.getElementById('result-screen').classList.remove('active');
    this.timeRemaining = 45.0;
    this.score = 0;
    this.combo = 0;
    this.dryness = 0;
    this.heat = 35;
    this.burnAmount = 0;
    this.wokHeiActive = false;
    this.wokHeiTossCount = 0;

    // UIボタン状態初期化
    document.getElementById('btn-egg').disabled = false;
    document.getElementById('btn-rice').disabled = true;
    document.getElementById('btn-meat').disabled = true;
    document.getElementById('btn-greenonion').disabled = true;
    document.getElementById('btn-soy').disabled = true;
    document.getElementById('btn-ladle').disabled = true;
    document.getElementById('wok-rim-overlay').classList.remove('active');

    this.showFeedback('熱々の油に卵を投入せよ！', '#ffca28');
  }

  resetGame() {
    this.riceGrains = [];
    this.smokeParticles = [];
    for (const key in this.ingredients) this.ingredients[key] = false;
    this.tossIntervals = [];
  }

  // --- 具材投入ロジック ---
  addIngredient(type) {
    if (this.gameState !== 'COOKING') return;
    const elapsed = 45.0 - this.timeRemaining;

    if (type === 'egg' && !this.ingredients.egg) {
      this.ingredients.egg = true;
      this.timings.egg = elapsed;
      document.getElementById('btn-egg').disabled = true;
      document.getElementById('btn-rice').disabled = false;
      this.sfx.playAdd();
      this.sfx.playSizzle();
      this.createEggSplashes();
      this.showFeedback('半熟のうちにご飯を入れろ！', '#ffca28');
    }
    else if (type === 'rice' && this.ingredients.egg && !this.ingredients.rice) {
      this.ingredients.rice = true;
      this.timings.rice = elapsed;
      document.getElementById('btn-rice').disabled = true;
      document.getElementById('btn-meat').disabled = false;
      document.getElementById('btn-greenonion').disabled = false;
      document.getElementById('btn-soy').disabled = false;
      document.getElementById('btn-ladle').disabled = false;
      this.sfx.playAdd();

      // ご飯投入タイミング評価
      const eggRiceDiff = this.timings.rice - this.timings.egg;
      if (eggRiceDiff >= 1.2 && eggRiceDiff <= 3.2) {
        this.showFeedback('黄金コーティング成功！(PERFECT)', '#00e676');
        this.addScore(800);
      } else {
        this.showFeedback('米投入！鍋をあおってほぐせ！', '#ffb300');
      }

      this.spawnRiceGrains(90);
    }
    else if (type === 'meat' && this.ingredients.rice && !this.ingredients.meat) {
      this.ingredients.meat = true;
      this.timings.meat = elapsed;
      document.getElementById('btn-meat').disabled = true;
      this.sfx.playAdd();
      this.spawnMeatBits(20);
      this.showFeedback('チャーシュー投入！', '#ff9800');
    }
    else if (type === 'greenonion' && this.ingredients.rice && !this.ingredients.greenonion) {
      this.ingredients.greenonion = true;
      this.timings.greenonion = elapsed;
      document.getElementById('btn-greenonion').disabled = true;
      this.sfx.playAdd();
      this.spawnGreenOnionBits(24);

      // ネギのタイミング評価（終了5〜10秒前がベスト）
      if (this.timeRemaining <= 12.0 && this.timeRemaining >= 4.0) {
        this.showFeedback('シャキシャキネギ！(PERFECT)', '#00e676');
        this.addScore(600);
      } else {
        this.showFeedback('ネギ投入！', '#8bc34a');
      }
    }
  }

  // 鍋肌醤油アクション
  addSoy() {
    if (this.gameState !== 'COOKING' || !this.ingredients.rice || this.ingredients.soy) return;
    this.ingredients.soy = true;
    this.timings.soy = 45.0 - this.timeRemaining;
    document.getElementById('btn-soy').disabled = true;

    this.sfx.playSizzle();

    // 鍋肌エフェクト発動
    this.wokHeiActive = true;
    this.wokHeiTossCount = 0;
    const banner = document.getElementById('wok-hei-banner');
    banner.classList.add('show');
    setTimeout(() => banner.classList.remove('show'), 1500);

    // 煙パーティクルを激しく発生
    for (let i = 0; i < 30; i++) {
      this.spawnSmoke(this.centerX + (Math.random() - 0.5) * this.wokRadius * 1.5,
                       this.centerY + (Math.random() - 0.5) * this.wokRadius * 1.5, true);
    }

    this.showFeedback('鍋肌醤油！即座に煽って香りを閉じ込めろ！', '#ff5722');
  }

  // お玉にまとめる
  gatherLadle() {
    if (this.gameState !== 'COOKING' || !this.ingredients.rice) return;
    this.gameState = 'LADLED';
    this.ingredients.ladled = true;
    this.sfx.playAdd();

    // 米粒をお玉の中心に引き寄せる
    this.riceGrains.forEach(g => {
      g.targetX = this.centerX + (Math.random() - 0.5) * 40;
      g.targetY = this.centerY + (Math.random() - 0.5) * 40;
      g.inLadle = true;
    });

    this.showFeedback('端末をパカッと裏返して皿へ盛れ！', '#42a5f5');
  }

  // 皿への盛り付け（ひっくり返し検知時）
  handleFlip() {
    if (this.gameState !== 'LADLED') return;
    this.sfx.playPlating();
    this.finishGame();
  }

  // --- 鍋あおりアクション ---
  handleToss(power) {
    if (this.gameState !== 'COOKING') return;

    this.sfx.playToss();
    this.tossCount++;

    const now = performance.now();
    if (this.lastTossTime > 0) {
      const interval = (now - this.lastTossTime) / 1000;
      this.tossIntervals.push(interval);

      // プロのリズム判定 (約0.28〜0.42秒 = 約2.5〜3.5Hz)
      if (interval >= 0.25 && interval <= 0.45) {
        this.combo++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
        this.addScore(150 * Math.min(this.combo, 10));
        this.showFeedback(`PERFECT RHYTHM! (${this.combo} COMBO)`, '#00e676');
        this.dryness = Math.min(100, this.dryness + 3.5);
      } else {
        this.combo = 0;
        this.showFeedback('GOOD TOSS!', '#ffca28');
        this.dryness = Math.min(100, this.dryness + 2.0);
      }
    } else {
      this.dryness = Math.min(100, this.dryness + 2.0);
    }
    this.lastTossTime = now;

    // 鑊気ボーナス判定
    if (this.wokHeiActive) {
      this.wokHeiTossCount++;
      if (this.wokHeiTossCount <= 3) {
        this.addScore(400);
      }
    }

    // 熱量の放熱（焦げリセット）
    this.heat = Math.max(10, this.heat - 12 * power);

    // 米粒の跳ね上げ物理
    const tossForce = 8.0 * power;
    this.riceGrains.forEach(g => {
      g.vz = tossForce + Math.random() * 4.0;
      g.vx += (Math.random() - 0.5) * 2.5;
      g.vy += (Math.random() - 0.5) * 2.5 - 1.0; // 手前へ少し寄る
    });

    // 煙パーティクル
    for (let i = 0; i < 4; i++) {
      this.spawnSmoke(this.centerX + (Math.random() - 0.5) * 80, this.centerY + (Math.random() - 0.5) * 80);
    }

    // 振りすぎ判定（米こぼれ）
    if (power > 1.85) {
      this.showFeedback('振りすぎ！米がこぼれた！', '#f44336');
      this.addScore(-100);
      this.burnAmount += 2;
    }
  }

  showFeedback(text, color = '#ffca28') {
    const el = document.getElementById('toss-feedback');
    el.textContent = text;
    el.style.color = color;
  }

  addScore(pts) {
    this.score = Math.max(0, this.score + pts);
    document.getElementById('score-val').textContent = this.score;
  }

  // --- パーティクル生成 ---
  createEggSplashes() {
    for (let i = 0; i < 30; i++) {
      this.smokeParticles.push({
        x: this.centerX + (Math.random() - 0.5) * 60,
        y: this.centerY + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        radius: 6 + Math.random() * 8,
        color: 'rgba(255, 214, 0, 0.7)',
        life: 1.0,
        decay: 0.03
      });
    }
  }

  spawnRiceGrains(count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * (this.wokRadius * 0.7);
      this.riceGrains.push({
        type: 'rice',
        x: this.centerX + Math.cos(angle) * dist,
        y: this.centerY + Math.sin(angle) * dist,
        z: 0,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        vz: 0,
        targetX: null,
        targetY: null,
        inLadle: false,
        size: 3.2,
        colorType: 'yellow' // yellow, golden, burnt
      });
    }
  }

  spawnMeatBits(count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * (this.wokRadius * 0.6);
      this.riceGrains.push({
        type: 'meat',
        x: this.centerX + Math.cos(angle) * dist,
        y: this.centerY + Math.sin(angle) * dist,
        z: 0,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        vz: 0,
        size: 5.5,
        color: '#b71c1c'
      });
    }
  }

  spawnGreenOnionBits(count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * (this.wokRadius * 0.6);
      this.riceGrains.push({
        type: 'onion',
        x: this.centerX + Math.cos(angle) * dist,
        y: this.centerY + Math.sin(angle) * dist,
        z: 0,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        vz: 0,
        size: 4.2,
        color: '#4caf50'
      });
    }
  }

  spawnSmoke(x, y, isWokHei = false) {
    this.smokeParticles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 1.0,
      vy: -1.5 - Math.random() * 2.0,
      radius: isWokHei ? 12 : 8,
      color: isWokHei ? 'rgba(255, 110, 64, 0.6)' : 'rgba(240, 240, 240, 0.4)',
      life: 1.0,
      decay: 0.02 + Math.random() * 0.02
    });
  }

  // --- ゲームループ ---
  gameLoop(now) {
    const dt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;

    if (this.gameState === 'COOKING') {
      this.updateCooking(dt);
    } else if (this.gameState === 'LADLED') {
      this.updateLadled(dt);
    }

    this.render();

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  updateCooking(dt) {
    // タイマー減算
    this.timeRemaining -= dt;
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.finishGame();
      return;
    }
    document.getElementById('time-val').textContent = Math.ceil(this.timeRemaining);

    // 熱量の上昇（強火バーナー）
    this.heat = Math.min(100, this.heat + 9.0 * dt);

    // 焦げの蓄積判定（熱量85以上で焦げ開始）
    if (this.heat > 85) {
      this.burnAmount += dt * 3.5;
      if (Math.random() < 0.25) {
        this.spawnSmoke(this.centerX + (Math.random() - 0.5) * 100, this.centerY + (Math.random() - 0.5) * 100);
      }
    }

    // メーターUI更新
    document.getElementById('meter-dryness').style.width = `${Math.min(100, this.dryness)}%`;
    document.getElementById('meter-heat').style.width = `${Math.min(100, this.heat)}%`;
    document.getElementById('combo-display').textContent = `COMBO ${this.combo}`;

    // 鍋肌ハイライトのオン/オフ（残り12秒〜5秒で点滅案内）
    const rimEl = document.getElementById('wok-rim-overlay');
    if (this.timeRemaining <= 12.0 && this.timeRemaining >= 4.0 && !this.ingredients.soy) {
      rimEl.classList.add('active');
    } else {
      rimEl.classList.remove('active');
    }

    this.updateParticles(dt);
  }

  updateLadled(dt) {
    this.updateParticles(dt);
  }

  updateParticles(dt) {
    // 米粒の物理
    const gravity = 18.0;
    this.riceGrains.forEach(g => {
      if (g.inLadle && g.targetX !== null) {
        // お玉への吸い込み
        g.x += (g.targetX - g.x) * 0.15;
        g.y += (g.targetY - g.y) * 0.15;
        g.z = Math.max(0, g.z - 0.5);
      } else {
        // 空中舞い上がり＆落下
        if (g.z > 0 || g.vz > 0) {
          g.z += g.vz * dt * 10;
          g.vz -= gravity * dt * 10;
          if (g.z <= 0) {
            g.z = 0;
            g.vz = 0;
          }
        }

        g.x += g.vx;
        g.y += g.vy;
        g.vx *= 0.94;
        g.vy *= 0.94;

        // 鍋の縁（すり鉢状）の反射
        const dx = g.x - this.centerX;
        const dy = g.y - this.centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = this.wokRadius * 0.85;
        if (dist > maxDist) {
          const angle = Math.atan2(dy, dx);
          g.x = this.centerX + Math.cos(angle) * maxDist;
          g.y = this.centerY + Math.sin(angle) * maxDist;
          g.vx = -g.vx * 0.5;
          g.vy = -g.vy * 0.5;
        }
      }
    });

    // 煙パーティクルの更新
    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const p = this.smokeParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.radius += 0.3;
      p.life -= p.decay;
      if (p.life <= 0) {
        this.smokeParticles.splice(i, 1);
      }
    }
  }

  // --- 描画レンダリング ---
  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 中華鍋の描画
    this.drawWok();

    // 煙・蒸気（背面）
    this.drawSmoke();

    // 米粒・具材
    this.drawIngredients();

    // お玉（まとめ時）
    if (this.gameState === 'LADLED') {
      this.drawLadleOverlay();
    }
  }

  drawWok() {
    const { ctx, centerX, centerY, wokRadius } = this;

    // 鍋の外枠（鉄の黒光り）
    const grad = ctx.createRadialGradient(
      centerX - wokRadius * 0.2, centerY - wokRadius * 0.2, wokRadius * 0.1,
      centerX, centerY, wokRadius
    );
    grad.addColorStop(0, '#33353e');
    grad.addColorStop(0.65, '#1e2027');
    grad.addColorStop(1, '#0c0d11');

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, wokRadius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 25;
    ctx.fill();

    // 熱量に応じた中央の赤熱（ヒートグロー）
    if (this.heat > 60) {
      const heatAlpha = ((this.heat - 60) / 40) * 0.45;
      const heatGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, wokRadius * 0.5);
      heatGrad.addColorStop(0, `rgba(255, 69, 0, ${heatAlpha})`);
      heatGrad.addColorStop(1, 'rgba(255, 69, 0, 0)');
      ctx.fillStyle = heatGrad;
      ctx.fill();
    }

    // 鍋の縁（フチ）のハイライト
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#484a58';
    ctx.stroke();
    ctx.restore();
  }

  drawIngredients() {
    const { ctx } = this;

    // 焦げ色計算
    const isBurnt = this.burnAmount > 12;
    const isParapara = this.dryness > 60;

    this.riceGrains.forEach(g => {
      ctx.save();
      // z軸による拡大（手前への舞い上がり）
      const scale = 1.0 + (g.z / 30);
      const drawSize = g.size * scale;

      // 影の描画（浮いている時）
      if (g.z > 2) {
        ctx.beginPath();
        ctx.ellipse(g.x, g.y + g.z * 0.8, drawSize * 0.8, drawSize * 0.4, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fill();
      }

      ctx.beginPath();
      if (g.type === 'rice') {
        ctx.ellipse(g.x, g.y - g.z * 1.2, drawSize * 1.3, drawSize * 0.8, (g.x + g.y) * 0.05, 0, Math.PI * 2);

        if (isBurnt) {
          ctx.fillStyle = '#5d4037'; // 焦げ茶
        } else if (isParapara) {
          ctx.fillStyle = '#ffd54f'; // 黄金パラパラ
        } else {
          ctx.fillStyle = '#fff9c4'; // 卵絡み白米
        }
      } else if (g.type === 'meat') {
        ctx.rect(g.x - drawSize / 2, (g.y - g.z * 1.2) - drawSize / 2, drawSize, drawSize);
        ctx.fillStyle = g.color;
      } else if (g.type === 'onion') {
        ctx.arc(g.x, g.y - g.z * 1.2, drawSize * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = g.color;
      }

      ctx.fill();
      ctx.restore();
    });
  }

  drawSmoke() {
    const { ctx } = this;
    this.smokeParticles.forEach(p => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fill();
      ctx.restore();
    });
  }

  drawLadleOverlay() {
    const { ctx, centerX, centerY } = this;
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, 55, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#64b5f6';
    ctx.setLineDash([8, 6]);
    ctx.stroke();

    ctx.fillStyle = 'rgba(100, 181, 246, 0.15)';
    ctx.fill();
    ctx.restore();
  }

  // --- ゲーム終了・スコア集計 ---
  finishGame() {
    this.gameState = 'RESULT';

    // 1. パラパラ度スコア (25点満点)
    const drynessScore = Math.round(Math.min(25, (this.dryness / 100) * 25));

    // 2. 焼き加減スコア (20点満点)
    let heatScore = 20;
    if (this.burnAmount > 5) {
      heatScore = Math.max(0, 20 - Math.round(this.burnAmount));
    }

    // 3. 卵・米コーティング (15点満点)
    let coatingScore = 15;
    if (!this.ingredients.egg || !this.ingredients.rice) {
      coatingScore = 0;
    } else {
      const diff = this.timings.rice - this.timings.egg;
      if (diff < 1.0 || diff > 4.0) coatingScore = 7;
    }

    // 4. 具材＆ネギ鮮度 (15点満点)
    let timingScore = 15;
    if (!this.ingredients.greenonion) {
      timingScore -= 8;
    }
    if (!this.ingredients.meat) {
      timingScore -= 7;
    }

    // 5. 鑊気スコア (15点満点)
    let wokheiScore = 0;
    if (this.ingredients.soy) {
      wokheiScore = Math.min(15, 6 + this.wokHeiTossCount * 3);
    }

    // 6. 盛り付けスコア (10点満点)
    const platingScore = this.ingredients.ladled ? 10 : 3;

    // 総合スコア (100点満点)
    const totalScore = Math.min(100, drynessScore + heatScore + coatingScore + timingScore + wokheiScore + platingScore);

    // リザルト画面に反映
    document.getElementById('score-dryness').textContent = `${drynessScore} / 25`;
    document.getElementById('score-heat').textContent = `${heatScore} / 20`;
    document.getElementById('score-coating').textContent = `${coatingScore} / 15`;
    document.getElementById('score-timing').textContent = `${timingScore} / 15`;
    document.getElementById('score-wokhei').textContent = `${wokheiScore} / 15`;
    document.getElementById('score-plating').textContent = `${platingScore} / 10`;
    document.getElementById('result-score').textContent = `${totalScore} / 100`;

    // ランク・称号
    let rank = 'D';
    let title = 'まかない落第';
    let comment = '「ベチャベチャ（または丸焦げ）だ！修行し直してこい！」';

    if (totalScore >= 92) {
      rank = 'S';
      title = '町中華の生ける伝説';
      comment = '「完璧だ…！米一粒一粒に卵が宿り、鑊気が突き抜ける至高の一皿！」';
    } else if (totalScore >= 78) {
      rank = 'A';
      title = '一流中華の料理長';
      comment = '「見事なパラパラ感と香ばしさ！ネギのシャキシャキ感も最高だ。」';
    } else if (totalScore >= 60) {
      rank = 'B';
      title = '一人前の料理人';
      comment = '「うん、うまい！次は鍋肌醤油のタイミングをもっと極めてみよう。」';
    } else if (totalScore >= 45) {
      rank = 'C';
      title = '見習いコック';
      comment = '「少し油っこいか…？具材を入れる順番と秒数を意識するんじゃ。」';
    }

    document.getElementById('result-rank').textContent = rank;
    document.getElementById('result-title').textContent = title;
    document.getElementById('chef-comment').textContent = comment;

    // お皿に盛られたチャーハンのプレビュー描画
    this.renderPlatePreview(totalScore);

    document.getElementById('result-screen').classList.add('active');
  }

  renderPlatePreview(score) {
    const pCanvas = document.getElementById('plate-canvas');
    const pCtx = pCanvas.getContext('2d');
    const cx = pCanvas.width / 2;
    const cy = pCanvas.height / 2;

    pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);

    // お皿（中華模様の中華皿）
    pCtx.beginPath();
    pCtx.arc(cx, cy, 95, 0, Math.PI * 2);
    pCtx.fillStyle = '#fdfdfd';
    pCtx.shadowColor = 'rgba(0,0,0,0.5)';
    pCtx.shadowBlur = 15;
    pCtx.fill();

    // お皿の青いフチ
    pCtx.lineWidth = 6;
    pCtx.strokeStyle = '#1e88e5';
    pCtx.stroke();

    // ドーム型チャーハン
    pCtx.beginPath();
    pCtx.arc(cx, cy, 70, 0, Math.PI * 2);
    if (score >= 90) {
      pCtx.fillStyle = '#ffca28'; // 黄金
    } else if (this.burnAmount > 10) {
      pCtx.fillStyle = '#6d4c41'; // コゲ
    } else {
      pCtx.fillStyle = '#ffe082'; // 普通
    }
    pCtx.shadowBlur = 8;
    pCtx.fill();

    // 米粒のツブツブ質感
    pCtx.fillStyle = score >= 90 ? '#fff8e1' : '#fff9c4';
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * 60;
      pCtx.beginPath();
      pCtx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2.5, 0, Math.PI * 2);
      pCtx.fill();
    }

    // 刻みネギ・チャーシューのトッピング
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * 55;
      pCtx.beginPath();
      pCtx.rect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 5, 5);
      pCtx.fillStyle = i % 2 === 0 ? '#43a047' : '#c62828';
      pCtx.fill();
    }
  }
}

// ページ読み込み完了時にゲーム起動
window.addEventListener('DOMContentLoaded', () => {
  new FriedRiceGame();
});
