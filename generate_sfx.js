const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;

function createWavBuffer(samples) {
  const numSamples = samples.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // audioFormat (1 for PCM)
  buffer.writeUInt16LE(1, 22);  // numChannels (1: mono)
  buffer.writeUInt32LE(SAMPLE_RATE, 24); // sampleRate
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byteRate
  buffer.writeUInt16LE(2, 32);  // blockAlign
  buffer.writeUInt16LE(16, 34); // bitsPerSample

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const intVal = s < 0 ? s * 32768 : s * 32767;
    buffer.writeInt16LE(Math.floor(intVal), 44 + i * 2);
  }

  return buffer;
}

const OUT_DIR = '/Users/nryktnk/.gemini/antigravity/scratch/GokuChahanUnity/Assets/Audio';

// 1. toss.wav (金属の煽り音 0.25秒)
{
  const duration = 0.25;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 14);
    const freq = 340 * Math.exp(-t * 6);
    const metal = Math.sin(2 * Math.PI * freq * t) + 0.5 * Math.sin(2 * Math.PI * freq * 2.3 * t);
    const noise = (Math.random() * 2 - 1) * 0.4;
    samples[i] = (metal * 0.6 + noise * 0.4) * env * 0.8;
  }
  fs.writeFileSync(path.join(OUT_DIR, 'toss.wav'), createWavBuffer(samples));
}

// 2. sizzle.wav (炒める音 1.0秒)
{
  const duration = 1.0;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const noise = Math.random() * 2 - 1;
    // クラックル（パチパチ音）
    const crackle = Math.random() < 0.006 ? (Math.random() * 2 - 1) * 1.8 : 0;
    samples[i] = (noise * 0.25 + crackle * 0.75) * 0.5;
  }
  fs.writeFileSync(path.join(OUT_DIR, 'sizzle.wav'), createWavBuffer(samples));
}

// 3. add.wav (具材投入音 0.15秒)
{
  const duration = 0.15;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 22);
    const freq = 520 + t * 1200;
    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.6;
  }
  fs.writeFileSync(path.join(OUT_DIR, 'add.wav'), createWavBuffer(samples));
}

// 4. soy.wav (醤油のジュワーッ！ 0.8秒)
{
  const duration = 0.8;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const env = t < 0.05 ? t / 0.05 : Math.exp(-(t - 0.05) * 4);
    const noise = Math.random() * 2 - 1;
    samples[i] = noise * env * 0.85;
  }
  fs.writeFileSync(path.join(OUT_DIR, 'soy.wav'), createWavBuffer(samples));
}

// 5. plating.wav (皿盛り パカッ！ 0.35秒)
{
  const duration = 0.35;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 12);
    const freq = 180 * Math.exp(-t * 8);
    const thud = Math.sin(2 * Math.PI * freq * t);
    const click = t < 0.02 ? (Math.random() * 2 - 1) * 0.8 : 0;
    samples[i] = (thud * 0.7 + click * 0.3) * env * 0.9;
  }
  fs.writeFileSync(path.join(OUT_DIR, 'plating.wav'), createWavBuffer(samples));
}

// 6. wokhei.wav (鑊気覚醒！ 1.2秒)
{
  const duration = 1.2;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const env = t < 0.1 ? t / 0.1 : Math.exp(-(t - 0.1) * 3);
    const bass = Math.sin(2 * Math.PI * 65 * t);
    const noise = Math.random() * 2 - 1;
    const gong = Math.sin(2 * Math.PI * 587 * t) * Math.exp(-t * 2.5);
    samples[i] = (bass * 0.4 + noise * 0.35 + gong * 0.35) * env * 0.9;
  }
  fs.writeFileSync(path.join(OUT_DIR, 'wokhei.wav'), createWavBuffer(samples));
}

console.log('Successfully generated all WAV sound effects in Assets/Audio!');
