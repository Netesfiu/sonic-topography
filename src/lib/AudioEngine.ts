import { AudioData } from '../types';

declare global {
  interface Window {
    wallpaperAudio?: {
      getAudioData: () => number[];
    };
    wallpaperRegisterAudioListener?: (callback: (audioData: number[]) => void) => void;
    wallpaperReady?: () => void;
  }
}

export type TriggerPreset = 'Auto Beat' | 'Advanced';
export type TriggerKind = 'Kick' | 'Snare' | 'Advanced';

export interface MusicState {
  bpm: number;
  tempoConfidence: number;
  beatPhase: number;
  beatIndex: number;
  barIndex: number;
  isDownbeat: boolean;
  beatPulse: number;
  onset: number;
  lowOnset: number;
  midOnset: number;
  highOnset: number;
  build: number;
  drop: number;
  stereoPan: number;
  stereoWidth: number;
  shortEnergy: number;
  longEnergy: number;
  onsetRate: number;
}

export class TriggerConfig {
  public enabled = true;
  public mode: TriggerPreset = 'Auto Beat';
  public freqIndex = -1;
  public threshold = 0.5;
  public sensitivity = 0.15;
  public cooldown = 60;
  public bandStart = 0;
  public bandEnd = 16;
  public pulseStrength = 0.2;
  public currentCooldown = 0;
  public beatHold = 0;
  public lastEvalEnergy = 0;
  public lastEvalThresh = 0;
  public fluxHistory: number[] = new Array(48).fill(0);
  public fluxHistoryIndex = 0;
  public smoothedFlux = 0;
  public prevSmoothedFlux = 0;

  constructor(public action: 'Pulse' | 'Meteor') {
    if (action === 'Pulse') {
      this.bandStart = 0;
      this.bandEnd = 12;
      this.sensitivity = 0.22;
      this.cooldown = 45;
      this.pulseStrength = 0.25;
    } else {
      this.bandStart = 92;
      this.bandEnd = 340;
      this.sensitivity = 0.4;
      this.cooldown = 180;
      this.pulseStrength = 0.5;
    }
  }

  /** Maps the legacy 0..511 trigger UI coordinate space onto the true 64-bin spectrum. */
  public getTriggerRange(): [number, number] {
    const clampBin = (v: number) => Math.max(0, Math.min(63, v));
    if (this.mode === 'Auto Beat') {
      return [
        clampBin(Math.floor((this.bandStart / 511) * 63)),
        clampBin(Math.ceil((this.bandEnd / 511) * 63)),
      ];
    }
    const legacy = this.freqIndex >= 0 ? this.freqIndex : Math.floor(0.2 * 512);
    const c = clampBin(Math.round((legacy / 511) * 63));
    return [Math.max(0, c - 1), Math.min(63, c + 1)];
  }
}

const ZERO_AUDIO: AudioData = {
  bass: 0, mid: 0, treble: 0, energy: 0,
  subBass: 0, lowMid: 0, highMid: 0, presence: 0, brilliance: 0, air: 0,
  warmth: 0, brightness: 0, sharpness: 0, smoothness: 0, density: 0, spectralCentroid: 0,
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const emaAlpha = (dt: number, timeConstant: number) => 1 - Math.exp(-Math.max(0, dt) / timeConstant);

export class AudioEngine {
  public isPlaying = false;
  public pulseTrigger = new TriggerConfig('Pulse');
  public meteorTrigger = new TriggerConfig('Meteor');
  public onFreqTrigger?: (strength: number, type: TriggerKind, action: 'Pulse' | 'Meteor') => void;

  private readonly monoSpectrum = new Float32Array(64);
  private readonly leftSpectrum = new Float32Array(64);
  private readonly rightSpectrum = new Float32Array(64);
  private readonly prevSpectrum = new Float32Array(64);

  private wallpaperAudioReceived = false;
  private lastFrameTime = 0;
  private lastActiveTime = 0;
  private lastIdleTime = 0;
  private idleEnergyThreshold = 0.012;
  private currentIdleIntensity = 0;
  private debounceDuration = 1;
  private idleFadeOutDuration = 1;
  private idleStartTime = 0;

  private baseData: AudioData = { ...ZERO_AUDIO };
  private renderedData: AudioData = { ...ZERO_AUDIO };
  private prevBrightness = 0;

  private fluxHistory = new Array<number>(48).fill(0);
  private fluxCursor = 0;
  private lowFluxHistory = new Array<number>(48).fill(0);
  private lowFluxCursor = 0;
  private midFluxHistory = new Array<number>(48).fill(0);
  private midFluxCursor = 0;
  private highFluxHistory = new Array<number>(48).fill(0);
  private highFluxCursor = 0;

  private onsetTimes: number[] = [];
  private recentOnsetTimes: number[] = [];
  private lastRawPulseTime = -Infinity;
  private lastSnareTime = -Infinity;
  private lastMeteorTime = -Infinity;

  private bpm = 0;
  private tempoConfidence = 0;
  private beatPeriodMs = 0;
  private beatAnchorMs = 0;
  private lastTempoEstimateMs = 0;
  private lastEmittedBeatNumber = -1;
  private beatAccent = [0, 0, 0, 0];
  private downbeatOffset = 0;

  private shortEnergy = 0;
  private longEnergy = 0;
  private build = 0;
  private drop = 0;
  private lastEnergyForDrop = 0;

  private latestOnset = 0;
  private latestLowOnset = 0;
  private latestMidOnset = 0;
  private latestHighOnset = 0;
  private stereoPan = 0;
  private stereoWidth = 0;

  private musicState: MusicState = {
    bpm: 0, tempoConfidence: 0, beatPhase: 0, beatIndex: 0, barIndex: 0,
    isDownbeat: false, beatPulse: 0, onset: 0, lowOnset: 0, midOnset: 0, highOnset: 0,
    build: 0, drop: 0, stereoPan: 0, stereoWidth: 0, shortEnergy: 0, longEnergy: 0, onsetRate: 0,
  };

  public isWallpaperEngineMode(): boolean {
    return this.wallpaperAudioReceived;
  }

  /**
   * Wallpaper Engine supplies 128 values: 64 left-channel frequency bands,
   * then 64 right-channel bands. Analysis stays at the real 64-bin resolution;
   * the old fake 512-bin expansion incorrectly mixed stereo layout with frequency.
   */
  public setWallpaperAudioData(audioData: number[]) {
    const now = performance.now();
    if (!this.wallpaperAudioReceived) {
      this.lastActiveTime = now;
      this.lastIdleTime = 0;
    }
    this.wallpaperAudioReceived = true;

    if (audioData.length >= 128) {
      for (let i = 0; i < 64; i++) {
        const l = Math.max(0, audioData[i] || 0);
        const r = Math.max(0, audioData[i + 64] || 0);
        this.leftSpectrum[i] = l;
        this.rightSpectrum[i] = r;
        this.monoSpectrum[i] = (l + r) * 0.5;
      }
    } else if (audioData.length >= 64) {
      for (let i = 0; i < 64; i++) {
        const v = Math.max(0, audioData[i] || 0);
        this.leftSpectrum[i] = v;
        this.rightSpectrum[i] = v;
        this.monoSpectrum[i] = v;
      }
    } else {
      const sourceBins = Math.max(1, audioData.length);
      for (let i = 0; i < 64; i++) {
        const source = Math.min(sourceBins - 1, Math.floor((i / 64) * sourceBins));
        const v = Math.max(0, audioData[source] || 0);
        this.leftSpectrum[i] = v;
        this.rightSpectrum[i] = v;
        this.monoSpectrum[i] = v;
      }
    }

    const dt = this.lastFrameTime > 0
      ? Math.min(0.1, Math.max(1 / 120, (now - this.lastFrameTime) / 1000))
      : 1 / 30;
    this.lastFrameTime = now;
    this.processAudioFrame(now, dt);
  }

  private averageRange(start: number, end: number): number {
    const s = Math.max(0, Math.min(63, start));
    const e = Math.max(s, Math.min(63, end));
    let sum = 0;
    for (let i = s; i <= e; i++) sum += this.monoSpectrum[i];
    return sum / (e - s + 1);
  }

  private fluxRange(start: number, end: number): number {
    const s = Math.max(0, Math.min(63, start));
    const e = Math.max(s, Math.min(63, end));
    let sum = 0;
    for (let i = s; i <= e; i++) {
      const diff = this.monoSpectrum[i] - this.prevSpectrum[i];
      if (diff > 0) sum += diff;
    }
    return sum / (e - s + 1);
  }

  private adaptiveOnset(score: number, history: number[], cursor: number, sensitivity: number) {
    history[cursor] = score;
    let mean = 0;
    for (const v of history) mean += v;
    mean /= history.length;
    let variance = 0;
    for (const v of history) variance += (v - mean) * (v - mean);
    variance /= history.length;
    const std = Math.sqrt(variance);
    const multiplier = Math.max(0.45, 2.5 - sensitivity * 1.7);
    const threshold = Math.max(0.0015, mean + std * multiplier);
    return { threshold, strength: clamp01((score - threshold) / Math.max(0.015, threshold * 2.2)) };
  }

  private processAudioFrame(now: number, dt: number) {
    let sum = 0;
    let centroidNum = 0;
    let volatility = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;
    let stereoDifference = 0;

    for (let i = 0; i < 64; i++) {
      const v = this.monoSpectrum[i];
      sum += v;
      centroidNum += i * v;
      volatility += Math.abs(v - this.prevSpectrum[i]);
      leftEnergy += this.leftSpectrum[i];
      rightEnergy += this.rightSpectrum[i];
      stereoDifference += Math.abs(this.leftSpectrum[i] - this.rightSpectrum[i]);
    }

    const energy = sum / 64;
    this.isPlaying = energy > this.idleEnergyThreshold;
    if (this.isPlaying) {
      this.lastActiveTime = now;
      this.idleStartTime = 0;
    } else {
      this.lastIdleTime = now;
    }

    const stereoTotal = leftEnergy + rightEnergy;
    const panTarget = stereoTotal > 1e-6 ? (rightEnergy - leftEnergy) / stereoTotal : 0;
    const widthTarget = stereoTotal > 1e-6 ? stereoDifference / (stereoTotal * 0.5) : 0;
    const stereoAlpha = emaAlpha(dt, 0.18);
    this.stereoPan += (panTarget - this.stereoPan) * stereoAlpha;
    this.stereoWidth += (clamp01(widthTarget) - this.stereoWidth) * stereoAlpha;

    const subBass = this.averageRange(0, 2);
    const bass = this.averageRange(3, 7);
    const lowMid = this.averageRange(8, 13);
    const mid = this.averageRange(14, 23);
    const highMid = this.averageRange(24, 34);
    const presence = this.averageRange(35, 44);
    const brilliance = this.averageRange(45, 54);
    const air = this.averageRange(55, 63);

    const legacyBass = (subBass * 3 + bass * 5 + lowMid * 6) / 14;
    const legacyMid = (mid * 10 + highMid * 11) / 21;
    const legacyTreble = (presence * 10 + brilliance * 10 + air * 9) / 29;

    const lowFlux = this.fluxRange(0, 13);
    const midFlux = this.fluxRange(14, 38);
    const highFlux = this.fluxRange(39, 63);
    const totalFlux = this.fluxRange(0, 63);

    const totalOnset = this.adaptiveOnset(totalFlux, this.fluxHistory, this.fluxCursor, 0.65);
    const lowOnset = this.adaptiveOnset(lowFlux, this.lowFluxHistory, this.lowFluxCursor, this.pulseTrigger.sensitivity);
    const midOnset = this.adaptiveOnset(midFlux, this.midFluxHistory, this.midFluxCursor, 0.55);
    const highOnset = this.adaptiveOnset(highFlux, this.highFluxHistory, this.highFluxCursor, this.meteorTrigger.sensitivity);
    this.fluxCursor = (this.fluxCursor + 1) % this.fluxHistory.length;
    this.lowFluxCursor = (this.lowFluxCursor + 1) % this.lowFluxHistory.length;
    this.midFluxCursor = (this.midFluxCursor + 1) % this.midFluxHistory.length;
    this.highFluxCursor = (this.highFluxCursor + 1) % this.highFluxHistory.length;

    this.latestOnset = totalOnset.strength;
    this.latestLowOnset = lowOnset.strength;
    this.latestMidOnset = midOnset.strength;
    this.latestHighOnset = highOnset.strength;

    this.pulseTrigger.lastEvalEnergy = lowFlux;
    this.pulseTrigger.lastEvalThresh = lowOnset.threshold;
    this.meteorTrigger.lastEvalEnergy = highFlux;
    this.meteorTrigger.lastEvalThresh = highOnset.threshold;

    this.shortEnergy += (energy - this.shortEnergy) * emaAlpha(dt, 0.22);
    this.longEnergy += (energy - this.longEnergy) * emaAlpha(dt, 2.6);
    const energyRatio = this.longEnergy > 0.002 ? this.shortEnergy / this.longEnergy : 1;
    const buildTarget = clamp01((energyRatio - 1.03) * 1.8 + totalOnset.strength * 0.2);
    this.build += (buildTarget - this.build) * emaAlpha(dt, buildTarget > this.build ? 0.35 : 1.2);

    const suddenRise = Math.max(0, this.shortEnergy - this.lastEnergyForDrop);
    const dropTarget = clamp01((energyRatio - 1.28) * 1.7 + suddenRise * 7 + lowOnset.strength * 0.25);
    this.drop = Math.max(dropTarget, this.drop * Math.exp(-dt / 0.7));
    this.lastEnergyForDrop = this.shortEnergy;

    if (totalOnset.strength > 0.12 && energy > this.idleEnergyThreshold) {
      const minGap = 110;
      if (this.onsetTimes.length === 0 || now - this.onsetTimes[this.onsetTimes.length - 1] > minGap) {
        this.onsetTimes.push(now);
        this.recentOnsetTimes.push(now);
        this.onsetTimes = this.onsetTimes.filter((t) => now - t <= 12000);
        this.recentOnsetTimes = this.recentOnsetTimes.filter((t) => now - t <= 4000);
        this.correctBeatPhaseFromOnset(now, Math.max(lowOnset.strength, totalOnset.strength));
      }
    }

    if (now - this.lastTempoEstimateMs > 350 && this.onsetTimes.length >= 5) {
      this.estimateTempo(now);
      this.lastTempoEstimateMs = now;
    }

    if (this.pulseTrigger.enabled && this.pulseTrigger.mode === 'Advanced') {
      this.evaluateAdvancedTrigger(this.pulseTrigger, now);
    } else if (this.pulseTrigger.enabled && this.tempoConfidence < 0.28 && lowOnset.strength > 0.08) {
      const cooldownMs = Math.max(80, this.pulseTrigger.cooldown * (1000 / 60));
      if (now - this.lastRawPulseTime >= cooldownMs) {
        this.lastRawPulseTime = now;
        this.onFreqTrigger?.(Math.max(0.08, lowOnset.strength) * this.pulseTrigger.pulseStrength * 2.5, 'Kick', 'Pulse');
      }
    }

    if (this.pulseTrigger.enabled && this.pulseTrigger.mode === 'Auto Beat' && midOnset.strength > 0.22 && lowOnset.strength < 0.15) {
      if (now - this.lastSnareTime > 220) {
        this.lastSnareTime = now;
        this.onFreqTrigger?.(midOnset.strength * 0.16, 'Snare', 'Pulse');
      }
    }

    if (this.meteorTrigger.enabled) {
      if (this.meteorTrigger.mode === 'Advanced') {
        this.evaluateAdvancedTrigger(this.meteorTrigger, now);
      } else if (highOnset.strength > 0.13) {
        const cooldownMs = Math.max(250, this.meteorTrigger.cooldown * (1000 / 60));
        if (now - this.lastMeteorTime >= cooldownMs) {
          this.lastMeteorTime = now;
          this.onFreqTrigger?.(highOnset.strength * this.meteorTrigger.pulseStrength, 'Snare', 'Meteor');
        }
      }
    }

    const warmth = sum > 1e-6 ? clamp01((subBass * 3 + bass * 5 + lowMid * 6 + mid * 10) / Math.max(0.001, sum)) : 0;
    const brightness = sum > 1e-6 ? clamp01((presence * 10 + brilliance * 10 + air * 9) / Math.max(0.001, sum)) : 0;
    const sharpnessTarget = Math.max(0, brightness - this.prevBrightness) * 8 + highOnset.strength * 0.8;
    this.prevBrightness = brightness;
    const smoothness = clamp01(1 - (volatility / 64) * 2.2);

    const activeThreshold = energy * 1.2;
    const bands = [subBass, bass, lowMid, mid, highMid, presence, brilliance, air];
    const density = bands.reduce((count, v) => count + (v > activeThreshold ? 1 : 0), 0) / bands.length;
    const spectralCentroid = sum > 1e-6 ? centroidNum / sum : 0;

    const attack = emaAlpha(dt, 0.055);
    const release = emaAlpha(dt, 0.22);
    const smooth = (current: number, target: number) => current + (target - current) * (target > current ? attack : release);

    this.baseData.bass = smooth(this.baseData.bass, legacyBass);
    this.baseData.mid = smooth(this.baseData.mid, legacyMid);
    this.baseData.treble = smooth(this.baseData.treble, legacyTreble);
    this.baseData.energy = smooth(this.baseData.energy, energy);
    this.baseData.subBass = smooth(this.baseData.subBass, subBass);
    this.baseData.lowMid = smooth(this.baseData.lowMid, lowMid);
    this.baseData.highMid = smooth(this.baseData.highMid, highMid);
    this.baseData.presence = smooth(this.baseData.presence, presence);
    this.baseData.brilliance = smooth(this.baseData.brilliance, brilliance);
    this.baseData.air = smooth(this.baseData.air, air);
    this.baseData.warmth = smooth(this.baseData.warmth, warmth);
    this.baseData.brightness = smooth(this.baseData.brightness, brightness);
    this.baseData.sharpness = smooth(this.baseData.sharpness, sharpnessTarget);
    this.baseData.smoothness = smooth(this.baseData.smoothness, smoothness);
    this.baseData.density = smooth(this.baseData.density, density);
    this.baseData.spectralCentroid = smooth(this.baseData.spectralCentroid, spectralCentroid);

    this.prevSpectrum.set(this.monoSpectrum);
  }

  private evaluateAdvancedTrigger(config: TriggerConfig, now: number) {
    const [start, end] = config.getTriggerRange();
    let sum = 0;
    for (let i = start; i <= end; i++) sum += this.monoSpectrum[i];
    const value = sum / Math.max(1, end - start + 1);
    config.lastEvalEnergy = value;
    config.lastEvalThresh = config.threshold;
    const cooldownMs = Math.max(50, config.cooldown * (1000 / 60));
    const last = config.action === 'Pulse' ? this.lastRawPulseTime : this.lastMeteorTime;
    if (value > config.threshold && now - last >= cooldownMs) {
      if (config.action === 'Pulse') this.lastRawPulseTime = now;
      else this.lastMeteorTime = now;
      this.onFreqTrigger?.(value * Math.max(0.1, config.pulseStrength), 'Advanced', config.action);
    }
  }

  private normalizeTempoBpm(bpm: number) {
    let normalized = bpm;
    while (normalized < 72) normalized *= 2;
    while (normalized > 180) normalized /= 2;
    return normalized;
  }

  private estimateTempo(now: number) {
    const intervals: Array<{ bpm: number; weight: number }> = [];
    const times = this.onsetTimes;

    for (let i = 1; i < times.length; i++) {
      for (let skip = 1; skip <= 3 && i - skip >= 0; skip++) {
        const interval = times[i] - times[i - skip];
        if (interval < 250 || interval > 2400) continue;
        const rawBpm = (60000 * skip) / interval;
        const bpm = this.normalizeTempoBpm(rawBpm);
        const recency = Math.exp(-(now - times[i]) / 7000);
        intervals.push({ bpm, weight: recency / skip });
      }
    }
    if (intervals.length < 4) return;

    const scores = new Float32Array(221);
    let totalWeight = 0;
    for (const candidate of intervals) {
      const idx = Math.max(0, Math.min(scores.length - 1, Math.round((candidate.bpm - 70) * 2)));
      for (let d = -2; d <= 2; d++) {
        const j = idx + d;
        if (j >= 0 && j < scores.length) scores[j] += candidate.weight * Math.exp(-0.7 * d * d);
      }
      totalWeight += candidate.weight;
    }

    let bestIdx = 0;
    let bestScore = 0;
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] > bestScore) {
        bestScore = scores[i];
        bestIdx = i;
      }
    }

    const candidateBpm = 70 + bestIdx / 2;
    const confidence = clamp01((bestScore / Math.max(0.001, totalWeight)) * 4.5);
    if (this.bpm <= 0) this.bpm = candidateBpm;
    else {
      const delta = Math.abs(candidateBpm - this.bpm);
      const blend = delta < 10 ? 0.18 : confidence > 0.7 ? 0.08 : 0.02;
      this.bpm += (candidateBpm - this.bpm) * blend;
    }
    this.tempoConfidence += (confidence - this.tempoConfidence) * 0.2;
    this.beatPeriodMs = 60000 / Math.max(1, this.bpm);

    if (this.beatAnchorMs <= 0 && times.length) {
      this.beatAnchorMs = times[times.length - 1];
      this.lastEmittedBeatNumber = -1;
    }
  }

  private correctBeatPhaseFromOnset(now: number, strength: number) {
    if (this.beatPeriodMs <= 0 || this.tempoConfidence < 0.2) return;
    if (this.beatAnchorMs <= 0) {
      this.beatAnchorMs = now;
      return;
    }

    const beatsFromAnchor = (now - this.beatAnchorMs) / this.beatPeriodMs;
    const nearestBeat = Math.round(beatsFromAnchor);
    const predicted = this.beatAnchorMs + nearestBeat * this.beatPeriodMs;
    const error = now - predicted;
    const tolerance = this.beatPeriodMs * 0.2;
    if (Math.abs(error) <= tolerance) {
      const correction = Math.min(0.32, 0.08 + strength * 0.22);
      this.beatAnchorMs += error * correction;
      const modulo = ((nearestBeat % 4) + 4) % 4;
      for (let i = 0; i < 4; i++) this.beatAccent[i] *= 0.985;
      this.beatAccent[modulo] += strength;
      let strongest = 0;
      for (let i = 1; i < 4; i++) if (this.beatAccent[i] > this.beatAccent[strongest]) strongest = i;
      this.downbeatOffset = strongest;
    }
  }

  private updateBeatClock(now: number) {
    if (this.beatPeriodMs <= 0 || this.tempoConfidence < 0.18 || this.beatAnchorMs <= 0 || !this.isPlaying) {
      this.musicState.beatPhase = 0;
      this.musicState.beatPulse = 0;
      this.musicState.isDownbeat = false;
      return;
    }

    const beatFloat = (now - this.beatAnchorMs) / this.beatPeriodMs;
    const beatNumber = Math.floor(beatFloat);
    const phase = ((beatFloat % 1) + 1) % 1;
    const beatIndex = ((beatNumber - this.downbeatOffset) % 4 + 4) % 4;
    const beatPulse = Math.exp(-phase * 9.5);

    if (beatNumber > this.lastEmittedBeatNumber) {
      if (this.lastEmittedBeatNumber >= 0 && beatNumber - this.lastEmittedBeatNumber > 2) {
        this.lastEmittedBeatNumber = beatNumber - 1;
      }
      this.lastEmittedBeatNumber = beatNumber;
      if (this.pulseTrigger.enabled && this.pulseTrigger.mode === 'Auto Beat') {
        const downbeatBoost = beatIndex === 0 ? 1.55 : 1;
        const strength = (0.08 + this.baseData.bass * 0.8 + this.latestLowOnset * 0.5)
          * this.pulseTrigger.pulseStrength * downbeatBoost;
        this.onFreqTrigger?.(strength, 'Kick', 'Pulse');
      }
    }

    this.musicState.beatPhase = phase;
    this.musicState.beatIndex = beatIndex;
    this.musicState.barIndex = Math.floor((beatNumber - this.downbeatOffset) / 4);
    this.musicState.isDownbeat = beatIndex === 0;
    this.musicState.beatPulse = beatPulse;
  }

  /** Heavy analysis is performed once per new Wallpaper Engine audio frame. */
  public getAudioData(_deltaTime: number = 0.016): AudioData {
    const now = performance.now();
    this.updateBeatClock(now);

    const phase = this.musicState.beatPhase;
    const anticipation = this.tempoConfidence > 0.3 ? Math.exp(-Math.pow((phase - 0.93) / 0.065, 2)) : 0;
    const beatPulse = this.musicState.beatPulse;
    const downbeat = this.musicState.isDownbeat ? beatPulse : 0;

    this.renderedData = {
      ...this.baseData,
      subBass: this.baseData.subBass * (1 + beatPulse * 0.18 + downbeat * 0.22),
      bass: this.baseData.bass * (1 + beatPulse * 0.15),
      mid: this.baseData.mid * (1 + anticipation * 0.035),
      energy: this.baseData.energy * (1 + beatPulse * 0.06 + this.drop * 0.08),
      highMid: this.baseData.highMid * (1 + this.latestMidOnset * 0.08),
      presence: this.baseData.presence * (1 + this.latestMidOnset * 0.1),
      brilliance: this.baseData.brilliance * (1 + this.latestHighOnset * 0.1),
      air: this.baseData.air * (1 + this.latestHighOnset * 0.12),
      sharpness: this.baseData.sharpness + this.latestHighOnset * 0.12 + this.drop * 0.08,
      density: clamp01(this.baseData.density + this.build * 0.08),
    };

    const onsetRate = this.recentOnsetTimes.filter((t) => now - t <= 4000).length / 4;
    this.musicState = {
      ...this.musicState,
      bpm: this.bpm,
      tempoConfidence: this.tempoConfidence,
      onset: this.latestOnset,
      lowOnset: this.latestLowOnset,
      midOnset: this.latestMidOnset,
      highOnset: this.latestHighOnset,
      build: this.build,
      drop: this.drop,
      stereoPan: this.stereoPan,
      stereoWidth: this.stereoWidth,
      shortEnergy: this.shortEnergy,
      longEnergy: this.longEnergy,
      onsetRate,
    };

    this.latestOnset *= 0.97;
    this.latestLowOnset *= 0.97;
    this.latestMidOnset *= 0.97;
    this.latestHighOnset *= 0.97;
    return { ...this.renderedData };
  }

  public getMusicState(): MusicState {
    this.updateBeatClock(performance.now());
    return { ...this.musicState };
  }

  public getStereoSpectrum(): { left: Float32Array; right: Float32Array; mono: Float32Array } {
    return {
      left: new Float32Array(this.leftSpectrum),
      right: new Float32Array(this.rightSpectrum),
      mono: new Float32Array(this.monoSpectrum),
    };
  }

  public getIdleWaveIntensity(deltaTime: number = 0.016): number {
    const now = performance.now();
    let targetIntensity = 0;

    if (this.wallpaperAudioReceived) {
      if (this.isPlaying) {
        targetIntensity = 0;
        this.idleStartTime = 0;
      } else {
        if (this.idleStartTime === 0) this.idleStartTime = now;
        targetIntensity = (now - this.idleStartTime) / 1000 >= this.debounceDuration ? 1 : 0;
      }
    } else {
      targetIntensity = this.isPlaying ? 0 : 1;
    }

    const fadeSpeed = 1 / Math.max(0.05, this.idleFadeOutDuration);
    const delta = fadeSpeed * Math.max(0, deltaTime);
    if (targetIntensity > this.currentIdleIntensity) {
      this.currentIdleIntensity = Math.min(targetIntensity, this.currentIdleIntensity + delta);
    } else if (targetIntensity < this.currentIdleIntensity) {
      this.currentIdleIntensity = Math.max(targetIntensity, this.currentIdleIntensity - delta);
    }
    return this.currentIdleIntensity;
  }

  public setIdleWaveDebounce(seconds: number) {
    this.debounceDuration = Math.max(0, seconds);
  }

  public setIdleFadeOutDuration(seconds: number) {
    this.idleFadeOutDuration = Math.max(0.05, seconds);
  }
}

export const engine = new AudioEngine();
