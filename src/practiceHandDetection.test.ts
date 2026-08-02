import { describe, expect, it } from 'vitest';
import type { AudioFeatureFrame } from './audioTraining';
import { chromaFromSpectralPeaks } from './leftHandAnalysis';
import { accompanimentAttackAtBeat, accompanimentContainsPitch, classifyHandCoordination, detectPracticeLeftHand } from './practiceHandDetection';
import type { AccordionButton, LeftHandAcousticProfile } from './types';

function peaks(frequencies: number[]) {
  return frequencies.flatMap((frequency) => Array.from({ length: 5 }, (_, index) => ({
    frequency: frequency * (index + 1), magnitude: 1 / (index + 1),
  })));
}

function frames(chroma: number[], midi = 45): AudioFeatureFrame[] {
  return Array.from({ length: 10 }, (_, index) => ({
    at: index * 38,
    volume: .06,
    spectralCentroid: 420,
    brightness: .08,
    pitch: { note: 'A2', midi, frequency: 110, cents: 0, confidence: .91, volume: .06 },
    chroma,
  }));
}

const button: AccordionButton = {
  id: 'left-a-dm', row: 1, index: 1, role: 'chord', push: 'A', pull: 'Dm',
  pushMidi: 57, pullMidi: 62, pushChord: 'A', pullChord: 'Dm',
};

describe('two-hand practice detection', () => {
  it('recognizes a left-hand chord as a harmonic gesture, not a monophonic note', () => {
    const aMajor = chromaFromSpectralPeaks(peaks([110, 138.59, 164.81]));
    const result = detectPracticeLeftHand(frames(aMajor), button, 'push');
    expect(result).toMatchObject({ matched: true, expectedLabel: 'La', source: 'harmonic-model' });
  });

  it('uses the synchronized instrument fingerprint when available', () => {
    const aMajor = chromaFromSpectralPeaks(peaks([110, 138.59, 164.81]));
    const dMinor = chromaFromSpectralPeaks(peaks([146.83, 174.61, 220]));
    const profile: LeftHandAcousticProfile = {
      accordionId: 'club', accordionModel: 'Club I', referencePitchHz: 435, completedAt: new Date().toISOString(),
      samples: [
        { buttonId: button.id, buttonIndex: 1, row: 1, direction: 'push', role: 'chord', expectedLabel: 'La', detectedLabel: 'La', expectedRootPitchClass: 9, detectedRootPitchClass: 9, chordQuality: 'major', confidence: .9, chroma: aMajor, outcome: 'matched', measuredAt: new Date().toISOString() },
        { buttonId: button.id, buttonIndex: 1, row: 1, direction: 'pull', role: 'chord', expectedLabel: 'Rém', detectedLabel: 'Rém', expectedRootPitchClass: 2, detectedRootPitchClass: 2, chordQuality: 'minor', confidence: .9, chroma: dMinor, outcome: 'matched', measuredAt: new Date().toISOString() },
      ],
    };
    const result = detectPracticeLeftHand(frames(dMinor, 50), button, 'pull', 435, profile);
    expect(result).toMatchObject({ matched: true, source: 'personal-profile' });
    expect(result?.confidence).toBeGreaterThan(.6);
  });

  it('keeps recognizing the accompaniment when the melody adds moderate spectral energy', () => {
    const aMajor = chromaFromSpectralPeaks(peaks([110, 138.59, 164.81]));
    const mixture = aMajor.map((value, index) => value + (index === 7 ? .12 : 0));
    const total = mixture.reduce((sum, value) => sum + value, 0);
    const result = detectPracticeLeftHand(frames(mixture.map((value) => value / total)), button, 'push');
    expect(result).toMatchObject({ matched: true, expectedLabel: 'La' });
  });

  it('requires the left hand in combined wait mode only on accompaniment attacks', () => {
    const events = [{ id: 'bass-1', beat: 0, duration: 1, rootMidi: 48, midi: 48, note: 'C3', chord: 'C', role: 'bass' as const, buttonId: 'b1', direction: 'push' as const }];
    expect(accompanimentAttackAtBeat(events, 0)?.id).toBe('bass-1');
    expect(accompanimentAttackAtBeat(events, .5)).toBeUndefined();
    expect(accompanimentContainsPitch({ ...events[0], role: 'chord', chord: 'C' }, 64)).toBe(true);
    expect(accompanimentContainsPitch({ ...events[0], role: 'chord', chord: 'C' }, 66)).toBe(false);
  });

  it('explains which hand is early or late', () => {
    expect(classifyHandCoordination(1000, 1080).kind).toBe('correct');
    expect(classifyHandCoordination(1000, 1250).kind).toBe('left-late');
    expect(classifyHandCoordination(1000, 800).kind).toBe('left-early');
  });
});
