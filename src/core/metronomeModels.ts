export type MetronomeModelId =
  | 'maelzel-1815'
  | 'viennese-1895'
  | 'artdeco-1928'
  | 'taktell-1954'
  | 'breguet-1796';

export type CaseShape = 'pyramid' | 'stepped-deco' | 'compact-column' | 'open-horology';
export type WeightShape = 'trapezoid' | 'scalloped' | 'octagon' | 'cylinder' | 'lens';

export interface AcousticProfile {
  /** Primary woody/metallic click transient frequency (Hz) */
  tickFreq: number;
  /** Secondary "tock" frequency ratio (authentic mechanical escapement asymmetry) */
  tockRatio: number;
  /** Resonant chamber bandpass frequency (Hz) */
  bodyResonanceFreq: number;
  /** Resonant chamber Q factor */
  bodyResonanceQ: number;
  /** Decay time of primary tick in seconds */
  tickDecay: number;
  /** High-frequency escapement metallic snap mix (0..1) */
  metallicSnap: number;
  /** Bell fundamental frequency (Hz) */
  bellFundamental: number;
  /** Bell inharmonic partial ratios */
  bellPartials: number[];
  /** Bell ring decay in seconds */
  bellDecay: number;
}

export interface VisualPalette {
  caseOuterStart: string;
  caseOuterMid: string;
  caseOuterEnd: string;
  caseBorder: string;
  caseShadow: string;
  wellBgStart: string;
  wellBgEnd: string;
  scalePlateBg: string;
  scalePlateBorder: string;
  scaleText: string;
  scaleAccent: string;
  rodColor: string;
  weightFillStart: string;
  weightFillEnd: string;
  weightStroke: string;
  hardwareMetal: string;
  hardwareHighlight: string;
  woodGrainOpacity: number;
  badgeText: string;
}

export interface MetronomeModel {
  id: MetronomeModelId;
  name: string;
  subtitle: string;
  year: number;
  origin: string;
  makerMark: string;
  materials: string;
  description: string;
  caseShape: CaseShape;
  weightShape: WeightShape;
  hasPullBell: boolean;
  hasVisibleGears: boolean;
  acoustic: AcousticProfile;
  palette: VisualPalette;
}

/**
 * Authentic Maelzel Metronome Scale increments:
 * 40..60 by 2
 * 60..72 by 3
 * 72..120 by 4
 * 120..144 by 6
 * 144..208 by 8
 */
export const MAELZEL_SCALE_STEPS: number[] = [
  40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60,
  63, 66, 69, 72,
  76, 80, 84, 88, 92, 96, 100, 104, 108, 112, 116, 120,
  126, 132, 138, 144,
  152, 160, 168, 176, 184, 192, 200, 208,
];

export interface TempoMarking {
  name: string;
  minBpm: number;
  maxBpm: number;
  character: string;
}

export const ITALIAN_TEMPO_MARKINGS: TempoMarking[] = [
  { name: 'Larghissimo', minBpm: 30, maxBpm: 40, character: 'Very, very slow & solemn' },
  { name: 'Grave', minBpm: 41, maxBpm: 45, character: 'Slow, weighty, and serious' },
  { name: 'Largo', minBpm: 46, maxBpm: 51, character: 'Broad and stately' },
  { name: 'Lento', minBpm: 52, maxBpm: 55, character: 'Slowly and drawn out' },
  { name: 'Larghetto', minBpm: 56, maxBpm: 62, character: 'Rather broadly' },
  { name: 'Adagio', minBpm: 63, maxBpm: 71, character: 'Slow, stately, at ease' },
  { name: 'Adagietto', minBpm: 72, maxBpm: 75, character: 'Rather slow and graceful' },
  { name: 'Andante', minBpm: 76, maxBpm: 87, character: 'At a walking pace' },
  { name: 'Andantino', minBpm: 88, maxBpm: 95, character: 'Slightly faster than Andante' },
  { name: 'Moderato', minBpm: 96, maxBpm: 107, character: 'Moderately and measured' },
  { name: 'Allegretto', minBpm: 108, maxBpm: 119, character: 'Moderately fast and lively' },
  { name: 'Allegro', minBpm: 120, maxBpm: 151, character: 'Fast, bright, and cheerful' },
  { name: 'Vivace', minBpm: 152, maxBpm: 167, character: 'Lively, brisk, and spirited' },
  { name: 'Presto', minBpm: 168, maxBpm: 199, character: 'Very fast and urgent' },
  { name: 'Prestissimo', minBpm: 200, maxBpm: 240, character: 'Extremely fast, as fast as possible' },
];

export function getTempoMarking(bpm: number): TempoMarking {
  for (const m of ITALIAN_TEMPO_MARKINGS) {
    if (bpm >= m.minBpm && bpm <= m.maxBpm) {
      return m;
    }
  }
  return bpm < 40 ? ITALIAN_TEMPO_MARKINGS[0] : ITALIAN_TEMPO_MARKINGS[ITALIAN_TEMPO_MARKINGS.length - 1];
}

export function snapToNearestMaelzelStep(bpm: number): number {
  let closest = MAELZEL_SCALE_STEPS[0];
  let minDiff = Math.abs(bpm - closest);
  for (const step of MAELZEL_SCALE_STEPS) {
    const diff = Math.abs(bpm - step);
    if (diff < minDiff) {
      minDiff = diff;
      closest = step;
    }
  }
  return closest;
}

export const METRONOME_MODELS: MetronomeModel[] = [
  {
    id: 'maelzel-1815',
    name: '1815 Maelzel Pyramid',
    subtitle: 'Original Parisian Mahogany Obelisk',
    year: 1815,
    origin: 'Paris, France',
    makerMark: 'J. N. MAELZEL • PARIS',
    materials: 'Cuban Flame Mahogany & Hand-Engraved Brass',
    description:
      'Patented by Johann Nepomuk Maelzel in 1815 and championed by Beethoven. Features a warm resonant mahogany soundbox, compound pendulum counterweight, and side-mounted brass bell pull.',
    caseShape: 'pyramid',
    weightShape: 'trapezoid',
    hasPullBell: true,
    hasVisibleGears: false,
    acoustic: {
      tickFreq: 920,
      tockRatio: 0.91,
      bodyResonanceFreq: 640,
      bodyResonanceQ: 5.2,
      tickDecay: 0.048,
      metallicSnap: 0.28,
      bellFundamental: 2180,
      bellPartials: [1, 2.02, 2.98, 4.15],
      bellDecay: 0.65,
    },
    palette: {
      caseOuterStart: '#6b2819',
      caseOuterMid: '#48180e',
      caseOuterEnd: '#280b06',
      caseBorder: '#8c442b',
      caseShadow: 'rgba(10, 4, 2, 0.85)',
      wellBgStart: '#1f0c07',
      wellBgEnd: '#120704',
      scalePlateBg: '#d8b467',
      scalePlateBorder: '#9b742c',
      scaleText: '#231608',
      scaleAccent: '#7a1c12',
      rodColor: '#e5c985',
      weightFillStart: '#f2d894',
      weightFillEnd: '#a97e30',
      weightStroke: '#fff3c9',
      hardwareMetal: '#d4a84f',
      hardwareHighlight: '#fff1be',
      woodGrainOpacity: 0.35,
      badgeText: '#f7e1a0',
    },
  },
  {
    id: 'viennese-1895',
    name: '1895 Viennese Conservatory',
    subtitle: 'Ebonized Pearwood & Sterling Silver',
    year: 1895,
    origin: 'Vienna, Austria',
    makerMark: 'CONSERVATORIUM • WIEN',
    materials: 'French-Polished Ebonized Walnut & Nickel Silver',
    description:
      'Built for late-Romantic concert halls and conservatory studios. The dense ebonized pearwood cabinet projects a crisp, authoritative click that cuts through grand piano fortissimos.',
    caseShape: 'pyramid',
    weightShape: 'scalloped',
    hasPullBell: true,
    hasVisibleGears: false,
    acoustic: {
      tickFreq: 1240,
      tockRatio: 0.94,
      bodyResonanceFreq: 880,
      bodyResonanceQ: 6.4,
      tickDecay: 0.038,
      metallicSnap: 0.45,
      bellFundamental: 2640,
      bellPartials: [1, 1.99, 3.12, 4.4],
      bellDecay: 0.8,
    },
    palette: {
      caseOuterStart: '#2f3136',
      caseOuterMid: '#1a1b1f',
      caseOuterEnd: '#0c0d10',
      caseBorder: '#525661',
      caseShadow: 'rgba(0, 0, 0, 0.9)',
      wellBgStart: '#121317',
      wellBgEnd: '#08090b',
      scalePlateBg: '#e2e6ec',
      scalePlateBorder: '#8d95a5',
      scaleText: '#14171f',
      scaleAccent: '#8e1b26',
      rodColor: '#dce2ec',
      weightFillStart: '#f4f7fb',
      weightFillEnd: '#8b94a3',
      weightStroke: '#ffffff',
      hardwareMetal: '#c8d0dc',
      hardwareHighlight: '#ffffff',
      woodGrainOpacity: 0.14,
      badgeText: '#e4e9f2',
    },
  },
  {
    id: 'artdeco-1928',
    name: '1928 Manhattan Art Deco',
    subtitle: 'Stepped Tortoiseshell Bakelite & Chrome',
    year: 1928,
    origin: 'Thomaston, Connecticut',
    makerMark: 'SETH THOMAS • U.S.A.',
    materials: 'Molded Phenolic Amber Bakelite & Brushed Chrome',
    description:
      'Jazz-Age American skyscraper silhouette in marbled amber Bakelite. Features a stepped ziggurat case, cream celluloid tempo dial, octagonal chrome weight, and a dry, punchy parlor snap.',
    caseShape: 'stepped-deco',
    weightShape: 'octagon',
    hasPullBell: true,
    hasVisibleGears: false,
    acoustic: {
      tickFreq: 1080,
      tockRatio: 0.89,
      bodyResonanceFreq: 760,
      bodyResonanceQ: 4.1,
      tickDecay: 0.034,
      metallicSnap: 0.36,
      bellFundamental: 1980,
      bellPartials: [1, 2.14, 3.05, 3.88],
      bellDecay: 0.52,
    },
    palette: {
      caseOuterStart: '#964b1b',
      caseOuterMid: '#5c280a',
      caseOuterEnd: '#2b1003',
      caseBorder: '#c47235',
      caseShadow: 'rgba(15, 6, 1, 0.88)',
      wellBgStart: '#261207',
      wellBgEnd: '#140802',
      scalePlateBg: '#f6ebd2',
      scalePlateBorder: '#b59d72',
      scaleText: '#261a0e',
      scaleAccent: '#b8321a',
      rodColor: '#d9dfe6',
      weightFillStart: '#eef3f8',
      weightFillEnd: '#7e8a96',
      weightStroke: '#ffffff',
      hardwareMetal: '#cdd5de',
      hardwareHighlight: '#f7fbff',
      woodGrainOpacity: 0.22,
      badgeText: '#f7ebd2',
    },
  },
  {
    id: 'taktell-1954',
    name: '1954 Taktell Piccolo',
    subtitle: 'Mid-Century Ivory Bakelite Pocket Classic',
    year: 1954,
    origin: 'Isny im Allgäu, Germany',
    makerMark: 'TAKTELL • PICCOLO',
    materials: 'Vintage Cream Polystyrene & German Spring Steel',
    description:
      'The beloved mid-century German traveling metronome. Compact, indestructible, and iconic in every piano teacher’s satchel, delivering a bright, surgical steel click with zero overhang.',
    caseShape: 'compact-column',
    weightShape: 'cylinder',
    hasPullBell: false,
    hasVisibleGears: false,
    acoustic: {
      tickFreq: 1580,
      tockRatio: 0.96,
      bodyResonanceFreq: 1320,
      bodyResonanceQ: 3.8,
      tickDecay: 0.025,
      metallicSnap: 0.62,
      bellFundamental: 2950,
      bellPartials: [1, 2.0, 3.0],
      bellDecay: 0.4,
    },
    palette: {
      caseOuterStart: '#efe4c8',
      caseOuterMid: '#d8c7a0',
      caseOuterEnd: '#b39e74',
      caseBorder: '#c4b186',
      caseShadow: 'rgba(20, 15, 8, 0.75)',
      wellBgStart: '#33291d',
      wellBgEnd: '#1f1810',
      scalePlateBg: '#fcf7e8',
      scalePlateBorder: '#b8a57a',
      scaleText: '#1e1912',
      scaleAccent: '#c92a2a',
      rodColor: '#d6dce2',
      weightFillStart: '#e8c468',
      weightFillEnd: '#9e7620',
      weightStroke: '#fff5d1',
      hardwareMetal: '#d1a84b',
      hardwareHighlight: '#fff4cf',
      woodGrainOpacity: 0.04,
      badgeText: '#8c221b',
    },
  },
  {
    id: 'breguet-1796',
    name: '1796 Breguet Chronometer',
    subtitle: 'Open-Escapement Gilded Horological Study',
    year: 1796,
    origin: 'Quai de l’Horloge, Paris',
    makerMark: 'BREGUET • HORLOGER',
    materials: 'Fire-Gilded Ormolu Brass, Blued Steel & Enamel',
    description:
      'Inspired by late-18th-century Parisian Loulié & Breguet chronometers. Features an exposed brass escapement wheel that rotates with every tick, blued steel pointer, and a delicate crystalline chime.',
    caseShape: 'open-horology',
    weightShape: 'lens',
    hasPullBell: true,
    hasVisibleGears: true,
    acoustic: {
      tickFreq: 1840,
      tockRatio: 0.93,
      bodyResonanceFreq: 1460,
      bodyResonanceQ: 7.5,
      tickDecay: 0.032,
      metallicSnap: 0.78,
      bellFundamental: 3120,
      bellPartials: [1, 2.01, 2.86, 4.02, 5.18],
      bellDecay: 0.95,
    },
    palette: {
      caseOuterStart: '#b88933',
      caseOuterMid: '#7d5614',
      caseOuterEnd: '#3d2605',
      caseBorder: '#e0b45c',
      caseShadow: 'rgba(12, 8, 2, 0.9)',
      wellBgStart: '#1c1306',
      wellBgEnd: '#0f0a03',
      scalePlateBg: '#fbf4e2',
      scalePlateBorder: '#c29744',
      scaleText: '#1a140b',
      scaleAccent: '#1d4b8f',
      rodColor: '#244673',
      weightFillStart: '#f7d983',
      weightFillEnd: '#9c6e19',
      weightStroke: '#fff7d6',
      hardwareMetal: '#e3b857',
      hardwareHighlight: '#fff6d1',
      woodGrainOpacity: 0.1,
      badgeText: '#fff3c4',
    },
  },
];

export type SubdivisionType = 'quarter' | 'eighth' | 'triplet' | 'sixteenth' | 'swing';

export interface SubdivisionOption {
  id: SubdivisionType;
  label: string;
  symbol: string;
  description: string;
  /** Offsets within a single beat [0..1) */
  offsets: number[];
}

export const SUBDIVISION_OPTIONS: SubdivisionOption[] = [
  {
    id: 'quarter',
    label: 'Quarter',
    symbol: '♩',
    description: 'Single pendulum strike per beat',
    offsets: [0],
  },
  {
    id: 'eighth',
    label: 'Eighths',
    symbol: '♫',
    description: 'Even duple subdivision',
    offsets: [0, 0.5],
  },
  {
    id: 'triplet',
    label: 'Triplets',
    symbol: '♪♪♪',
    description: 'Three even subdivisions per beat',
    offsets: [0, 1 / 3, 2 / 3],
  },
  {
    id: 'sixteenth',
    label: 'Sixteenths',
    symbol: '♬',
    description: 'Four rapid subdivisions per beat',
    offsets: [0, 0.25, 0.5, 0.75],
  },
  {
    id: 'swing',
    label: 'Swing',
    symbol: '♩.♪',
    description: 'Triplet-feel jazz & baroque lilt',
    offsets: [0, 0.6667],
  },
];

export type BeatAccentLevel = 'bell' | 'accent' | 'normal' | 'mute';

export interface RepertoirePreset {
  id: string;
  title: string;
  composer: string;
  bpm: number;
  beatsPerBar: number;
  bellEnabled: boolean;
  subdivision: SubdivisionType;
  modelId: MetronomeModelId;
}

export const DEFAULT_REPERTOIRE_PRESETS: RepertoirePreset[] = [
  {
    id: 'beethoven-pathetique',
    title: 'Sonata Pathétique Op. 13 (Grave)',
    composer: 'L. van Beethoven',
    bpm: 44,
    beatsPerBar: 4,
    bellEnabled: true,
    subdivision: 'quarter',
    modelId: 'maelzel-1815',
  },
  {
    id: 'chopin-nocturne',
    title: 'Nocturne Op. 9 No. 2 (Andante)',
    composer: 'F. Chopin',
    bpm: 66,
    beatsPerBar: 6,
    bellEnabled: true,
    subdivision: 'quarter',
    modelId: 'viennese-1895',
  },
  {
    id: 'bach-invention',
    title: 'Invention No. 1 in C Major',
    composer: 'J. S. Bach',
    bpm: 96,
    beatsPerBar: 4,
    bellEnabled: false,
    subdivision: 'eighth',
    modelId: 'breguet-1796',
  },
  {
    id: 'gershwin-prelude',
    title: 'Prelude No. 1 (Allegro ben ritmato)',
    composer: 'G. Gershwin',
    bpm: 126,
    beatsPerBar: 2,
    bellEnabled: true,
    subdivision: 'swing',
    modelId: 'artdeco-1928',
  },
  {
    id: 'mozart-alla-turca',
    title: 'Rondo Alla Turca (Allegretto)',
    composer: 'W. A. Mozart',
    bpm: 132,
    beatsPerBar: 2,
    bellEnabled: true,
    subdivision: 'quarter',
    modelId: 'taktell-1954',
  },
];
