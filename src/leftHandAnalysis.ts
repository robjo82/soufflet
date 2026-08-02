import type { AudioFeatureFrame } from './audioTraining';
import type { AccordionButton, Direction, LeftHandScanSample } from './types';

const PITCH_CLASS_NAMES = ['Do', 'Do♯', 'Ré', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'Si♭', 'Si'];
const NOTE_TO_PITCH_CLASS: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

export interface SpectralPeak {
  frequency: number;
  magnitude: number;
}

export interface LeftHandSoundAnalysis {
  role: 'bass' | 'chord';
  rootPitchClass: number;
  rootName: string;
  chordQuality?: 'major' | 'minor';
  label: string;
  pitchClasses: number[];
  chroma: number[];
  confidence: number;
  tuningCents?: number;
  sampleCount: number;
  signalQuality: 'good' | 'uncertain' | 'weak';
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const pitchClass = (midi: number) => ((midi % 12) + 12) % 12;

function normalizeChroma(values: number[]) {
  const chroma = Array.from({ length: 12 }, (_, index) => Math.max(0, values[index] ?? 0));
  const total = chroma.reduce((sum, value) => sum + value, 0);
  return total > 0 ? chroma.map((value) => value / total) : chroma;
}

/**
 * Converts spectral peaks to a pitch-class profile. Peaks are lightly folded
 * through their first harmonics so a strong overtone does not become a false
 * bass root. This compact profile is safe to persist: it cannot recreate audio.
 */
export function chromaFromSpectralPeaks(peaks: SpectralPeak[], concertA = 440) {
  const chroma = Array<number>(12).fill(0);
  for (const peak of peaks) {
    if (peak.frequency < 45 || peak.frequency > 2600 || peak.magnitude <= 0) continue;
    const frequencyWeight = 1 / Math.sqrt(Math.max(1, peak.frequency / 110));
    for (let harmonic = 1; harmonic <= 5; harmonic += 1) {
      const possibleFundamental = peak.frequency / harmonic;
      if (possibleFundamental < 40) break;
      const midi = Math.round(69 + 12 * Math.log2(possibleFundamental / concertA));
      const harmonicWeight = harmonic === 1 ? 1 : .24 / harmonic;
      chroma[pitchClass(midi)] += peak.magnitude * frequencyWeight * harmonicWeight;
    }
  }
  return normalizeChroma(chroma);
}

function averageChroma(frames: AudioFeatureFrame[]) {
  const total = Array<number>(12).fill(0);
  let weightSum = 0;
  for (const frame of frames) {
    if (!frame.chroma || frame.chroma.length !== 12) continue;
    const weight = Math.max(.001, frame.volume);
    frame.chroma.forEach((value, index) => { total[index] += value * weight; });
    weightSum += weight;
  }
  return weightSum ? normalizeChroma(total.map((value) => value / weightSum)) : total;
}

function chordScore(chroma: number[], root: number, minor: boolean) {
  const third = (root + (minor ? 3 : 4)) % 12;
  const fifth = (root + 7) % 12;
  const chordEnergy = chroma[root] * .46 + chroma[third] * .3 + chroma[fifth] * .24;
  const strongestOutside = Math.max(...chroma.filter((_, index) => index !== root && index !== third && index !== fifth));
  return chordEnergy - strongestOutside * .12;
}

function chordFromChroma(chroma: number[]) {
  const candidates = Array.from({ length: 12 }, (_, root) => ([
    { root, quality: 'major' as const, score: chordScore(chroma, root, false) },
    { root, quality: 'minor' as const, score: chordScore(chroma, root, true) },
  ])).flat().sort((left, right) => right.score - left.score);
  const best = candidates[0];
  const runnerUp = candidates[1];
  const triad = [best.root, (best.root + (best.quality === 'minor' ? 3 : 4)) % 12, (best.root + 7) % 12];
  const coverage = triad.reduce((sum, note) => sum + chroma[note], 0);
  const margin = Math.max(0, best.score - runnerUp.score);
  return {
    ...best,
    pitchClasses: triad,
    confidence: clamp01((coverage - .25) * 1.5 + margin * 4.5),
  };
}

function bassFromFrames(frames: AudioFeatureFrame[], chroma: number[], concertA: number) {
  const votes = Array<number>(12).fill(0);
  for (const frame of frames) {
    if (!frame.pitch || frame.pitch.confidence < .62) continue;
    votes[pitchClass(frame.pitch.midi)] += frame.pitch.confidence * Math.max(frame.volume, .005);
  }
  const voteTotal = votes.reduce((sum, value) => sum + value, 0);
  const normalizedVotes = voteTotal ? votes.map((value) => value / voteTotal) : votes;
  const combined = chroma.map((value, index) => value * .55 + normalizedVotes[index] * .45);
  const ranking = combined.map((score, root) => ({ root, score })).sort((left, right) => right.score - left.score);
  const root = ranking[0].root;
  const total = combined.reduce((sum, value) => sum + value, 0);
  const confidence = clamp01(total ? (ranking[0].score / total - .14) * 2.1 + (ranking[0].score - ranking[1].score) / total : 0);
  const pitchFrames = frames.filter((frame) => frame.pitch && pitchClass(frame.pitch.midi) === root);
  const centsValues = pitchFrames.map((frame) => {
    const exactMidi = 69 + 12 * Math.log2(frame.pitch!.frequency / concertA);
    return (exactMidi - Math.round(exactMidi)) * 100;
  }).sort((a, b) => a - b);
  return {
    root,
    confidence,
    tuningCents: centsValues.length ? centsValues[Math.floor(centsValues.length / 2)] : undefined,
  };
}

export function analyzeLeftHandFrames(
  frames: AudioFeatureFrame[],
  role: 'bass' | 'chord',
  concertA = 440,
): LeftHandSoundAnalysis | null {
  const usable = frames.filter((frame) => frame.volume >= .006 && frame.chroma?.length === 12);
  if (usable.length < 6) return null;
  const chroma = averageChroma(usable);
  if (!chroma.some((value) => value > 0)) return null;

  if (role === 'bass') {
    const result = bassFromFrames(usable, chroma, concertA);
    return {
      role,
      rootPitchClass: result.root,
      rootName: PITCH_CLASS_NAMES[result.root],
      label: PITCH_CLASS_NAMES[result.root],
      pitchClasses: [result.root],
      chroma,
      confidence: result.confidence,
      tuningCents: result.tuningCents,
      sampleCount: usable.length,
      signalQuality: result.confidence >= .58 ? 'good' : result.confidence >= .34 ? 'uncertain' : 'weak',
    };
  }

  const result = chordFromChroma(chroma);
  const suffix = result.quality === 'minor' ? 'm' : '';
  return {
    role,
    rootPitchClass: result.root,
    rootName: PITCH_CLASS_NAMES[result.root],
    chordQuality: result.quality,
    label: `${PITCH_CLASS_NAMES[result.root]}${suffix}`,
    pitchClasses: result.pitchClasses,
    chroma,
    confidence: result.confidence,
    sampleCount: usable.length,
    signalQuality: result.confidence >= .52 ? 'good' : result.confidence >= .3 ? 'uncertain' : 'weak',
  };
}

export function chordLabelPitchClass(label?: string) {
  if (!label) return null;
  const match = label.trim().match(/^([A-G](?:#|b)?)(m)?/);
  return match ? { root: NOTE_TO_PITCH_CLASS[match[1]], quality: match[2] ? 'minor' as const : 'major' as const } : null;
}

export function expectedLeftHandLabel(button: AccordionButton, direction: Direction) {
  const chord = direction === 'push' ? button.pushChord : button.pullChord;
  if (button.role === 'chord' && chord) {
    const parsed = chordLabelPitchClass(chord);
    return parsed ? `${PITCH_CLASS_NAMES[parsed.root]}${parsed.quality === 'minor' ? 'm' : ''}` : chord;
  }
  return PITCH_CLASS_NAMES[pitchClass(direction === 'push' ? button.pushMidi : button.pullMidi)];
}

export function leftHandAnalysisMatches(button: AccordionButton, direction: Direction, analysis: LeftHandSoundAnalysis) {
  const chord = chordLabelPitchClass(direction === 'push' ? button.pushChord : button.pullChord);
  const expectedRoot = chord?.root ?? pitchClass(direction === 'push' ? button.pushMidi : button.pullMidi);
  if (analysis.rootPitchClass !== expectedRoot) return false;
  return button.role !== 'chord' || !chord || analysis.chordQuality === chord.quality;
}

export function buildLeftHandScanSample(
  button: AccordionButton,
  direction: Direction,
  analysis: LeftHandSoundAnalysis,
): LeftHandScanSample {
  const matched = leftHandAnalysisMatches(button, direction, analysis);
  return {
    buttonId: button.id,
    buttonIndex: button.index,
    row: button.row,
    direction,
    role: button.role === 'chord' ? 'chord' : 'bass',
    expectedLabel: expectedLeftHandLabel(button, direction),
    detectedLabel: analysis.label,
    expectedRootPitchClass: chordLabelPitchClass(direction === 'push' ? button.pushChord : button.pullChord)?.root
      ?? pitchClass(direction === 'push' ? button.pushMidi : button.pullMidi),
    detectedRootPitchClass: analysis.rootPitchClass,
    chordQuality: analysis.chordQuality,
    confidence: analysis.confidence,
    tuningCents: analysis.tuningCents,
    chroma: analysis.chroma.map((value) => Math.round(value * 10_000) / 10_000),
    outcome: analysis.signalQuality !== 'good' ? 'uncertain' : matched ? 'matched' : 'mismatch',
    measuredAt: new Date().toISOString(),
  };
}
