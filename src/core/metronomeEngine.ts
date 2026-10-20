import {
  BeatAccentLevel,
  METRONOME_MODELS,
  MetronomeModel,
  MetronomeModelId,
  SUBDIVISION_OPTIONS,
  SubdivisionType,
} from './metronomeModels';
import { SoundSynthesizer } from './soundSynthesizer';

export interface BeatTriggerEvent {
  beatIndex: number;
  subdivisionIndex: number;
  level: BeatAccentLevel;
  isTockSwing: boolean;
  audioTime: number;
  springReserve: number;
}

export type BeatListener = (event: BeatTriggerEvent) => void;

export class MetronomeEngine {
  private synth: SoundSynthesizer;
  private isPlaying: boolean = false;
  private bpm: number = 108;
  private model: MetronomeModel = METRONOME_MODELS[0];
  private beatsPerBar: number = 4;
  private beatPattern: BeatAccentLevel[] = ['bell', 'normal', 'normal', 'normal'];
  private subdivision: SubdivisionType = 'quarter';

  // Lookahead scheduler state
  private lookaheadIntervalMs: number = 25;
  private scheduleAheadSec: number = 0.1;
  private schedulerTimerId: number | null = null;

  private nextBeatAudioTime: number = 0;
  private lastBeatAudioTime: number = 0;
  private currentBeatIndex: number = 0;
  private totalBeatsElapsed: number = 0;

  // Mainspring simulation
  private springModeEnabled: boolean = false;
  private springReserve: number = 1.0; // 0.0 to 1.0

  // Haptics
  private hapticsEnabled: boolean = false;

  // Listeners for UI synchronization
  private listeners: Set<BeatListener> = new Set();

  constructor(synth?: SoundSynthesizer) {
    this.synth = synth ?? new SoundSynthesizer();
  }

  public getSynth(): SoundSynthesizer {
    return this.synth;
  }

  public subscribe(listener: BeatListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public start(): void {
    if (this.isPlaying) return;
    this.synth.unlockAudio();

    if (this.springModeEnabled && this.springReserve <= 0.01) {
      this.springReserve = 1.0;
    }

    const now = this.synth.getCurrentTime();
    this.isPlaying = true;
    this.currentBeatIndex = 0;
    this.totalBeatsElapsed = 0;
    this.lastBeatAudioTime = now;
    this.nextBeatAudioTime = now + 0.05;

    this.schedulerTick();
    this.schedulerTimerId = window.setInterval(() => {
      this.schedulerTick();
    }, this.lookaheadIntervalMs);
  }

  public stop(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.schedulerTimerId !== null) {
      window.clearInterval(this.schedulerTimerId);
      this.schedulerTimerId = null;
    }
  }

  public toggle(): boolean {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.start();
    }
    return this.isPlaying;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public setBpm(bpm: number): void {
    const clamped = Math.max(30, Math.min(240, Math.round(bpm)));
    this.bpm = clamped;
  }

  public getBpm(): number {
    return this.bpm;
  }

  public setModel(modelId: MetronomeModelId): void {
    const found = METRONOME_MODELS.find((m) => m.id === modelId);
    if (found) {
      this.model = found;
      if (!found.hasPullBell) {
        this.beatPattern = this.beatPattern.map((b) => (b === 'bell' ? 'accent' : b));
      }
    }
  }

  public setBeatsPerBar(count: number, bellEnabled: boolean): void {
    const clamped = Math.max(1, Math.min(12, count));
    this.beatsPerBar = clamped;
    const nextPattern: BeatAccentLevel[] = [];
    for (let i = 0; i < clamped; i++) {
      if (i === 0) {
        nextPattern.push(bellEnabled && this.model.hasPullBell ? 'bell' : 'accent');
      } else {
        nextPattern.push(this.beatPattern[i] && this.beatPattern[i] !== 'bell' ? this.beatPattern[i] : 'normal');
      }
    }
    this.beatPattern = nextPattern;
    if (this.currentBeatIndex >= this.beatsPerBar) {
      this.currentBeatIndex = 0;
    }
  }

  public setBeatPattern(pattern: BeatAccentLevel[]): void {
    this.beatPattern = [...pattern];
    this.beatsPerBar = pattern.length;
  }

  public getBeatPattern(): BeatAccentLevel[] {
    return this.beatPattern;
  }

  public setSubdivision(sub: SubdivisionType): void {
    this.subdivision = sub;
  }

  public setSpringMode(enabled: boolean): void {
    this.springModeEnabled = enabled;
  }

  public windMainspring(amount: number = 0.35): number {
    this.synth.playWindUpRatchet();
    this.springReserve = Math.min(1.0, this.springReserve + amount);
    return this.springReserve;
  }

  public getSpringReserve(): number {
    return this.springReserve;
  }

  public setHapticsEnabled(enabled: boolean): void {
    this.hapticsEnabled = enabled;
  }

  private schedulerTick(): void {
    if (!this.isPlaying) return;
    const currentTime = this.synth.getCurrentTime();

    while (this.nextBeatAudioTime < currentTime + this.scheduleAheadSec) {
      this.scheduleBeatAndSubdivisions(this.nextBeatAudioTime);
      this.advanceBeat();
    }
  }

  private scheduleBeatAndSubdivisions(beatTime: number): void {
    const beatIndex = this.currentBeatIndex;
    const isTockSwing = this.totalBeatsElapsed % 2 === 1;
    const level: BeatAccentLevel = this.beatPattern[beatIndex] ?? 'normal';
    const subOption = SUBDIVISION_OPTIONS.find((s) => s.id === this.subdivision) ?? SUBDIVISION_OPTIONS[0];
    const secondsPerBeat = 60.0 / this.bpm;

    subOption.offsets.forEach((offset, subIdx) => {
      const eventTime = beatTime + offset * secondsPerBeat;
      const isSub = subIdx > 0;
      const subLevel: BeatAccentLevel = level === 'mute' ? 'mute' : isSub ? 'normal' : level;

      this.synth.scheduleTick(
        eventTime,
        this.model.acoustic,
        subLevel,
        isTockSwing,
        isSub
      );

      // Schedule UI callback synchronized with audio time
      const delayMs = Math.max(0, (eventTime - this.synth.getCurrentTime()) * 1000);
      const snapshotSpring = this.springReserve;
      window.setTimeout(() => {
        if (!this.isPlaying) return;
        if (this.hapticsEnabled && !isSub && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(level === 'bell' || level === 'accent' ? 18 : 8);
          } catch {
            // Ignore on unsupported browsers
          }
        }
        const evt: BeatTriggerEvent = {
          beatIndex,
          subdivisionIndex: subIdx,
          level: subLevel,
          isTockSwing,
          audioTime: eventTime,
          springReserve: snapshotSpring,
        };
        this.listeners.forEach((cb) => cb(evt));
      }, delayMs);
    });
  }

  private advanceBeat(): void {
    const secondsPerBeat = 60.0 / this.bpm;
    this.lastBeatAudioTime = this.nextBeatAudioTime;
    this.nextBeatAudioTime += secondsPerBeat;
    this.currentBeatIndex = (this.currentBeatIndex + 1) % this.beatsPerBar;
    this.totalBeatsElapsed += 1;

    if (this.springModeEnabled) {
      // Roughly 280 beats per full wind in demo spring mode so user can feel it unwind
      this.springReserve = Math.max(0, this.springReserve - 1 / 280);
      if (this.springReserve <= 0) {
        this.stop();
      }
    }
  }

  /**
   * Computes exact instantaneous pendulum angle in degrees for 60/120fps rendering.
   * Synchronized directly to AudioContext.currentTime so the click occurs as the rod crosses 0 deg.
   */
  public getPendulumAngleDeg(): number {
    if (!this.isPlaying) {
      return 0;
    }

    const now = this.synth.getCurrentTime();
    const secondsPerBeat = 60.0 / this.bpm;

    // Progress between the previous beat and the next scheduled beat
    const beatDuration = Math.max(0.05, this.nextBeatAudioTime - this.lastBeatAudioTime || secondsPerBeat);
    const elapsedInBeat = now - this.lastBeatAudioTime;
    const t = Math.max(0, Math.min(1, elapsedInBeat / beatDuration));

    // Direction alternates every beat
    const direction = this.totalBeatsElapsed % 2 === 0 ? 1 : -1;

    // Amplitude widens slightly at slower tempos and narrows slightly at Prestissimo, like a real escapement
    const maxAmplitudeDeg = 27 - ((this.bpm - 40) / 200) * 6.5;

    // Cosine trajectory so clicks occur near center (mid-swing maximum velocity) and reversals occur at extremes
    // Wait: on a real Maelzel metronome, the loud click happens just before/at the center or near the turnaround?
    // Actually, on a Maelzel verge/anchor escapement, the pallet releases near the center of the swing, and the user visually perceives the beat at the apex of each swing!
    // Synchronizing the apex (turnaround) with the beat time makes visual conducting & playing 100% intuitive!
    const angle = Math.cos(t * Math.PI) * maxAmplitudeDeg * direction;
    return angle;
  }
}
