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
  events: Array<{
    beat: number;
    duration: number;
    midi: number;
    note: string;
    chord?: string;
    confidence: number;
  }>;
}

export type Page = 'home' | 'learn' | 'library' | 'studio' | 'tuner' | 'settings';
