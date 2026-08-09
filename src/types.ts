export type Direction = 'push' | 'pull';
export type InstrumentType = 'accordion' | 'piano' | 'guitar';
export type PianoInput = 'midi' | 'microphone' | 'computer-keyboard';
export type PianoKeyboardSize = 25 | 32 | 49 | 61 | 76 | 88;
export type GuitarInput = 'microphone' | 'midi' | 'touch';
export type BellowsStyle = 'balanced' | 'push-pull' | 'cross-row';
export type Hand = 'right' | 'left' | 'both';
export type Notation = 'french' | 'english' | 'button' | 'tablature';
export type PrimaryPracticeMode = 'demo' | 'guided' | 'wait' | 'performance';
export type SupplementalPracticeMode = 'rhythm' | 'bellows';
export type LegacyPracticeMode = 'notes' | 'right' | 'left' | 'combined';
export type PracticeMode =
  | PrimaryPracticeMode
  | SupplementalPracticeMode
  | LegacyPracticeMode
  | 'game';

export interface AccordionButton {
  id: string;
  row: number;
  index: number;
  push: string;
  pull: string;
  pushMidi: number;
  pullMidi: number;
  /** Harmonic label for a left-hand chord button (for example C, Dm or G7). */
  pushChord?: string;
  pullChord?: string;
  finger?: number;
  role?: 'melody' | 'accidental' | 'bass' | 'chord';
  isGleichton?: boolean;
}

export interface AccordionConfig {
  id: string;
  maker: string;
  model: string;
  tuning: string;
  color: string;
  rightRows: number[];
  bassCount: number;
  description: string;
  buttons: AccordionButton[];
  basses: AccordionButton[];
  verified: boolean;
  sourceNote?: string;
  /** Native diapason of the instrument. Vintage Club models are commonly below A4=440 Hz. */
  referencePitchHz?: number;
}

export interface PianoConfig {
  id: string;
  instrumentType: 'piano';
  name: string;
  keyboardSize: PianoKeyboardSize;
  input: PianoInput;
  notation: 'french' | 'english';
  builtIn?: boolean;
}

export interface GuitarStringConfig {
  number: number;
  note: string;
  midi: number;
}

export interface GuitarConfig {
  id: string;
  instrumentType: 'guitar';
  name: string;
  strings: GuitarStringConfig[];
  fretCount: number;
  capo: number;
  handedness: 'right' | 'left';
  input: GuitarInput;
  builtIn?: boolean;
}

export interface InstrumentPosition {
  string: number;
  fret: number;
  finger?: number;
}

export interface InstrumentArrangementEvent {
  id: string;
  beat: number;
  duration: number;
  midis: number[];
  hand: 'right' | 'left' | 'both';
  fingers?: number[];
  label?: string;
  sourceEventId?: string;
  part?: 'melody' | 'accompaniment';
  positions?: InstrumentPosition[];
}

export interface InstrumentArrangement {
  instrumentType: InstrumentType;
  difficulty: number;
  events: InstrumentArrangementEvent[];
  provenance: string;
}

export interface SongEvent {
  id: string;
  beat: number;
  duration: number;
  midi: number;
  note: string;
  buttonId: string;
  direction: Direction;
  finger: number;
  hand?: Hand;
  bassButtonId?: string;
  bassLabel?: string;
  confidence?: number;
  mappingSource?: 'authorial' | 'optimized';
}

export interface BellowsAirAction {
  fromAmount: number;
  toAmount: number;
  reason: 'reserve-low' | 'reserve-high' | 'phrase-breath';
}

export interface BellowsPlanStep {
  eventId: string;
  beat: number;
  direction: Direction;
  beforeAmount: number;
  afterAmount: number;
  airBefore?: BellowsAirAction;
}

export interface BellowsPlan {
  style: BellowsStyle;
  startAmount: number;
  comfortableMin: number;
  comfortableMax: number;
  minAmount: number;
  maxAmount: number;
  directionChanges: number;
  rowChanges: number;
  airActions: number;
  needsReview: boolean;
  steps: BellowsPlanStep[];
}

export interface AccompanimentEvent {
  id: string;
  beat: number;
  duration: number;
  rootMidi: number;
  midi: number;
  note: string;
  chord: string;
  role: 'bass' | 'chord';
  buttonId: string;
  direction: Direction;
  confidence?: number;
}

export interface TranscriptionSource {
  title: string;
  url: string;
  kind: 'abc' | 'midi' | 'musicxml' | 'tablature' | 'score' | 'pdf' | 'chords' | 'lyrics' | 'metadata' | 'other';
  usedFor: string;
  reliability: number;
}

export interface LyricLine {
  beat: number;
  text: string;
  section?: string;
}

export interface TranscriptionCoverage {
  sourceDurationSeconds: number;
  transcribedDurationSeconds: number;
  ratio: number;
  sectionsFound: number;
  sectionsTranscribed: number;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  sourceType: 'lesson' | 'audio' | 'youtube' | 'spotify' | 'tablature';
  sourceUrl?: string;
  bpm: number;
  timeSignature: [number, number];
  key: string;
  duration: number;
  difficulty: number;
  status: 'ready' | 'analyzing' | 'needs-review' | 'reference-only';
  events: SongEvent[];
  accompaniment?: AccompanimentEvent[];
  confidence?: number;
  uncertainBeats?: number[];
  transcriptionMethod?: 'deterministic' | 'verified-library' | 'gemini-preview' | 'multimodal-research';
  transcriptionWarnings?: string[];
  transcriptionSources?: TranscriptionSource[];
  transcriptionCoverage?: TranscriptionCoverage;
  lyrics?: LyricLine[];
  rightsStatus?: 'public-domain' | 'traditional' | 'protected' | 'unknown';
  rightsNote?: string;
  arrangements?: Partial<Record<InstrumentType, InstrumentArrangement>>;
  builtIn?: boolean;
  license?: string;
  provenance?: string;
  bellowsPlan?: BellowsPlan;
}

export interface UserAccount {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface SkillProgress {
  id: string;
  title: string;
  description: string;
  progress: number;
  lessons: number;
  icon: string;
  locked?: boolean;
  due?: boolean;
}

export interface PracticeSettings {
  mode: PracticeMode;
  hand: Hand;
  tempo: number;
  countIn: boolean;
  metronome: boolean;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  notation: Notation;
  bellowsStyle: BellowsStyle;
}

export interface PracticeSessionInput {
  id: string;
  songId: string;
  songTitle: string;
  mode: PracticeMode;
  hand: Hand;
  startedAt: string;
  endedAt: string;
  activeSeconds: number;
  correctCount: number;
  earlyCount: number;
  lateCount: number;
  wrongCount: number;
  completionPercent: number;
  tempoPercent: number;
  flagged: boolean;
  instrumentType?: InstrumentType;
  assessmentBreakdown?: PracticeAssessmentBreakdown;
}

export interface PracticeDimensionResults {
  correct: number;
  early: number;
  late: number;
  wrong: number;
}

export interface PracticeAssessmentBreakdown {
  right: PracticeDimensionResults;
  left: PracticeDimensionResults;
  coordination: PracticeDimensionResults;
}

export interface PracticeStats {
  generatedAt: string;
  hasData: boolean;
  overview: {
    totalSeconds: number;
    weekSeconds: number;
    totalSessions: number;
    currentStreak: number;
    longestStreak: number;
    activeDays: number;
    songsPracticed: number;
    assessedNotes: number;
    pitchAccuracy: number | null;
    timingAccuracy: number | null;
  };
  week: Array<{ date: string; activeSeconds: number; sessions: number }>;
  trends: Array<{ weekStart: string; activeSeconds: number; sessions: number; pitchAccuracy: number | null }>;
  skills: {
    notes: { value: number | null; sampleSize: number };
    rhythm: { value: number | null; sampleSize: number };
    tempo: { value: number | null; sampleSize: number };
    regularity: { value: number; sampleSize: number };
  };
  recentSessions: Array<PracticeSessionInput>;
  favoriteSongs: Array<{ songId: string; title: string; activeSeconds: number; sessions: number }>;
  modeBreakdown: Array<{ mode: PracticeMode; activeSeconds: number; sessions: number }>;
  insights: Array<{ kind: 'encouragement' | 'focus' | 'observation'; title: string; detail: string }>;
}

export interface PitchReading {
  note: string;
  midi: number;
  frequency: number;
  cents: number;
  confidence: number;
  volume: number;
}

export interface TunerReading {
  id: string;
  sessionId: string;
  accordionId: string;
  accordionModel: string;
  buttonId: string;
  row: number;
  buttonIndex: number;
  hand: 'right' | 'left';
  direction: Direction;
  expectedMidi: number;
  detectedMidi: number;
  frequency: number;
  cents: number;
  confidence: number;
  volume: number;
  outcome: 'matched' | 'corrected';
  measuredAt: string;
}

export interface LeftHandScanSample {
  buttonId: string;
  buttonIndex: number;
  row: number;
  direction: Direction;
  role: 'bass' | 'chord';
  expectedLabel: string;
  detectedLabel: string;
  expectedRootPitchClass: number;
  detectedRootPitchClass: number;
  chordQuality?: 'major' | 'minor';
  confidence: number;
  tuningCents?: number;
  /** Normalized C..B harmonic profile. This contains no reconstructable audio. */
  chroma: number[];
  outcome: 'matched' | 'uncertain' | 'mismatch';
  measuredAt: string;
}

export interface LeftHandAcousticProfile {
  accordionId: string;
  accordionModel: string;
  referencePitchHz: number;
  completedAt: string;
  samples: LeftHandScanSample[];
}

export interface TranscriptionResult {
  title: string;
  artist: string;
  bpm: number;
  key: string;
  timeSignature: [number, number];
  confidence: number;
  warnings: string[];
  method?: 'deterministic' | 'verified-library' | 'gemini-preview' | 'multimodal-research';
  events: Array<{
    beat: number;
    duration: number;
    midi: number;
    note: string;
    chord?: string;
    confidence: number;
  }>;
  accompaniment?: Array<{
    beat: number;
    duration: number;
    rootMidi: number;
    midi: number;
    note: string;
    chord: string;
    role: 'bass' | 'chord';
    confidence: number;
  }>;
  sources?: TranscriptionSource[];
  coverage?: TranscriptionCoverage;
  lyrics?: LyricLine[];
  rightsStatus?: 'public-domain' | 'traditional' | 'protected' | 'unknown';
  rightsNote?: string;
}

export type Page = 'home' | 'learn' | 'game' | 'library' | 'studio' | 'tuner' | 'settings' | 'account';
