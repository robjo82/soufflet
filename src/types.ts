export type Direction = 'push' | 'pull';
export type Hand = 'right' | 'left' | 'both';
export type Notation = 'french' | 'english' | 'button' | 'tablature';
export type PracticeMode =
  | 'demo'
  | 'guided'
  | 'wait'
  | 'notes'
  | 'rhythm'
  | 'bellows'
  | 'right'
  | 'left'
  | 'combined'
  | 'game'
  | 'performance';

export interface AccordionButton {
  id: string;
  row: number;
  index: number;
  push: string;
  pull: string;
  pushMidi: number;
  pullMidi: number;
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
  transcriptionMethod?: 'deterministic' | 'verified-library' | 'gemini-preview';
  transcriptionWarnings?: string[];
  builtIn?: boolean;
  license?: string;
  provenance?: string;
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
  tempo: number;
  countIn: boolean;
  metronome: boolean;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  notation: Notation;
}

export interface PracticeSessionInput {
  id: string;
  songId: string;
  songTitle: string;
  mode: PracticeMode;
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

export interface TranscriptionResult {
  title: string;
  artist: string;
  bpm: number;
  key: string;
  timeSignature: [number, number];
  confidence: number;
  warnings: string[];
  method?: 'deterministic' | 'verified-library' | 'gemini-preview';
  events: Array<{
    beat: number;
    duration: number;
    midi: number;
    note: string;
    chord?: string;
    confidence: number;
  }>;
}

export type Page = 'home' | 'learn' | 'library' | 'studio' | 'tuner' | 'settings' | 'account';
