/**
 * 極・炒飯道 PHOTOREAL EDITION (Goku Chahandou - Real-Time Photographic Wok Physics Engine)
 *
 * 【アーキテクチャ刷新】
 * - 外部CDN/WASMのロード競合・遅延を完全排除し、開いた瞬間に100%確実に起動
 * - 実写マクロ撮影テクスチャ（空の打ち出し中華鍋、強火ガスコンロ、白米・黄金炒飯、半熟炒り卵、焼豚、長ネギ）
 *   から高精細スプライト＆レイヤーをリアルタイム合成
 * - スマホの加速度(DeviceMotion)・傾き(DeviceOrientation)・タッチドラッグが1:1で中華鍋の3D変位と
 *   放物面ボウル内の約800個の具材粒子に直結する「スマホ＝中華鍋」完全シンクロ物理エンジン
 */

// --- 1. プロシージャル実写音響エンジン (Web Audio API) ---
class ChahanAudioEngine {
  constructor() {
    this.ctx = null;
    this.sizzleGain = null;
    this.sizzleFilter = null;
    this.isCooking = false;
  }

  init() {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        this.setupSizzleLoop();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    } catch (e) {
      console.warn('Audio init warning:', e);
    }
  }

  setupSizzleLoop() {
    const bufferSize = this.ctx.sampleRate * 2.0;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      const crackle = Math.random() < 0.008 ? (Math.random() * 2 - 1) * 2.8 : 0;
      data[i] = white * 0.32 + crackle * 0.68;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    this.sizzleFilter = this.ctx.createBiquadFilter();
    this.sizzleFilter.type = 'bandpass';
    this.sizzleFilter.frequency.value = 1700;
    this.sizzleFilter.Q.value = 1.1;

    this.sizzleGain = this.ctx.createGain();
    this.sizzleGain.gain.value = 0.0;

    noiseSource.connect(this.sizzleFilter);
    this.sizzleFilter.connect(this.sizzleGain);
    this.sizzleGain.connect(this.ctx.destination);
    noiseSource.start();
  }

  updateSizzle(heat, ingredientCount, agitationSpeed = 0) {
    if (!this.sizzleGain || !this.ctx || !this.isCooking) return;
    const baseIntensity = Math.min(1.0, (ingredientCount + 12) / 180);
    const motionBoost = Math.min(0.45, agitationSpeed * 0.08);
    const targetVol = Math.min(0.65, (heat / 100) * 0.48 * baseIntensity + motionBoost);
    this.sizzleGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.06);

    const targetFreq = 1300 + (heat / 100) * 1600 + Math.min(800, agitationSpeed * 120);
    this.sizzleFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.08);
  }

  playCollision(impactSpeed) {
    if (!this.ctx || impactSpeed < 0.6) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(310 + Math.random() * 240, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.055);

    const vol = Math.min(0.22, (impactSpeed / 5.0) * 0.22);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  playToss(power) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 鉄鍋と五徳が擦れる金属音「シャン！ガッ！」
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(380 * Math.min(1.3, Math.max(0.8, power)), now);
    osc.frequency.exponentialRampToValueAtTime(125, now + 0.20);

    gain.gain.setValueAtTime(Math.min(0.42, 0.26 * power), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);

    // 米粒の波が宙を舞う風切り＆着地シズル音「ジャッ！」
    const bufSize = Math.floor(this.ctx.sampleRate * 0.24);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufSize) * Math.PI);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1150;

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(Math.min(0.48, 0.30 * power), now);
    nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.ctx.destination);
    noise.start(now);
  }

  playAdd() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(860, now + 0.12);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playSoySizzle() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const bufSize = Math.floor(this.ctx.sampleRate * 0.9);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 0.55);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2500, now);
    filter.frequency.exponentialRampToValueAtTime(900, now + 0.9);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.9);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
  }

  playPlating() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.25, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.45);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.45);
    });
  }
}

// --- 2. フォトリアル中華鍋＆物理シミュレーションエンジン ---
class GokuChahanPhotoreal {
  constructor() {
    this.canvas = document.getElementById('three-canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.audio = new ChahanAudioEngine();

    // ゲーム進行状態
    this.gameState = 'COOKING';
    this.timeRemaining = 45.0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.lastTossTime = 0;

    // 調理パラメータ
    this.dryness = 0;      // パラパラ度 (0〜100%)
    this.heat = 38;        // 鍋底熱量 (0〜100%)
    this.burnAmount = 0;   // 焦げ蓄積
    this.ingredients = {
      egg: false,
      rice: false,
      meat: false,
      greenonion: false,
      soy: false,
      ladled: false
    };
    this.timings = { egg: 0, rice: 0, meat: 0, greenonion: 0, soy: 0 };
    this.wokHeiActive = false;
    this.wokHeiTossCount = 0;

    // 中華鍋の3D運動状態（スマホの揺れ・傾き・ドラッグと1:1で連動）
    this.wokX = 0;          // 左右変位 (-1.0 〜 +1.0)
    this.wokY = 0;          // 前後（手前・奥）変位 (-1.0 〜 +1.0)
    this.wokZ = 0;          // 上下（持ち上げ・煽り）高さ (0.0 〜 1.0)
    this.wokVx = 0;
    this.wokVy = 0;
    this.wokVz = 0;
    this.tiltX = 0;         // スマホの左右傾き (-0.5 〜 +0.5)
    this.tiltY = 0;         // スマホの前後傾き (-0.5 〜 +0.5)

    // 具材パーティクル配列（最初は完全に空！）
    this.eggPool = null;    // 投入直後のジュワッと広がる液状〜半熟卵プール
    this.eggParticles = []; // ほぐれたふんわり半熟炒り卵そぼろ (56個)
    this.riceParticles = []; // 実写テクスチャ米粒 (650粒)
    this.meatParticles = []; // 実写角切りチャーシュー (28個)
    this.onionParticles = []; // 実写小口切り長ネギ (38個)
    this.oilSparks = [];    // パチパチ弾ける油の微細気泡
    this.soyBubbles = [];   // 鍋肌醤油のキャラメル沸騰泡
    this.steamParticles = []; // 立ち上る湯気・鑊気（ウォックヘイ）の白煙

    // 実写テクスチャ画像とベイク済み高精細スプライトキャッシュ
    this.textures = {};
    this.sprites = {
      riceWhite: [],
      riceEgg: [],
      riceGolden: [],
      riceToasted: [],
      eggCurds: [],
      meatCubes: [],
      onionRings: [],
      wokCutout: null
    };

    // センサー＆ポインター追跡
    this.lastTossDetectTime = 0;
    this.isPointerDown = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
    this.lastPointerTime = 0;
    this.sensorActive = false;

    // レイアウト座標
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.wokCenterX = 0;
    this.wokCenterY = 0;
    this.wokRadiusPx = 150;

    // FPS計測
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.fpsTimer = 0;

    this.init();
  }

  init() {
    this.handleResize();
    this.buildInitialSteam();
    this.loadPhotorealTextures();
    this.bindEvents();
    this.resetGame();
    this.startGame();
    requestAnimationFrame((t) => this.animate(t));
  }

  // --- 実写テクスチャ読み込み ＆ フォトリアル切り抜きスプライト生成 ---
  loadPhotorealTextures() {
    const sources = {
      wokEmpty: 'textures/wok_empty_fpv.jpg',
      wokSurface: 'textures/wok_diffuse.jpg',
      rice: 'textures/rice_diffuse.jpg',
      egg: 'textures/egg_diffuse.jpg',
      meat: 'textures/meat_diffuse.jpg',
      onion: 'textures/onion_diffuse.jpg'
    };

    // テクスチャロード完了前でも即座に描画できるようプロシージャル高精細スプライトを先行生成
    this.bakePhotorealSprites();

    Object.entries(sources).forEach(([key, url]) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        this.textures[key] = img;
        if (key === 'wokEmpty') {
          this.bakeWokCutout(img);
        } else {
          this.bakePhotorealSprites();
        }
      };
      img.src = url;
    });
  }

  // 空の打ち出し中華鍋＋木柄（wok_empty_fpv.jpg: 1024x1024）から
  // 1) 固定される「業務用ガスコンロ＆強火バーナー背景 (stoveBg)」と
  // 2) スマホの動きで1:1に動く「打ち出し中華鍋＋木柄 (wokCutout)」の2レイヤーを分離生成
  bakeWokCutout(img) {
    const size = 1024;

    // --- A. 可動中華鍋＋木柄レイヤー (wokCutout) ---
    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    const c = off.getContext('2d');

    c.save();
    c.beginPath();
    c.arc(511, 458, 373, 0, Math.PI * 2);
    c.rect(456, 800, 96, 224);
    c.clip();
    c.drawImage(img, 0, 0, size, size);
    c.restore();

    // 鍋の金属リムの立体ハイライト
    c.strokeStyle = 'rgba(255, 250, 240, 0.32)';
    c.lineWidth = 3.5;
    c.beginPath();
    c.arc(511, 458, 371, 0, Math.PI * 2);
    c.stroke();

    this.sprites.wokCutout = off;

    // --- B. 固定コンロ＆バーナー火口背景レイヤー (stoveBg) ---
    // 鍋が大きく動いても下に元の鍋の縁が二重に見えないよう、鍋の下に火口と五徳を描画
    const bg = document.createElement('canvas');
    bg.width = size;
    bg.height = size;
    const bc = bg.getContext('2d');

    bc.drawImage(img, 0, 0, size, size);

    // 下部ステンレス天板の柄の影部分をクリーンなステンレス質感で補完
    const steelGrad = bc.createLinearGradient(420, 845, 590, 845);
    steelGrad.addColorStop(0, '#9a9d9e');
    steelGrad.addColorStop(0.5, '#b8babc');
    steelGrad.addColorStop(1, '#8c8f91');
    bc.fillStyle = steelGrad;
    bc.fillRect(445, 845, 118, 179);

    // 鍋の下に隠れている強火バーナー火口と五徳の放射フレーム
    const pitGrad = bc.createRadialGradient(511, 458, 40, 511, 458, 382);
    pitGrad.addColorStop(0, '#090b10');
    pitGrad.addColorStop(0.55, '#101520');
    pitGrad.addColorStop(0.82, '#1b3b68');
    pitGrad.addColorStop(0.93, '#e86f2c');
    pitGrad.addColorStop(1, 'rgba(20, 22, 28, 0)');
    bc.fillStyle = pitGrad;
    bc.beginPath();
    bc.arc(511, 458, 382, 0, Math.PI * 2);
    bc.fill();

    // 五徳の鋳鉄クロスバー
    bc.strokeStyle = '#18191c';
    bc.lineWidth = 22;
    for (let a = 0; a < 4; a++) {
      const ang = (a * Math.PI) / 4;
      bc.beginPath();
      bc.moveTo(511 - Math.cos(ang) * 380, 458 - Math.sin(ang) * 380);
      bc.lineTo(511 + Math.cos(ang) * 380, 458 + Math.sin(ang) * 380);
      bc.stroke();
    }

    this.sprites.stoveBg = bg;
  }

  // 実写マクロ写真から米粒・半熟炒り卵・焼豚・長ネギのリアル切り抜きスプライトをベイク
  bakePhotorealSprites() {
    this.sprites.riceWhite = [];
    this.sprites.riceEgg = [];
    this.sprites.riceGolden = [];
    this.sprites.riceToasted = [];
    this.sprites.eggCurds = [];
    this.sprites.meatCubes = [];
    this.sprites.onionRings = [];

    // 1. 米粒スプライト（4段階の調理状態 × 6バリエーション）
    const states = [
      { key: 'riceWhite', base: '#fcfaf2',mid: '#f2ede0', edge: '#d8cfb8', glow: 'rgba(255,255,255,0.92)', tint: null },
      { key: 'riceEgg', base: '#fff3b8', mid: '#f7dc78', edge: '#d9b23b', glow: 'rgba(255,255,240,0.95)', tint: 'rgba(255, 225, 95, 0.36)' },
      { key: 'riceGolden', base: '#ffec9e', mid: '#f2c755', edge: '#c98a22', glow: 'rgba(255,252,230,0.95)', tint: 'rgba(245, 180, 45, 0.42)' },
      { key: 'riceToasted', base: '#d99b52', mid: '#b56e28', edge: '#753d10', glow: 'rgba(255,220,170,0.8)', tint: 'rgba(145, 70, 18, 0.55)' }
    ];

    states.forEach((st) => {
      for (let v = 0; v < 6; v++) {
        const w = 28, h = 18;
        const cv = document.createElement('canvas');
        cv.width = w;
        cv.height = h;
        const c = cv.getContext('2d');

        c.save();
        c.translate(w / 2, h / 2);
        // 日本米（ジャポニカ米）のふっくらした楕円粒形状
        c.beginPath();
        c.ellipse(0, 0, 10.5, 5.8, 0, 0, Math.PI * 2);
        c.closePath();
        c.clip();

        if (this.textures.rice) {
          // 実写米テクスチャからランダムな領域をサンプリングして自然な陰影・焦げ目を付与
          const sx = (v * 137) % Math.max(1, this.textures.rice.width - 64);
          const sy = (v * 211) % Math.max(1, this.textures.rice.height - 64);
          c.drawImage(this.textures.rice, sx, sy, 48, 32, -12, -8, 24, 16);
          // 明るさと透明感のある米肌ブレンド
          const grad = c.createRadialGradient(-2, -1.5, 1, 0, 0, 11);
          grad.addColorStop(0, st.base);
          grad.addColorStop(0.65, st.mid);
          grad.addColorStop(1, st.edge);
          c.globalAlpha = st.key === 'riceWhite' ? 0.78 : 0.62;
          c.fillStyle = grad;
          c.fillRect(-12, -8, 24, 16);
          c.globalAlpha = 1.0;
          if (st.tint) {
            c.fillStyle = st.tint;
            c.fillRect(-12, -8, 24, 16);
          }
        } else {
          const grad = c.createRadialGradient(-2.5, -1.5, 1, 0, 0, 11);
          grad.addColorStop(0, st.base);
          grad.addColorStop(0.68, st.mid);
          grad.addColorStop(1, st.edge);
          c.fillStyle = grad;
          c.fill();
        }

        // 油膜のツヤ・スペキュラハイライト（一粒一粒が油をまとって輝く）
        c.fillStyle = st.glow;
        c.beginPath();
        c.ellipse(-3.2, -1.8, 4.2, 1.4, -0.15, 0, Math.PI * 2);
        c.fill();

        c.restore();
        this.sprites[st.key].push(cv);
      }
    });

    // 2. ふんわり半熟炒り卵そぼろスプライト（10バリエーション：実写egg_diffuse.jpg切り抜き）
    for (let v = 0; v < 10; v++) {
      const sz = 64;
      const cv = document.createElement('canvas');
      cv.width = sz;
      cv.height = sz;
      const c = cv.getContext('2d');

      c.save();
      c.translate(sz / 2, sz / 2);
      // 不規則でふんわりした雲形の卵そぼろ輪郭
      c.beginPath();
      const lobes = 7;
      for (let i = 0; i <= lobes * 4; i++) {
        const ang = (i / (lobes * 4)) * Math.PI * 2;
        const r = 18 + Math.sin(ang * 3 + v * 1.7) * 4.5 + Math.cos(ang * 5 - v) * 3.0;
        const px = Math.cos(ang) * r;
        const py = Math.sin(ang) * (r * 0.82);
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
      c.clip();

      if (this.textures.egg) {
        const sx = (v * 97) % Math.max(1, this.textures.egg.width - 160);
        const sy = (v * 149) % Math.max(1, this.textures.egg.height - 160);
        c.drawImage(this.textures.egg, sx, sy, 150, 150, -28, -28, 56, 56);
      } else {
        const g = c.createRadialGradient(-5, -5, 2, 0, 0, 26);
        g.addColorStop(0, '#fff9c4');
        g.addColorStop(0.5, '#ffd54f');
        g.addColorStop(1, '#e69b10');
        c.fillStyle = g;
        c.fillRect(-28, -28, 56, 56);
      }

      // 半熟の立体感と白身のレース感ハイライト
      const sheen = c.createRadialGradient(-6, -6, 2, 0, 0, 25);
      sheen.addColorStop(0, 'rgba(255, 253, 230, 0.45)');
      sheen.addColorStop(0.6, 'rgba(255, 213, 79, 0.12)');
      sheen.addColorStop(1, 'rgba(180, 105, 10, 0.35)');
      c.fillStyle = sheen;
      c.fillRect(-28, -28, 56, 56);

      c.restore();
      this.sprites.eggCurds.push(cv);
    }

    // 3. 角切りチャーシュー（焼豚）スプライト（8バリエーション：実写meat_diffuse.jpg切り抜き）
    for (let v = 0; v < 8; v++) {
      const sz = 52;
      const cv = document.createElement('canvas');
      cv.width = sz;
      cv.height = sz;
      const c = cv.getContext('2d');

      c.save();
      c.translate(sz / 2, sz / 2);
      c.beginPath();
      c.rect(-16, -15, 32, 30);
      c.closePath();
      c.clip();

      if (this.textures.meat) {
        const sx = (v * 123) % Math.max(1, this.textures.meat.width - 150);
        const sy = (v * 167) % Math.max(1, this.textures.meat.height - 150);
        c.drawImage(this.textures.meat, sx, sy, 140, 140, -18, -18, 36, 36);
      } else {
        const g = c.createLinearGradient(-16, -15, 16, 15);
        g.addColorStop(0, '#d98c5f');
        g.addColorStop(0.5, '#8c3b1e');
        g.addColorStop(1, '#4a1b0c');
        c.fillStyle = g;
        c.fillRect(-16, -15, 32, 30);
      }

      // 立体ベベル＆タレの照りハイライト
      c.strokeStyle = 'rgba(60, 20, 8, 0.65)';
      c.lineWidth = 2.5;
      c.strokeRect(-15, -14, 30, 28);

      c.fillStyle = 'rgba(255, 240, 220, 0.55)';
      c.beginPath();
      c.ellipse(-6, -6, 6, 2.2, -0.3, 0, Math.PI * 2);
      c.fill();

      c.restore();
      this.sprites.meatCubes.push(cv);
    }

    // 4. 小口切り長ネギスプライト（8バリエーション：実写onion_diffuse.jpg切り抜き）
    for (let v = 0; v < 8; v++) {
      const sz = 40;
      const cv = document.createElement('canvas');
      cv.width = sz;
      cv.height = sz;
      const c = cv.getContext('2d');

      c.save();
      c.translate(sz / 2, sz / 2);
      // 外輪と中空の輪切り形状
      c.beginPath();
      c.arc(0, 0, 12.5, 0, Math.PI * 2);
      if (v % 2 === 0) {
        c.arc(0, 0, 4.2, 0, Math.PI * 2, true);
      }
      c.closePath();
      c.clip();

      if (this.textures.onion) {
        const sx = (v * 113) % Math.max(1, this.textures.onion.width - 130);
        const sy = (v * 151) % Math.max(1, this.textures.onion.height - 130);
        c.drawImage(this.textures.onion, sx, sy, 120, 120, -15, -15, 30, 30);
      } else {
        const g = c.createRadialGradient(0, 0, 3, 0, 0, 13);
        g.addColorStop(0, '#e8f5e9');
        g.addColorStop(0.55, '#66bb6a');
        g.addColorStop(1, '#2e7d32');
        c.fillStyle = g;
        c.fillRect(-14, -14, 28, 28);
      }

      // みずみずしい断面リム
      c.strokeStyle = 'rgba(220, 255, 210, 0.6)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(0, 0, 11.5, 0, Math.PI * 2);
      c.stroke();

      c.restore();
      this.sprites.onionRings.push(cv);
    }
  }

  buildInitialSteam() {
    this.steamParticles = [];
    for (let i = 0; i < 28; i++) {
      this.steamParticles.push({
        x: (Math.random() - 0.5) * 1.1,
        y: (Math.random() - 0.5) * 1.1,
        z: Math.random() * 1.2,
        vx: (Math.random() - 0.5) * 0.15,
        vy: -0.15 - Math.random() * 0.25,
        vz: 0.35 + Math.random() * 0.45,
        size: 35 + Math.random() * 55,
        alpha: 0.08 + Math.random() * 0.12
      });
    }
  }

  // --- スマホ縦画面・PC横画面で下部ボタンと絶対に重ならないレスポンシブ配置 ---
  handleResize() {
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.floor(this.viewW * this.dpr);
    this.canvas.height = Math.floor(this.viewH * this.dpr);

    // 上部HUDと下部パレットの実測高さを取得して、その間の空き領域の中央に中華鍋を配置
    const statusBar = document.getElementById('status-bar');
    const meters = document.getElementById('meters-container');
    const palette = document.getElementById('action-palette');
    const debugPanel = document.getElementById('debug-panel');

    const topUsed = (statusBar ? statusBar.offsetHeight : 54) + (meters ? meters.offsetHeight : 36) + 10;
    const bottomUsed = (palette ? palette.offsetHeight : 148) + (debugPanel ? debugPanel.offsetHeight : 24) + 12;

    const availH = Math.max(220, this.viewH - topUsed - bottomUsed);
    const availW = this.viewW;

    this.wokCenterX = availW * 0.5;
    // 下部に木柄が伸びるため、鍋の中心を空き領域のやや上寄りに配置
    this.wokCenterY = topUsed + availH * 0.44;
    this.wokRadiusPx = Math.min(availW * 0.41, availH * 0.41);

    // 鍋肌ガイドのサイズも同期
    const rimEl = document.getElementById('rim-guide');
    if (rimEl) {
      const d = Math.round(this.wokRadiusPx * 1.75);
      rimEl.style.width = `${d}px`;
      rimEl.style.height = `${d}px`;
      rimEl.style.top = `${Math.round(this.wokCenterY)}px`;
      rimEl.style.left = `${Math.round(this.wokCenterX)}px`;
    }
  }

  // --- イベントバインディング（スマホセンサー・タッチドラッグ・キーボード） ---
  bindEvents() {
    window.addEventListener('resize', () => this.handleResize());

    // 画面上のどこをタップしても自動で音声＆iOSモーションセンサーを有効化
    const unlockAll = () => {
      this.audio.init();
      if (!this.sensorActive) {
        this.requestDevicePermissions();
      }
    };
    window.addEventListener('pointerdown', unlockAll, { passive: true });
    window.addEventListener('touchstart', unlockAll, { passive: true });

    const sensorBtn = document.getElementById('btn-enable-sensor');
    if (sensorBtn) {
      sensorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.audio.init();
        this.requestDevicePermissions();
      });
    }

    // もう一丁作る！（完全リセット＆再スタート）
    const retryBtn = document.getElementById('btn-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.audio.init();
        this.resetGame();
        this.startGame();
      });
    }

    // 具材・アクションボタン
    document.getElementById('btn-egg').addEventListener('click', () => this.addIngredient('egg'));
    document.getElementById('btn-rice').addEventListener('click', () => this.addIngredient('rice'));
    document.getElementById('btn-meat').addEventListener('click', () => this.addIngredient('meat'));
    document.getElementById('btn-greenonion').addEventListener('click', () => this.addIngredient('greenonion'));
    document.getElementById('btn-soy').addEventListener('click', () => this.addSoy());
    document.getElementById('btn-ladle').addEventListener('click', () => this.gatherLadle());

    // デバッグ・PC操作ボタン
    document.getElementById('btn-debug-toss').addEventListener('click', () => this.triggerToss(1.15));
    document.getElementById('btn-debug-flip').addEventListener('click', () => this.triggerFlip());

    // タッチ＆マウスによる直接「鍋の柄を握って振る」1:1インタラクション
    this.canvas.addEventListener('pointerdown', (e) => {
      this.isPointerDown = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.lastPointerTime = performance.now();
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isPointerDown) return;
      const now = performance.now();
      const dt = Math.max(0.008, (now - this.lastPointerTime) / 1000);
      const dx = (e.clientX - this.lastPointerX) / this.wokRadiusPx;
      const dy = (e.clientY - this.lastPointerY) / this.wokRadiusPx;

      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.lastPointerTime = now;

      // 鍋のリアルタイム移動と慣性力注入
      this.wokVx += dx * 14.0;
      this.wokVy += dy * 14.0;
      this.applyContinuousWokForce(dx / dt, dy / dt, 0);

      // 素早いスナップ操作で本格的な「あおり（小翻）」を発動
      const speed = Math.hypot(dx / dt, dy / dt);
      if (speed > 3.2 && now - this.lastTossDetectTime > 210) {
        const power = Math.min(1.6, Math.max(0.75, speed / 5.0));
        this.triggerToss(power, dx * 2.0, dy * 2.0);
        this.lastTossDetectTime = now;
      }
    });

    window.addEventListener('pointerup', () => {
      this.isPointerDown = false;
    });

    // PCキーボード操作
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.audio.init();
        this.triggerToss(1.15);
      } else if (e.code === 'KeyF') {
        this.triggerFlip();
      } else if (e.code === 'ArrowLeft') {
        this.wokVx -= 1.8;
        this.tiltX = Math.max(-0.4, this.tiltX - 0.12);
        this.applyContinuousWokForce(-4.0, 0, 0);
      } else if (e.code === 'ArrowRight') {
        this.wokVx += 1.8;
        this.tiltX = Math.min(0.4, this.tiltX + 0.12);
        this.applyContinuousWokForce(4.0, 0, 0);
      } else if (e.code === 'ArrowUp') {
        this.wokVy -= 1.8;
        this.tiltY = Math.max(-0.4, this.tiltY - 0.12);
        this.applyContinuousWokForce(0, -4.0, 0);
      } else if (e.code === 'ArrowDown') {
        this.wokVy += 1.8;
        this.tiltY = Math.min(0.4, this.tiltY + 0.12);
        this.applyContinuousWokForce(0, 4.0, 0);
      }
    });

    this.setupSensors();
  }

  async requestDevicePermissions() {
    const statusEl = document.getElementById('sensor-status');
    const banner = document.getElementById('sensor-banner');
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const res = await DeviceMotionEvent.requestPermission();
        if (res === 'granted') {
          this.sensorActive = true;
          if (statusEl) statusEl.textContent = 'センサー連動中 (スマホを振って鍋をあおれ！)';
          if (banner) setTimeout(() => banner.classList.add('hidden'), 1200);
        }
      } else {
        this.sensorActive = true;
        if (statusEl) statusEl.textContent = 'センサー連動中';
        if (banner) setTimeout(() => banner.classList.add('hidden'), 1500);
      }
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        await DeviceOrientationEvent.requestPermission();
      }
    } catch (err) {
      console.warn('Sensor permission notice:', err);
    }
  }

  // --- スマホの加速度・ジャイロと中華鍋の1:1完全シンクロ ---
  setupSensors() {
    window.addEventListener('devicemotion', (e) => {
      if (this.gameState !== 'COOKING' && this.gameState !== 'LADLED') return;

      const acc = e.acceleration || e.accelerationIncludingGravity;
      const accG = e.accelerationIncludingGravity;
      if (!acc) return;

      const ax = acc.x || 0;
      const ay = acc.y || 0;
      const az = acc.z || 0;

      const dbgAy = document.getElementById('dbg-ay');
      const dbgAz = document.getElementById('dbg-az');
      if (dbgAy) dbgAy.textContent = ay.toFixed(1);
      if (dbgAz) dbgAz.textContent = az.toFixed(1);

      // 1. 毎フレームのスマホの揺れを直接中華鍋の変位速度＆具材への慣性力に変換！
      // これにより「スマホを少し動かすだけで鍋と油と米がリアルタイムに連動して動く」没入感を実現
      this.wokVx += npClamp(ax * 0.08, -1.2, 1.2);
      this.wokVy += npClamp(-ay * 0.08, -1.2, 1.2);
      this.wokVz += npClamp(az * 0.05, -0.6, 0.8);

      this.applyContinuousWokForce(ax * 0.45, -ay * 0.45, az * 0.35);

      const now = performance.now();
      const totalShake = Math.hypot(ax, ay, az);

      // 2. 手首のスナップや振りで本格的な「鍋あおり（小翻）」を発動
      // 従来の厳しい制限を撤廃し、手前に引く・上に振る・前後にシェイクする動作すべてに高感度応答
      if (this.gameState === 'COOKING') {
        const isSnapToss = (ay < -2.0 && az > 1.6) || totalShake > 4.2;
        if (isSnapToss && now - this.lastTossDetectTime > 190) {
          const power = npClamp(totalShake / 6.0, 0.75, 1.65);
          this.triggerToss(power, ax * 0.15, -ay * 0.15);
          this.lastTossDetectTime = now;
        }
      }

      // 3. お玉まとめ後の皿盛り（スマホを返す動作または強い振り）
      if (this.gameState === 'LADLED') {
        if ((accG && accG.z < -2.5) || totalShake > 7.5) {
          this.triggerFlip();
        }
      }
    });

    // スマホの傾き（重力方向）に連動して油と具材が鍋底を滑る
    window.addEventListener('deviceorientation', (e) => {
      const gamma = e.gamma || 0; // 左右傾き (-90〜90)
      const beta = e.beta || 0;   // 前後傾き (-180〜180)

      this.tiltX = npClamp(gamma / 45.0, -0.55, 0.55);
      this.tiltY = npClamp((beta - 35) / 45.0, -0.55, 0.55);

      if (this.gameState === 'LADLED' && Math.abs(beta) > 100) {
        this.triggerFlip();
      }
    });
  }

  // --- ゲーム開始・完全リセット ---
  startGame() {
    this.gameState = 'COOKING';
    this.audio.isCooking = true;

    const startScreen = document.getElementById('start-screen');
    if (startScreen) startScreen.classList.remove('active');
    const resultScreen = document.getElementById('result-screen');
    if (resultScreen) resultScreen.classList.remove('active');

    this.timeRemaining = 45.0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.dryness = 0;
    this.heat = 38;
    this.burnAmount = 0;
    this.wokHeiActive = false;
    this.wokHeiTossCount = 0;

    // 最初は溶き卵ボタンのみ有効（空の熱々中華鍋からスタート！）
    document.getElementById('btn-egg').disabled = false;
    document.getElementById('btn-rice').disabled = true;
    document.getElementById('btn-meat').disabled = true;
    document.getElementById('btn-greenonion').disabled = true;
    document.getElementById('btn-soy').disabled = true;
    document.getElementById('btn-ladle').disabled = true;

    const dbgCount = document.getElementById('dbg-count');
    if (dbgCount) dbgCount.textContent = '0';

    this.showFeedback('熱々の油に【🥚溶き卵】を投入せよ！', '#ffca28');
  }

  resetGame() {
    for (const k in this.ingredients) this.ingredients[k] = false;
    for (const k in this.timings) this.timings[k] = 0;

    // すべての具材配列を完全に空にする（最初から何か入っている状態を100%排除）
    this.eggPool = null;
    this.eggParticles = [];
    this.riceParticles = [];
    this.meatParticles = [];
    this.onionParticles = [];
    this.oilSparks = [];
    this.soyBubbles = [];

    this.wokX = 0;
    this.wokY = 0;
    this.wokZ = 0;
    this.wokVx = 0;
    this.wokVy = 0;
    this.wokVz = 0;

    const resultScreen = document.getElementById('result-screen');
    if (resultScreen) resultScreen.classList.remove('active');
    const rimEl = document.getElementById('rim-guide');
    if (rimEl) rimEl.classList.remove('active');
    const banner = document.getElementById('wok-hei-banner');
    if (banner) banner.classList.remove('active');

    document.getElementById('time-val').textContent = '45';
    document.getElementById('meter-dryness').style.width = '0%';
    document.getElementById('val-dryness').textContent = '0%';
    document.getElementById('meter-heat').style.width = '38%';
    document.getElementById('val-heat').textContent = '38%';
    document.getElementById('combo-display').textContent = 'COMBO 0';
    document.getElementById('score-val').textContent = '0';
  }

  // --- 具材のスポーン処理 ---
  spawnEgg() {
    // 1. 鍋底の熱々オイルの上に広がる液状〜半熟卵プール
    this.eggPool = {
      radius: 0.05,
      targetRadius: 0.42,
      cookProgress: 0,
      alpha: 0.95,
      bubbles: Array.from({ length: 22 }, () => ({
        angle: Math.random() * Math.PI * 2,
        dist: 0.15 + Math.random() * 0.82,
        r: 0.02 + Math.random() * 0.035,
        phase: Math.random() * Math.PI * 2
      }))
    };

    // 2. ふんわり半熟炒り卵そぼろ塊 (56個)
    this.eggParticles = [];
    for (let i = 0; i < 56; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.38;
      this.eggParticles.push({
        kind: 'egg',
        x: Math.cos(a) * r,
        y: Math.sin(a) * r,
        z: 0.12 + Math.random() * 0.15,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        vz: 0.3 + Math.random() * 0.4,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 3.0,
        scale: 0.52 + Math.random() * 0.42,
        variant: i % Math.max(1, this.sprites.eggCurds.length)
      });
    }
    this.updateDebugCount();
  }

  spawnRice() {
    this.riceParticles = [];
    const count = 650;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      // 最初はほぐれる前のお椀型の白飯塊として中央に投入
      const r = Math.pow(Math.random(), 0.65) * 0.34;
      this.riceParticles.push({
        kind: 'rice',
        x: Math.cos(a) * r,
        y: Math.sin(a) * r,
        z: 0.18 + Math.random() * 0.28,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        vz: -0.2,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 4.0,
        scale: 0.82 + Math.random() * 0.32,
        coat: 0.0,     // 0: 白米, 0.5: 卵コーティング, 1.0: 黄金パラパラ
        toast: 0.0,    // 焦げ・香ばしさ
        variant: i % 6
      });
    }
    this.updateDebugCount();
  }

  spawnMeat() {
    this.meatParticles = [];
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.38;
      this.meatParticles.push({
        kind: 'meat',
        x: Math.cos(a) * r,
        y: Math.sin(a) * r,
        z: 0.25 + Math.random() * 0.25,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        vz: 0.2,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 3.5,
        scale: 0.62 + Math.random() * 0.28,
        variant: i % Math.max(1, this.sprites.meatCubes.length)
      });
    }
    this.updateDebugCount();
  }

  spawnOnion() {
    this.onionParticles = [];
    for (let i = 0; i < 38; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.40;
      this.onionParticles.push({
        kind: 'onion',
        x: Math.cos(a) * r,
        y: Math.sin(a) * r,
        z: 0.28 + Math.random() * 0.25,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        vz: 0.25,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 4.0,
        scale: 0.58 + Math.random() * 0.30,
        variant: i % Math.max(1, this.sprites.onionRings.length)
      });
    }
    this.updateDebugCount();
  }

  updateDebugCount() {
    const el = document.getElementById('dbg-count');
    if (el) {
      const total = this.eggParticles.length + this.riceParticles.length + this.meatParticles.length + this.onionParticles.length;
      el.textContent = String(total);
    }
  }

  // --- 調理インタラクション ---
  addIngredient(type) {
    if (this.gameState !== 'COOKING') return;
    this.audio.init();
    const elapsed = 45.0 - this.timeRemaining;

    if (type === 'egg' && !this.ingredients.egg) {
      this.ingredients.egg = true;
      this.timings.egg = elapsed;
      document.getElementById('btn-egg').disabled = true;
      document.getElementById('btn-rice').disabled = false;
      this.audio.playAdd();
      this.audio.playSoySizzle();

      this.spawnEgg();
      this.vibrate(35);
      this.showFeedback('ジュワッ！半熟のうちに【🍚ご飯】を投入せよ！', '#ffca28');
    } else if (type === 'rice' && this.ingredients.egg && !this.ingredients.rice) {
      this.ingredients.rice = true;
      this.timings.rice = elapsed;
      document.getElementById('btn-rice').disabled = true;
      document.getElementById('btn-meat').disabled = false;
      document.getElementById('btn-greenonion').disabled = false;
      document.getElementById('btn-soy').disabled = false;
      document.getElementById('btn-ladle').disabled = false;
      this.audio.playAdd();

      this.spawnRice();
      this.vibrate(45);

      const eggRiceDiff = this.timings.rice - this.timings.egg;
      if (eggRiceDiff >= 0.8 && eggRiceDiff <= 4.2) {
        this.showFeedback('黄金コーティング成功！スマホを振って鍋をあおれ！', '#00e676');
        this.addScore(800);
        this.riceParticles.forEach((p) => { p.coat = 0.45; });
      } else {
        this.showFeedback('ご飯投入！スマホを振って（またはドラッグ/Spaceで）鍋をあおれ！', '#ffb300');
      }
    } else if (type === 'meat' && this.ingredients.rice && !this.ingredients.meat) {
      this.ingredients.meat = true;
      this.timings.meat = elapsed;
      document.getElementById('btn-meat').disabled = true;
      this.audio.playAdd();

      this.spawnMeat();
      this.vibrate(30);
      this.showFeedback('秘伝チャーシュー投入！さらに鍋を振って旨味を絡めろ！', '#ff9800');
      this.addScore(400);
    } else if (type === 'greenonion' && this.ingredients.rice && !this.ingredients.greenonion) {
      this.ingredients.greenonion = true;
      this.timings.greenonion = elapsed;
      document.getElementById('btn-greenonion').disabled = true;
      this.audio.playAdd();

      this.spawnOnion();
      this.vibrate(30);
      if (this.timeRemaining <= 18.0 && this.timeRemaining >= 2.0) {
        this.showFeedback('シャキシャキ長ネギ！(PERFECT TIMING)', '#00e676');
        this.addScore(600);
      } else {
        this.showFeedback('長ネギ投入！', '#8bc34a');
        this.addScore(300);
      }
    }
  }

  addSoy() {
    if (this.gameState !== 'COOKING' || !this.ingredients.rice || this.ingredients.soy) return;
    this.audio.init();
    this.ingredients.soy = true;
    this.timings.soy = 45.0 - this.timeRemaining;
    document.getElementById('btn-soy').disabled = true;

    this.audio.playSoySizzle();
    this.vibrate([40, 30, 60]);
    this.wokHeiActive = true;
    this.wokHeiTossCount = 0;

    // 鍋肌に焦がし醤油の沸騰リングを生成
    this.soyBubbles = [];
    for (let i = 0; i < 42; i++) {
      const ang = (i / 42) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
      const dist = 0.64 + Math.random() * 0.18;
      this.soyBubbles.push({
        x: Math.cos(ang) * dist,
        y: Math.sin(ang) * dist,
        r: 4 + Math.random() * 8,
        life: 1.0
      });
    }

    // 鑊気（ウォックヘイ）の白煙を一気に立ち上らせる
    for (let i = 0; i < 20; i++) {
      this.steamParticles.push({
        x: (Math.random() - 0.5) * 0.9,
        y: (Math.random() - 0.5) * 0.9,
        z: 0.1,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.3 - Math.random() * 0.4,
        vz: 0.7 + Math.random() * 0.6,
        size: 55 + Math.random() * 65,
        alpha: 0.38,
        temp: true
      });
    }

    const banner = document.getElementById('wok-hei-banner');
    if (banner) {
      banner.classList.add('active');
      setTimeout(() => banner.classList.remove('active'), 1700);
    }

    this.showFeedback('ジュワァァッ！鍋肌醤油！今すぐ鍋を振って香りを閉じ込めろ！', '#ff5722');
  }

  gatherLadle() {
    if (this.gameState !== 'COOKING' || !this.ingredients.rice) return;
    this.audio.init();
    this.gameState = 'LADLED';
    this.ingredients.ladled = true;
    document.getElementById('btn-ladle').disabled = true;
    this.audio.playAdd();
    this.vibrate(50);

    this.showFeedback('お玉でドーム成形完了！スマホを返すか【盛る(F)】で皿へ盛れ！', '#42a5f5');
    // 2.2秒後に自動で皿盛り完了する安心設計（センサー・キーでも即発動可能）
    this.ladleCompleteTimer = 2.2;
  }

  triggerFlip() {
    if (this.gameState !== 'LADLED') return;
    this.audio.playPlating();
    this.vibrate([50, 40, 80]);
    this.finishGame();
  }

  // --- 連続鍋振り慣性力（スマホの細かな揺れに1:1で具材が反応） ---
  applyContinuousWokForce(fx, fy, fz) {
    if (!this.ingredients.egg && !this.ingredients.rice) return;
    const all = this.getAllParticles();
    const strength = 0.085;
    for (let i = 0; i < all.length; i++) {
      const p = all[i];
      p.vx += fx * strength + (Math.random() - 0.5) * 0.04;
      p.vy += fy * strength + (Math.random() - 0.5) * 0.04;
      if (fz > 0.2) {
        p.vz += Math.min(0.8, fz * 0.12);
      }
      if (p.kind === 'rice' && this.ingredients.egg) {
        p.coat = Math.min(1.0, p.coat + 0.003);
      }
    }
    if (this.ingredients.rice) {
      this.dryness = Math.min(100, this.dryness + Math.hypot(fx, fy) * 0.015);
    }
  }

  // --- 本格鍋あおり（小翻：具材の波が奥から手前へ3D宙返りして鍋中央に戻る） ---
  triggerToss(power = 1.0, dirX = 0, dirY = -1) {
    if (this.gameState !== 'COOKING') return;
    if (!this.ingredients.egg && !this.ingredients.rice) {
      // 空鍋でも鍋自体はリアルに跳ねる
      this.wokVy -= 0.85 * power;
      this.wokVz += 0.65 * power;
      this.audio.playToss(power * 0.7);
      this.vibrate(25);
      return;
    }

    this.audio.playToss(power);
    this.vibrate(35);

    // 鍋自体のダイナミックな突き出し＆引き戻しリフトモーション
    this.wokVx += npClamp(dirX * 0.4, -0.8, 0.8);
    this.wokVy -= 1.15 * power;
    this.wokVz = Math.min(1.0, this.wokVz + 0.78 * power);

    const now = performance.now();
    if (this.ingredients.rice) {
      if (this.lastTossTime > 0) {
        const interval = (now - this.lastTossTime) / 1000;
        if (interval >= 0.22 && interval <= 0.55) {
          this.combo++;
          if (this.combo > this.maxCombo) this.maxCombo = this.combo;
          this.addScore(160 * Math.min(this.combo, 10));
          this.showFeedback(`絶品あおり！ (${this.combo} COMBO)`, '#00e676');
          this.dryness = Math.min(100, this.dryness + 4.8);
        } else {
          this.combo = 1;
          this.addScore(100);
          this.showFeedback('ナイスあおり！リズミカルに振れ！', '#ffca28');
          this.dryness = Math.min(100, this.dryness + 2.8);
        }
      } else {
        this.combo = 1;
        this.dryness = Math.min(100, this.dryness + 3.0);
      }
      this.lastTossTime = now;
    }

    if (this.wokHeiActive) {
      this.wokHeiTossCount++;
      if (this.wokHeiTossCount <= 4) {
        this.addScore(450);
        this.showFeedback(`鑊気コーティング！ (+450)`, '#ff7043');
      }
    }

    // 放熱（焦げ防止）
    this.heat = Math.max(22, this.heat - 12 * power);

    // 卵プールをそぼろへほぐす
    if (this.eggPool) {
      this.eggPool.alpha = Math.max(0.15, this.eggPool.alpha - 0.22);
    }

    // 全具材粒子に「奥の鍋肌を駆け上がって手前空中へ舞い上がり、鍋底中央へ戻る」放物線速度を付与！
    const all = this.getAllParticles();
    const liftBase = npClamp(1.85 * power, 1.35, 2.55);

    for (let i = 0; i < all.length; i++) {
      const p = all[i];
      // 現在の位置から中央〜やや手前へ返ってくる水平速度（吹っ飛びを100%防止しつつ豪快に舞う）
      const targetX = (Math.random() - 0.5) * 0.42;
      const targetY = (Math.random() - 0.5) * 0.42 + 0.08;
      const flightTime = (2.0 * liftBase) / 9.8;

      p.vx = ((targetX - p.x) / flightTime) + (Math.random() - 0.5) * 0.45;
      p.vy = ((targetY - p.y) / flightTime) - 0.35 + (Math.random() - 0.5) * 0.45;
      p.vz = liftBase * (0.78 + Math.random() * 0.42);
      p.vrot = (Math.random() - 0.5) * 10.0;

      if (p.kind === 'rice') {
        p.coat = Math.min(1.0, p.coat + 0.14 * power);
        if (this.ingredients.soy) {
          p.toast = Math.min(0.65, p.toast + 0.12);
        }
      }
    }
  }

  getAllParticles() {
    return [
      ...this.eggParticles,
      ...this.riceParticles,
      ...this.meatParticles,
      ...this.onionParticles
    ];
  }

  vibrate(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (_) {}
  }

  showFeedback(text, color = '#ffca28') {
    const el = document.getElementById('toss-feedback');
    if (el) {
      el.textContent = text;
      el.style.color = color;
    }
  }

  addScore(pts) {
    this.score = Math.max(0, this.score + pts);
    const el = document.getElementById('score-val');
    if (el) el.textContent = String(this.score);
  }

  // --- メイン物理＆調理更新ループ ---
  animate(now) {
    requestAnimationFrame((t) => this.animate(t));

    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.045);
    this.lastFrameTime = now;

    // FPS計測
    this.frameCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      const fpsEl = document.getElementById('dbg-fps');
      if (fpsEl) fpsEl.textContent = String(Math.round(this.frameCount / this.fpsTimer));
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    this.updatePhysicsAndCooking(dt, now);
    this.renderPhotorealScene(now);
  }

  updatePhysicsAndCooking(dt, now) {
    // 1. 中華鍋自体のバネ・ダンパー運動更新（手首の自然な反動）
    const springK = 28.0;
    const damping = 7.5;
    this.wokVx += (-springK * this.wokX - damping * this.wokVx) * dt;
    this.wokVy += (-springK * this.wokY - damping * this.wokVy) * dt;
    this.wokVz += (-springK * 1.4 * this.wokZ - damping * 1.2 * this.wokVz) * dt;

    this.wokX = npClamp(this.wokX + this.wokVx * dt, -0.55, 0.55);
    this.wokY = npClamp(this.wokY + this.wokVy * dt, -0.55, 0.55);
    this.wokZ = npClamp(this.wokZ + this.wokVz * dt, 0.0, 0.95);

    // 2. 調理タイマーと熱力学更新
    if (this.gameState === 'COOKING') {
      this.timeRemaining -= dt;
      if (this.timeRemaining <= 0) {
        this.timeRemaining = 0;
        this.finishGame();
        return;
      }
      document.getElementById('time-val').textContent = String(Math.ceil(this.timeRemaining));

      this.heat = Math.min(100, this.heat + 8.8 * dt);
      if (this.heat > 86 && this.ingredients.rice) {
        this.burnAmount += dt * 2.2;
      }

      document.getElementById('meter-dryness').style.width = `${Math.min(100, this.dryness)}%`;
      document.getElementById('val-dryness').textContent = `${Math.round(this.dryness)}%`;
      document.getElementById('meter-heat').style.width = `${Math.min(100, this.heat)}%`;
      document.getElementById('val-heat').textContent = `${Math.round(this.heat)}%`;
      document.getElementById('combo-display').textContent = `COMBO ${this.combo}`;

      const rimEl = document.getElementById('rim-guide');
      if (rimEl) {
        if (this.timeRemaining <= 16.0 && this.timeRemaining >= 3.0 && this.ingredients.rice && !this.ingredients.soy) {
          rimEl.classList.add('active');
        } else {
          rimEl.classList.remove('active');
        }
      }
    } else if (this.gameState === 'LADLED') {
      this.ladleCompleteTimer -= dt;
      if (this.ladleCompleteTimer <= 0) {
        this.triggerFlip();
        return;
      }
    }

    // 3. 液状〜半熟卵プールのアニメーション
    if (this.eggPool) {
      this.eggPool.radius += (this.eggPool.targetRadius - this.eggPool.radius) * Math.min(1, dt * 6.0);
      this.eggPool.cookProgress = Math.min(1.0, this.eggPool.cookProgress + dt * 0.25);
    }

    // 4. 鍋肌醤油の泡アニメーション
    for (let i = this.soyBubbles.length - 1; i >= 0; i--) {
      this.soyBubbles[i].life -= dt * 0.45;
      if (this.soyBubbles[i].life <= 0) this.soyBubbles.splice(i, 1);
    }

    // 5. 全具材粒子の3D放物面ボウル物理シミュレーション
    const all = this.getAllParticles();
    const gravity = 9.8;
    const bowlCurvature = 0.42;
    let landingCount = 0;

    for (let i = 0; i < all.length; i++) {
      const p = all[i];

      if (this.gameState === 'LADLED') {
        // お玉の中央ドームへ綺麗に凝集
        const targetR = 0.24;
        const dist = Math.hypot(p.x, p.y);
        if (dist > targetR) {
          p.x *= (1 - dt * 6.0);
          p.y *= (1 - dt * 6.0);
        } else {
          p.x += (0 - p.x) * dt * 2.5;
          p.y += (0 - p.y) * dt * 2.5;
        }
        p.z = Math.max(0.05, (targetR * targetR - (p.x * p.x + p.y * p.y)) * 1.2);
        p.vx = 0;
        p.vy = 0;
        p.vz = 0;
        continue;
      }

      // 空中落下と水平移動
      p.vz -= gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rot += p.vrot * dt;

      const rSq = p.x * p.x + p.y * p.y;
      const bowlSurfaceZ = bowlCurvature * rSq;

      // 鍋底・鍋肌との接触判定
      if (p.z <= bowlSurfaceZ) {
        if (p.vz < -1.1) {
          landingCount++;
        }
        p.z = bowlSurfaceZ;
        p.vz = Math.abs(p.vz) * 0.16;

        // 放物面の傾斜による中心への復元力 ＋ スマホの傾き(tiltX, tiltY)による滑り力
        const slopeForce = 2.6;
        p.vx += (-p.x * slopeForce + this.tiltX * 2.2 - this.wokVx * 0.35) * dt;
        p.vy += (-p.y * slopeForce + this.tiltY * 2.2 - this.wokVy * 0.35) * dt;

        // 適度な油の摩擦減衰
        const dampingFactor = Math.pow(0.18, dt);
        p.vx *= dampingFactor;
        p.vy *= dampingFactor;
        p.vrot *= dampingFactor;

        // 鍋底での加熱による黄金メイラード進行（黒焦げにはしない）
        if (p.kind === 'rice' && this.heat > 85) {
          p.toast = Math.min(1.0, p.toast + dt * 0.025);
        }
      }

      // 鍋の縁（半径 0.72）から外へ飛び出さない絶対クランプ（吹っ飛び防止）
      const dist = Math.sqrt(rSq);
      const maxR = 0.68;
      if (dist > maxR) {
        const nx = p.x / dist;
        const ny = p.y / dist;
        p.x = nx * maxR * 0.96;
        p.y = ny * maxR * 0.96;
        const dot = p.vx * nx + p.vy * ny;
        if (dot > 0) {
          p.vx -= 1.5 * dot * nx;
          p.vy -= 1.5 * dot * ny;
        }
        // 縁に当たった勢いで少し浮き上がって中央へ返る（本物の中華鍋の返し形状）
        p.vz = Math.max(p.vz, 0.35);
      }
    }

    if (landingCount > 0 && Math.random() < 0.45) {
      this.audio.playCollision(Math.min(4.5, 1.2 + landingCount * 0.15));
    }

    const wokSpeed = Math.hypot(this.wokVx, this.wokVy, this.wokVz);
    this.audio.updateSizzle(this.heat, all.length, wokSpeed);

    // 6. 湯気・煙パーティクルの更新
    for (let i = this.steamParticles.length - 1; i >= 0; i--) {
      const s = this.steamParticles[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      if (s.temp) {
        s.alpha -= dt * 0.22;
        if (s.alpha <= 0) {
          this.steamParticles.splice(i, 1);
        }
      } else if (s.z > 1.5) {
        s.x = (Math.random() - 0.5) * 0.85;
        s.y = (Math.random() - 0.5) * 0.85;
        s.z = 0.05;
      }
    }
  }

  // --- フォトリアル・マルチレイヤー描画パイプライン ---
  renderPhotorealScene(now) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const dpr = this.dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    const cx = this.wokCenterX;
    const cy = this.wokCenterY;
    const R = this.wokRadiusPx;

    // 背景クリア（重厚な業務用厨房の暗色ステンレス調）
    ctx.fillStyle = '#0d0e12';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    // 画像描画スケール: wok_empty_fpv.jpg (1024x1024) における鍋半径は 370px
    const imgSize = (R / 370) * 1024;
    const imgLeft = cx - (511 / 1024) * imgSize;
    const imgTop = cy - (458 / 1024) * imgSize;

    // =========================================================================
    // LAYER 1: 固定された業務用ガスコンロ・五徳・強火ブルー＆オレンジ炎レイヤー
    // =========================================================================
    const bgSource = this.sprites.stoveBg || this.textures.wokEmpty;
    if (bgSource) {
      ctx.drawImage(bgSource, imgLeft, imgTop, imgSize, imgSize);
    } else {
      // フォールバック五徳描画
      const bgGrad = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.5);
      bgGrad.addColorStop(0, '#1a2436');
      bgGrad.addColorStop(0.7, '#14161d');
      bgGrad.addColorStop(1, '#090a0d');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }

    // 強火ガスバーナーの動的揺らぎ発光エフェクト（熱量に応じて炎が脈動）
    const flamePulse = 0.75 + 0.25 * Math.sin(now * 0.024) * Math.cos(now * 0.017);
    const heatRatio = this.heat / 100;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const flameGrad = ctx.createRadialGradient(cx, cy, R * 0.82, cx, cy, R * 1.22);
    flameGrad.addColorStop(0, `rgba(0, 170, 255, ${0.32 * flamePulse})`);
    flameGrad.addColorStop(0.55, `rgba(255, 110, 20, ${0.38 * heatRatio * flamePulse})`);
    flameGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // =========================================================================
    // LAYER 2: スマホの動きに1:1で連動して動く「実写打ち出し中華鍋＋木柄」レイヤー
    // =========================================================================
    const wokShiftX = (this.wokX * 0.42 + this.tiltX * 0.22) * R;
    const wokShiftY = (this.wokY * 0.42 + this.tiltY * 0.22) * R;
    const wokScale = 1.0 + this.wokZ * 0.14;

    ctx.save();
    ctx.translate(cx + wokShiftX, cy + wokShiftY);
    ctx.scale(wokScale, wokScale);

    // 鍋が動いた際にコンロ上に落ちるリアルなドロップシャドウ
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.arc(-wokShiftX * 0.35, 10 + this.wokZ * 18, R * 1.01, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (this.sprites.wokCutout) {
      const cutLeft = -(511 / 1024) * imgSize;
      const cutTop = -(458 / 1024) * imgSize;
      ctx.drawImage(this.sprites.wokCutout, cutLeft, cutTop, imgSize, imgSize);
    } else {
      // テクスチャロード完了前の高精細鉄鍋フォールバック
      const wokGrad = ctx.createRadialGradient(-R * 0.2, -R * 0.2, R * 0.1, 0, 0, R);
      wokGrad.addColorStop(0, '#2c2926');
      wokGrad.addColorStop(0.55, '#1c1b1a');
      wokGrad.addColorStop(0.92, '#111112');
      wokGrad.addColorStop(1, '#555558');
      ctx.fillStyle = wokGrad;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fill();
    }

    // 鍋底の熱せられた油溜まり（スマホの傾きに応じてオイルのハイライトがヌルッと移動！）
    const oilOffsetX = this.tiltX * R * 0.28;
    const oilOffsetY = this.tiltY * R * 0.28;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const oilGrad = ctx.createRadialGradient(
      oilOffsetX - R * 0.12,
      oilOffsetY - R * 0.12,
      R * 0.04,
      oilOffsetX,
      oilOffsetY,
      R * 0.48
    );
    oilGrad.addColorStop(0, 'rgba(255, 245, 210, 0.22)');
    oilGrad.addColorStop(0.45, 'rgba(255, 190, 90, 0.08)');
    oilGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = oilGrad;
    ctx.beginPath();
    ctx.arc(oilOffsetX, oilOffsetY, R * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // =========================================================================
    // LAYER 3: 鍋底の溶き卵ジュワッ演出 ＆ 鍋肌焦がし醤油リング
    // =========================================================================
    if (this.eggPool && this.eggPool.alpha > 0.02) {
      ctx.save();
      ctx.globalAlpha = this.eggPool.alpha;
      const pr = this.eggPool.radius * R;

      // 白身のレース状の縁
      const eggEdgeGrad = ctx.createRadialGradient(0, 0, pr * 0.2, 0, 0, pr * 1.08);
      eggEdgeGrad.addColorStop(0, '#ffd54f');
      eggEdgeGrad.addColorStop(0.65, '#ffca28');
      eggEdgeGrad.addColorStop(0.88, '#fffde7');
      eggEdgeGrad.addColorStop(1, 'rgba(255, 253, 231, 0)');
      ctx.fillStyle = eggEdgeGrad;
      ctx.beginPath();
      ctx.arc(oilOffsetX * 0.4, oilOffsetY * 0.4, pr * 1.08, 0, Math.PI * 2);
      ctx.fill();

      // ジュワジュワ膨らむ半熟気泡
      this.eggPool.bubbles.forEach((b) => {
        const bx = oilOffsetX * 0.4 + Math.cos(b.angle) * (b.dist * pr);
        const by = oilOffsetY * 0.4 + Math.sin(b.angle) * (b.dist * pr);
        const br = b.r * R * (0.85 + 0.25 * Math.sin(now * 0.015 + b.phase));
        ctx.fillStyle = 'rgba(255, 248, 200, 0.75)';
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    // 鍋肌醤油の香ばしいキャラメル沸騰泡
    if (this.soyBubbles.length > 0) {
      ctx.save();
      this.soyBubbles.forEach((sb) => {
        ctx.fillStyle = `rgba(165, 75, 20, ${sb.life * 0.75})`;
        ctx.beginPath();
        ctx.arc(sb.x * R, sb.y * R, sb.r * (1.2 - sb.life * 0.3), 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(255, 195, 110, ${sb.life * 0.65})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      });
      ctx.restore();
    }

    // =========================================================================
    // LAYER 4: 3Dソートされた実写具材パーティクル（米650粒・卵56個・肉28個・ネギ38個）
    // =========================================================================
    const all = this.getAllParticles();
    if (all.length > 0) {
      // 低い粒子から高い粒子（空中を舞う粒子）の順にZソートして立体的な重なりを表現
      all.sort((a, b) => a.z - b.z);

      // 4-A. 鍋肌に落ちるソフトドロップシャドウを一括描画
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      for (let i = 0; i < all.length; i += 2) {
        const p = all[i];
        const airHeight = Math.max(0, p.z - 0.38 * (p.x * p.x + p.y * p.y));
        const sx = p.x * R + airHeight * 14;
        const sy = p.y * R + airHeight * 22 + 3;
        const sr = (p.kind === 'rice' ? 4.5 : 9.5) * p.scale;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 4-B. 実写切り抜きスプライトの3D遠近投影描画
      for (let i = 0; i < all.length; i++) {
        const p = all[i];
        const airHeight = Math.max(0, p.z - 0.38 * (p.x * p.x + p.y * p.y));
        // 空中に舞い上がった具材ほどカメラに近づき大きく見える3D透視投影
        const perspective = 1.0 + airHeight * 0.52;
        const px = p.x * R;
        const py = p.y * R - airHeight * 38;
        const sc = p.scale * perspective * (R / 175);

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(p.rot);
        ctx.scale(sc, sc);

        if (p.kind === 'rice') {
          let spriteList = this.sprites.riceWhite;
          if (p.toast > 0.65) {
            spriteList = this.sprites.riceToasted;
          } else if (p.coat > 0.65 || this.dryness > 50) {
            spriteList = this.sprites.riceGolden;
          } else if (p.coat > 0.18 || this.ingredients.egg) {
            spriteList = this.sprites.riceEgg;
          }
          const sp = spriteList[p.variant % spriteList.length];
          if (sp) ctx.drawImage(sp, -14, -9);
        } else if (p.kind === 'egg') {
          const sp = this.sprites.eggCurds[p.variant % this.sprites.eggCurds.length];
          if (sp) ctx.drawImage(sp, -32, -32);
        } else if (p.kind === 'meat') {
          const sp = this.sprites.meatCubes[p.variant % this.sprites.meatCubes.length];
          if (sp) ctx.drawImage(sp, -26, -26);
        } else if (p.kind === 'onion') {
          const sp = this.sprites.onionRings[p.variant % this.sprites.onionRings.length];
          if (sp) ctx.drawImage(sp, -20, -20);
        }

        ctx.restore();
      }
    }

    // お玉まとめ時のステンレス中華お玉ドーム演出
    if (this.gameState === 'LADLED') {
      ctx.save();
      const ladleR = R * 0.32;
      const ladleGrad = ctx.createRadialGradient(-ladleR * 0.3, -ladleR * 0.3, ladleR * 0.1, 0, 0, ladleR);
      ladleGrad.addColorStop(0, 'rgba(240, 245, 255, 0.55)');
      ladleGrad.addColorStop(0.6, 'rgba(160, 175, 190, 0.35)');
      ladleGrad.addColorStop(1, 'rgba(70, 80, 95, 0.75)');
      ctx.fillStyle = ladleGrad;
      ctx.beginPath();
      ctx.arc(0, 0, ladleR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }

    // =========================================================================
    // LAYER 5: 立ち上る湯気・鑊気（ウォックヘイ）のリアル白煙エフェクト
    // =========================================================================
    ctx.save();
    for (let i = 0; i < this.steamParticles.length; i++) {
      const s = this.steamParticles[i];
      const sx = s.x * R;
      const sy = s.y * R - s.z * 42;
      const sr = s.size * (0.8 + s.z * 0.7) * (R / 180);
      const fade = Math.sin(npClamp(s.z / 1.5, 0, 1) * Math.PI);
      const alpha = s.alpha * fade;
      if (alpha <= 0.01) continue;

      const sGrad = ctx.createRadialGradient(sx, sy, 2, sx, sy, sr);
      sGrad.addColorStop(0, `rgba(255, 252, 245, ${alpha})`);
      sGrad.addColorStop(0.5, `rgba(235, 240, 248, ${alpha * 0.45})`);
      sGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = sGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.restore(); // LAYER 2 (Wok Transform) 終了
    ctx.restore(); // DPR Scale 終了
  }

  // --- ゲーム終了・スコア審査 ---
  finishGame() {
    this.gameState = 'RESULT';
    this.audio.isCooking = false;
    if (this.audio.sizzleGain && this.audio.ctx) {
      this.audio.sizzleGain.gain.setTargetAtTime(0, this.audio.ctx.currentTime, 0.05);
    }

    const drynessScore = Math.round(Math.min(25, (this.dryness / 100) * 25));

    let heatScore = 20;
    if (this.burnAmount > 6) {
      heatScore = Math.max(5, 20 - Math.round((this.burnAmount - 6) * 1.2));
    }

    let coatingScore = 15;
    if (!this.ingredients.egg || !this.ingredients.rice) {
      coatingScore = 0;
    } else {
      const diff = this.timings.rice - this.timings.egg;
      if (diff < 0.6 || diff > 5.0) coatingScore = 9;
    }

    let timingScore = 15;
    if (!this.ingredients.greenonion) timingScore -= 7;
    if (!this.ingredients.meat) timingScore -= 6;

    let wokheiScore = 0;
    if (this.ingredients.soy) {
      wokheiScore = Math.min(15, 7 + this.wokHeiTossCount * 3);
    }

    const platingScore = this.ingredients.ladled ? 10 : 4;
    const totalScore = Math.min(100, drynessScore + heatScore + coatingScore + timingScore + wokheiScore + platingScore);

    document.getElementById('score-dryness').textContent = `${drynessScore} / 25`;
    document.getElementById('score-heat').textContent = `${heatScore} / 20`;
    document.getElementById('score-coating').textContent = `${coatingScore} / 15`;
    document.getElementById('score-timing').textContent = `${timingScore} / 15`;
    document.getElementById('score-wokhei').textContent = `${wokheiScore} / 15`;
    document.getElementById('score-plating').textContent = `${platingScore} / 10`;
    document.getElementById('result-score').textContent = `${totalScore} / 100`;

    let rank = 'C';
    let title = '見習いコック';
    let comment = '「まずは卵・ご飯・焼豚・ネギ・鍋肌醤油をテンポよく入れて鍋を振るんじゃ！」';

    if (totalScore >= 90) {
      rank = 'S';
      title = '町中華の生ける伝説';
      comment = '「完璧だ…！米一粒一粒に黄金の卵が宿り、鑊気が突き抜ける至高の一皿！」';
    } else if (totalScore >= 75) {
      rank = 'A';
      title = '一流中華の料理長';
      comment = '「見事なパラパラ感と香ばしさ！鍋振りの手首の返しも板についておる！」';
    } else if (totalScore >= 58) {
      rank = 'B';
      title = '一人前の料理人';
      comment = '「うまい！次は鍋肌醤油のあとに素早く鍋をあおって香りを閉じ込めよう。」';
    }

    document.getElementById('result-rank').textContent = rank;
    document.getElementById('result-title').textContent = title;
    document.getElementById('chef-comment').textContent = comment;

    document.getElementById('result-screen').classList.add('active');
  }
}

function npClamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// --- 確実な起動（DOMContentLoadedの発火前後どちらでも100%即座に起動） ---
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    window.__chahanGame = new GokuChahanPhotoreal();
  });
} else {
  window.__chahanGame = new GokuChahanPhotoreal();
}
