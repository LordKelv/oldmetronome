import { AcousticProfile, BeatAccentLevel } from './metronomeModels';

export class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private reverbConvolver: ConvolverNode | null = null;
  private masterGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;

  private volume: number = 0.85;
  private roomAmbience: number = 0.22;
  private escapementRealism: boolean = true;

  public ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.setupMasterChain(this.ctx);
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Unlocks iOS Safari / WKWebView AudioContext on first user touch/click
   */
  public unlockAudio(): void {
    const ctx = this.ensureContext();
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  }

  private setupMasterChain(ctx: AudioContext): void {
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.volume;

    this.dryGain = ctx.createGain();
    this.dryGain.gain.value = 1 - this.roomAmbience * 0.35;

    this.wetGain = ctx.createGain();
    this.wetGain.gain.value = this.roomAmbience;

    this.reverbConvolver = ctx.createConvolver();
    this.reverbConvolver.buffer = this.createParlorImpulseResponse(ctx, 0.55, 4.2);

    this.dryGain.connect(this.masterGain);
    this.wetGain.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.masterGain);
    this.masterGain.connect(ctx.destination);
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 0.12);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      // Exponentially decaying white noise burst for mechanical pallet impact
      const env = Math.pow(1 - i / length, 2.4);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    return buffer;
  }

  private createParlorImpulseResponse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const channelData = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const n = i / length;
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay) * 0.5;
      }
    }
    return impulse;
  }

  public setVolume(val: number): void {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.015);
    }
  }

  public setRoomAmbience(val: number): void {
    this.roomAmbience = Math.max(0, Math.min(1, val));
    if (this.dryGain && this.wetGain && this.ctx) {
      this.dryGain.gain.setTargetAtTime(1 - this.roomAmbience * 0.35, this.ctx.currentTime, 0.02);
      this.wetGain.gain.setTargetAtTime(this.roomAmbience, this.ctx.currentTime, 0.02);
    }
  }

  public setEscapementRealism(enabled: boolean): void {
    this.escapementRealism = enabled;
  }

  public getCurrentTime(): number {
    return this.ensureContext().currentTime;
  }

  /**
   * Schedules a physical-modeled metronome tick & optional mechanical bell at exact audio clock time.
   */
  public scheduleTick(
    time: number,
    profile: AcousticProfile,
    level: BeatAccentLevel,
    isTockSwing: boolean,
    isSubdivision: boolean
  ): void {
    if (level === 'mute') return;

    const ctx = this.ensureContext();
    if (!this.dryGain || !this.wetGain || !this.noiseBuffer) return;

    const swingPitchFactor = this.escapementRealism && isTockSwing && !isSubdivision ? profile.tockRatio : 1.0;
    const subPitchFactor = isSubdivision ? 1.22 : 1.0;
    const accentGainFactor =
       isSubdivision
        ? 0.42
        : level === 'bell'
        ? 1.05
        : level === 'accent'
        ? 1.0
        : 0.78;

    // 1. Resonant Case Body Impact (pitched woodblock/cavity impulse)
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = 'triangle';

    const baseFreq = profile.tickFreq * swingPitchFactor * subPitchFactor * (level === 'accent' ? 1.08 : 1.0);
    bodyOsc.frequency.setValueAtTime(baseFreq * 1.45, time);
    bodyOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.52, time + profile.tickDecay);

    bodyGain.gain.setValueAtTime(0.0001, time);
    bodyGain.gain.linearRampToValueAtTime(0.75 * accentGainFactor, time + 0.0012);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + profile.tickDecay);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(this.dryGain);
    bodyGain.connect(this.wetGain);

    bodyOsc.start(time);
    bodyOsc.stop(time + profile.tickDecay + 0.01);

    // 2. Escapement Pallet Click (Bandpass-filtered noise burst through cabinet resonance)
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this.noiseBuffer;

    const cabinetFilter = ctx.createBiquadFilter();
    cabinetFilter.type = 'bandpass';
    cabinetFilter.frequency.setValueAtTime(profile.bodyResonanceFreq * swingPitchFactor, time);
    cabinetFilter.Q.setValueAtTime(profile.bodyResonanceQ, time);

    const snapFilter = ctx.createBiquadFilter();
    snapFilter.type = 'highpass';
    snapFilter.frequency.setValueAtTime(1900, time);

    const noiseGain = ctx.createGain();
    const palletLevel = (0.55 + profile.metallicSnap * 0.5) * accentGainFactor;
    noiseGain.gain.setValueAtTime(0.001, time);
    noiseGain.gain.linearRampToValueAtTime(palletLevel, time + 0.0008);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + profile.tickDecay * 0.85);

    noiseSrc.connect(cabinetFilter);
    cabinetFilter.connect(noiseGain);

    // Parallel metallic escapement snap
    const snapGain = ctx.createGain();
    snapGain.gain.setValueAtTime(profile.metallicSnap * 0.38 * accentGainFactor, time);
    snapGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.012);
    noiseSrc.connect(snapFilter);
    snapFilter.connect(snapGain);

    noiseGain.connect(this.dryGain);
    noiseGain.connect(this.wetGain);
    snapGain.connect(this.dryGain);

    noiseSrc.start(time);
    noiseSrc.stop(time + profile.tickDecay + 0.015);

    // 3. Mechanical Pull-Bell Striker on 'bell' beat (never on subdivision)
    if (level === 'bell' && !isSubdivision) {
      this.scheduleBellStrike(time, profile);
    }
  }

  public scheduleBellStrike(time: number, profile: AcousticProfile): void {
    const ctx = this.ensureContext();
    if (!this.dryGain || !this.wetGain) return;

    profile.bellPartials.forEach((ratio, idx) => {
      if (!this.dryGain || !this.wetGain) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(profile.bellFundamental * ratio, time);

      // Higher partials decay faster like a real brass/silver bell
      const partialDecay = profile.bellDecay / (1 + idx * 0.55);
      const partialAmp = (0.28 / (idx + 1)) * (idx === 0 ? 1.15 : 0.85);

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(partialAmp, time + 0.0015);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + partialDecay);

      osc.connect(gain);
      gain.connect(this.dryGain);
      gain.connect(this.wetGain);

      osc.start(time);
      osc.stop(time + partialDecay + 0.02);
    });
  }

  /**
   * Subtle tactile brass detent click when user slides the counterweight along the pendulum rod
   */
  public playWeightDetentClick(bpm: number): void {
    const ctx = this.ensureContext();
    if (!this.dryGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    // Higher pitch for faster BPM (weight lower on rod)
    const freq = 1100 + ((bpm - 40) / 168) * 900;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.6, now + 0.014);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);

    osc.connect(gain);
    gain.connect(this.dryGain);
    osc.start(now);
    osc.stop(now + 0.016);
  }

  /**
   * Mechanical mainspring winding ratchet sound when winding the brass key
   */
  public playWindUpRatchet(): void {
    const ctx = this.ensureContext();
    if (!this.dryGain) return;
    const now = ctx.currentTime;

    const clickOffsets = [0, 0.045, 0.095, 0.15, 0.21, 0.275];
    clickOffsets.forEach((offset, i) => {
      if (!this.dryGain) return;
      const t = now + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const baseFreq = 1650 + i * 75;
      osc.frequency.setValueAtTime(baseFreq, t);
      osc.frequency.exponentialRampToValueAtTime(620, t + 0.018);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);

      osc.connect(gain);
      gain.connect(this.dryGain);
      osc.start(t);
      osc.stop(t + 0.022);
    });
  }
}
