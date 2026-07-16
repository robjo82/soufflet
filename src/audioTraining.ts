import type { Direction, PitchReading } from './types';

export interface AudioFeatureFrame {
  at: number;
  volume: number;
  spectralCentroid: number;
  brightness: number;
  pitch: PitchReading | null;
}

export interface AudioOnset {
  id: number;
  at: number;
  volume: number;
}

export interface BellowsReference {
  direction: Direction;
  midi: number;
  frequency: number;
  volume: number;
  spectralCentroid: number;
  brightness: number;
  samples: number;
}

export interface BellowsProfile {
  accordionId: string;
  buttonId: string;
  createdAt: string;
  push: BellowsReference;
  pull: BellowsReference;
}

export interface BellowsDetection {
  direction: Direction | null;
  confidence: number;
  reason: 'matched' | 'ambiguous' | 'weak-signal';
}

const PROFILE_KEY = 'soufflet.bellowsProfiles';

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export function createBellowsReference(direction: Direction, frames: AudioFeatureFrame[]): BellowsReference | null {
  const reliable = frames.filter((frame) => frame.pitch && frame.pitch.confidence >= .62 && frame.volume >= .008);
  if (reliable.length < 6) return null;
  return {
    direction,
    midi: Math.round(median(reliable.map((frame) => frame.pitch!.midi))),
    frequency: median(reliable.map((frame) => frame.pitch!.frequency)),
    volume: median(reliable.map((frame) => frame.volume)),
    spectralCentroid: median(reliable.map((frame) => frame.spectralCentroid)),
    brightness: median(reliable.map((frame) => frame.brightness)),
    samples: reliable.length,
  };
}

function referenceDistance(frame: AudioFeatureFrame, reference: BellowsReference) {
  if (!frame.pitch) return Number.POSITIVE_INFINITY;
  const semitones = Math.abs(12 * Math.log2(frame.pitch.frequency / reference.frequency));
  const centroid = Math.abs(Math.log2((frame.spectralCentroid + 80) / (reference.spectralCentroid + 80)));
  const brightness = Math.abs(frame.brightness - reference.brightness);
  return semitones * 1.45 + centroid * .45 + brightness * .8;
}

export function classifyBellows(frame: AudioFeatureFrame, profile: BellowsProfile): BellowsDetection {
  if (!frame.pitch || frame.pitch.confidence < .62 || frame.volume < Math.max(.007, Math.min(profile.push.volume, profile.pull.volume) * .32)) {
    return { direction: null, confidence: 0, reason: 'weak-signal' };
  }
  const pushDistance = referenceDistance(frame, profile.push);
  const pullDistance = referenceDistance(frame, profile.pull);
  const best = Math.min(pushDistance, pullDistance);
  const other = Math.max(pushDistance, pullDistance);
  const confidence = Math.max(0, Math.min(1, (other - best) / Math.max(.7, other + best)));
  if (best > 2.2 || confidence < .3) return { direction: null, confidence, reason: 'ambiguous' };
  return { direction: pushDistance < pullDistance ? 'push' : 'pull', confidence, reason: 'matched' };
}

export function evaluateRhythm(onsets: number[]) {
  if (onsets.length < 4) return { regular: false, averageInterval: 0, variation: 1 };
  const intervals = onsets.slice(1).map((time, index) => time - onsets[index]);
  const averageInterval = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  const variation = Math.max(...intervals.map((value) => Math.abs(value - averageInterval))) / Math.max(1, averageInterval);
  return {
    regular: averageInterval >= 280 && averageInterval <= 1800 && variation <= .28,
    averageInterval,
    variation,
  };
}

export function midiMatches(expected: number, heard: number) {
  return expected === heard || Math.abs(expected - heard) === 12;
}

export function readBellowsProfiles(): Record<string, BellowsProfile> {
  try {
    const value = localStorage.getItem(PROFILE_KEY);
    return value ? JSON.parse(value) as Record<string, BellowsProfile> : {};
  } catch {
    return {};
  }
}

export function saveBellowsProfile(profile: BellowsProfile) {
  const profiles = readBellowsProfiles();
  localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...profiles, [profile.accordionId]: profile }));
}

export function removeBellowsProfile(accordionId: string) {
  const profiles = readBellowsProfiles();
  delete profiles[accordionId];
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
}
