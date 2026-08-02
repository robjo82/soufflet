import type { AudioFeatureFrame } from './audioTraining';
import { analyzeLeftHandFrames, chordLabelPitchClass, expectedLeftHandLabel, leftHandAnalysisMatches, type LeftHandSoundAnalysis } from './leftHandAnalysis';
import type { AccordionButton, AccompanimentEvent, Direction, LeftHandAcousticProfile } from './types';

export type PracticeHandDetectionSource = 'personal-profile' | 'harmonic-model';

export interface PracticeLeftHandDetection {
  analysis: LeftHandSoundAnalysis;
  expectedLabel: string;
  heardLabel: string;
  matched: boolean;
  confidence: number;
  source: PracticeHandDetectionSource;
  signalQuality: 'good' | 'uncertain' | 'weak';
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function cosineSimilarity(left: number[], right: number[]) {
  if (left.length !== 12 || right.length !== 12) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < 12; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}

/**
 * Recognizes the expected bass or chord from a short live window. When the
 * user scanned their own accordion, its fingerprint takes precedence over the
 * generic harmonic model while the latter remains a guard against ambiguity.
 */
export function detectPracticeLeftHand(
  frames: AudioFeatureFrame[],
  button: AccordionButton,
  direction: Direction,
  concertA = 440,
  profile?: LeftHandAcousticProfile | null,
): PracticeLeftHandDetection | null {
  const role = button.role === 'chord' ? 'chord' : 'bass';
  const analysis = analyzeLeftHandFrames(frames, role, concertA);
  if (!analysis) return null;
  const expectedLabel = expectedLeftHandLabel(button, direction);
  const genericMatch = leftHandAnalysisMatches(button, direction, analysis);
  const samples = profile
    ? profile.samples.filter((sample) => sample.role === role && sample.chroma.length === 12)
    : [];
  const expectedSample = samples.find((sample) => sample.buttonId === button.id && sample.direction === direction);

  if (!expectedSample) {
    return {
      analysis,
      expectedLabel,
      heardLabel: analysis.label,
      matched: genericMatch,
      confidence: analysis.confidence,
      source: 'harmonic-model',
      signalQuality: analysis.signalQuality,
    };
  }

  const ranked = samples.map((sample) => ({
    sample,
    similarity: cosineSimilarity(analysis.chroma, sample.chroma),
  })).sort((left, right) => right.similarity - left.similarity);
  const expectedSimilarity = cosineSimilarity(analysis.chroma, expectedSample.chroma);
  const best = ranked[0];
  const expectedIsCompetitive = !best
    || best.sample.buttonId === expectedSample.buttonId && best.sample.direction === expectedSample.direction
    || expectedSimilarity >= best.similarity - .035;
  const strongFingerprint = expectedSimilarity >= .8 && expectedIsCompetitive;
  const matched = genericMatch
    ? expectedSimilarity >= .67 || strongFingerprint
    : expectedSimilarity >= .88 && expectedIsCompetitive;
  const confidence = clamp01(analysis.confidence * .42 + expectedSimilarity * .58);
  const signalQuality = confidence >= .62 && (genericMatch || strongFingerprint)
    ? 'good'
    : confidence >= .4 ? 'uncertain' : 'weak';

  return {
    analysis,
    expectedLabel,
    heardLabel: best?.sample.detectedLabel ?? analysis.label,
    matched,
    confidence,
    source: 'personal-profile',
    signalQuality,
  };
}

export function accompanimentAttackAtBeat(events: AccompanimentEvent[] | undefined, beat: number, tolerance = .08) {
  return events?.find((event) => Math.abs(event.beat - beat) <= tolerance);
}

export function accompanimentContainsPitch(event: AccompanimentEvent | undefined, midi: number) {
  if (!event) return false;
  const heard = ((midi % 12) + 12) % 12;
  const chord = chordLabelPitchClass(event.chord);
  if (!chord || event.role === 'bass') return heard === ((event.midi % 12) + 12) % 12;
  const pitches = [chord.root, (chord.root + (chord.quality === 'minor' ? 3 : 4)) % 12, (chord.root + 7) % 12];
  return pitches.includes(heard);
}

export function classifyHandCoordination(rightAt: number, leftAt: number, toleranceMs = 140) {
  const deltaMs = leftAt - rightAt;
  if (Math.abs(deltaMs) <= toleranceMs) return { kind: 'correct' as const, deltaMs };
  return { kind: deltaMs < 0 ? 'left-early' as const : 'left-late' as const, deltaMs };
}
