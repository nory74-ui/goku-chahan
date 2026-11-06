const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// PNGエンコーダー（RGBA 8bit）
function encodePNG(width, height, rgbaBuffer) {
  const IHDR = Buffer.alloc(13);
  IHDR.writeUInt32BE(width, 0);
  IHDR.writeUInt32BE(height, 4);
  IHDR.writeUInt8(8, 8);  // bit depth
  IHDR.writeUInt8(6, 9);  // color type 6: RGBA
  IHDR.writeUInt8(0, 10); // compression
  IHDR.writeUInt8(0, 11); // filter
  IHDR.writeUInt8(0, 12); // interlace

  const rowSize = width * 4;
  const rawData = Buffer.alloc(height * (rowSize + 1));
  for (let y = 0; y < height; y++) {
    rawData[y * (rowSize + 1)] = 0; // filter type 0 (None)
    rgbaBuffer.copy(rawData, y * (rowSize + 1) + 1, y * rowSize, (y + 1) * rowSize);
  }

  const IDAT = zlib.deflateSync(rawData);

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(8 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    const crc = crc32(buf.slice(4, 8 + len));
    buf.writeInt32BE(crc, 8 + len);
    return buf;
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrChunk = makeChunk('IHDR', IHDR);
  const idatChunk = makeChunk('IDAT', IDAT);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return (c ^ 0xffffffff) | 0;
}

const OUT_DIR = '/Users/nryktnk/.gemini/antigravity/scratch/GokuChahanUnity/Assets/Textures';

// 1. 打出し中華鍋のハンマー痕ノーマルマップ (512x512)
{
  const W = 512, H = 512;
  const rgba = Buffer.alloc(W * H * 4);
  const heightMap = new Float32Array(W * H);

  // ボロノイ風のハンマー痕生成
  const numDents = 180;
  const dents = [];
  for (let i = 0; i < numDents; i++) {
    dents.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 16 + Math.random() * 24,
      depth: 0.15 + Math.random() * 0.25
    });
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let h = 0;
      for (const d of dents) {
        let dx = Math.abs(x - d.x);
        let dy = Math.abs(y - d.y);
        if (dx > W / 2) dx = W - dx;
        if (dy > H / 2) dy = H - dy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < d.r) {
          const t = dist / d.r;
          h -= (1 - t * t) * (1 - t * t) * d.depth;
        }
      }
      // 微小ノイズ
      h += (Math.random() - 0.5) * 0.015;
      heightMap[y * W + x] = h;
    }
  }

  // 法線ベクトル (Sobelフィルタ)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ym = (y - 1 + H) % H, yp = (y + 1) % H;
      const xm = (x - 1 + W) % W, xp = (x + 1) % W;

      const dzdx = (heightMap[y * W + xp] - heightMap[y * W + xm]) * 3.5;
      const dzdy = (heightMap[yp * W + x] - heightMap[ym * W + x]) * 3.5;

      let nx = -dzdx;
      let ny = -dzdy;
      let nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len; ny /= len; nz /= len;

      const idx = (y * W + x) * 4;
      rgba[idx + 0] = Math.floor((nx * 0.5 + 0.5) * 255);
      rgba[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
      rgba[idx + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
      rgba[idx + 3] = 255;
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, 'wok_hammer_normal.png'), encodePNG(W, H, rgba));
}

// 2. 鍋肌の油膜・カーボン粗さマスク (512x512)
{
  const W = 512, H = 512;
  const rgba = Buffer.alloc(W * H * 4);
  const cx = W / 2, cy = H / 2;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / cx;
      const dy = (y - cy) / cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 中心部（鍋底）：油が焼き付いてツルツル（粗さ 0.18〜0.25）
      // 外周部（縁）：油が炭化して少しザラッとしたカーボン層（粗さ 0.55〜0.70）
      let roughness = 0.20 + Math.pow(dist, 1.8) * 0.50;
      // 微細な焼き付きムラ
      roughness += (Math.random() - 0.5) * 0.06;
      roughness = Math.max(0, Math.min(1, roughness));

      // 金属度 (中心は90%、外周は70%)
      let metallic = 0.92 - dist * 0.22;
      metallic = Math.max(0, Math.min(1, metallic));

      const idx = (y * W + x) * 4;
      rgba[idx + 0] = Math.floor(roughness * 255); // R: Roughness
      rgba[idx + 1] = Math.floor(metallic * 255);  // G: Metallic
      rgba[idx + 2] = 255;                         // B: AO
      rgba[idx + 3] = 255;
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, 'wok_mask.png'), encodePNG(W, H, rgba));
}

console.log('PBR textures generated successfully in Assets/Textures!');
