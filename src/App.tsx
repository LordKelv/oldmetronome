import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play,
  Square,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  Smartphone,
  Monitor,
  Sparkles,
  BookOpen,
  Sliders,
  Plus,
  Minus,
  RotateCcw,
  Check,
  Trash2,
  Info,
  KeyRound,
  Hand,
} from 'lucide-react';
import {
  BeatAccentLevel,
  DEFAULT_REPERTOIRE_PRESETS,
  ITALIAN_TEMPO_MARKINGS,
  MAELZEL_SCALE_STEPS,
  METRONOME_MODELS,
  MetronomeModelId,
  RepertoirePreset,
  SUBDIVISION_OPTIONS,
  SubdivisionType,
  getTempoMarking,
  snapToNearestMaelzelStep,
} from './core/metronomeModels';
import { MetronomeEngine } from './core/metronomeEngine';
import { VintageMetronomeCabinet } from './components/VintageMetronomeCabinet';

const PRESETS_STORAGE_KEY = 'oldmetronome_repertoire_presets_v1';

export const App: React.FC = () => {
  // Singleton MetronomeEngine instance
  const engineRef = useRef<MetronomeEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new MetronomeEngine();
  }
  const engine = engineRef.current;

  // Core State
  const [modelId, setModelId] = useState<MetronomeModelId>('maelzel-1815');
  const [bpm, setBpm] = useState<number>(108);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [beatsPerBar, setBeatsPerBar] = useState<number>(4);
  const [bellEnabled, setBellEnabled] = useState<boolean>(true);
  const [beatPattern, setBeatPattern] = useState<BeatAccentLevel[]>([
    'bell',
    'normal',
    'normal',
    'normal',
  ]);
  const [subdivision, setSubdivision] = useState<SubdivisionType>('quarter');
  const [snapToMaelzelScale, setSnapToMaelzelScale] = useState<boolean>(false);

  // Active Beat Visual Feedback
  const [activeBeat, setActiveBeat] = useState<number>(-1);
  const [activeSubdivision, setActiveSubdivision] = useState<number>(0);
  const [lastBeatIsBell, setLastBeatIsBell] = useState<boolean>(false);

  // Acoustic & Mechanical Realism State
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [roomAmbience, setRoomAmbience] = useState<number>(0.22);
  const [escapementRealism, setEscapementRealism] = useState<boolean>(true);
  const [springModeEnabled, setSpringModeEnabled] = useState<boolean>(false);
  const [springReserve, setSpringReserve] = useState<number>(1.0);
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(true);

  // View & Navigation State (Web Studio vs iPhone Preview)
  const [iphonePreviewMode, setIphonePreviewMode] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<'metronome' | 'models' | 'rhythm' | 'repertoire'>('metronome');
  const [showIosGuideModal, setShowIosGuideModal] = useState<boolean>(false);

  // Repertoire Presets
  const [presets, setPresets] = useState<RepertoirePreset[]>(() => {
    try {
      const saved = localStorage.getItem(PRESETS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback to defaults
    }
    return DEFAULT_REPERTOIRE_PRESETS;
  });
  const [newPresetTitle, setNewPresetTitle] = useState<string>('');
  const [newPresetComposer, setNewPresetComposer] = useState<string>('');

  // Tap Tempo State
  const tapTimesRef = useRef<number[]>([]);
  const [tapFlash, setTapFlash] = useState<boolean>(false);

  const currentModel = useMemo(
    () => METRONOME_MODELS.find((m) => m.id === modelId) ?? METRONOME_MODELS[0],
    [modelId]
  );

  const tempoMarking = useMemo(() => getTempoMarking(bpm), [bpm]);

  // Subscribe to MetronomeEngine beat events
  useEffect(() => {
    const unsubscribe = engine.subscribe((evt) => {
      setActiveBeat(evt.beatIndex);
      setActiveSubdivision(evt.subdivisionIndex);
      setLastBeatIsBell(evt.level === 'bell');
      setSpringReserve(evt.springReserve);
      if (evt.springReserve <= 0 && engine.getIsPlaying() === false) {
        setIsPlaying(false);
      }
    });
    return unsubscribe;
  }, [engine]);

  // Keep WakeLock active while playing on iOS / modern browsers
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    if (isPlaying && 'wakeLock' in navigator) {
      navigator.wakeLock
        .request('screen')
        .then((sentinel) => {
          wakeLock = sentinel;
        })
        .catch(() => {});
    }
    return () => {
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, [isPlaying]);

  // Save presets to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
    } catch {
      // ignore storage errors
    }
  }, [presets]);

  // Handlers
  const handleBpmChange = useCallback(
    (nextBpm: number, playDetent: boolean = false) => {
      const clamped = Math.max(30, Math.min(240, Math.round(nextBpm)));
      setBpm(clamped);
      engine.setBpm(clamped);
      if (playDetent && !isMuted) {
        engine.getSynth().playWeightDetentClick(clamped);
      }
    },
    [engine, isMuted]
  );

  const handleTogglePlay = useCallback(() => {
    const next = engine.toggle();
    setIsPlaying(next);
    if (!next) {
      setActiveBeat(-1);
    }
  }, [engine]);

  const handleSelectModel = useCallback(
    (nextModelId: MetronomeModelId) => {
      setModelId(nextModelId);
      engine.setModel(nextModelId);
      const found = METRONOME_MODELS.find((m) => m.id === nextModelId);
      if (found) {
        if (!found.hasPullBell) {
          setBellEnabled(false);
          const updatedPattern: BeatAccentLevel[] = beatPattern.map((b, idx) =>
            idx === 0 ? 'accent' : b === 'bell' ? 'accent' : b
          );
          setBeatPattern(updatedPattern);
          engine.setBeatPattern(updatedPattern);
        } else {
          // Restore bell on beat 1 if bellEnabled
          const updatedPattern: BeatAccentLevel[] = beatPattern.map((b, idx) =>
            idx === 0 ? (bellEnabled ? 'bell' : 'accent') : b
          );
          setBeatPattern(updatedPattern);
          engine.setBeatPattern(updatedPattern);
        }
      }
    },
    [engine, beatPattern, bellEnabled]
  );

  const handleBeatsPerBarChange = useCallback(
    (count: number) => {
      const clamped = Math.max(1, Math.min(12, count));
      setBeatsPerBar(clamped);
      const canBell = bellEnabled && currentModel.hasPullBell;
      engine.setBeatsPerBar(clamped, canBell);
      setBeatPattern([...engine.getBeatPattern()]);
    },
    [engine, bellEnabled, currentModel.hasPullBell]
  );

  const handleToggleBell = useCallback(() => {
    if (!currentModel.hasPullBell) return;
    const nextBell = !bellEnabled;
    setBellEnabled(nextBell);
    const nextPattern = beatPattern.map((lvl, idx) => {
      if (idx === 0) return nextBell ? 'bell' : 'accent';
      return lvl;
    });
    setBeatPattern(nextPattern);
    engine.setBeatPattern(nextPattern);
    if (!isMuted) {
      engine.getSynth().playWeightDetentClick(nextBell ? 180 : 90);
    }
  }, [bellEnabled, beatPattern, currentModel.hasPullBell, engine, isMuted]);

  const handleCycleBellFromCabinet = useCallback(() => {
    if (!currentModel.hasPullBell) return;
    // Cycle: 4 -> 3 -> 2 -> 6 -> Off -> 4
    if (!bellEnabled) {
      setBellEnabled(true);
      handleBeatsPerBarChange(4);
      const nextPattern: BeatAccentLevel[] = ['bell', 'normal', 'normal', 'normal'];
      setBeatPattern(nextPattern);
      engine.setBeatPattern(nextPattern);
    } else if (beatsPerBar === 4) {
      handleBeatsPerBarChange(3);
    } else if (beatsPerBar === 3) {
      handleBeatsPerBarChange(2);
    } else if (beatsPerBar === 2) {
      handleBeatsPerBarChange(6);
    } else {
      setBellEnabled(false);
      const nextPattern = beatPattern.map((lvl) => (lvl === 'bell' ? 'accent' : lvl));
      setBeatPattern(nextPattern);
      engine.setBeatPattern(nextPattern);
    }
    if (!isMuted) {
      engine.getSynth().playWeightDetentClick(150);
    }
  }, [bellEnabled, beatsPerBar, beatPattern, currentModel.hasPullBell, engine, handleBeatsPerBarChange, isMuted]);

  const handleCycleBeatOrb = (index: number) => {
    const order: BeatAccentLevel[] = currentModel.hasPullBell
      ? ['bell', 'accent', 'normal', 'mute']
      : ['accent', 'normal', 'mute'];
    const current = beatPattern[index] ?? 'normal';
    const next = order[(order.indexOf(current) + 1) % order.length];
    const nextPattern = [...beatPattern];
    nextPattern[index] = next;
    setBeatPattern(nextPattern);
    engine.setBeatPattern(nextPattern);
    if (index === 0) {
      setBellEnabled(next === 'bell');
    }
  };

  const handleSubdivisionChange = (sub: SubdivisionType) => {
    setSubdivision(sub);
    engine.setSubdivision(sub);
  };

  const handleTapTempo = useCallback(() => {
    const now = performance.now();
    setTapFlash(true);
    window.setTimeout(() => setTapFlash(false), 140);

    const recent = tapTimesRef.current.filter((t) => now - t < 2500);
    recent.push(now);
    tapTimesRef.current = recent.slice(-6);

    if (tapTimesRef.current.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < tapTimesRef.current.length; i++) {
        intervals.push(tapTimesRef.current[i] - tapTimesRef.current[i - 1]);
      }
      const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      let calculatedBpm = Math.round(60000 / avgMs);
      if (snapToMaelzelScale) {
        calculatedBpm = snapToNearestMaelzelStep(calculatedBpm);
      }
      handleBpmChange(calculatedBpm, true);
    } else if (!isMuted) {
      engine.getSynth().playWeightDetentClick(bpm);
    }
  }, [bpm, engine, handleBpmChange, isMuted, snapToMaelzelScale]);

  const handleWindSpring = useCallback(() => {
    const updated = engine.windMainspring(0.4);
    setSpringReserve(updated);
  }, [engine]);

  // Keyboard shortcuts (Space to toggle play, Up/Down to adjust BPM, T for tap tempo)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        handleBpmChange(bpm + (e.shiftKey ? 5 : 1), true);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        handleBpmChange(bpm - (e.shiftKey ? 5 : 1), true);
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        handleTapTempo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [bpm, handleBpmChange, handleTapTempo, handleTogglePlay]);

  const handleLoadPreset = (preset: RepertoirePreset) => {
    handleSelectModel(preset.modelId);
    handleBpmChange(preset.bpm, true);
    setSubdivision(preset.subdivision);
    engine.setSubdivision(preset.subdivision);
    const modelObj = METRONOME_MODELS.find((m) => m.id === preset.modelId) ?? currentModel;
    const canBell = preset.bellEnabled && modelObj.hasPullBell;
    setBellEnabled(canBell);
    setBeatsPerBar(preset.beatsPerBar);
    engine.setBeatsPerBar(preset.beatsPerBar, canBell);
    setBeatPattern([...engine.getBeatPattern()]);
  };

  const handleAddPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetTitle.trim()) return;
    const item: RepertoirePreset = {
      id: `custom-${Date.now()}`,
      title: newPresetTitle.trim(),
      composer: newPresetComposer.trim() || 'Custom Study',
      bpm,
      beatsPerBar,
      bellEnabled,
      subdivision,
      modelId,
    };
    setPresets((prev) => [item, ...prev]);
    setNewPresetTitle('');
    setNewPresetComposer('');
  };

  const handleDeletePreset = (id: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  };

  const stepBpm = (direction: 1 | -1, coarse: boolean = false) => {
    if (snapToMaelzelScale && !coarse) {
      const currentIdx = MAELZEL_SCALE_STEPS.findIndex((s) => s >= bpm);
      const nextIdx = Math.max(
        0,
        Math.min(MAELZEL_SCALE_STEPS.length - 1, (currentIdx === -1 ? 0 : currentIdx) + direction)
      );
      handleBpmChange(MAELZEL_SCALE_STEPS[nextIdx], true);
    } else {
      handleBpmChange(bpm + direction * (coarse ? 5 : 1), true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col text-[#f5ebd6] selection:bg-[#d4a359]/30">
      {/* Top Atelier Navigation Bar */}
      <header className="border-b border-[#d4a359]/20 bg-[#140e0a]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Brand Crest */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6e2e1e] to-[#2b0f08] border border-[#d4a359]/60 flex items-center justify-center shadow-inner">
              <span className="font-serif font-bold text-lg text-[#f7e1a0]">M</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-lg sm:text-xl font-bold tracking-wide text-[#f7e7c4]">
                  Maelzel &amp; Co.
                </h1>
                <span className="hidden md:inline-block text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#d4a359]/15 text-[#e5be77] border border-[#d4a359]/30">
                  Est. 1815 • Paris &amp; Wien
                </span>
              </div>
              <p className="text-xs text-[#b89f7d] hidden sm:block">
                Historical Mechanical Metronome Atelier &amp; Acoustic Chronometer
              </p>
            </div>
          </div>

          {/* Right Quick Actions: Web Studio vs iPhone Frame Toggle + iOS Guide */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center bg-[#1f1610] p-1 rounded-xl border border-[#d4a359]/25">
              <button
                onClick={() => setIphonePreviewMode(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  !iphonePreviewMode
                    ? 'bg-gradient-to-b from-[#d4a359] to-[#9c6e27] text-[#170f09] font-semibold shadow'
                    : 'text-[#cbb593] hover:text-white'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Atelier Studio</span>
              </button>
              <button
                onClick={() => setIphonePreviewMode(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  iphonePreviewMode
                    ? 'bg-gradient-to-b from-[#d4a359] to-[#9c6e27] text-[#170f09] font-semibold shadow'
                    : 'text-[#cbb593] hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>iPhone App View</span>
              </button>
            </div>

            <button
              onClick={() => setShowIosGuideModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#261a12] hover:bg-[#322218] border border-[#d4a359]/35 text-xs text-[#ebd5b3] transition"
              title="iPhone App & Capacitor Architecture"
            >
              <Info className="w-3.5 h-3.5 text-[#d4a359]" />
              <span className="hidden lg:inline">iOS Architecture</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container: Switches between Full Studio Layout and iPhone 16 Pro Shell Preview */}
      {iphonePreviewMode ? (
        <main className="flex-1 flex flex-col items-center justify-center py-6 px-3">
          {/* Simulated iPhone 16 Pro Titanium Bezel */}
          <div className="relative w-full max-w-[402px] h-[832px] rounded-[54px] bg-[#0e0a08] border-[10px] border-[#3a3028] shadow-[0_30px_90px_rgba(0,0,0,0.95),0_0_0_2px_rgba(212,163,89,0.35)] flex flex-col overflow-hidden">
            {/* iPhone Dynamic Island */}
            <div className="pt-3 pb-2 px-7 flex items-center justify-between bg-[#140e0a] z-20">
              <span className="text-[11px] font-mono font-semibold text-[#e6d5b8]">9:41</span>
              <div className="w-28 h-6 bg-black rounded-full border border-white/10 flex items-center justify-between px-3">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isPlaying ? 'bg-amber-400 animate-pulse' : 'bg-zinc-700'
                  }`}
                />
                <span className="text-[9px] font-mono text-[#d4a359]">
                  {isPlaying ? `${bpm} BPM` : 'IDLE'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#e6d5b8]">
                <span>5G</span>
                <div className="w-5 h-2.5 rounded-sm border border-[#e6d5b8]/60 p-0.5">
                  <div className="w-full h-full bg-[#d4a359] rounded-[1px]" />
                </div>
              </div>
            </div>

            {/* Active Mobile Screen Content */}
            <div className="flex-1 overflow-y-auto px-4 pt-1 pb-4 flex flex-col justify-between">
              {mobileTab === 'metronome' && (
                <div className="flex flex-col items-center justify-between h-full">
                  {/* Top Compact Tempo Readout */}
                  <div className="w-full flex items-center justify-between bg-[#1c130d]/90 border border-[#d4a359]/25 rounded-2xl px-3.5 py-2 mb-1">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-[#b89f7d]">
                        {currentModel.name}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-2xl font-bold text-[#f7e1a0]">{bpm}</span>
                        <span className="text-xs font-serif italic text-[#d4a359]">
                          {tempoMarking.name}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => stepBpm(-1)}
                        className="w-8 h-8 rounded-lg bg-[#281b12] border border-[#d4a359]/30 flex items-center justify-center active:scale-95"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => stepBpm(1)}
                        className="w-8 h-8 rounded-lg bg-[#281b12] border border-[#d4a359]/30 flex items-center justify-center active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={handleTapTempo}
                        className="px-2.5 h-8 rounded-lg bg-[#281b12] border border-[#d4a359]/30 text-[11px] font-mono font-semibold text-[#e6cfa8] active:scale-95"
                      >
                        TAP
                      </button>
                    </div>
                  </div>

                  {/* Interactive Metronome Cabinet sized for iPhone screen */}
                  <div className="w-full max-w-[310px] my-auto">
                    <VintageMetronomeCabinet
                      model={currentModel}
                      bpm={bpm}
                      isPlaying={isPlaying}
                      snapToMaelzelScale={snapToMaelzelScale}
                      bellEnabled={bellEnabled}
                      beatsPerBar={beatsPerBar}
                      activeBeat={activeBeat}
                      lastBeatIsBell={lastBeatIsBell}
                      springModeEnabled={springModeEnabled}
                      springReserve={springReserve}
                      engine={engine}
                      onBpmChange={handleBpmChange}
                      onTogglePlay={handleTogglePlay}
                      onCycleBell={handleCycleBellFromCabinet}
                      onWindSpring={handleWindSpring}
                    />
                  </div>

                  {/* Bottom Play & Beat Strip */}
                  <div className="w-full space-y-2 mt-1">
                    <div className="flex items-center justify-center gap-1.5">
                      {beatPattern.map((lvl, idx) => {
                        const isActive = isPlaying && activeBeat === idx;
                        return (
                          <button
                            key={idx}
                            onClick={() => handleCycleBeatOrb(idx)}
                            className={`h-7 px-2.5 rounded-full text-[11px] font-mono font-bold transition-all border ${
                              isActive
                                ? 'bg-[#f7d983] text-[#170f09] border-white scale-110 shadow-[0_0_12px_rgba(247,217,131,0.8)]'
                                : lvl === 'bell'
                                ? 'bg-[#462d14] text-[#f7d983] border-[#d4a359]/60'
                                : lvl === 'accent'
                                ? 'bg-[#332214] text-[#e5c99b] border-[#d4a359]/40'
                                : lvl === 'mute'
                                ? 'bg-[#17110d] text-[#6e5d49] border-[#423224]'
                                : 'bg-[#221710] text-[#b89f7d] border-[#d4a359]/20'
                            }`}
                          >
                            {idx + 1}
                            {lvl === 'bell' ? '🔔' : lvl === 'accent' ? '▲' : lvl === 'mute' ? '×' : ''}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={handleTogglePlay}
                      className={`w-full py-3 rounded-2xl font-serif font-bold text-base tracking-wide flex items-center justify-center gap-2 shadow-lg transition active:scale-[0.99] ${
                        isPlaying
                          ? 'bg-gradient-to-r from-[#8f2419] to-[#5e140d] text-white border border-[#e86f61]/50'
                          : 'bg-gradient-to-r from-[#e0b35c] via-[#d4a359] to-[#9e7029] text-[#170f09] border border-[#fff2c2]/50'
                      }`}
                    >
                      {isPlaying ? (
                        <>
                          <Square className="w-4 h-4 fill-current" />
                          <span>Latch Pendulum (Stop)</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current" />
                          <span>Release Pendulum (Start)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {mobileTab === 'models' && (
                <div className="space-y-3 py-2">
                  <h2 className="font-serif text-lg font-bold text-[#f7e1a0]">
                    Historical Collection
                  </h2>
                  {METRONOME_MODELS.map((m) => {
                    const selected = m.id === modelId;
                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          handleSelectModel(m.id);
                          setMobileTab('metronome');
                        }}
                        className={`w-full text-left p-3.5 rounded-2xl border transition-all ${
                          selected
                            ? 'bg-[#2b1d13] border-[#d4a359] shadow-[0_0_20px_rgba(212,163,89,0.2)]'
                            : 'bg-[#1a120c] border-[#d4a359]/20 hover:border-[#d4a359]/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-serif font-bold text-base text-[#f7e7c4]">
                            {m.name}
                          </span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#d4a359]/15 text-[#e5be77]">
                            {m.origin}
                          </span>
                        </div>
                        <p className="text-xs text-[#d4a359] mt-0.5">{m.materials}</p>
                        <p className="text-xs text-[#b89f7d] mt-1.5 leading-relaxed">
                          {m.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}

              {mobileTab === 'rhythm' && (
                <div className="space-y-4 py-2">
                  <h2 className="font-serif text-lg font-bold text-[#f7e1a0]">
                    Meter, Bell &amp; Acoustics
                  </h2>
                  <div className="p-3.5 rounded-2xl bg-[#1c130d] border border-[#d4a359]/25 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#dec8a6]">Beats per Measure</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleBeatsPerBarChange(beatsPerBar - 1)}
                          className="w-7 h-7 rounded bg-[#2b1d14] border border-[#d4a359]/30 flex items-center justify-center"
                        >
                          -
                        </button>
                        <span className="font-mono font-bold text-sm w-6 text-center">
                          {beatsPerBar}
                        </span>
                        <button
                          onClick={() => handleBeatsPerBarChange(beatsPerBar + 1)}
                          className="w-7 h-7 rounded bg-[#2b1d14] border border-[#d4a359]/30 flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-xs font-medium text-[#dec8a6]">Subdivision</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {SUBDIVISION_OPTIONS.map((sub) => (
                          <button
                            key={sub.id}
                            onClick={() => handleSubdivisionChange(sub.id)}
                            className={`p-2 rounded-xl border text-center transition ${
                              subdivision === sub.id
                                ? 'bg-[#d4a359] text-[#170f09] border-[#fff1be] font-bold'
                                : 'bg-[#241810] text-[#cbb593] border-[#d4a359]/20'
                            }`}
                          >
                            <div className="text-sm">{sub.symbol}</div>
                            <div className="text-[10px]">{sub.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#1c130d] border border-[#d4a359]/25 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#dec8a6]">Maelzel Stepped Detents</span>
                      <input
                        type="checkbox"
                        checked={snapToMaelzelScale}
                        onChange={(e) => setSnapToMaelzelScale(e.target.checked)}
                        className="accent-[#d4a359] w-4 h-4"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#dec8a6]">Asymmetric Tick-TockPallet</span>
                      <input
                        type="checkbox"
                        checked={escapementRealism}
                        onChange={(e) => {
                          setEscapementRealism(e.target.checked);
                          engine.getSynth().setEscapementRealism(e.target.checked);
                        }}
                        className="accent-[#d4a359] w-4 h-4"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#dec8a6]">Mainspring Unwind Mode</span>
                      <input
                        type="checkbox"
                        checked={springModeEnabled}
                        onChange={(e) => {
                          setSpringModeEnabled(e.target.checked);
                          engine.setSpringMode(e.target.checked);
                        }}
                        className="accent-[#d4a359] w-4 h-4"
                      />
                    </div>
                  </div>
                </div>
              )}

              {mobileTab === 'repertoire' && (
                <div className="space-y-2.5 py-2">
                  <h2 className="font-serif text-lg font-bold text-[#f7e1a0]">
                    Practice Setlist
                  </h2>
                  {presets.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        handleLoadPreset(p);
                        setMobileTab('metronome');
                      }}
                      className="w-full text-left p-3 rounded-2xl bg-[#1c130d] border border-[#d4a359]/25 hover:border-[#d4a359] transition flex items-center justify-between"
                    >
                      <div>
                        <div className="font-serif font-semibold text-sm text-[#f7e7c4]">
                          {p.title}
                        </div>
                        <div className="text-[11px] text-[#b89f7d]">{p.composer}</div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-sm font-bold text-[#f7d983]">{p.bpm} BPM</div>
                        <div className="text-[10px] text-[#b89f7d]">{p.beatsPerBar}/4</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* iOS Bottom Tab Bar */}
            <nav className="bg-[#160f0b]/95 border-t border-[#d4a359]/20 px-3 pt-2 pb-5 grid grid-cols-4 gap-1">
              {[
                { id: 'metronome', label: 'Metronome', icon: Sparkles },
                { id: 'models', label: 'Models', icon: KeyRound },
                { id: 'rhythm', label: 'Mechanics', icon: Sliders },
                { id: 'repertoire', label: 'Repertoire', icon: BookOpen },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = mobileTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setMobileTab(tab.id as typeof mobileTab)}
                    className={`flex flex-col items-center gap-1 py-1 rounded-xl transition ${
                      active ? 'text-[#f7d983]' : 'text-[#8c765c]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px] font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* iOS Home Indicator Pill */}
            <div className="bg-[#160f0b] pb-2 flex justify-center">
              <div className="w-32 h-1 rounded-full bg-white/30" />
            </div>
          </div>
        </main>
      ) : (
        /* FULL WEB ATELIER STUDIO VIEW */
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN (4 cols): Historical Metronome Selector & Repertoire Setlist */}
          <div className="lg:col-span-4 space-y-5 order-2 lg:order-1">
            {/* 1. Classic Metronome Model Selector */}
            <section className="rounded-3xl bg-[#18110c]/90 border border-[#d4a359]/25 p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-3.5">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#d4a359]">
                    Curated Collection
                  </span>
                  <h2 className="font-serif text-xl font-bold text-[#f7e7c4]">
                    Select Historical Model
                  </h2>
                </div>
                <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-[#261a11] border border-[#d4a359]/30 text-[#e5be77]">
                  5 Originals
                </span>
              </div>

              <div className="space-y-2.5">
                {METRONOME_MODELS.map((m) => {
                  const isSelected = m.id === modelId;
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleSelectModel(m.id)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all relative overflow-hidden group ${
                        isSelected
                          ? 'bg-gradient-to-r from-[#2e1e13] to-[#21150d] border-[#d4a359] shadow-[0_6px_25px_rgba(212,163,89,0.18)]'
                          : 'bg-[#140e0a]/80 border-[#d4a359]/15 hover:border-[#d4a359]/45 hover:bg-[#1e150f]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          {/* Color Swatch Orb */}
                          <span
                            className="w-4 h-4 rounded-full border border-white/30 shrink-0 shadow-inner"
                            style={{
                              background: `linear-gradient(135deg, ${m.palette.caseOuterStart}, ${m.palette.caseOuterEnd})`,
                            }}
                          />
                          <div>
                            <div className="font-serif font-bold text-base text-[#f7e7c4] flex items-center gap-2">
                              {m.name}
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-[#f7d983] shrink-0" />
                              )}
                            </div>
                            <div className="text-[11px] text-[#c7b293]">{m.subtitle}</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#d4a359]/15 text-[#e5be77] shrink-0">
                          {m.origin}
                        </span>
                      </div>

                      {isSelected && (
                        <div className="mt-2.5 pt-2.5 border-t border-[#d4a359]/20 text-xs text-[#cbb593] space-y-1">
                          <div className="text-[11px] font-mono text-[#e5be77]">
                            Cabinet: {m.materials}
                          </div>
                          <p className="leading-relaxed text-[11.5px] text-[#bda685]">
                            {m.description}
                          </p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 2. Classical & Jazz Repertoire Setlist */}
            <section className="rounded-3xl bg-[#18110c]/90 border border-[#d4a359]/25 p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#d4a359]">
                    Practice Bench
                  </span>
                  <h2 className="font-serif text-lg font-bold text-[#f7e7c4]">
                    Repertoire &amp; Saved Tempos
                  </h2>
                </div>
                <BookOpen className="w-4 h-4 text-[#d4a359]" />
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#130d09] border border-[#d4a359]/20 hover:border-[#d4a359]/50 transition group"
                  >
                    <button
                      onClick={() => handleLoadPreset(preset)}
                      className="flex-1 text-left"
                    >
                      <div className="font-serif font-semibold text-sm text-[#f5e6c8] group-hover:text-[#f7d983] transition">
                        {preset.title}
                      </div>
                      <div className="text-[11px] text-[#a89173]">
                        {preset.composer} •{' '}
                        {METRONOME_MODELS.find((m) => m.id === preset.modelId)?.name}
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleLoadPreset(preset)}
                        className="text-right font-mono px-2 py-1 rounded-lg bg-[#241810] border border-[#d4a359]/25 text-xs font-bold text-[#f7d983]"
                      >
                        {preset.bpm} <span className="text-[10px] font-normal">BPM</span>
                      </button>
                      {preset.id.startsWith('custom-') && (
                        <button
                          onClick={() => handleDeletePreset(preset.id)}
                          className="p-1.5 text-[#8c765c] hover:text-red-400 transition"
                          title="Delete preset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Save Current State as Preset */}
              <form onSubmit={handleAddPreset} className="mt-3 pt-3 border-t border-[#d4a359]/15 flex gap-2">
                <input
                  type="text"
                  value={newPresetTitle}
                  onChange={(e) => setNewPresetTitle(e.target.value)}
                  placeholder="Save piece title (e.g. Clair de Lune)..."
                  className="flex-1 bg-[#120c08] border border-[#d4a359]/30 rounded-xl px-3 py-1.5 text-xs text-[#f5ebd6] placeholder-[#7d6850] focus:outline-none focus:border-[#d4a359]"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-[#2c1e14] hover:bg-[#3b281b] border border-[#d4a359]/40 text-xs font-mono font-semibold text-[#f7d983] transition shrink-0"
                >
                  + Save ({bpm})
                </button>
              </form>
            </section>
          </div>

          {/* CENTER COLUMN (4 cols): The Interactive Vintage Metronome Cabinet */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center order-1 lg:order-2">
            {/* Active Model Crest Banner above Cabinet */}
            <div className="w-full text-center mb-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#1f150e] border border-[#d4a359]/30 text-xs text-[#e5be77] mb-1">
                <span className="font-mono font-semibold">{currentModel.year}</span>
                <span>•</span>
                <span className="font-serif italic">{currentModel.origin}</span>
              </div>
            </div>

            <VintageMetronomeCabinet
              model={currentModel}
              bpm={bpm}
              isPlaying={isPlaying}
              snapToMaelzelScale={snapToMaelzelScale}
              bellEnabled={bellEnabled}
              beatsPerBar={beatsPerBar}
              activeBeat={activeBeat}
              lastBeatIsBell={lastBeatIsBell}
              springModeEnabled={springModeEnabled}
              springReserve={springReserve}
              engine={engine}
              onBpmChange={handleBpmChange}
              onTogglePlay={handleTogglePlay}
              onCycleBell={handleCycleBellFromCabinet}
              onWindSpring={handleWindSpring}
            />

            {/* Primary Start / Stop Escapement Release Button */}
            <div className="w-full max-w-[360px] mt-4">
              <button
                onClick={handleTogglePlay}
                className={`w-full py-3.5 px-6 rounded-2xl font-serif font-bold text-lg tracking-wide flex items-center justify-center gap-3 shadow-2xl transition-all active:scale-[0.99] ${
                  isPlaying
                    ? 'bg-gradient-to-r from-[#8f2419] via-[#751b12] to-[#54110a] text-[#ffece8] border border-[#f27d70]/50 shadow-[0_10px_30px_rgba(143,36,25,0.45)]'
                    : 'bg-gradient-to-r from-[#e6bc65] via-[#d4a359] to-[#9c6e24] text-[#170f09] border border-[#fff3c9]/60 shadow-[0_10px_30px_rgba(212,163,89,0.3)] hover:brightness-105'
                }`}
              >
                {isPlaying ? (
                  <>
                    <Square className="w-5 h-5 fill-current" />
                    <span>Latch Pendulum (Stop)</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    <span>Release Pendulum (Start)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN (4 cols): Precision Tempo, Meter/Bell Pattern & Horological Acoustics */}
          <div className="lg:col-span-4 space-y-5 order-3">
            {/* 1. Engraved Tempo & Italian Marking Console */}
            <section className="rounded-3xl bg-[#18110c]/90 border border-[#d4a359]/25 p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#d4a359]">
                    Maelzel Scale Regulator
                  </span>
                  <h2 className="font-serif text-xl font-bold text-[#f7e7c4]">
                    Tempo &amp; Cadence
                  </h2>
                </div>
                <button
                  onClick={handleTapTempo}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-mono text-xs font-bold border transition-all active:scale-95 ${
                    tapFlash
                      ? 'bg-[#f7d983] text-[#170f09] border-white shadow-[0_0_15px_rgba(247,217,131,0.7)]'
                      : 'bg-[#281b12] hover:bg-[#362418] text-[#f7d983] border-[#d4a359]/45'
                  }`}
                  title="Tap repeatedly or press 'T' key to set tempo"
                >
                  <Hand className="w-3.5 h-3.5" />
                  <span>TAP TEMPO</span>
                </button>
              </div>

              {/* Large Brass Dial Readout */}
              <div className="rounded-2xl bg-gradient-to-b from-[#120c08] to-[#1b120c] border border-[#d4a359]/35 p-4 flex items-center justify-between mb-4 shadow-inner">
                <div>
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-mono text-5xl font-extrabold tracking-tight text-[#f7e1a0]">
                      {bpm}
                    </span>
                    <span className="font-mono text-xs uppercase tracking-widest text-[#b89f7d]">
                      M.M. (♩/min)
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-serif italic font-semibold text-lg text-[#e5be77]">
                      {tempoMarking.name}
                    </span>
                    <span className="text-xs text-[#9c8466]">— {tempoMarking.character}</span>
                  </div>
                </div>

                {/* Fine & Coarse Stepper Buttons */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => stepBpm(-1, false)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#261a11] hover:bg-[#342317] border border-[#d4a359]/30 font-mono text-xs font-bold text-[#f5ebd6] active:scale-95"
                    title="Decrease 1 step"
                  >
                    -1
                  </button>
                  <button
                    onClick={() => stepBpm(1, false)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#261a11] hover:bg-[#342317] border border-[#d4a359]/30 font-mono text-xs font-bold text-[#f5ebd6] active:scale-95"
                    title="Increase 1 step"
                  >
                    +1
                  </button>
                  <button
                    onClick={() => stepBpm(-1, true)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#1d140d] hover:bg-[#2a1d13] border border-[#d4a359]/20 font-mono text-xs text-[#cbb593] active:scale-95"
                    title="Decrease 5 BPM"
                  >
                    -5
                  </button>
                  <button
                    onClick={() => stepBpm(1, true)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#1d140d] hover:bg-[#2a1d13] border border-[#d4a359]/20 font-mono text-xs text-[#cbb593] active:scale-95"
                    title="Increase 5 BPM"
                  >
                    +5
                  </button>
                </div>
              </div>

              {/* Brass Range Slider */}
              <div className="space-y-1.5 mb-4">
                <input
                  type="range"
                  min={30}
                  max={240}
                  value={bpm}
                  onChange={(e) => {
                    const raw = Number(e.target.value);
                    handleBpmChange(
                      snapToMaelzelScale ? snapToNearestMaelzelStep(raw) : raw,
                      false
                    );
                  }}
                  className="w-full brass-slider"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#9c8466]">
                  <span>30 (Larghissimo)</span>
                  <span>108 (Moderato)</span>
                  <span>208+ (Prestissimo)</span>
                </div>
              </div>

              {/* Classical Italian Tempo Quick Presets */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'Grave', bpm: 44 },
                  { label: 'Largo', bpm: 50 },
                  { label: 'Adagio', bpm: 66 },
                  { label: 'Andante', bpm: 84 },
                  { label: 'Moderato', bpm: 104 },
                  { label: 'Allegro', bpm: 132 },
                  { label: 'Vivace', bpm: 160 },
                  { label: 'Presto', bpm: 184 },
                ].map((mark) => {
                  const active = tempoMarking.name === mark.label;
                  return (
                    <button
                      key={mark.label}
                      onClick={() => handleBpmChange(mark.bpm, true)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-serif transition border ${
                        active
                          ? 'bg-[#d4a359] text-[#170f09] border-[#fff2c2] font-bold'
                          : 'bg-[#21160f] text-[#cbb593] border-[#d4a359]/20 hover:border-[#d4a359]/50'
                      }`}
                    >
                      {mark.label} <span className="font-mono text-[10px] opacity-80">{mark.bpm}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 2. Mechanical Bell Drawbar, Beat Matrix & Subdivisions */}
            <section className="rounded-3xl bg-[#18110c]/90 border border-[#d4a359]/25 p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#d4a359]">
                    Striker &amp; Division
                  </span>
                  <h2 className="font-serif text-lg font-bold text-[#f7e7c4]">
                    Bell Chime &amp; Meter
                  </h2>
                </div>

                {/* Pull-Bell Toggle Button */}
                <button
                  onClick={handleToggleBell}
                  disabled={!currentModel.hasPullBell}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold border transition ${
                    !currentModel.hasPullBell
                      ? 'bg-[#17110d] text-[#665644] border-[#33271d] cursor-not-allowed'
                      : bellEnabled
                      ? 'bg-[#3d2812] text-[#f7d983] border-[#d4a359]'
                      : 'bg-[#21160f] text-[#b89f7d] border-[#d4a359]/25'
                  }`}
                >
                  {bellEnabled && currentModel.hasPullBell ? (
                    <>
                      <Bell className="w-3.5 h-3.5 text-[#f7d983]" />
                      <span>Bell Pull: Active</span>
                    </>
                  ) : (
                    <>
                      <BellOff className="w-3.5 h-3.5" />
                      <span>{currentModel.hasPullBell ? 'Bell Pull: In' : 'No Bell on Model'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Beats per bar selector */}
              <div className="flex items-center justify-between bg-[#130d09] p-3 rounded-2xl border border-[#d4a359]/20">
                <span className="text-xs text-[#dec8a6]">Beats per Measure</span>
                <div className="flex items-center gap-1.5">
                  {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <button
                      key={n}
                      onClick={() => handleBeatsPerBarChange(n)}
                      className={`w-7 h-7 rounded-lg font-mono text-xs font-bold border transition ${
                        beatsPerBar === n
                          ? 'bg-[#d4a359] text-[#170f09] border-[#fff1be]'
                          : 'bg-[#21160f] text-[#b89f7d] border-[#d4a359]/20 hover:border-[#d4a359]/50'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interactive Beat Accent Matrix (Click to cycle Bell / Accent / Normal / Mute) */}
              <div>
                <div className="flex items-center justify-between text-[11px] text-[#a89173] mb-2">
                  <span>Click any beat to cycle: 🔔 Bell → ▲ Accent → • Normal → × Mute</span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
                  {beatPattern.map((lvl, idx) => {
                    const isCurrentBeat = isPlaying && activeBeat === idx;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleCycleBeatOrb(idx)}
                        className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                          isCurrentBeat
                            ? 'bg-[#f7d983] text-[#170f09] border-white scale-105 shadow-[0_0_16px_rgba(247,217,131,0.75)]'
                            : lvl === 'bell'
                            ? 'bg-[#382411] text-[#f7d983] border-[#d4a359]/60'
                            : lvl === 'accent'
                            ? 'bg-[#2b1d12] text-[#e5be77] border-[#d4a359]/40'
                            : lvl === 'mute'
                            ? 'bg-[#130d09] text-[#665544] border-[#2e2218]'
                            : 'bg-[#1e140d] text-[#c7b293] border-[#d4a359]/20'
                        }`}
                      >
                        <span className="font-mono text-xs font-bold">Beat {idx + 1}</span>
                        <span className="text-[10px] font-mono uppercase">
                          {lvl === 'bell'
                            ? '🔔 Bell'
                            : lvl === 'accent'
                            ? '▲ Accent'
                            : lvl === 'mute'
                            ? '× Rest'
                            : '• Tick'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subdivision Selector */}
              <div>
                <span className="text-xs text-[#dec8a6] block mb-2">Rhythmic Subdivision</span>
                <div className="grid grid-cols-5 gap-1.5">
                  {SUBDIVISION_OPTIONS.map((sub) => {
                    const selected = subdivision === sub.id;
                    return (
                      <button
                        key={sub.id}
                        onClick={() => handleSubdivisionChange(sub.id)}
                        className={`py-2 px-1.5 rounded-xl border text-center transition ${
                          selected
                            ? 'bg-[#d4a359] text-[#170f09] border-[#fff2c2] font-bold shadow'
                            : 'bg-[#1f150e] text-[#cbb593] border-[#d4a359]/20 hover:border-[#d4a359]/50'
                        }`}
                        title={sub.description}
                      >
                        <div className="text-base leading-none mb-1">{sub.symbol}</div>
                        <div className="text-[10px] font-mono">{sub.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* 3. Horological Mechanics & Parlor Acoustics */}
            <section className="rounded-3xl bg-[#18110c]/90 border border-[#d4a359]/25 p-5 shadow-2xl space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#d4a359]">
                    Clockwork &amp; Soundbox
                  </span>
                  <h2 className="font-serif text-lg font-bold text-[#f7e7c4]">
                    Mechanical Realism
                  </h2>
                </div>

                {/* Mainspring Wind Button */}
                <button
                  onClick={handleWindSpring}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2a1d13] hover:bg-[#38271a] border border-[#d4a359]/45 text-xs font-mono font-semibold text-[#f7d983] transition active:scale-95"
                  title="Wind clockwork mainspring key"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Wind Key ({Math.round(springReserve * 100)}%)</span>
                </button>
              </div>

              {/* Volume & Room Ambience Sliders */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const nextMute = !isMuted;
                      setIsMuted(nextMute);
                      engine.getSynth().setVolume(nextMute ? 0 : volume);
                    }}
                    className="text-[#d4a359] hover:text-[#f7d983]"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <span className="text-xs text-[#cbb593] w-28">Soundbox Level</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setVolume(v);
                      setIsMuted(v === 0);
                      engine.getSynth().setVolume(v);
                    }}
                    className="flex-1 brass-slider"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-[#d4a359]" />
                  <span className="text-xs text-[#cbb593] w-28">Parlor Resonance</span>
                  <input
                    type="range"
                    min={0}
                    max={0.8}
                    step={0.02}
                    value={roomAmbience}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setRoomAmbience(val);
                      engine.getSynth().setRoomAmbience(val);
                    }}
                    className="flex-1 brass-slider"
                  />
                </div>
              </div>

              {/* Authentic Mechanical Switches */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#d4a359]/15">
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#130d09] border border-[#d4a359]/15 cursor-pointer">
                  <span className="text-xs text-[#dec8a6]">Maelzel Scale Detents</span>
                  <input
                    type="checkbox"
                    checked={snapToMaelzelScale}
                    onChange={(e) => {
                      setSnapToMaelzelScale(e.target.checked);
                      if (e.target.checked) {
                        handleBpmChange(snapToNearestMaelzelStep(bpm), true);
                      }
                    }}
                    className="accent-[#d4a359] w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#130d09] border border-[#d4a359]/15 cursor-pointer">
                  <span className="text-xs text-[#dec8a6]">Tick/Tock Pallet Pitch</span>
                  <input
                    type="checkbox"
                    checked={escapementRealism}
                    onChange={(e) => {
                      setEscapementRealism(e.target.checked);
                      engine.getSynth().setEscapementRealism(e.target.checked);
                    }}
                    className="accent-[#d4a359] w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#130d09] border border-[#d4a359]/15 cursor-pointer">
                  <span className="text-xs text-[#dec8a6]">Mainspring Unwind</span>
                  <input
                    type="checkbox"
                    checked={springModeEnabled}
                    onChange={(e) => {
                      setSpringModeEnabled(e.target.checked);
                      engine.setSpringMode(e.target.checked);
                    }}
                    className="accent-[#d4a359] w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#130d09] border border-[#d4a359]/15 cursor-pointer">
                  <span className="text-xs text-[#dec8a6]">Tactile Haptic Pulse</span>
                  <input
                    type="checkbox"
                    checked={hapticsEnabled}
                    onChange={(e) => {
                      setHapticsEnabled(e.target.checked);
                      engine.setHapticsEnabled(e.target.checked);
                    }}
                    className="accent-[#d4a359] w-4 h-4"
                  />
                </label>
              </div>
            </section>
          </div>
        </main>
      )}

      {/* Modal: iPhone App & Capacitor Native Architecture Guide */}
      {showIosGuideModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowIosGuideModal(false)}
        >
          <div
            className="max-w-lg w-full rounded-3xl bg-[#1b120c] border border-[#d4a359]/50 p-6 shadow-2xl space-y-4 text-[#f5ebd6]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#d4a359]/20 pb-3">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-[#d4a359]" />
                <h3 className="font-serif text-xl font-bold text-[#f7e1a0]">
                  Built for Web &amp; Native iPhone (iOS)
                </h3>
              </div>
              <button
                onClick={() => setShowIosGuideModal(false)}
                className="text-xs font-mono px-2.5 py-1 rounded-lg bg-[#2a1c12] text-[#cbb593]"
              >
                ESC
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-[#d8c3a5]">
              <p>
                This project is architected with a decoupled core engine so it runs natively on the
                Web today and compiles cleanly into an iPhone app whenever you are ready:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong className="text-[#f7e1a0]">Decoupled Core Engine (`src/core/`):</strong>{' '}
                  `MetronomeEngine`, `SoundSynthesizer`, and `metronomeModels` have zero DOM
                  dependencies and use rock-solid Web Audio lookahead scheduling that never drifts
                  on iOS Safari or `WKWebView`.
                </li>
                <li>
                  <strong className="text-[#f7e1a0]">Capacitor iOS Config Included:</strong>{' '}
                  `capacitor.config.json` is pre-configured (`com.oldmetronome.app`). Run{' '}
                  <code className="px-1.5 py-0.5 rounded bg-black/50 text-[#f7d983]">
                    npm install @capacitor/core @capacitor/cli @capacitor/ios &amp;&amp; npx cap add ios
                  </code>{' '}
                  to open the Xcode project directly.
                </li>
                <li>
                  <strong className="text-[#f7e1a0]">iOS Safari &amp; Home Screen PWA Ready:</strong>{' '}
                  Includes automatic first-touch `AudioContext` unlocking, Screen `WakeLock` to
                  prevent iPhone sleep during practice, and pointer-capture counterweight dragging.
                </li>
              </ul>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => {
                  setIphonePreviewMode(true);
                  setShowIosGuideModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#d4a359] to-[#9c6e27] text-[#170f09] font-semibold text-xs"
              >
                Preview in iPhone Frame
              </button>
              <button
                onClick={() => setShowIosGuideModal(false)}
                className="px-4 py-2 rounded-xl bg-[#2a1c12] text-[#e6d5b8] text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
