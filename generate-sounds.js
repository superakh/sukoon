/**
 * Generate ambient sound WAV files for Sukoon
 * Run: node generate-sounds.js
 * Creates 8 high-quality loopable ambient sound files in public/audio/
 */

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const DURATION = 30; // 30 seconds per sound, will loop seamlessly
const NUM_SAMPLES = SAMPLE_RATE * DURATION;

function writeWav(filename, samples) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = SAMPLE_RATE * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = samples.length * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write samples
  for (let i = 0; i < samples.length; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.floor(s * 32767), 44 + i * 2);
  }

  const outPath = path.join(__dirname, 'public', 'audio', filename);
  fs.writeFileSync(outPath, buffer);
  console.log(`  Created ${filename} (${(buffer.length / 1024).toFixed(0)} KB)`);
}

// Utility: crossfade loop edges for seamless looping
function crossfadeEdges(samples, fadeSamples = SAMPLE_RATE * 2) {
  for (let i = 0; i < fadeSamples; i++) {
    const t = i / fadeSamples;
    // Fade in from end, fade out from start
    samples[i] = samples[i] * t + samples[samples.length - fadeSamples + i] * (1 - t);
  }
  return samples;
}

// Utility: generate white noise
function noise() { return Math.random() * 2 - 1; }

// Utility: simple lowpass filter
function lowpass(samples, cutoff) {
  const rc = 1.0 / (cutoff * 2 * Math.PI);
  const dt = 1.0 / SAMPLE_RATE;
  const alpha = dt / (rc + dt);
  const out = new Float64Array(samples.length);
  out[0] = samples[0];
  for (let i = 1; i < samples.length; i++) {
    out[i] = out[i-1] + alpha * (samples[i] - out[i-1]);
  }
  return out;
}

// Utility: bandpass filter (lowpass then highpass)
function highpass(samples, cutoff) {
  const rc = 1.0 / (cutoff * 2 * Math.PI);
  const dt = 1.0 / SAMPLE_RATE;
  const alpha = rc / (rc + dt);
  const out = new Float64Array(samples.length);
  out[0] = samples[0];
  for (let i = 1; i < samples.length; i++) {
    out[i] = alpha * (out[i-1] + samples[i] - samples[i-1]);
  }
  return out;
}

function bandpass(samples, low, high) {
  return highpass(lowpass(samples, high), low);
}

// ============ RAIN ============
function generateRain() {
  console.log('Generating rain...');
  const out = new Float64Array(NUM_SAMPLES);

  // Layer 1: Constant gentle patter (filtered noise)
  const patter = new Float64Array(NUM_SAMPLES);
  for (let i = 0; i < NUM_SAMPLES; i++) patter[i] = noise();
  const patterFiltered = lowpass(patter, 3000);

  // Layer 2: Individual droplets (random impulses with decay)
  const drops = new Float64Array(NUM_SAMPLES);
  for (let i = 0; i < NUM_SAMPLES; i++) {
    if (Math.random() < 0.002) { // Random drop events
      const amp = 0.3 + Math.random() * 0.7;
      const decay = 200 + Math.floor(Math.random() * 600);
      for (let j = 0; j < decay && (i+j) < NUM_SAMPLES; j++) {
        drops[i+j] += amp * Math.exp(-j / (decay * 0.2)) * noise();
      }
    }
  }
  const dropsFiltered = bandpass(drops, 1000, 6000);

  // Layer 3: Low rumble (very low filtered noise)
  const rumble = new Float64Array(NUM_SAMPLES);
  for (let i = 0; i < NUM_SAMPLES; i++) rumble[i] = noise();
  const rumbleFiltered = lowpass(rumble, 200);

  // Mix with slow amplitude modulation
  for (let i = 0; i < NUM_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    const swell = 0.7 + 0.3 * Math.sin(t * 0.15); // Slow intensity variation
    out[i] = (patterFiltered[i] * 0.35 + dropsFiltered[i] * 0.15 + rumbleFiltered[i] * 0.12) * swell;
  }

  return crossfadeEdges(out);
}

// ============ OCEAN ============
function generateOcean() {
  console.log('Generating ocean...');
  const out = new Float64Array(NUM_SAMPLES);

  // Base noise
  const baseNoise = new Float64Array(NUM_SAMPLES);
  for (let i = 0; i < NUM_SAMPLES; i++) baseNoise[i] = noise();

  // Wave wash (lowpass noise with rhythmic amplitude)
  const wash = lowpass(baseNoise, 600);

  // Foam/hiss (higher frequency)
  const foam = bandpass(baseNoise, 1500, 5000);

  // Deep rumble
  const deep = lowpass(baseNoise, 80);

  for (let i = 0; i < NUM_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    // Multiple overlapping wave cycles at different speeds
    const wave1 = Math.pow(Math.max(0, Math.sin(t * 0.5)), 2); // ~12 sec cycle
    const wave2 = Math.pow(Math.max(0, Math.sin(t * 0.35 + 1.2)), 2); // ~18 sec cycle
    const wave3 = Math.pow(Math.max(0, Math.sin(t * 0.7 + 2.5)), 1.5); // ~9 sec cycle
    const waveEnv = (wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2);

    // Foam follows wave but slightly delayed and at higher pitch
    const foamEnv = Math.pow(Math.max(0, Math.sin(t * 0.5 - 0.8)), 3);

    out[i] = wash[i] * waveEnv * 0.5 + foam[i] * foamEnv * 0.15 + deep[i] * 0.15;
  }

  return crossfadeEdges(out);
}

// ============ BIRDS ============
function generateBirds() {
  console.log('Generating birds...');
  const out = new Float64Array(NUM_SAMPLES);

  // Generate individual bird songs using FM synthesis
  const birds = [
    { freq: 2200, modFreq: 12, modDepth: 400, chirpRate: 3.5, chirpDuty: 0.15, amp: 0.3 },
    { freq: 3100, modFreq: 8, modDepth: 600, chirpRate: 2.0, chirpDuty: 0.2, amp: 0.25 },
    { freq: 2800, modFreq: 15, modDepth: 300, chirpRate: 4.5, chirpDuty: 0.1, amp: 0.2 },
    { freq: 3800, modFreq: 6, modDepth: 800, chirpRate: 1.5, chirpDuty: 0.25, amp: 0.15 },
    { freq: 1800, modFreq: 10, modDepth: 500, chirpRate: 5.0, chirpDuty: 0.08, amp: 0.2 },
  ];

  for (const bird of birds) {
    const offset = Math.random() * Math.PI * 2;
    for (let i = 0; i < NUM_SAMPLES; i++) {
      const t = i / SAMPLE_RATE;
      // Chirp envelope (on/off pattern)
      const chirpPhase = (t * bird.chirpRate + offset) % 1;
      const chirpEnv = chirpPhase < bird.chirpDuty ?
        Math.sin(chirpPhase / bird.chirpDuty * Math.PI) : 0;

      if (chirpEnv > 0.01) {
        // FM synthesis for realistic bird sound
        const mod = Math.sin(2 * Math.PI * bird.modFreq * t) * bird.modDepth;
        const freq = bird.freq + mod + Math.sin(t * 25) * 50; // vibrato
        const sample = Math.sin(2 * Math.PI * freq * t) * chirpEnv * bird.amp;
        out[i] += sample;
      }
    }
  }

  // Add subtle ambient forest noise
  const ambient = new Float64Array(NUM_SAMPLES);
  for (let i = 0; i < NUM_SAMPLES; i++) ambient[i] = noise();
  const ambientFiltered = bandpass(ambient, 2000, 8000);
  for (let i = 0; i < NUM_SAMPLES; i++) out[i] += ambientFiltered[i] * 0.03;

  // Gentle amplitude breathing
  for (let i = 0; i < NUM_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    out[i] *= 0.7 + 0.3 * Math.sin(t * 0.1);
  }

  return crossfadeEdges(out);
}

// ============ THUNDER ============
function generateThunder() {
  console.log('Generating thunder...');
  const out = new Float64Array(NUM_SAMPLES);

  // Constant low distant rumble
  const rumble = new Float64Array(NUM_SAMPLES);
  for (let i = 0; i < NUM_SAMPLES; i++) rumble[i] = noise();
  const rumbleFiltered = lowpass(rumble, 100);
  for (let i = 0; i < NUM_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    out[i] = rumbleFiltered[i] * 0.15 * (0.6 + 0.4 * Math.sin(t * 0.08));
  }

  // Occasional thunder claps (3-5 in 30 seconds)
  const numClaps = 3 + Math.floor(Math.random() * 3);
  for (let c = 0; c < numClaps; c++) {
    const startSample = Math.floor((2 + Math.random() * 24) * SAMPLE_RATE); // Between 2-26 seconds
    const duration = Math.floor((1.5 + Math.random() * 3) * SAMPLE_RATE); // 1.5-4.5 seconds

    // Thunder clap = burst of low noise with fast attack, slow decay
    for (let i = 0; i < duration && (startSample + i) < NUM_SAMPLES; i++) {
      const env = Math.exp(-i / (duration * 0.25)); // Exponential decay
      const attack = Math.min(1, i / (SAMPLE_RATE * 0.05)); // 50ms attack
      const thunderNoise = noise();
      // Multiple frequency bands
      out[startSample + i] += thunderNoise * env * attack * 0.4;
    }
  }

  // Filter the whole thing to keep it low
  const filtered = lowpass(out, 250);

  // Add rain background
  const rain = new Float64Array(NUM_SAMPLES);
  for (let i = 0; i < NUM_SAMPLES; i++) rain[i] = noise();
  const rainFiltered = lowpass(rain, 3500);
  for (let i = 0; i < NUM_SAMPLES; i++) {
    filtered[i] += rainFiltered[i] * 0.08;
  }

  return crossfadeEdges(filtered);
}

// ============ FIREPLACE ============
function generateFire() {
  console.log('Generating fireplace...');
  const out = new Float64Array(NUM_SAMPLES);

  // Base warm crackle
  const base = new Float64Array(NUM_SAMPLES);
  for (let i = 0; i < NUM_SAMPLES; i++) base[i] = noise();
  const baseFiltered = bandpass(base, 300, 2500);

  // Random crackle pops
  for (let i = 0; i < NUM_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;

    // Base warm sound
    out[i] = baseFiltered[i] * 0.15 * (0.8 + 0.2 * Math.sin(t * 0.3));

    // Random pops and crackles
    if (Math.random() < 0.0008) { // Random pop events
      const popLen = 100 + Math.floor(Math.random() * 800);
      const popAmp = 0.2 + Math.random() * 0.5;
      for (let j = 0; j < popLen && (i+j) < NUM_SAMPLES; j++) {
        const env = Math.exp(-j / (popLen * 0.15));
        out[i+j] += noise() * env * popAmp;
      }
    }

    // Micro-crackles (very short, frequent)
    if (Math.random() < 0.005) {
      const crackLen = 20 + Math.floor(Math.random() * 100);
      const crackAmp = 0.1 + Math.random() * 0.2;
      for (let j = 0; j < crackLen && (i+j) < NUM_SAMPLES; j++) {
        out[i+j] += noise() * Math.exp(-j / (crackLen * 0.3)) * crackAmp;
      }
    }
  }

  // Warm lowpass to soften
  const filtered = lowpass(out, 4000);

  // Add low warm hum
  for (let i = 0; i < NUM_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    filtered[i] += Math.sin(t * 80) * 0.02 * (0.8 + 0.2 * Math.sin(t * 0.2));
  }

  return crossfadeEdges(filtered);
}

// ============ WIND ============
function generateWind() {
  console.log('Generating wind...');
  const out = new Float64Array(NUM_SAMPLES);

  const base = new Float64Array(NUM_SAMPLES);
  for (let i = 0; i < NUM_SAMPLES; i++) base[i] = noise();

  // Dynamic filtering - cutoff frequency changes over time (gusting)
  for (let i = 0; i < NUM_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    // Multiple slow sine waves create organic gusting pattern
    const gustEnv = 0.4 + 0.3 * Math.sin(t * 0.2) + 0.2 * Math.sin(t * 0.07 + 1) + 0.1 * Math.sin(t * 0.35 + 2);
    out[i] = base[i] * gustEnv;
  }

  // Main body lowpass
  const body = lowpass(out, 500);

  // High whistle layer
  const whistle = bandpass(base, 3000, 7000);
  for (let i = 0; i < NUM_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    const whistleEnv = Math.max(0, Math.sin(t * 0.15) * 0.5 - 0.2); // Only during strong gusts
    body[i] = body[i] * 0.4 + whistle[i] * whistleEnv * 0.05;
  }

  return crossfadeEdges(body);
}

// ============ CREEK ============
function generateCreek() {
  console.log('Generating creek...');
  const out = new Float64Array(NUM_SAMPLES);

  const base = new Float64Array(NUM_SAMPLES);
  for (let i = 0; i < NUM_SAMPLES; i++) base[i] = noise();

  // Flowing water base (mid-high bandpass)
  const flow = bandpass(base, 1000, 6000);

  // Bubbling effect (rapid amplitude modulation)
  for (let i = 0; i < NUM_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    // Multiple bubble rhythms
    const bubble1 = 0.5 + 0.5 * Math.sin(t * 18 + Math.sin(t * 3) * 2);
    const bubble2 = 0.5 + 0.5 * Math.sin(t * 12.5 + Math.sin(t * 2) * 3);
    const bubble3 = 0.5 + 0.5 * Math.sin(t * 25 + Math.sin(t * 4) * 1.5);
    const bubbleEnv = (bubble1 * 0.4 + bubble2 * 0.35 + bubble3 * 0.25);

    out[i] = flow[i] * bubbleEnv * 0.3;
  }

  // Low water flow undertone
  const lowFlow = lowpass(base, 400);
  for (let i = 0; i < NUM_SAMPLES; i++) {
    out[i] += lowFlow[i] * 0.08;
  }

  // Gentle volume breathing
  for (let i = 0; i < NUM_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    out[i] *= 0.8 + 0.2 * Math.sin(t * 0.12);
  }

  return crossfadeEdges(out);
}

// ============ CRICKETS ============
function generateCrickets() {
  console.log('Generating crickets...');
  const out = new Float64Array(NUM_SAMPLES);

  // Individual crickets using oscillators with rhythmic gating
  const crickets = [
    { freq: 4200, pulseRate: 5.2, amp: 0.15, phase: 0 },
    { freq: 4800, pulseRate: 3.8, amp: 0.12, phase: 1.5 },
    { freq: 3900, pulseRate: 6.1, amp: 0.1, phase: 3.0 },
    { freq: 5200, pulseRate: 4.5, amp: 0.08, phase: 0.7 },
    { freq: 4500, pulseRate: 7.0, amp: 0.1, phase: 2.2 },
  ];

  for (const c of crickets) {
    for (let i = 0; i < NUM_SAMPLES; i++) {
      const t = i / SAMPLE_RATE;
      // Chirp pattern: rapid on-off
      const pulse = Math.sin(2 * Math.PI * c.pulseRate * t + c.phase);
      const gate = pulse > 0.3 ? 1 : 0; // Sharp gating for chirp feel

      // The chirp tone itself
      const tone = Math.sin(2 * Math.PI * c.freq * t);

      // Slow natural breathing envelope
      const breath = 0.5 + 0.5 * Math.sin(t * 0.08 + c.phase);

      out[i] += tone * gate * c.amp * breath;
    }
  }

  // Add very soft night ambience
  const nightNoise = new Float64Array(NUM_SAMPLES);
  for (let i = 0; i < NUM_SAMPLES; i++) nightNoise[i] = noise();
  const nightFiltered = bandpass(nightNoise, 3000, 10000);
  for (let i = 0; i < NUM_SAMPLES; i++) {
    out[i] += nightFiltered[i] * 0.015;
  }

  return crossfadeEdges(out);
}

// ============ GENERATE ALL ============
console.log('\nSukoon Ambient Sound Generator');
console.log('================================\n');

const audioDir = path.join(__dirname, 'public', 'audio');
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

writeWav('rain.wav', generateRain());
writeWav('ocean.wav', generateOcean());
writeWav('birds.wav', generateBirds());
writeWav('thunder.wav', generateThunder());
writeWav('fire.wav', generateFire());
writeWav('wind.wav', generateWind());
writeWav('creek.wav', generateCreek());
writeWav('crickets.wav', generateCrickets());

console.log('\nAll 8 ambient sounds generated successfully!');
console.log('Files saved to: public/audio/\n');
