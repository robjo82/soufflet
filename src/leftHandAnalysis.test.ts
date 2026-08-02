import { describe, expect, it } from 'vitest';
import type { AudioFeatureFrame } from './audioTraining';
import { analyzeLeftHandFrames, chromaFromSpectralPeaks, leftHandAnalysisMatches } from './leftHandAnalysis';
import type { AccordionButton } from './types';

function harmonicPeaks(frequencies: number[]) {
  return frequencies.flatMap((frequency) => Array.from({ length: 6 }, (_, index) => ({
    frequency: frequency * (index + 1),
    magnitude: 1 / (index + 1) ** .8,
  })));
}

function frames(chroma: number[], midi = 48): AudioFeatureFrame[] {
  return Array.from({ length: 18 }, (_, index) => ({
    at: index * 38,
    volume: .06,
    spectralCentroid: 410,
    brightness: .08,
    pitch: { note: 'C3', midi, frequency: 130.81, cents: 0, confidence: .9, volume: .06 },
    chroma,
  }));
}

describe('polyphonic left-hand analysis', () => {
  it('recognizes major and minor chords from their fundamentals and reed harmonics', () => {
    const aMajor = chromaFromSpectralPeaks(harmonicPeaks([110, 138.59, 164.81]));
    const dMinor = chromaFromSpectralPeaks(harmonicPeaks([146.83, 174.61, 220]));
    expect(analyzeLeftHandFrames(frames(aMajor, 45), 'chord')).toMatchObject({ rootPitchClass: 9, chordQuality: 'major' });
    expect(analyzeLeftHandFrames(frames(dMinor, 50), 'chord')).toMatchObject({ rootPitchClass: 2, chordQuality: 'minor' });
  });

  it('recognizes a bass independently of its octave and reports tuning against A435', () => {
    const frequencyAtA435 = 435 * 2 ** ((43 - 69) / 12);
    const chroma = chromaFromSpectralPeaks(harmonicPeaks([frequencyAtA435]), 435);
    const result = analyzeLeftHandFrames(frames(chroma, 43).map((frame) => ({
      ...frame,
      pitch: { ...frame.pitch!, midi: 43, frequency: frequencyAtA435 },
    })), 'bass', 435);
    expect(result?.rootPitchClass).toBe(7);
    expect(Math.abs(result?.tuningCents ?? 100)).toBeLessThan(2);
  });

  it('compares the whole chord quality rather than a single arbitrary partial', () => {
    const button: AccordionButton = {
      id: 'left-a-dm', row: 1, index: 1, role: 'chord', push: 'A', pull: 'Dm',
      pushMidi: 57, pullMidi: 62, pushChord: 'A', pullChord: 'Dm',
    };
    const analysis = analyzeLeftHandFrames(frames(chromaFromSpectralPeaks(harmonicPeaks([146.83, 174.61, 220])), 50), 'chord');
    expect(analysis && leftHandAnalysisMatches(button, 'pull', analysis)).toBe(true);
    expect(analysis && leftHandAnalysisMatches(button, 'push', analysis)).toBe(false);
  });

  it('recognizes all 16 gestures from the anonymized fingerprint of the real Club I recording', () => {
    // C..B chroma snapshots derived from Rue Fonvieille 2.m4a. These 192
    // normalized coefficients cannot reconstruct or identify the raw audio.
    const fingerprints = [
      [0.0148, 0.2676, 0.0321, 0.0064, 0.3048, 0.0506, 0.0208, 0.0132, 0.0536, 0.1586, 0.0056, 0.0717],
      [0.0397, 0.048, 0.2395, 0.0068, 0.2062, 0.1825, 0.0389, 0.0293, 0.0037, 0.1603, 0.0248, 0.0202],
      [0.2303, 0.018, 0.0886, 0.0737, 0.1525, 0.0361, 0.0036, 0.2561, 0.0206, 0.0289, 0.0297, 0.0619],
      [0.021, 0.0038, 0.1248, 0.0344, 0.042, 0.0022, 0.1022, 0.2464, 0.0152, 0.0095, 0.0054, 0.3931],
      [0.0213, 0.1203, 0.0326, 0.0095, 0.3439, 0.0253, 0.0198, 0.0357, 0.0522, 0.31, 0.0066, 0.0229],
      [0.06, 0.0453, 0.3355, 0.0159, 0.0441, 0.0176, 0.1177, 0.0589, 0.0091, 0.2461, 0.0293, 0.0204],
      [0.4038, 0.012, 0.0447, 0.0168, 0.1285, 0.0618, 0.0092, 0.1732, 0.0245, 0.0832, 0.0314, 0.011],
      [0.0436, 0.0096, 0.3914, 0.0203, 0.0313, 0.0326, 0.0273, 0.2705, 0.01, 0.0661, 0.0257, 0.0718],
      [0.0419, 0.0165, 0.0555, 0.233, 0.0028, 0.0789, 0.0126, 0.2534, 0.025, 0.0031, 0.2343, 0.043],
      [0.0636, 0.018, 0.2859, 0.0367, 0.0033, 0.2681, 0.0322, 0.0319, 0.0093, 0.0386, 0.2017, 0.0107],
      [0.2826, 0.0269, 0.0598, 0.0057, 0.0624, 0.2786, 0.0066, 0.1044, 0.0156, 0.127, 0.0254, 0.005],
      [0.1922, 0.0075, 0.2224, 0.0083, 0.2407, 0.022, 0.0018, 0.1951, 0.0179, 0.0304, 0.0127, 0.049],
      [0.041, 0.0463, 0.0849, 0.3514, 0.0101, 0.0501, 0.0331, 0.0869, 0.04, 0.012, 0.2003, 0.0439],
      [0.0515, 0.0207, 0.117, 0.0451, 0.0061, 0.2906, 0.0238, 0.0142, 0.0275, 0.018, 0.3778, 0.0079],
      [0.2048, 0.0213, 0.0811, 0.005, 0.0131, 0.5114, 0.0029, 0.034, 0.0096, 0.0619, 0.0512, 0.0038],
      [0.4487, 0.0117, 0.05, 0.0188, 0.0836, 0.0657, 0.0032, 0.2239, 0.0283, 0.0113, 0.0446, 0.0103],
    ];
    const expectations = [
      ['chord', 9, 'major'], ['chord', 2, 'minor'], ['chord', 0, 'major'], ['chord', 7, 'major'],
      ['bass', 9], ['bass', 2], ['bass', 0], ['bass', 7],
      ['chord', 3, 'major'], ['chord', 10, 'major'], ['chord', 5, 'major'], ['chord', 0, 'major'],
      ['bass', 3], ['bass', 10], ['bass', 5], ['bass', 0],
    ] as const;
    const bassMidis = [57, 62, 60, 55, 57, 62, 60, 55, 63, 58, 53, 60, 63, 58, 53, 60];
    expectations.forEach(([role, root, quality], index) => {
      const result = analyzeLeftHandFrames(frames(fingerprints[index], bassMidis[index]), role, 435);
      expect(result?.rootPitchClass, `gesture ${index + 1}`).toBe(root);
      if (quality) expect(result?.chordQuality, `gesture ${index + 1}`).toBe(quality);
    });
  });
});
