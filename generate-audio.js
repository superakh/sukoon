#!/usr/bin/env node
/**
 * Generate high-quality ambient WAV files for Sukoon
 * Each file: 60 seconds, 44100Hz, 16-bit stereo
 * Uses procedural noise + filtering for natural-sounding ambience
 */

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const DURATION = 60; // seconds
const NUM_SAMPLES = SAMPLE_RATE * DURATION;
const AUDIO_DIR = path.join(__dirname, 'public', 'audio');

// Ensure audio directory exists
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

// === UTILITIES ===
function writeWav(filename, leftChannel, rightChannel) {
    const numSamples = leftChannel.length;
    const numChannels = 2;
    const bitsPerSample = 16;
    const byteRate = SAMPLE_RATE * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = numSamples * numChannels * (bitsPerSample / 8);
    const fileSize = 36 + dataSize;

    const buffer = Buffer.alloc(44 + dataSize);
    let offset = 0;

    // RIFF header
    buffer.write('RIFF', offset); offset += 4;
    buffer.writeUInt32LE(fileSize, offset); offset += 4;
    buffer.write('WAVE', offset); offset += 4;

    // fmt chunk
    buffer.write('fmt ', offset); offset += 4;
    buffer.writeUInt32LE(16, offset); offset += 4; // chunk size
    buffer.writeUInt16LE(1, offset); offset += 2; // PCM
    buffer.writeUInt16LE(numChannels, offset); offset += 2;
    buffer.writeUInt32LE(SAMPLE_RATE, offset); offset += 4;
    buffer.writeUInt32LE(byteRate, offset); offset += 4;
    buffer.writeUInt16LE(blockAlign, offset); offset += 2;
    buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

    // data chunk
    buffer.write('data', offset); offset += 4;
    buffer.writeUInt32LE(dataSize, offset); offset += 4;

    for (let i = 0; i < numSamples; i++) {
        const l = Math.max(-1, Math.min(1, leftChannel[i]));
        const r = Math.max(-1, Math.min(1, rightChannel[i]));
        buffer.writeInt16LE(Math.round(l * 32767), offset); offset += 2;
        buffer.writeInt16LE(Math.round(r * 32767), offset); offset += 2;
    }

    const filepath = path.join(AUDIO_DIR, filename);
    fs.writeFileSync(filepath, buffer);
    const sizeMB = (buffer.length / (1024 * 1024)).toFixed(1);
    console.log(`  ✓ ${filename} (${sizeMB} MB, ${DURATION}s)`);
}

// Simple low-pass filter (one-pole)
function lowPass(samples, cutoff) {
    const rc = 1.0 / (cutoff * 2 * Math.PI);
    const dt = 1.0 / SAMPLE_RATE;
    const alpha = dt / (rc + dt);
    const out = new Float32Array(samples.length);
    out[0] = samples[0];
    for (let i = 1; i < samples.length; i++) {
        out[i] = out[i - 1] + alpha * (samples[i] - out[i - 1]);
    }
    return out;
}

// High-pass filter (one-pole)
function highPass(samples, cutoff) {
    const rc = 1.0 / (cutoff * 2 * Math.PI);
    const dt = 1.0 / SAMPLE_RATE;
    const alpha = rc / (rc + dt);
    const out = new Float32Array(samples.length);
    out[0] = samples[0];
    for (let i = 1; i < samples.length; i++) {
        out[i] = alpha * (out[i - 1] + samples[i] - samples[i - 1]);
    }
    return out;
}

// Bandpass filter
function bandPass(samples, lowCut, highCut) {
    return highPass(lowPass(samples, highCut), lowCut);
}

// White noise generator
function whiteNoise(length) {
    const out = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        out[i] = Math.random() * 2 - 1;
    }
    return out;
}

// Brown noise (integrated white noise, very smooth)
function brownNoise(length) {
    const out = new Float32Array(length);
    let last = 0;
    for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + (0.02 * white)) / 1.02;
        out[i] = last * 3.5;
    }
    return out;
}

// Pink noise (1/f noise)
function pinkNoise(length) {
    const out = new Float32Array(length);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
    }
    return out;
}

// Smooth amplitude envelope from random LFO
function lfoEnvelope(length, rate, depth, base) {
    const out = new Float32Array(length);
    const samplesPerCycle = SAMPLE_RATE / rate;
    let phase = Math.random() * Math.PI * 2;
    for (let i = 0; i < length; i++) {
        out[i] = base + depth * (0.5 + 0.5 * Math.sin(phase));
        phase += (2 * Math.PI) / samplesPerCycle;
        // Add slight randomness to rate
        phase += (Math.random() - 0.5) * 0.001;
    }
    return out;
}

// Apply fade-in/fade-out for seamless looping
function applyLoopFade(samples, fadeSamples) {
    const len = samples.length;
    for (let i = 0; i < fadeSamples; i++) {
        const t = i / fadeSamples;
        // Fade in
        samples[i] *= t;
        // Fade out
        samples[len - 1 - i] *= t;
    }
    return samples;
}

// Mix multiple arrays together
function mix(arrays, gains) {
    const len = arrays[0].length;
    const out = new Float32Array(len);
    for (let a = 0; a < arrays.length; a++) {
        const g = gains ? gains[a] : 1;
        for (let i = 0; i < len; i++) {
            out[i] += arrays[a][i] * g;
        }
    }
    return out;
}

// Apply envelope to signal
function applyEnvelope(signal, envelope) {
    const out = new Float32Array(signal.length);
    for (let i = 0; i < signal.length; i++) {
        out[i] = signal[i] * envelope[i];
    }
    return out;
}

// === SOUND GENERATORS ===

function generateRain() {
    console.log('  Generating rain...');
    // Layered approach: steady rain base + heavier drops + gentle patter

    // Layer 1: Steady rain (filtered pink noise)
    const base = pinkNoise(NUM_SAMPLES);
    const steadyL = bandPass(base, 200, 8000);
    const steadyR = bandPass(pinkNoise(NUM_SAMPLES), 200, 8000);

    // Layer 2: Heavier rain texture (white noise, narrower band)
    const heavy = bandPass(whiteNoise(NUM_SAMPLES), 1000, 6000);
    const heavyR = bandPass(whiteNoise(NUM_SAMPLES), 1000, 6000);

    // Layer 3: Very gentle low rumble (brown noise)
    const rumble = lowPass(brownNoise(NUM_SAMPLES), 200);
    const rumbleR = lowPass(brownNoise(NUM_SAMPLES), 200);

    // Gentle amplitude variation
    const env = lfoEnvelope(NUM_SAMPLES, 0.08, 0.15, 0.75);

    const left = applyEnvelope(mix([steadyL, heavy, rumble], [0.45, 0.25, 0.15]), env);
    const right = applyEnvelope(mix([steadyR, heavyR, rumbleR], [0.45, 0.25, 0.15]), env);

    applyLoopFade(left, SAMPLE_RATE * 3);
    applyLoopFade(right, SAMPLE_RATE * 3);

    writeWav('rain.wav', left, right);
}

function generateOcean() {
    console.log('  Generating ocean...');
    // Ocean: Brown noise with slow, rhythmic amplitude modulation (waves)

    const noiseL = brownNoise(NUM_SAMPLES);
    const noiseR = brownNoise(NUM_SAMPLES);

    // Filtered for ocean-like frequency content
    const filtL = bandPass(noiseL, 60, 3000);
    const filtR = bandPass(noiseR, 60, 3000);

    // High frequency "foam" layer
    const foamL = bandPass(whiteNoise(NUM_SAMPLES), 2000, 8000);
    const foamR = bandPass(whiteNoise(NUM_SAMPLES), 2000, 8000);

    // Wave rhythm: slow sine modulation (~0.1Hz = one wave every 10 seconds)
    const waveEnv = new Float32Array(NUM_SAMPLES);
    const foamEnv = new Float32Array(NUM_SAMPLES);
    let phase = 0;
    for (let i = 0; i < NUM_SAMPLES; i++) {
        // Main wave rhythm
        const wave = 0.5 + 0.5 * Math.sin(phase);
        waveEnv[i] = 0.35 + 0.55 * wave;
        // Foam peaks slightly after wave crest
        const foamPhase = phase - 0.5;
        foamEnv[i] = Math.max(0, Math.sin(foamPhase)) * 0.3;
        // Vary wave period slightly (0.08-0.12 Hz)
        const freq = 0.1 + 0.03 * Math.sin(i / SAMPLE_RATE * 0.02);
        phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    }

    const left = mix(
        [applyEnvelope(filtL, waveEnv), applyEnvelope(foamL, foamEnv)],
        [0.7, 0.2]
    );
    const right = mix(
        [applyEnvelope(filtR, waveEnv), applyEnvelope(foamR, foamEnv)],
        [0.7, 0.2]
    );

    applyLoopFade(left, SAMPLE_RATE * 3);
    applyLoopFade(right, SAMPLE_RATE * 3);

    writeWav('ocean.wav', left, right);
}

function generateBirds() {
    console.log('  Generating birds...');
    // Forest ambience: gentle background noise + synthetic bird chirps

    // Background: soft forest air (very gentle noise)
    const bgL = lowPass(pinkNoise(NUM_SAMPLES), 2000);
    const bgR = lowPass(pinkNoise(NUM_SAMPLES), 2000);

    // Bird chirps: short sine sweeps at various frequencies
    const chirpsL = new Float32Array(NUM_SAMPLES);
    const chirpsR = new Float32Array(NUM_SAMPLES);

    const birdCount = 80; // Number of chirp events in 60 seconds
    for (let b = 0; b < birdCount; b++) {
        // Random position
        const startSample = Math.floor(Math.random() * (NUM_SAMPLES - SAMPLE_RATE));
        // Bird frequency range: 2000-6000 Hz
        const baseFreq = 2000 + Math.random() * 4000;
        // Chirp type: up-sweep, down-sweep, or trill
        const type = Math.floor(Math.random() * 3);
        // Duration: 0.05-0.3 seconds
        const durSamples = Math.floor((0.05 + Math.random() * 0.25) * SAMPLE_RATE);
        // Stereo position
        const pan = Math.random(); // 0 = left, 1 = right

        for (let i = 0; i < durSamples && (startSample + i) < NUM_SAMPLES; i++) {
            const t = i / durSamples;
            // Amplitude envelope (fade in/out)
            const amp = Math.sin(t * Math.PI) * (0.08 + Math.random() * 0.04);

            let freq = baseFreq;
            if (type === 0) freq = baseFreq + t * 1500; // up sweep
            else if (type === 1) freq = baseFreq + 1500 - t * 1500; // down sweep
            else freq = baseFreq + Math.sin(t * 50) * 500; // trill

            const sample = Math.sin(2 * Math.PI * freq * i / SAMPLE_RATE) * amp;
            chirpsL[startSample + i] += sample * (1 - pan * 0.7);
            chirpsR[startSample + i] += sample * (0.3 + pan * 0.7);
        }

        // Some birds repeat 2-4 times quickly
        if (Math.random() > 0.5) {
            const repeats = 1 + Math.floor(Math.random() * 3);
            for (let r = 0; r < repeats; r++) {
                const gap = Math.floor((0.08 + Math.random() * 0.15) * SAMPLE_RATE);
                const rStart = startSample + (r + 1) * gap;
                if (rStart + durSamples >= NUM_SAMPLES) break;
                for (let i = 0; i < durSamples * 0.8; i++) {
                    const t = i / (durSamples * 0.8);
                    const amp = Math.sin(t * Math.PI) * 0.06;
                    const freq2 = baseFreq + (type === 0 ? t * 1200 : type === 1 ? 1200 - t * 1200 : Math.sin(t * 50) * 400);
                    const s = Math.sin(2 * Math.PI * freq2 * i / SAMPLE_RATE) * amp;
                    chirpsL[rStart + i] += s * (1 - pan * 0.7);
                    chirpsR[rStart + i] += s * (0.3 + pan * 0.7);
                }
            }
        }
    }

    const left = mix([bgL, chirpsL], [0.12, 0.7]);
    const right = mix([bgR, chirpsR], [0.12, 0.7]);

    applyLoopFade(left, SAMPLE_RATE * 3);
    applyLoopFade(right, SAMPLE_RATE * 3);

    writeWav('birds.wav', left, right);
}

function generateThunder() {
    console.log('  Generating thunder...');
    // Thunderstorm: rain base + distant thunder rumbles

    // Rain layer (heavier than regular rain)
    const rainL = bandPass(pinkNoise(NUM_SAMPLES), 150, 7000);
    const rainR = bandPass(pinkNoise(NUM_SAMPLES), 150, 7000);
    const rainEnv = lfoEnvelope(NUM_SAMPLES, 0.05, 0.2, 0.7);

    // Thunder rumbles: 3-5 events in 60 seconds
    const thunderL = new Float32Array(NUM_SAMPLES);
    const thunderR = new Float32Array(NUM_SAMPLES);
    const numThunders = 3 + Math.floor(Math.random() * 3);

    for (let t = 0; t < numThunders; t++) {
        const startSec = 5 + Math.random() * 50;
        const startSample = Math.floor(startSec * SAMPLE_RATE);
        // Thunder duration: 2-6 seconds
        const durSec = 2 + Math.random() * 4;
        const durSamples = Math.floor(durSec * SAMPLE_RATE);

        // Low rumble (brown noise, heavily filtered)
        const rumble = lowPass(brownNoise(durSamples), 150);

        // Thunder envelope: quick attack, long decay
        for (let i = 0; i < durSamples && (startSample + i) < NUM_SAMPLES; i++) {
            const t2 = i / durSamples;
            // Quick attack (0.1s), long decay
            const attackT = Math.min(1, i / (SAMPLE_RATE * 0.1));
            const decay = Math.exp(-t2 * 3);
            const amp = attackT * decay * (0.5 + Math.random() * 0.1);

            thunderL[startSample + i] += rumble[i] * amp * 0.8;
            thunderR[startSample + i] += rumble[i] * amp * 0.6;
        }
    }

    const left = mix(
        [applyEnvelope(rainL, rainEnv), thunderL],
        [0.35, 0.5]
    );
    const right = mix(
        [applyEnvelope(rainR, rainEnv), thunderR],
        [0.35, 0.5]
    );

    applyLoopFade(left, SAMPLE_RATE * 3);
    applyLoopFade(right, SAMPLE_RATE * 3);

    writeWav('thunder.wav', left, right);
}

function generateFire() {
    console.log('  Generating fire...');
    // Crackling fire: filtered noise + random pops/crackles

    // Base warmth (low brown noise)
    const baseL = lowPass(brownNoise(NUM_SAMPLES), 800);
    const baseR = lowPass(brownNoise(NUM_SAMPLES), 800);

    // Crackle layer: random sharp transients
    const crackleL = new Float32Array(NUM_SAMPLES);
    const crackleR = new Float32Array(NUM_SAMPLES);

    // Generate ~300 crackles per minute
    for (let c = 0; c < 300; c++) {
        const pos = Math.floor(Math.random() * NUM_SAMPLES);
        // Crackle duration: 5-50ms
        const dur = Math.floor((0.005 + Math.random() * 0.045) * SAMPLE_RATE);
        const amp = 0.1 + Math.random() * 0.3;
        const pan = Math.random();

        for (let i = 0; i < dur && (pos + i) < NUM_SAMPLES; i++) {
            const t = i / dur;
            const env = (1 - t) * (1 - t); // Quick decay
            const noise = (Math.random() * 2 - 1) * env * amp;
            crackleL[pos + i] += noise * (0.5 + (1 - pan) * 0.5);
            crackleR[pos + i] += noise * (0.5 + pan * 0.5);
        }
    }

    // Pop layer: louder, less frequent
    for (let p = 0; p < 40; p++) {
        const pos = Math.floor(Math.random() * NUM_SAMPLES);
        const dur = Math.floor((0.01 + Math.random() * 0.03) * SAMPLE_RATE);
        const amp = 0.3 + Math.random() * 0.2;

        for (let i = 0; i < dur && (pos + i) < NUM_SAMPLES; i++) {
            const t = i / dur;
            const env = Math.exp(-t * 10) * amp;
            const s = (Math.random() * 2 - 1) * env;
            crackleL[pos + i] += s * 0.7;
            crackleR[pos + i] += s * 0.5;
        }
    }

    // Filtered crackles for warmth
    const filtCrackleL = bandPass(crackleL, 200, 6000);
    const filtCrackleR = bandPass(crackleR, 200, 6000);

    // Gentle wavering (fire breathes)
    const env = lfoEnvelope(NUM_SAMPLES, 0.15, 0.15, 0.75);

    const left = applyEnvelope(mix([baseL, filtCrackleL], [0.3, 0.55]), env);
    const right = applyEnvelope(mix([baseR, filtCrackleR], [0.3, 0.55]), env);

    applyLoopFade(left, SAMPLE_RATE * 3);
    applyLoopFade(right, SAMPLE_RATE * 3);

    writeWav('fire.wav', left, right);
}

function generateWind() {
    console.log('  Generating wind...');
    // Wind: brown/pink noise with slow, organic amplitude modulation

    const noiseL = brownNoise(NUM_SAMPLES);
    const noiseR = brownNoise(NUM_SAMPLES);

    const filtL = bandPass(noiseL, 80, 3000);
    const filtR = bandPass(noiseR, 80, 3000);

    // Higher whistling layer
    const whistleL = bandPass(pinkNoise(NUM_SAMPLES), 800, 4000);
    const whistleR = bandPass(pinkNoise(NUM_SAMPLES), 800, 4000);

    // Organic wind gusts: multiple slow LFOs combined
    const env = new Float32Array(NUM_SAMPLES);
    let p1 = Math.random() * Math.PI * 2;
    let p2 = Math.random() * Math.PI * 2;
    let p3 = Math.random() * Math.PI * 2;
    for (let i = 0; i < NUM_SAMPLES; i++) {
        env[i] = 0.3 +
            0.25 * (0.5 + 0.5 * Math.sin(p1)) +
            0.15 * (0.5 + 0.5 * Math.sin(p2)) +
            0.1 * (0.5 + 0.5 * Math.sin(p3));
        p1 += (2 * Math.PI * 0.05) / SAMPLE_RATE;
        p2 += (2 * Math.PI * 0.13) / SAMPLE_RATE;
        p3 += (2 * Math.PI * 0.31) / SAMPLE_RATE;
    }

    const left = mix(
        [applyEnvelope(filtL, env), applyEnvelope(whistleL, env)],
        [0.6, 0.15]
    );
    const right = mix(
        [applyEnvelope(filtR, env), applyEnvelope(whistleR, env)],
        [0.6, 0.15]
    );

    applyLoopFade(left, SAMPLE_RATE * 3);
    applyLoopFade(right, SAMPLE_RATE * 3);

    writeWav('wind.wav', left, right);
}

function generateCreek() {
    console.log('  Generating creek...');
    // Babbling creek: filtered noise with rapid, bubbly modulation

    const noiseL = pinkNoise(NUM_SAMPLES);
    const noiseR = pinkNoise(NUM_SAMPLES);

    // Water body (mid frequencies)
    const waterL = bandPass(noiseL, 300, 5000);
    const waterR = bandPass(noiseR, 300, 5000);

    // Bubble layer: rapid amplitude modulation
    const bubbleEnv = new Float32Array(NUM_SAMPLES);
    for (let i = 0; i < NUM_SAMPLES; i++) {
        const t = i / SAMPLE_RATE;
        // Multiple fast LFOs create burbling effect
        bubbleEnv[i] = 0.4 +
            0.2 * Math.sin(t * 15.7) +
            0.15 * Math.sin(t * 23.1) +
            0.1 * Math.sin(t * 37.3) +
            0.08 * Math.sin(t * 7.9);
        bubbleEnv[i] = Math.max(0.1, bubbleEnv[i]);
    }

    // Splashy high frequency layer
    const splashL = bandPass(whiteNoise(NUM_SAMPLES), 3000, 10000);
    const splashR = bandPass(whiteNoise(NUM_SAMPLES), 3000, 10000);
    const splashEnv = lfoEnvelope(NUM_SAMPLES, 0.3, 0.4, 0.2);

    const left = mix(
        [applyEnvelope(waterL, bubbleEnv), applyEnvelope(splashL, splashEnv)],
        [0.45, 0.12]
    );
    const right = mix(
        [applyEnvelope(waterR, bubbleEnv), applyEnvelope(splashR, splashEnv)],
        [0.45, 0.12]
    );

    applyLoopFade(left, SAMPLE_RATE * 3);
    applyLoopFade(right, SAMPLE_RATE * 3);

    writeWav('creek.wav', left, right);
}

function generateCrickets() {
    console.log('  Generating crickets...');
    // Night crickets: rhythmic chirping + gentle night ambience

    // Night ambience base (very soft, low noise)
    const bgL = lowPass(brownNoise(NUM_SAMPLES), 500);
    const bgR = lowPass(brownNoise(NUM_SAMPLES), 500);

    // Cricket chirps: high-frequency pulses in rhythmic patterns
    const chirpL = new Float32Array(NUM_SAMPLES);
    const chirpR = new Float32Array(NUM_SAMPLES);

    // Create 6-10 cricket "voices" at different positions/rhythms
    const numCrickets = 6 + Math.floor(Math.random() * 5);

    for (let c = 0; c < numCrickets; c++) {
        // Each cricket has its own frequency, rhythm, and stereo position
        const freq = 3500 + Math.random() * 2500; // 3500-6000 Hz
        const chirpRate = 2 + Math.random() * 4; // chirps per second
        const chirpDur = 0.02 + Math.random() * 0.04; // duration of each chirp
        const pulsesPerChirp = 2 + Math.floor(Math.random() * 4); // rapid pulses within chirp
        const pan = Math.random();
        const amp = 0.04 + Math.random() * 0.06;

        // Cricket doesn't chirp continuously - has active/rest periods
        let active = Math.random() > 0.3;
        let nextToggle = Math.floor(Math.random() * SAMPLE_RATE * 5);

        const samplesPerChirp = Math.floor(SAMPLE_RATE / chirpRate);

        for (let i = 0; i < NUM_SAMPLES; i += samplesPerChirp) {
            // Toggle active state occasionally
            if (i >= nextToggle) {
                active = !active;
                nextToggle = i + Math.floor((3 + Math.random() * 8) * SAMPLE_RATE);
            }
            if (!active) continue;

            // Generate chirp (rapid pulses)
            const chirpSamples = Math.floor(chirpDur * SAMPLE_RATE);
            const pulseGap = Math.floor(chirpSamples / pulsesPerChirp);

            for (let p = 0; p < pulsesPerChirp; p++) {
                const pulseStart = i + p * pulseGap;
                const pulseDur = Math.floor(pulseGap * 0.6);

                for (let s = 0; s < pulseDur && (pulseStart + s) < NUM_SAMPLES; s++) {
                    const t = s / pulseDur;
                    const env = Math.sin(t * Math.PI) * amp;
                    const sample = Math.sin(2 * Math.PI * freq * s / SAMPLE_RATE) * env;
                    chirpL[pulseStart + s] += sample * (0.3 + (1 - pan) * 0.7);
                    chirpR[pulseStart + s] += sample * (0.3 + pan * 0.7);
                }
            }
        }
    }

    // Gentle filtering to soften
    const filtChirpL = bandPass(chirpL, 2500, 8000);
    const filtChirpR = bandPass(chirpR, 2500, 8000);

    const left = mix([bgL, filtChirpL], [0.1, 0.65]);
    const right = mix([bgR, filtChirpR], [0.1, 0.65]);

    applyLoopFade(left, SAMPLE_RATE * 3);
    applyLoopFade(right, SAMPLE_RATE * 3);

    writeWav('crickets.wav', left, right);
}

// === GENERATE ALL ===
console.log('\n🎵 Generating Sukoon ambient audio (60s each, 44.1kHz stereo)...\n');

generateRain();
generateOcean();
generateBirds();
generateThunder();
generateFire();
generateWind();
generateCreek();
generateCrickets();

console.log('\n✅ All 8 sounds generated!\n');
