import { describe, expect, it } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ACCORDION_SAMPLES,
  accordionSampleAssetPath,
  sampleLoopSeconds,
  samplePlaybackRate,
  selectAccordionSample,
} from './accordionSampleBank';

describe('accordion sample bank', () => {
  it('covers the Club I range with the original SFZ regions', () => {
    expect(selectAccordionSample(48).rootMidi).toBe(47);
    expect(selectAccordionSample(54).rootMidi).toBe(54);
    expect(selectAccordionSample(60).rootMidi).toBe(60);
    expect(selectAccordionSample(78).rootMidi).toBe(76);
    expect(selectAccordionSample(91).rootMidi).toBe(79);
  });

  it('applies the source tuning correction and pitch transposition', () => {
    const sample = selectAccordionSample(60);
    expect(samplePlaybackRate(sample, 60)).toBeCloseTo(2 ** (-.28 / 12), 6);
    expect(samplePlaybackRate(sample, 61) / samplePlaybackRate(sample, 60)).toBeCloseTo(2 ** (1 / 12), 6);
  });

  it('keeps valid continuous loops and stable asset paths', () => {
    let totalBytes = 0;
    for (const sample of ACCORDION_SAMPLES) {
      const loop = sampleLoopSeconds(sample);
      const asset = resolve(process.cwd(), 'public', accordionSampleAssetPath(sample));
      expect(loop.start).toBeGreaterThan(0);
      expect(loop.end).toBeGreaterThan(loop.start);
      expect(accordionSampleAssetPath(sample)).toMatch(/^audio\/accordion\/freepats-hn-20240329\/m\d+\.wav$/);
      expect(existsSync(asset), `${sample.file} must be shipped`).toBe(true);
      totalBytes += statSync(asset).size;
    }
    expect(totalBytes).toBeLessThan(6 * 1024 * 1024);
  });
});
