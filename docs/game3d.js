/**
 * 極・炒飯道 3D (Goku Chahandou 3D)
 * Three.js (3D Graphics) × Rapier.js (WASM Physics) × Web Audio API (Dynamic Sound)
 */

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

// --- 1. Web Audio API 音響エンジン ---
class ChahanAudioEngine {
  constructor() {
    this.ctx = null;
    this.sizzleGain = null;
    this.sizzleFilter = null;
    this.isCooking = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.setupSizzleLoop();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 常時流れる炒めノイズ（ホワイトノイズ＋クラックル）
  setupSizzleLoop() {
    const bufferSize = this.ctx.sampleRate * 2.0;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      const crackle = Math.random() < 0.005 ? (Math.random() * 2 - 1) * 2.5 : 0;
      data[i] = white * 0.35 + crackle * 0.65;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    this.sizzleFilter = this.ctx.createBiquadFilter();
    this.sizzleFilter.type = 'bandpass';
    this.sizzleFilter.frequency.value = 1600;
    this.sizzleFilter.Q.value = 1.2;

    this.sizzleGain = this.ctx.createGain();
    this.sizzleGain.gain.value = 0.0;

    noiseSource.connect(this.sizzleFilter);
    this.sizzleFilter.connect(this.sizzleGain);
    this.sizzleGain.connect(this.ctx.destination);
    noiseSource.start();
  }

  // 鍋底の米粒接触数と熱量に応じたシズル音の動的変化
  updateSizzle(heat, touchingGrains) {
    if (!this.sizzleGain || !this.isCooking) return;
    const intensity = Math.min(1.0, touchingGrains / 60);
    const targetVol = (heat / 100) * 0.55 * intensity;
    this.sizzleGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.08);

    // 熱量が高いほど高周波のパチパチ音にシフト
    const targetFreq = 1200 + (heat / 100) * 1800;
    this.sizzleFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
  }

  // 米粒が鍋肌に当たった時の「ジャッ！」「チリッ！」衝突音（音割れ防止サンプリング）
  playCollision(impactSpeed) {
    if (!this.ctx || impactSpeed < 0.8) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280 + Math.random() * 200, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.06);

    const vol = Math.min(0.25, (impactSpeed / 6.0) * 0.25);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // 煽り音（金属の「シャン！」＋風切り音）
  playToss(power) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(130, now + 0.22);

    gain.gain.setValueAtTime(0.35 * power, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  // 具材投入音
  playAdd() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(1040, now + 0.12);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // 鍋肌醤油の激しい気化音（ジュワァァッ！）
  playSoySizzle() {
    if (!this.ctx) return;
    const duration = 0.9;
    const now = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.9;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    source.start(now);
  }

  // 皿盛りパカッ！音
  playPlating() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.3);
    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  }
}

// --- 2. メイン3Dシミュレーション クラス ---
class GokuChahan3D {
  constructor() {
    this.canvas = document.getElementById('three-canvas');
    this.audio = new ChahanAudioEngine();

    this.gameState = 'START'; // START, COOKING, LADLED, RESULT
    this.timeRemaining = 45.0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;

    // 熱力学パラメーター
    this.dryness = 0;    // 0〜100 (パラパラ度)
    this.heat = 30;      // 0〜100 (鍋底熱量)
    this.burnAmount = 0; // 焦げ蓄積
    this.lastTossTime = 0;

    // 具材フラグ
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

    // Three.js & Rapier コア
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.world = null;

    // 剛体・メッシュ
    this.wokMesh = null;
    this.wokRigidBody = null;
    this.wokRadius = 1.6;
    this.wokDepth = 0.85;

    // 米粒（InstancedMesh + RigidBodies）
    this.riceCount = 240;
    this.riceInstancedMesh = null;
    this.riceBodies = [];
    this.riceBurnTimers = new Float32Array(this.riceCount);

    // 具材メッシュ・剛体
    this.meatCount = 20;
    this.meatInstancedMesh = null;
    this.meatBodies = [];
    this.meatSpawned = false;

    this.onionCount = 25;
    this.onionInstancedMesh = null;
    this.onionBodies = [];
    this.onionSpawned = false;

    // 湯気・煙パーティクル
    this.smokeSystem = null;
    this.smokeParticles = [];

    // センサー＆キー入力
    this.lastAccelY = 0;
    this.lastAccelZ = 0;
    this.lastTossDetectTime = 0;
    this.wokTiltX = 0;
    this.wokTiltZ = 0;

    // FPS計測
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.fpsTimer = 0;

    this.init();
  }

  async init() {
    // 1. Rapier WASM 初期化
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });

    // 2. Three.js シーン・カメラ・レンダラー初期化
    this.setupThreeScene();

    // 3. 中華鍋（放物面メッシュ ＋ Trimeshコライダー）構築
    this.buildWok();

    // 4. 米粒＆具材（InstancedMesh ＋ 剛体）初期化
    this.buildRiceAndIngredients();

    // 5. 湯気・煙パーティクル構築
    this.buildSmokeSystem();

    // 6. 入力イベント＆センサー設定
    this.bindEvents();

    // 7. レンダリングループ開始
    this.animate();
  }

  setupThreeScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0b0e);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 50);
    this.setupCameraForAspect();

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // ライティング
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffaed, 2.0);
    dirLight.position.set(2, 6, 3);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    this.scene.add(dirLight);

    // 鍋底のコンロ熱（オレンジの赤熱グロー）
    this.stoveLight = new THREE.PointLight(0xff3d00, 1.2, 4.0);
    this.stoveLight.position.set(0, 0.05, 0);
    this.scene.add(this.stoveLight);
  }

  // スマホ・タブレット縦画面で中華鍋全体が収まり、下部ボタンと重ならないカメラ調整
  setupCameraForAspect() {
    if (!this.camera) return;
    const aspect = window.innerWidth / window.innerHeight;
    this.camera.aspect = aspect;

    if (aspect < 1.0) {
      // スマホ・タブレット縦画面 (9:16 〜 3:4)
      // 横幅に合わせてFOVを拡張し、注視点を奥にシフトして下部ボタンエリアと中華鍋を完全分離
      const targetFov = 50 / aspect * 0.56;
      this.camera.fov = Math.min(68, Math.max(48, targetFov));
      this.camera.position.set(0, 4.6, 1.9);
      this.camera.lookAt(0, 0.2, 0.40);
    } else {
      // PC・横画面
      this.camera.fov = 48;
      this.camera.position.set(0, 3.4, 2.3);
      this.camera.lookAt(0, 0.2, 0);
    }
    this.camera.updateProjectionMatrix();
  }

  // --- 中華鍋の放物面メッシュ ＆ Trimesh コライダー構築 ---
  buildWok() {
    const R = this.wokRadius;
    const H = this.wokDepth;
    const radialSegs = 36;
    const heightSegs = 20;

    const vertices = [];
    const indices = [];
    const uvs = [];

    // 放物面幾何学：y = (H / R^2) * r^2
    const curvature = H / (R * R);

    for (let h = 0; h <= heightSegs; h++) {
      const rNorm = h / heightSegs;
      const r = rNorm * R;
      const y = curvature * (r * r);

      for (let s = 0; s <= radialSegs; s++) {
        const theta = (s / radialSegs) * Math.PI * 2;
        const x = Math.cos(theta) * r;
        const z = Math.sin(theta) * r;

        vertices.push(x, y, z);
        uvs.push(s / radialSegs, h / heightSegs);
      }
    }

    for (let h = 0; h < heightSegs; h++) {
      for (let s = 0; s < radialSegs; s++) {
        const first = h * (radialSegs + 1) + s;
        const second = first + radialSegs + 1;

        // 内側が見えるインデックス順
        indices.push(first, first + 1, second);
        indices.push(second, first + 1, second + 1);
      }
    }

    const wokGeom = new THREE.BufferGeometry();
    wokGeom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    wokGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    wokGeom.setIndex(indices);
    wokGeom.computeVertexNormals();

    const texLoader = new THREE.TextureLoader();
    const wokTex = texLoader.load('textures/wok_diffuse.jpg');
    wokTex.wrapS = THREE.RepeatWrapping;
    wokTex.wrapT = THREE.RepeatWrapping;

    // 黒光りする鋳鉄PBRマテリアル (実写シーズニングテクスチャ適用)
    const wokMat = new THREE.MeshStandardMaterial({
      map: wokTex,
      roughness: 0.28,
      metalness: 0.88,
      side: THREE.DoubleSide
    });

    this.wokMesh = new THREE.Mesh(wokGeom, wokMat);
    this.wokMesh.receiveShadow = true;
    this.scene.add(this.wokMesh);

    // 木製ハンドル（手前）
    const handleGeom = new THREE.CylinderGeometry(0.06, 0.08, 0.7, 16);
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0x4a2e18,
      roughness: 0.45,
      metalness: 0.05
    });
    const handle = new THREE.Mesh(handleGeom, handleMat);
    handle.rotation.x = Math.PI / 2.3;
    handle.position.set(0, 0.35, R + 0.35);
    this.wokMesh.add(handle);

    // Rapier Trimesh コライダー（お椀型の当たり判定）
    const float32Verts = new Float32Array(vertices);
    const uint32Indices = new Uint32Array(indices);
    const wokColliderDesc = RAPIER.ColliderDesc.trimesh(float32Verts, uint32Indices);

    // 物理特性：油でヌルッと滑る低摩擦(0.08) ＋ 跳ねすぎない反発(0.18)
    wokColliderDesc.setFriction(0.08);
    wokColliderDesc.setRestitution(0.18);

    const wokBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
    this.wokRigidBody = this.world.createRigidBody(wokBodyDesc);
    this.world.createCollider(wokColliderDesc, this.wokRigidBody);
  }

  // --- 米粒 ＆ 具材の剛体初期化 ---
  buildRiceAndIngredients() {
    const texLoader = new THREE.TextureLoader();
    const riceTex = texLoader.load('textures/rice_diffuse.jpg');
    const meatTex = texLoader.load('textures/meat_diffuse.jpg');
    const onionTex = texLoader.load('textures/onion_diffuse.jpg');

    // 1. 米粒 InstancedMesh (240粒)
    const riceGeom = new THREE.SphereGeometry(0.045, 8, 8);
    riceGeom.scale(1.0, 0.75, 1.35); // 米粒の細長い形状

    const riceMat = new THREE.MeshStandardMaterial({
      map: riceTex,
      roughness: 0.32,
      metalness: 0.08
    });

    this.riceInstancedMesh = new THREE.InstancedMesh(riceGeom, riceMat, this.riceCount);
    this.riceInstancedMesh.castShadow = true;
    this.riceInstancedMesh.receiveShadow = true;
    this.riceInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.riceInstancedMesh);

    const dummy = new THREE.Object3D();
    const defaultColor = new THREE.Color(0xffffff);

    for (let i = 0; i < this.riceCount; i++) {
      // 鍋の底周辺にランダム配置
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * (this.wokRadius * 0.38);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = (this.wokDepth / (this.wokRadius * this.wokRadius)) * (r * r) + 0.05 + Math.random() * 0.15;

      const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setLinearDamping(0.15)
        .setAngularDamping(0.25);

      const body = this.world.createRigidBody(bodyDesc);
      body.setEnabled(false); // 初期は非アクティブ（ご飯投入で有効化）

      // 球体コライダーで高速・滑らかに滑る
      const colliderDesc = RAPIER.ColliderDesc.ball(0.045)
        .setFriction(0.08)
        .setRestitution(0.18);
      this.world.createCollider(colliderDesc, body);

      this.riceBodies.push(body);
      this.riceBurnTimers[i] = 0;

      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      this.riceInstancedMesh.setMatrixAt(i, dummy.matrix);
      this.riceInstancedMesh.setColorAt(i, defaultColor);
    }
    this.riceInstancedMesh.instanceMatrix.needsUpdate = true;
    this.riceInstancedMesh.instanceColor.needsUpdate = true;
    this.riceInstancedMesh.visible = false;

    // 2. チャーシュー InstancedMesh (20個)
    const meatGeom = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    const meatMat = new THREE.MeshStandardMaterial({
      map: meatTex,
      roughness: 0.45,
      metalness: 0.05
    });
    this.meatInstancedMesh = new THREE.InstancedMesh(meatGeom, meatMat, this.meatCount);
    this.meatInstancedMesh.castShadow = true;
    this.meatInstancedMesh.visible = false;
    this.scene.add(this.meatInstancedMesh);

    for (let i = 0; i < this.meatCount; i++) {
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 5, 0);
      const body = this.world.createRigidBody(bodyDesc);
      body.setEnabled(false);
      const colliderDesc = RAPIER.ColliderDesc.cuboid(0.045, 0.045, 0.045)
        .setFriction(0.12)
        .setRestitution(0.2);
      this.world.createCollider(colliderDesc, body);
      this.meatBodies.push(body);
    }

    // 3. 長ネギ InstancedMesh (25個)
    const onionGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10);
    const onionMat = new THREE.MeshStandardMaterial({
      map: onionTex,
      roughness: 0.5,
      metalness: 0.0
    });
    this.onionInstancedMesh = new THREE.InstancedMesh(onionGeom, onionMat, this.onionCount);
    this.onionInstancedMesh.castShadow = true;
    this.onionInstancedMesh.visible = false;
    this.scene.add(this.onionInstancedMesh);

    for (let i = 0; i < this.onionCount; i++) {
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 5, 0);
      const body = this.world.createRigidBody(bodyDesc);
      body.setEnabled(false);
      const colliderDesc = RAPIER.ColliderDesc.cylinder(0.025, 0.05)
        .setFriction(0.1)
        .setRestitution(0.22);
      this.world.createCollider(colliderDesc, body);
      this.onionBodies.push(body);
    }
  }

  // --- 湯気・煙パーティクル ---
  buildSmokeSystem() {
    const particleCount = 80;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const alphas = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 0.8;
      positions[i * 3 + 1] = Math.random() * 1.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
      alphas[i] = Math.random();

      this.smokeParticles.push({
        x: positions[i * 3 + 0],
        y: positions[i * 3 + 1],
        z: positions[i * 3 + 2],
        vy: 0.4 + Math.random() * 0.6,
        alpha: alphas[i]
      });
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.12,
      transparent: true,
      opacity: 0.25,
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    this.smokeSystem = new THREE.Points(geom, mat);
    this.scene.add(this.smokeSystem);
  }

  // --- 入力イベント（センサー ＆ キーボード） ---
  bindEvents() {
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.setupCameraForAspect();
    });

    // スタートボタン
    document.getElementById('btn-start').addEventListener('click', () => {
      this.audio.init();
      this.requestDevicePermissions().then(() => {
        this.startGame();
      });
    });

    // リトライ
    document.getElementById('btn-retry').addEventListener('click', () => {
      this.resetGame();
      this.startGame();
    });

    // 具材ボタン
    document.getElementById('btn-egg').addEventListener('click', () => this.addIngredient('egg'));
    document.getElementById('btn-rice').addEventListener('click', () => this.addIngredient('rice'));
    document.getElementById('btn-meat').addEventListener('click', () => this.addIngredient('meat'));
    document.getElementById('btn-greenonion').addEventListener('click', () => this.addIngredient('greenonion'));
    document.getElementById('btn-soy').addEventListener('click', () => this.addSoy());
    document.getElementById('btn-ladle').addEventListener('click', () => this.gatherLadle());

    // デバッグボタン
    document.getElementById('btn-debug-toss').addEventListener('click', () => this.triggerToss(1.0));
    document.getElementById('btn-debug-flip').addEventListener('click', () => this.triggerFlip());

    // PCキーボード操作
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.triggerToss(1.0);
      } else if (e.code === 'KeyF') {
        this.triggerFlip();
      } else if (e.code === 'ArrowLeft') {
        this.wokTiltZ = Math.min(0.25, this.wokTiltZ + 0.08);
      } else if (e.code === 'ArrowRight') {
        this.wokTiltZ = Math.max(-0.25, this.wokTiltZ - 0.08);
      } else if (e.code === 'ArrowUp') {
        this.wokTiltX = Math.max(-0.25, this.wokTiltX - 0.08);
      } else if (e.code === 'ArrowDown') {
        this.wokTiltX = Math.min(0.25, this.wokTiltX + 0.08);
      }
    });

    // モーションセンサー監視
    this.setupSensors();
  }

  async requestDevicePermissions() {
    const statusEl = document.getElementById('sensor-status');
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const response = await DeviceMotionEvent.requestPermission();
        if (response === 'granted') {
          statusEl.textContent = 'センサー許可済み (iOS)';
        }
      } catch (err) {
        console.warn('Sensor permission error:', err);
      }
    }
  }

  setupSensors() {
    window.addEventListener('devicemotion', (e) => {
      if (this.gameState !== 'COOKING' && this.gameState !== 'LADLED') return;

      const acc = e.acceleration || e.accelerationIncludingGravity;
      const accG = e.accelerationIncludingGravity;
      if (!acc) return;

      const ay = acc.y || 0;
      const az = acc.z || 0;

      document.getElementById('dbg-ay').textContent = ay.toFixed(1);
      document.getElementById('dbg-az').textContent = az.toFixed(1);

      const now = performance.now();

      // 手首のスナップ判定：手前に引く(-ay) ＋ 上へ持ち上げる(+az)
      if (this.gameState === 'COOKING') {
        if (ay < -2.6 && az > 2.4) {
          if (now - this.lastTossDetectTime > 230) {
            const power = Math.min(2.2, Math.max(0.7, (Math.abs(ay) + Math.abs(az)) / 7.5));
            this.triggerToss(power);
            this.lastTossDetectTime = now;
          }
        }
      }

      // お玉まとめ後のひっくり返し判定（Z軸重力反転）
      if (this.gameState === 'LADLED' && accG) {
        if (accG.z < -3.5) {
          this.triggerFlip();
        }
      }

      this.lastAccelY = ay;
      this.lastAccelZ = az;
    });

    window.addEventListener('deviceorientation', (e) => {
      const pitch = e.beta || 0;
      if (this.gameState === 'LADLED' && Math.abs(pitch) > 105) {
        this.triggerFlip();
      }
    });
  }

  startGame() {
    this.gameState = 'COOKING';
    this.audio.isCooking = true;
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

    document.getElementById('btn-egg').disabled = false;
    document.getElementById('btn-rice').disabled = true;
    document.getElementById('btn-meat').disabled = true;
    document.getElementById('btn-greenonion').disabled = true;
    document.getElementById('btn-soy').disabled = true;
    document.getElementById('btn-ladle').disabled = true;

    this.showFeedback('熱々の油に卵を投入せよ！', '#ffca28');
  }

  resetGame() {
    for (const key in this.ingredients) this.ingredients[key] = false;
    this.meatSpawned = false;
    this.onionSpawned = false;
    this.riceInstancedMesh.visible = false;
    this.meatInstancedMesh.visible = false;
    this.onionInstancedMesh.visible = false;

    // 剛体のリセット
    this.riceBodies.forEach((body, i) => {
      body.setEnabled(false);
      this.riceBurnTimers[i] = 0;
    });
    this.meatBodies.forEach(body => body.setEnabled(false));
    this.onionBodies.forEach(body => body.setEnabled(false));
  }

  // --- 調理インタラクション ---
  addIngredient(type) {
    if (this.gameState !== 'COOKING') return;
    const elapsed = 45.0 - this.timeRemaining;

    if (type === 'egg' && !this.ingredients.egg) {
      this.ingredients.egg = true;
      this.timings.egg = elapsed;
      document.getElementById('btn-egg').disabled = true;
      document.getElementById('btn-rice').disabled = false;
      this.audio.playAdd();
      this.audio.playSoySizzle();
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
      this.audio.playAdd();

      // 米粒の物理剛体を一斉にアクティブ化
      this.riceInstancedMesh.visible = true;
      const eggRiceDiff = this.timings.rice - this.timings.egg;
      const isCoatingPerfect = (eggRiceDiff >= 1.2 && eggRiceDiff <= 3.2);

      this.riceBodies.forEach((body) => {
        body.setEnabled(true);
        body.setLinvel({ x: (Math.random() - 0.5) * 0.4, y: 0.5, z: (Math.random() - 0.5) * 0.4 }, true);
      });

      if (isCoatingPerfect) {
        this.showFeedback('黄金コーティング成功！(PERFECT)', '#00e676');
        this.addScore(800);
      } else {
        this.showFeedback('米投入！鍋をあおってほぐせ！', '#ffb300');
      }
    }
    else if (type === 'meat' && this.ingredients.rice && !this.ingredients.meat) {
      this.ingredients.meat = true;
      this.timings.meat = elapsed;
      document.getElementById('btn-meat').disabled = true;
      this.audio.playAdd();

      this.meatSpawned = true;
      this.meatInstancedMesh.visible = true;
      this.meatBodies.forEach((body) => {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * (this.wokRadius * 0.4);
        body.setTranslation({ x: Math.cos(a) * r, y: 0.6, z: Math.sin(a) * r }, true);
        body.setEnabled(true);
        body.setLinvel({ x: (Math.random() - 0.5) * 0.5, y: 1.0, z: (Math.random() - 0.5) * 0.5 }, true);
      });
      this.showFeedback('チャーシュー投入！', '#ff9800');
    }
    else if (type === 'greenonion' && this.ingredients.rice && !this.ingredients.greenonion) {
      this.ingredients.greenonion = true;
      this.timings.greenonion = elapsed;
      document.getElementById('btn-greenonion').disabled = true;
      this.audio.playAdd();

      this.onionSpawned = true;
      this.onionInstancedMesh.visible = true;
      this.onionBodies.forEach((body) => {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * (this.wokRadius * 0.4);
        body.setTranslation({ x: Math.cos(a) * r, y: 0.6, z: Math.sin(a) * r }, true);
        body.setEnabled(true);
        body.setLinvel({ x: (Math.random() - 0.5) * 0.5, y: 1.0, z: (Math.random() - 0.5) * 0.5 }, true);
      });

      if (this.timeRemaining <= 12.0 && this.timeRemaining >= 4.0) {
        this.showFeedback('シャキシャキネギ！(PERFECT)', '#00e676');
        this.addScore(600);
      } else {
        this.showFeedback('ネギ投入！', '#8bc34a');
      }
    }
  }

  addSoy() {
    if (this.gameState !== 'COOKING' || !this.ingredients.rice || this.ingredients.soy) return;
    this.ingredients.soy = true;
    this.timings.soy = 45.0 - this.timeRemaining;
    document.getElementById('btn-soy').disabled = true;

    this.audio.playSoySizzle();
    this.wokHeiActive = true;
    this.wokHeiTossCount = 0;

    const banner = document.getElementById('wok-hei-banner');
    banner.classList.add('active');
    setTimeout(() => banner.classList.remove('active'), 1600);

    // 激しい煙演出
    this.smokeSystem.material.opacity = 0.8;
    setTimeout(() => { this.smokeSystem.material.opacity = 0.25; }, 1800);

    this.showFeedback('鍋肌醤油！即座に煽って香りを閉じ込めろ！', '#ff5722');
  }

  gatherLadle() {
    if (this.gameState !== 'COOKING' || !this.ingredients.rice) return;
    this.gameState = 'LADLED';
    this.ingredients.ladled = true;
    this.audio.playAdd();

    // お玉の中心へ全剛体を引き寄せる
    this.riceBodies.forEach((body) => {
      const pos = body.translation();
      const dx = -pos.x;
      const dz = -pos.z;
      body.setLinvel({ x: dx * 2.5, y: 0.5, z: dz * 2.5 }, true);
    });

    this.showFeedback('端末をパカッと裏返して皿へ盛れ！', '#42a5f5');
  }

  triggerFlip() {
    if (this.gameState !== 'LADLED') return;
    this.audio.playPlating();
    this.finishGame();
  }

  // --- 鍋煽り物理インパルス注入（Rapier.js） ---
  triggerToss(power) {
    if (this.gameState !== 'COOKING' || !this.ingredients.rice) return;

    this.audio.playToss(power);

    const now = performance.now();
    if (this.lastTossTime > 0) {
      const interval = (now - this.lastTossTime) / 1000;
      // プロの黄金リズム（0.26秒〜0.44秒）
      if (interval >= 0.25 && interval <= 0.45) {
        this.combo++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
        this.addScore(150 * Math.min(this.combo, 10));
        this.showFeedback(`PERFECT RHYTHM! (${this.combo} COMBO)`, '#00e676');
        this.dryness = Math.min(100, this.dryness + 4.0);
      } else {
        this.combo = 0;
        this.showFeedback('GOOD TOSS!', '#ffca28');
        this.dryness = Math.min(100, this.dryness + 2.0);
      }
    } else {
      this.dryness = Math.min(100, this.dryness + 2.0);
    }
    this.lastTossTime = now;

    // 鑊気煽り判定
    if (this.wokHeiActive) {
      this.wokHeiTossCount++;
      if (this.wokHeiTossCount <= 3) this.addScore(450);
    }

    // 放熱（焦げリセット）
    this.heat = Math.max(10, this.heat - 14 * power);

    // 【物理の極意】：全剛体に「上斜め前方（手前に引きつつ奥へ放るベクトル）」のインパルスを注入！
    const liftForce = 0.22 * power;
    const forwardForce = -0.06 * power; // 手前へ引き込む

    const applyTossToBodies = (bodies) => {
      bodies.forEach((body) => {
        if (!body.isEnabled()) return;
        const currentVel = body.linvel();
        const randX = (Math.random() - 0.5) * 0.04;
        const randY = (Math.random() - 0.5) * 0.04;
        body.applyImpulse({
          x: randX,
          y: liftForce + randY,
          z: forwardForce + (Math.random() - 0.5) * 0.03
        }, true);
      });
    };

    applyTossToBodies(this.riceBodies);
    if (this.meatSpawned) applyTossToBodies(this.meatBodies);
    if (this.onionSpawned) applyTossToBodies(this.onionBodies);

    // 鍋自体のわずかな跳ね上がりアニメーション
    this.wokTiltX = -0.12 * power;
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

  // --- アニメーション＆物理ループ ---
  animate() {
    requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = now;

    // FPS計算
    this.frameCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      document.getElementById('dbg-fps').textContent = Math.round(this.frameCount / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    // 1. 調理ステート・熱伝導更新
    if (this.gameState === 'COOKING') {
      this.updateCooking(dt);
    }

    // 2. 中華鍋のキネマティック傾き更新
    this.wokTiltX = THREE.MathUtils.lerp(this.wokTiltX, 0, dt * 5.0);
    this.wokTiltZ = THREE.MathUtils.lerp(this.wokTiltZ, 0, dt * 5.0);
    const wokQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.wokTiltX, 0, this.wokTiltZ));
    this.wokMesh.quaternion.copy(wokQuat);
    this.wokRigidBody.setNextKinematicRotation(wokQuat);

    // 3. Rapier 物理ワールドのステップ実行 (WASM)
    this.world.step();

    // 4. 剛体の位置・回転を Three.js の InstancedMesh へ同期
    this.syncPhysicsToVisuals();

    // 5. 湯気パーティクルの更新
    this.updateSmoke(dt);

    // 6. レンダリング
    this.renderer.render(this.scene, this.camera);
  }

  updateCooking(dt) {
    this.timeRemaining -= dt;
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.finishGame();
      return;
    }
    document.getElementById('time-val').textContent = Math.ceil(this.timeRemaining);

    // 強火バーナーによる熱量上昇
    this.heat = Math.min(100, this.heat + 9.5 * dt);

    if (this.heat > 84) {
      this.burnAmount += dt * 3.5;
    }

    // UIメーター更新
    document.getElementById('meter-dryness').style.width = `${Math.min(100, this.dryness)}%`;
    document.getElementById('val-dryness').textContent = `${Math.round(this.dryness)}%`;
    document.getElementById('meter-heat').style.width = `${Math.min(100, this.heat)}%`;
    document.getElementById('val-heat').textContent = `${Math.round(this.heat)}%`;
    document.getElementById('combo-display').textContent = `COMBO ${this.combo}`;

    // 鍋肌ガイド
    const rimEl = document.getElementById('rim-guide');
    if (this.timeRemaining <= 12.0 && this.timeRemaining >= 4.0 && !this.ingredients.soy) {
      rimEl.classList.add('active');
    } else {
      rimEl.classList.remove('active');
    }
  }

  // --- 物理とビジュアルの同期＆動的メイラード反応 ---
  syncPhysicsToVisuals() {
    const dummy = new THREE.Object3D();
    const tempColor = new THREE.Color();
    let touchingCount = 0;

    // 米粒の同期
    if (this.ingredients.rice) {
      const isEggCoated = this.ingredients.egg;
      const isBurnt = this.burnAmount > 12;

      for (let i = 0; i < this.riceCount; i++) {
        const body = this.riceBodies[i];
        if (!body.isEnabled()) continue;

        const pos = body.translation();
        const rot = body.rotation();

        dummy.position.set(pos.x, pos.y, pos.z);
        dummy.quaternion.set(rot.x, rot.y, rot.z, rot.w);
        dummy.updateMatrix();
        this.riceInstancedMesh.setMatrixAt(i, dummy.matrix);

        // 鍋底接触判定（y < 0.18 かつ 水平移動中）
        if (pos.y < 0.18) {
          touchingCount++;
          this.riceBurnTimers[i] += 0.02;

          // 衝突音（速度に応じたサンプリング発音）
          const vel = body.linvel();
          const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
          if (speed > 1.2 && i % 18 === 0) {
            this.audio.playCollision(speed);
          }
        }

        // 動的な色の変化（生米 ➔ 卵 ➔ 黄金パラパラ ➔ 焦げ）
        const burnTime = this.riceBurnTimers[i];
        if (isBurnt || burnTime > 8.0) {
          tempColor.setHex(0x3d1308); // 焦げ黒褐色
        } else if (this.dryness > 55) {
          tempColor.setHex(0xffb703); // 黄金パラパラ
        } else if (isEggCoated) {
          tempColor.setHex(0xffe066); // 卵イエロー
        } else {
          tempColor.setHex(0xf5f5ea); // 白米
        }

        this.riceInstancedMesh.setColorAt(i, tempColor);
      }
      this.riceInstancedMesh.instanceMatrix.needsUpdate = true;
      if (this.riceInstancedMesh.instanceColor) this.riceInstancedMesh.instanceColor.needsUpdate = true;
    }

    // チャーシューの同期
    if (this.meatSpawned) {
      for (let i = 0; i < this.meatCount; i++) {
        const body = this.meatBodies[i];
        if (!body.isEnabled()) continue;
        const pos = body.translation();
        const rot = body.rotation();
        dummy.position.set(pos.x, pos.y, pos.z);
        dummy.quaternion.set(rot.x, rot.y, rot.z, rot.w);
        dummy.updateMatrix();
        this.meatInstancedMesh.setMatrixAt(i, dummy.matrix);
      }
      this.meatInstancedMesh.instanceMatrix.needsUpdate = true;
    }

    // ネギの同期
    if (this.onionSpawned) {
      for (let i = 0; i < this.onionCount; i++) {
        const body = this.onionBodies[i];
        if (!body.isEnabled()) continue;
        const pos = body.translation();
        const rot = body.rotation();
        dummy.position.set(pos.x, pos.y, pos.z);
        dummy.quaternion.set(rot.x, rot.y, rot.z, rot.w);
        dummy.updateMatrix();
        this.onionInstancedMesh.setMatrixAt(i, dummy.matrix);
      }
      this.onionInstancedMesh.instanceMatrix.needsUpdate = true;
    }

    // シズル音の更新
    this.audio.updateSizzle(this.heat, touchingCount);
  }

  updateSmoke(dt) {
    if (!this.smokeSystem) return;
    const positions = this.smokeSystem.geometry.attributes.position.array;

    for (let i = 0; i < this.smokeParticles.length; i++) {
      const p = this.smokeParticles[i];
      p.y += p.vy * dt;
      if (p.y > 1.8) {
        p.y = 0.1;
        p.x = (Math.random() - 0.5) * 0.9;
        p.z = (Math.random() - 0.5) * 0.9;
      }
      positions[i * 3 + 0] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
    }
    this.smokeSystem.geometry.attributes.position.needsUpdate = true;

    // 焦げが多いときは煙を黒く
    if (this.burnAmount > 10) {
      this.smokeSystem.material.color.setHex(0x333333);
    } else {
      this.smokeSystem.material.color.setHex(0xffffff);
    }
  }

  // --- ゲーム終了・スコア判定 ---
  finishGame() {
    this.gameState = 'RESULT';
    this.audio.isCooking = false;
    if (this.audio.sizzleGain) this.audio.sizzleGain.gain.value = 0;

    // 1. パラパラ度スコア (25点)
    const drynessScore = Math.round(Math.min(25, (this.dryness / 100) * 25));

    // 2. 焼き加減スコア (20点)
    let heatScore = 20;
    if (this.burnAmount > 4) {
      heatScore = Math.max(0, 20 - Math.round(this.burnAmount * 1.5));
    }

    // 3. 卵・米コーティング (15点)
    let coatingScore = 15;
    if (!this.ingredients.egg || !this.ingredients.rice) {
      coatingScore = 0;
    } else {
      const diff = this.timings.rice - this.timings.egg;
      if (diff < 1.0 || diff > 3.8) coatingScore = 7;
    }

    // 4. 具材＆ネギ鮮度 (15点)
    let timingScore = 15;
    if (!this.ingredients.greenonion) timingScore -= 8;
    if (!this.ingredients.meat) timingScore -= 7;

    // 5. 鑊気スコア (15点)
    let wokheiScore = 0;
    if (this.ingredients.soy) {
      wokheiScore = Math.min(15, 6 + this.wokHeiTossCount * 3);
    }

    // 6. 盛り付けスコア (10点)
    const platingScore = this.ingredients.ladled ? 10 : 3;

    const totalScore = Math.min(100, drynessScore + heatScore + coatingScore + timingScore + wokheiScore + platingScore);

    // リザルトUI反映
    document.getElementById('score-dryness').textContent = `${drynessScore} / 25`;
    document.getElementById('score-heat').textContent = `${heatScore} / 20`;
    document.getElementById('score-coating').textContent = `${coatingScore} / 15`;
    document.getElementById('score-timing').textContent = `${timingScore} / 15`;
    document.getElementById('score-wokhei').textContent = `${wokheiScore} / 15`;
    document.getElementById('score-plating').textContent = `${platingScore} / 10`;
    document.getElementById('result-score').textContent = `${totalScore} / 100`;

    let rank = 'D';
    let title = 'まかない落第';
    let comment = '「ベチャベチャ（または丸焦げ）だ！修業し直してこい！」';

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

    document.getElementById('result-screen').classList.add('active');
  }
}

// 起動
window.addEventListener('DOMContentLoaded', () => {
  new GokuChahan3D();
});
