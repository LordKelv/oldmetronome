import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  MAELZEL_SCALE_STEPS,
  MetronomeModel,
  getTempoMarking,
  snapToNearestMaelzelStep,
} from '../core/metronomeModels';
import { MetronomeEngine } from '../core/metronomeEngine';

interface VintageMetronomeCabinetProps {
  model: MetronomeModel;
  bpm: number;
  isPlaying: boolean;
  snapToMaelzelScale: boolean;
  bellEnabled: boolean;
  beatsPerBar: number;
  activeBeat: number;
  lastBeatIsBell: boolean;
  springModeEnabled: boolean;
  springReserve: number;
  engine: MetronomeEngine;
  onBpmChange: (newBpm: number, playDetent?: boolean) => void;
  onTogglePlay: () => void;
  onCycleBell: () => void;
  onWindSpring: () => void;
}

// Pendulum geometry constants inside the 380x520 SVG coordinate space
const PIVOT_X = 190;
const PIVOT_Y = 408;
const SCALE_TOP_Y = 122; // 40 BPM (top of rod)
const SCALE_BOTTOM_Y = 346; // 208 BPM (bottom of rod)

export function bpmToWeightY(bpm: number): number {
  const clamped = Math.max(40, Math.min(208, bpm));
  const t = (clamped - 40) / (208 - 40);
  return SCALE_TOP_Y + t * (SCALE_BOTTOM_Y - SCALE_TOP_Y);
}

export function weightYToBpm(y: number): number {
  const clampedY = Math.max(SCALE_TOP_Y, Math.min(SCALE_BOTTOM_Y, y));
  const t = (clampedY - SCALE_TOP_Y) / (SCALE_BOTTOM_Y - SCALE_TOP_Y);
  return Math.round(40 + t * (208 - 40));
}

const MAJOR_SCALE_NUMBERS = [
  40, 44, 48, 52, 56, 60, 66, 72, 80, 88, 96, 104, 112, 120, 132, 144, 160, 176, 192, 208,
];

const SCALE_TEMPO_LABELS: { label: string; bpm: number }[] = [
  { label: 'LARGO', bpm: 46 },
  { label: 'ADAGIO', bpm: 68 },
  { label: 'ANDANTE', bpm: 88 },
  { label: 'MODERATO', bpm: 108 },
  { label: 'ALLEGRO', bpm: 136 },
  { label: 'PRESTO', bpm: 180 },
];

export const VintageMetronomeCabinet: React.FC<VintageMetronomeCabinetProps> = ({
  model,
  bpm,
  isPlaying,
  snapToMaelzelScale,
  bellEnabled,
  beatsPerBar,
  activeBeat,
  lastBeatIsBell,
  springModeEnabled,
  springReserve,
  engine,
  onBpmChange,
  onTogglePlay,
  onCycleBell,
  onWindSpring,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pendulumGroupRef = useRef<SVGGElement | null>(null);
  const escapementWheelRef = useRef<SVGGElement | null>(null);
  const shadowRodRef = useRef<SVGLineElement | null>(null);

  const [isDraggingWeight, setIsDraggingWeight] = useState(false);
  const [keyRotation, setKeyRotation] = useState(0);
  const [bellFlash, setBellFlash] = useState(false);
  const lastDetentBpmRef = useRef<number>(bpm);

  // Trigger bell visual ring flash when beat 1 bell rings
  useEffect(() => {
    if (isPlaying && lastBeatIsBell && activeBeat === 0) {
      setBellFlash(true);
      const t = window.setTimeout(() => setBellFlash(false), 260);
      return () => window.clearTimeout(t);
    }
  }, [isPlaying, lastBeatIsBell, activeBeat]);

  // High-fps animation loop directly mutating the SVG transform for zero-React-render-overhead 60/120fps motion
  useEffect(() => {
    let rafId: number;
    let gearAngle = 0;

    const animate = () => {
      const angle = isDraggingWeight ? 0 : engine.getPendulumAngleDeg();
      if (pendulumGroupRef.current) {
        pendulumGroupRef.current.setAttribute(
          'transform',
          `rotate(${angle.toFixed(2)} ${PIVOT_X} ${PIVOT_Y})`
        );
      }
      if (shadowRodRef.current) {
        const rad = (angle * Math.PI) / 180;
        const tipX = PIVOT_X + Math.sin(rad) * 315 + 8;
        const tipY = PIVOT_Y - Math.cos(rad) * 315 + 6;
        shadowRodRef.current.setAttribute('x2', tipX.toFixed(1));
        shadowRodRef.current.setAttribute('y2', tipY.toFixed(1));
      }
      if (escapementWheelRef.current && isPlaying && !isDraggingWeight) {
        gearAngle = (gearAngle + (bpm / 60) * 0.65) % 360;
        escapementWheelRef.current.setAttribute(
          'transform',
          `rotate(${gearAngle.toFixed(1)} 190 365)`
        );
      }
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [engine, isPlaying, isDraggingWeight, bpm]);

  const updateBpmFromClientY = useCallback(
    (clientY: number) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const scaleY = 520 / rect.height;
      const svgY = (clientY - rect.top) * scaleY;
      let nextBpm = weightYToBpm(svgY);
      if (snapToMaelzelScale) {
        nextBpm = snapToNearestMaelzelStep(nextBpm);
      }
      if (nextBpm !== lastDetentBpmRef.current) {
        lastDetentBpmRef.current = nextBpm;
        onBpmChange(nextBpm, true);
      }
    },
    [snapToMaelzelScale, onBpmChange]
  );

  useEffect(() => {
    if (!isDraggingWeight) return;

    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault();
      updateBpmFromClientY(e.clientY);
    };

    const handlePointerUp = () => {
      setIsDraggingWeight(false);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isDraggingWeight, updateBpmFromClientY]);

  const weightY = bpmToWeightY(bpm);
  const { palette } = model;
  const tempoMarking = getTempoMarking(bpm);

  const handleWindKeyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setKeyRotation((prev) => prev + 180);
    onWindSpring();
  };

  // Case Outer Path depending on historical model shape
  const renderCaseBody = () => {
    switch (model.caseShape) {
      case 'stepped-deco':
        return (
          <g>
            {/* Stepped Ziggurat Art Deco silhouette */}
            <path
              d="M 118 48 L 262 48 L 272 95 L 288 95 L 304 220 L 320 220 L 340 448 L 40 448 L 60 220 L 76 220 L 92 95 L 108 95 Z"
              fill="url(#caseBodyGrad)"
              stroke={palette.caseBorder}
              strokeWidth="3"
              filter="url(#cabinetDropShadow)"
            />
            {/* Deco vertical fluted chrome/brass inlays */}
            <line x1="78" y1="225" x2="62" y2="444" stroke={palette.hardwareMetal} strokeWidth="1.5" opacity="0.55" />
            <line x1="302" y1="225" x2="318" y2="444" stroke={palette.hardwareMetal} strokeWidth="1.5" opacity="0.55" />
            <path
              d="M 132 48 L 190 26 L 248 48"
              fill="url(#hardwareGrad)"
              stroke={palette.caseBorder}
              strokeWidth="2"
            />
          </g>
        );

      case 'compact-column':
        return (
          <g>
            {/* 1954 Wittner Taktell Piccolo rounded column */}
            <rect
              x="76"
              y="42"
              width="228"
              height="408"
              rx="38"
              fill="url(#caseBodyGrad)"
              stroke={palette.caseBorder}
              strokeWidth="3.5"
              filter="url(#cabinetDropShadow)"
            />
            {/* Classic crimson inner trim bezel of the Taktell Piccolo */}
            <rect
              x="92"
              y="58"
              width="196"
              height="368"
              rx="26"
              fill="none"
              stroke={palette.scaleAccent}
              strokeWidth="2.5"
              opacity="0.75"
            />
          </g>
        );

      case 'open-horology':
        return (
          <g>
            {/* 1796 Breguet Gilded Arch & Columns */}
            <path
              d="M 115 62 C 115 22, 265 22, 265 62 L 315 448 L 65 448 Z"
              fill="url(#caseBodyGrad)"
              stroke={palette.caseBorder}
              strokeWidth="3.5"
              filter="url(#cabinetDropShadow)"
            />
            {/* Decorative corner ormolu rivets */}
            {[85, 295].map((cx, i) => (
              <circle
                key={i}
                cx={cx}
                cy={426}
                r="5"
                fill="url(#hardwareGrad)"
                stroke="#3a2505"
                strokeWidth="1"
              />
            ))}
          </g>
        );

      case 'pyramid':
      default:
        return (
          <g>
            {/* Classic 1815 Maelzel / 1895 Viennese Truncated Pyramid Obelisk */}
            <path
              d="M 122 36 L 258 36 L 266 56 L 114 56 Z"
              fill="url(#caseCapGrad)"
              stroke={palette.caseBorder}
              strokeWidth="2"
            />
            <path
              d="M 112 56 L 268 56 L 344 448 L 36 448 Z"
              fill="url(#caseBodyGrad)"
              stroke={palette.caseBorder}
              strokeWidth="3"
              filter="url(#cabinetDropShadow)"
            />
            {/* Subtle wood grain overlay */}
            <path
              d="M 112 56 L 268 56 L 344 448 L 36 448 Z"
              fill="url(#woodGrainPattern)"
              opacity={palette.woodGrainOpacity}
              style={{ mixBlendMode: 'multiply' }}
            />
            {/* Beveled front molding */}
            <path
              d="M 122 68 L 258 68 L 326 436 L 54 436 Z"
              fill="none"
              stroke={palette.hardwareHighlight}
              strokeWidth="1"
              opacity="0.22"
            />
          </g>
        );
    }
  };

  // Counterweight shape renderer
  const renderCounterweight = (y: number) => {
    switch (model.weightShape) {
      case 'scalloped':
        return (
          <g transform={`translate(${PIVOT_X}, ${y})`}>
            <path
              d="M -21 -13 L 21 -13 L 25 0 L 18 14 L -18 14 L -25 0 Z"
              fill="url(#weightGrad)"
              stroke={palette.weightStroke}
              strokeWidth="1.6"
              filter="url(#weightShadow)"
            />
            <line x1="-18" y1="0" x2="18" y2="0" stroke={palette.scaleAccent} strokeWidth="1.5" />
            <circle cx="0" cy="0" r="3.5" fill={palette.caseOuterEnd} />
          </g>
        );

      case 'octagon':
        return (
          <g transform={`translate(${PIVOT_X}, ${y})`}>
            <polygon
              points="-16,-14 16,-14 23,-6 23,6 16,14 -16,14 -23,6 -23,-6"
              fill="url(#weightGrad)"
              stroke={palette.weightStroke}
              strokeWidth="1.6"
              filter="url(#weightShadow)"
            />
            <line x1="-21" y1="0" x2="21" y2="0" stroke={palette.scaleAccent} strokeWidth="2" />
          </g>
        );

      case 'cylinder':
        return (
          <g transform={`translate(${PIVOT_X}, ${y})`}>
            <rect
              x="-20"
              y="-11"
              width="40"
              height="22"
              rx="6"
              fill="url(#weightGrad)"
              stroke={palette.weightStroke}
              strokeWidth="1.5"
              filter="url(#weightShadow)"
            />
            <line x1="-19" y1="0" x2="19" y2="0" stroke={palette.scaleAccent} strokeWidth="2" />
          </g>
        );

      case 'lens':
        return (
          <g transform={`translate(${PIVOT_X}, ${y})`}>
            <ellipse
              cx="0"
              cy="0"
              rx="22"
              ry="13"
              fill="url(#weightGrad)"
              stroke={palette.weightStroke}
              strokeWidth="1.8"
              filter="url(#weightShadow)"
            />
            <circle cx="0" cy="0" r="5" fill="none" stroke={palette.scaleAccent} strokeWidth="1.4" />
            <line x1="-22" y1="0" x2="22" y2="0" stroke={palette.scaleAccent} strokeWidth="1.5" />
          </g>
        );

      case 'trapezoid':
      default:
        return (
          <g transform={`translate(${PIVOT_X}, ${y})`}>
            {/* Classic Maelzel Trapezoidal Brass Bob with knurled grip grooves */}
            <polygon
              points="-22,-13 22,-13 17,14 -17,14"
              fill="url(#weightGrad)"
              stroke={palette.weightStroke}
              strokeWidth="1.6"
              filter="url(#weightShadow)"
            />
            <line x1="-19" y1="-5" x2="19" y2="-5" stroke="#593e10" strokeWidth="1" opacity="0.6" />
            <line x1="-18" y1="5" x2="18" y2="5" stroke="#593e10" strokeWidth="1" opacity="0.6" />
            {/* Tempo index notch at top/center */}
            <line x1="-20" y1="0" x2="20" y2="0" stroke={palette.scaleAccent} strokeWidth="2" />
            <circle cx="0" cy="0" r="3" fill="#3b2607" />
          </g>
        );
    }
  };

  const pullBellOffset = bellEnabled ? 20 : 0;

  return (
    <div className="relative flex flex-col items-center select-none w-full max-w-[400px] mx-auto">
      <svg
        ref={svgRef}
        viewBox="0 0 380 520"
        className="w-full h-auto drop-shadow-[0_24px_48px_rgba(0,0,0,0.85)] overflow-visible touch-none"
        aria-label={`${model.name} interactive mechanical metronome`}
      >
        <defs>
          <filter id="cabinetDropShadow" x="-15%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="14" stdDeviation="12" floodColor={palette.caseShadow} />
          </filter>

          <filter id="wellInnerShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000000" floodOpacity="0.85" />
          </filter>

          <filter id="weightShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.65" />
          </filter>

          <linearGradient id="caseBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.caseOuterStart} />
            <stop offset="48%" stopColor={palette.caseOuterMid} />
            <stop offset="100%" stopColor={palette.caseOuterEnd} />
          </linearGradient>

          <linearGradient id="caseCapGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={palette.caseOuterMid} />
            <stop offset="50%" stopColor={palette.caseOuterStart} />
            <stop offset="100%" stopColor={palette.caseOuterEnd} />
          </linearGradient>

          <linearGradient id="wellGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={palette.wellBgStart} />
            <stop offset="100%" stopColor={palette.wellBgEnd} />
          </linearGradient>

          <linearGradient id="scalePlateGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.scalePlateBg} />
            <stop offset="55%" stopColor={palette.scalePlateBg} />
            <stop offset="100%" stopColor={palette.scalePlateBorder} />
          </linearGradient>

          <linearGradient id="hardwareGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.hardwareHighlight} />
            <stop offset="45%" stopColor={palette.hardwareMetal} />
            <stop offset="100%" stopColor="#5e4618" />
          </linearGradient>

          <linearGradient id="weightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.weightStroke} />
            <stop offset="35%" stopColor={palette.weightFillStart} />
            <stop offset="100%" stopColor={palette.weightFillEnd} />
          </linearGradient>

          <linearGradient id="rodGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6e737b" />
            <stop offset="45%" stopColor={palette.rodColor} />
            <stop offset="65%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#50555c" />
          </linearGradient>

          <pattern id="woodGrainPattern" width="40" height="120" patternUnits="userSpaceOnUse">
            <path
              d="M 0 20 Q 20 10, 40 25 M 0 55 Q 18 70, 40 50 M 0 95 Q 22 85, 40 100"
              stroke="#120502"
              strokeWidth="1.4"
              fill="none"
            />
          </pattern>
        </defs>

        {/* 1. LEFT SIDE HARDWARE: Mechanical Pull-Bell Cord/Drawbar */}
        {model.hasPullBell && (
          <g
            onClick={onCycleBell}
            className="cursor-pointer group"
            role="button"
            aria-label="Toggle mechanical bell accent"
          >
            <title>Click to pull/push mechanical bell drawbar ({bellEnabled ? `Every ${beatsPerBar} beats` : 'Off'})</title>
            {/* Drawbar shaft */}
            <rect
              x={34 - pullBellOffset}
              y="366"
              width={26 + pullBellOffset}
              height="8"
              rx="2"
              fill="url(#hardwareGrad)"
              stroke="#2a1a08"
              strokeWidth="1"
            />
            {/* Engraved notch markings on shaft */}
            {[0, 6, 12, 18].map((offset) => (
              <line
                key={offset}
                x1={42 - pullBellOffset + offset}
                y1="366"
                x2={42 - pullBellOffset + offset}
                y2="374"
                stroke="#3b2608"
                strokeWidth="1"
              />
            ))}
            {/* Brass Pull Knob */}
            <circle
              cx={28 - pullBellOffset}
              cy="370"
              r="11"
              fill="url(#hardwareGrad)"
              stroke={bellFlash ? '#fff7d1' : '#3b2608'}
              strokeWidth={bellFlash ? '2.5' : '1.4'}
            />
            <circle cx={28 - pullBellOffset} cy="370" r="5" fill="none" stroke="#5e4314" strokeWidth="1" />
            {/* Bell status tag */}
            <text
              x={28 - pullBellOffset}
              y="395"
              textAnchor="middle"
              fill="#d8c39e"
              fontSize="9.5"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="600"
            >
              {bellEnabled ? `🔔/${beatsPerBar}` : 'BELL OFF'}
            </text>
          </g>
        )}

        {/* 2. RIGHT SIDE HARDWARE: Brass Mainspring Winding Key */}
        <g
          onClick={handleWindKeyClick}
          className="cursor-pointer"
          role="button"
          aria-label="Wind mainspring key"
        >
          <title>Click to wind the mechanical mainspring key</title>
          {/* Winding arbor bushing */}
          <rect
            x="324"
            y="358"
            width="16"
            height="14"
            rx="2"
            fill="url(#hardwareGrad)"
            stroke="#2a1a08"
            strokeWidth="1.2"
          />
          {/* Rotating winged key handle */}
          <g
            style={{
              transform: `rotate(${keyRotation}deg)`,
              transformOrigin: '352px 365px',
              transition: 'transform 0.42s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <rect
              x="336"
              y="362"
              width="20"
              height="6"
              rx="2"
              fill="url(#hardwareGrad)"
              stroke="#2a1a08"
              strokeWidth="1"
            />
            <ellipse
              cx="358"
              cy="352"
              rx="7"
              ry="11"
              fill="url(#hardwareGrad)"
              stroke="#2a1a08"
              strokeWidth="1.2"
            />
            <ellipse
              cx="358"
              cy="378"
              rx="7"
              ry="11"
              fill="url(#hardwareGrad)"
              stroke="#2a1a08"
              strokeWidth="1.2"
            />
            <circle cx="358" cy="352" r="3" fill="#120d0a" />
            <circle cx="358" cy="378" r="3" fill="#120d0a" />
          </g>
          <text
            x="352"
            y="404"
            textAnchor="middle"
            fill="#d8c39e"
            fontSize="9.5"
            fontFamily="JetBrains Mono, monospace"
            fontWeight="600"
          >
            {springModeEnabled ? `${Math.round(springReserve * 100)}%` : 'WIND'}
          </text>
        </g>

        {/* 3. CABINET BODY */}
        {renderCaseBody()}

        {/* 4. RECESSED PENDULUM WELL & ARCH */}
        <path
          d="M 134 74 C 134 58, 246 58, 246 74 L 274 398 L 106 398 Z"
          fill="url(#wellGrad)"
          stroke={palette.scalePlateBorder}
          strokeWidth="2.5"
          filter="url(#wellInnerShadow)"
        />

        {/* 5. ENGRAVED TEMPO SCALE PLATE */}
        <path
          d="M 142 82 C 142 70, 238 70, 238 82 L 258 388 L 122 388 Z"
          fill="url(#scalePlateGrad)"
          stroke={palette.scalePlateBorder}
          strokeWidth="1.5"
        />

        {/* Center vertical slot in the scale plate */}
        <rect
          x={PIVOT_X - 4}
          y="94"
          width="8"
          height="294"
          rx="4"
          fill="#120905"
          stroke={palette.scalePlateBorder}
          strokeWidth="0.8"
        />

        {/* 6. OPTIONAL VISIBLE HOROLOGICAL ESCAPEMENT GEARS (1796 Breguet & subtle window on others) */}
        <g opacity={model.hasVisibleGears ? 0.92 : 0.25}>
          <g ref={escapementWheelRef}>
            <circle
              cx="190"
              cy="365"
              r="22"
              fill="none"
              stroke={palette.hardwareMetal}
              strokeWidth="2.5"
              strokeDasharray="4 3.2"
            />
            <circle
              cx="190"
              cy="365"
              r="15"
              fill="none"
              stroke={palette.hardwareMetal}
              strokeWidth="1.5"
            />
            {[0, 60, 120, 180, 240, 300].map((deg) => (
              <line
                key={deg}
                x1="190"
                y1="350"
                x2="190"
                y2="380"
                stroke={palette.hardwareMetal}
                strokeWidth="1.5"
                transform={`rotate(${deg} 190 365)`}
              />
            ))}
          </g>
        </g>

        {/* 7. MAELZEL SCALE TICKS & TEMPO MARKINGS */}
        {MAELZEL_SCALE_STEPS.map((stepBpm) => {
          const y = bpmToWeightY(stepBpm);
          const isMajor = MAJOR_SCALE_NUMBERS.includes(stepBpm);
          const isLeft = MAJOR_SCALE_NUMBERS.indexOf(stepBpm) % 2 === 0;
          const isCurrent = Math.abs(bpm - stepBpm) <= 1;

          return (
            <g key={stepBpm}>
              {/* Tick line */}
              <line
                x1={isLeft ? PIVOT_X - 18 : PIVOT_X + 5}
                y1={y}
                x2={isLeft ? PIVOT_X - 5 : PIVOT_X + 18}
                y2={y}
                stroke={isCurrent ? palette.scaleAccent : palette.scaleText}
                strokeWidth={isCurrent ? '2' : isMajor ? '1.2' : '0.7'}
                opacity={isMajor || isCurrent ? 0.95 : 0.55}
              />
              {/* Number label on alternating sides */}
              {isMajor && (
                <text
                  x={isLeft ? PIVOT_X - 22 : PIVOT_X + 22}
                  y={y + 3}
                  textAnchor={isLeft ? 'end' : 'start'}
                  fill={isCurrent ? palette.scaleAccent : palette.scaleText}
                  fontSize={isCurrent ? '9.5' : '8.2'}
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight={isCurrent ? '800' : '600'}
                >
                  {stepBpm}
                </text>
              )}
            </g>
          );
        })}

        {/* Classical Italian Tempo vertical labels along the scale edge */}
        {SCALE_TEMPO_LABELS.map((item) => {
          const y = bpmToWeightY(item.bpm);
          return (
            <text
              key={item.label}
              x={PIVOT_X - 44}
              y={y + 2}
              textAnchor="end"
              fill={palette.scaleAccent}
              fontSize="6.4"
              fontFamily="Playfair Display, serif"
              fontWeight="700"
              letterSpacing="0.06em"
              opacity="0.85"
            >
              {item.label}
            </text>
          );
        })}

        {/* 8. BELL CHIME RESONATOR VISUAL ON DOWNBEAT */}
        {model.hasPullBell && (
          <g transform="translate(132, 368)">
            <path
              d="M -10 6 A 10 10 0 0 1 10 6 Z"
              fill="url(#hardwareGrad)"
              stroke="#2a1a08"
              strokeWidth="1"
            />
            {bellFlash && (
              <>
                <circle
                  cx="0"
                  cy="2"
                  r="16"
                  fill="none"
                  stroke="#ffe596"
                  strokeWidth="2"
                  opacity="0.85"
                />
                <circle
                  cx="0"
                  cy="2"
                  r="24"
                  fill="none"
                  stroke="#ffe596"
                  strokeWidth="1.2"
                  opacity="0.45"
                />
              </>
            )}
          </g>
        )}

        {/* 9. DYNAMIC PENDULUM SHADOW INSIDE WELL */}
        <line
          ref={shadowRodRef}
          x1={PIVOT_X + 6}
          y1={PIVOT_Y + 4}
          x2={PIVOT_X + 8}
          y2={PIVOT_Y - 310}
          stroke="rgba(0,0,0,0.45)"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* 10. ANIMATED COMPOUND PENDULUM ROD & DRAGGABLE COUNTERWEIGHT */}
        <g ref={pendulumGroupRef} transform={`rotate(0 ${PIVOT_X} ${PIVOT_Y})`}>
          {/* Steel Pendulum Rod */}
          <line
            x1={PIVOT_X}
            y1={PIVOT_Y + 12}
            x2={PIVOT_X}
            y2={86}
            stroke="url(#rodGrad)"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          {/* Finial tip at top of pendulum rod */}
          <circle
            cx={PIVOT_X}
            cy={86}
            r="4.5"
            fill="url(#hardwareGrad)"
            stroke="#2a1a08"
            strokeWidth="1"
          />

          {/* Interactive Counterweight Bob (Drag up/down for tempo) */}
          <g
            onPointerDown={(e) => {
              e.stopPropagation();
              (e.target as Element).setPointerCapture?.(e.pointerId);
              setIsDraggingWeight(true);
            }}
            className="cursor-grab active:cursor-grabbing"
          >
            <title>Drag counterweight up (slower) or down (faster) — Current: {bpm} BPM ({tempoMarking.name})</title>
            {/* Invisible larger touch target for effortless iPhone thumb dragging */}
            <rect
              x={PIVOT_X - 44}
              y={weightY - 28}
              width="88"
              height="56"
              fill="transparent"
            />
            {renderCounterweight(weightY)}
          </g>

          {/* Pivot arbor jewel */}
          <circle
            cx={PIVOT_X}
            cy={PIVOT_Y}
            r="9"
            fill="url(#hardwareGrad)"
            stroke="#1e1206"
            strokeWidth="1.5"
          />
          <circle cx={PIVOT_X} cy={PIVOT_Y} r="3.5" fill="#2e1b09" />
        </g>

        {/* 11. LOWER ESCUTCHEON SHIELD & MAKER'S PLAQUE */}
        <path
          d="M 88 394 L 292 394 L 312 448 L 68 448 Z"
          fill="url(#caseBodyGrad)"
          stroke={palette.caseBorder}
          strokeWidth="2"
        />

        {/* Brass Maker's Nameplate */}
        <g
          onClick={onTogglePlay}
          className="cursor-pointer"
          role="button"
          aria-label={isPlaying ? 'Stop metronome' : 'Start metronome'}
        >
          <rect
            x="114"
            y="406"
            width="152"
            height="28"
            rx="5"
            fill="url(#hardwareGrad)"
            stroke="#2a1a08"
            strokeWidth="1.4"
          />
          <circle cx="122" cy="420" r="2" fill="#2a1a08" />
          <circle cx="258" cy="420" r="2" fill="#2a1a08" />
          <text
            x="190"
            y="418"
            textAnchor="middle"
            fill="#1f1306"
            fontSize="8.5"
            fontFamily="Playfair Display, serif"
            fontWeight="800"
            letterSpacing="0.12em"
          >
            {model.makerMark}
          </text>
          <text
            x="190"
            y="429"
            textAnchor="middle"
            fill="#3d260a"
            fontSize="7"
            fontFamily="JetBrains Mono, monospace"
            fontWeight="700"
            letterSpacing="0.08em"
          >
            {isPlaying ? '● ESCAPEMENT ENGAGED' : '○ TAP TO RELEASE PENDULUM'}
          </text>
        </g>

        {/* 12. BASE MOLDING PLINTH & BUN FEET */}
        <rect
          x="26"
          y="446"
          width="328"
          height="18"
          rx="4"
          fill="url(#caseCapGrad)"
          stroke={palette.caseBorder}
          strokeWidth="2.5"
        />
        {/* Turned Brass/Wood Bun Feet */}
        <path
          d="M 42 464 L 78 464 L 72 478 L 48 478 Z"
          fill="url(#hardwareGrad)"
          stroke="#2a1a08"
          strokeWidth="1.5"
        />
        <path
          d="M 302 464 L 338 464 L 332 478 L 308 478 Z"
          fill="url(#hardwareGrad)"
          stroke="#2a1a08"
          strokeWidth="1.5"
        />
      </svg>

      {/* Subtle instruction badge below cabinet */}
      <div className="mt-1 flex items-center gap-2 text-[11px] text-[#c7b293]/80 font-mono tracking-wide">
        <span>↕ Drag brass weight on rod</span>
        <span>•</span>
        <span>Tap plaque or Spacebar to {isPlaying ? 'stop' : 'start'}</span>
      </div>
    </div>
  );
};
