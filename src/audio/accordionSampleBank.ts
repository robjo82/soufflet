export interface AccordionSample {
  file: string;
  rootMidi: number;
  lowMidi: number;
  highMidi: number;
  tuneCents: number;
  loopStart: number;
  loopEnd: number;
}

export const ACCORDION_SAMPLE_RATE = 44_100;
export const ACCORDION_SAMPLE_BANK_ID = 'freepats-hn-20240329';

// Original SFZ mapping from FreePats' Button Accordion HN bank. The filenames
// use the SFZ key centres rather than the octave labels found in the archive.
export const ACCORDION_SAMPLES: AccordionSample[] = [
  { file: 'm47.wav', rootMidi: 47, lowMidi: 0, highMidi: 49, tuneCents: -34, loopStart: 36_018, loopEnd: 62_654 },
  { file: 'm50.wav', rootMidi: 50, lowMidi: 50, highMidi: 53, tuneCents: -38, loopStart: 49_751, loopEnd: 69_153 },
  { file: 'm54.wav', rootMidi: 54, lowMidi: 54, highMidi: 54, tuneCents: -23, loopStart: 46_413, loopEnd: 79_367 },
  { file: 'm55.wav', rootMidi: 55, lowMidi: 55, highMidi: 56, tuneCents: -30, loopStart: 66_543, loopEnd: 93_290 },
  { file: 'm57.wav', rootMidi: 57, lowMidi: 57, highMidi: 58, tuneCents: -32, loopStart: 60_366, loopEnd: 74_543 },
  { file: 'm59.wav', rootMidi: 59, lowMidi: 59, highMidi: 59, tuneCents: -19, loopStart: 76_136, loopEnd: 91_082 },
  { file: 'm60.wav', rootMidi: 60, lowMidi: 60, highMidi: 61, tuneCents: -28, loopStart: 72_926, loopEnd: 86_200 },
  { file: 'm62.wav', rootMidi: 62, lowMidi: 62, highMidi: 63, tuneCents: -26, loopStart: 73_008, loopEnd: 86_264 },
  { file: 'm64.wav', rootMidi: 64, lowMidi: 64, highMidi: 65, tuneCents: -30, loopStart: 65_908, loopEnd: 83_784 },
  { file: 'm66.wav', rootMidi: 66, lowMidi: 66, highMidi: 66, tuneCents: -26, loopStart: 85_013, loopEnd: 94_643 },
  { file: 'm67.wav', rootMidi: 67, lowMidi: 67, highMidi: 68, tuneCents: -29, loopStart: 78_733, loopEnd: 97_217 },
  { file: 'm69.wav', rootMidi: 69, lowMidi: 69, highMidi: 70, tuneCents: -20, loopStart: 85_262, loopEnd: 93_453 },
  { file: 'm71.wav', rootMidi: 71, lowMidi: 71, highMidi: 71, tuneCents: -7, loopStart: 75_333, loopEnd: 82_273 },
  { file: 'm72.wav', rootMidi: 72, lowMidi: 72, highMidi: 73, tuneCents: -26, loopStart: 101_921, loopEnd: 108_876 },
  { file: 'm74.wav', rootMidi: 74, lowMidi: 74, highMidi: 75, tuneCents: -16, loopStart: 50_588, loopEnd: 59_478 },
  { file: 'm76.wav', rootMidi: 76, lowMidi: 76, highMidi: 78, tuneCents: -22, loopStart: 86_641, loopEnd: 93_093 },
  { file: 'm79.wav', rootMidi: 79, lowMidi: 79, highMidi: 127, tuneCents: -10, loopStart: 58_658, loopEnd: 63_555 },
];

export function selectAccordionSample(midi: number) {
  return ACCORDION_SAMPLES.find((sample) => midi >= sample.lowMidi && midi <= sample.highMidi)
    ?? ACCORDION_SAMPLES.reduce((closest, sample) => (
      Math.abs(sample.rootMidi - midi) < Math.abs(closest.rootMidi - midi) ? sample : closest
    ));
}

export function samplePlaybackRate(sample: AccordionSample, midi: number) {
  return 2 ** ((midi - sample.rootMidi + sample.tuneCents / 100) / 12);
}

export function sampleLoopSeconds(sample: AccordionSample) {
  return {
    start: sample.loopStart / ACCORDION_SAMPLE_RATE,
    end: sample.loopEnd / ACCORDION_SAMPLE_RATE,
  };
}

export function accordionSampleAssetPath(sample: AccordionSample) {
  return `audio/accordion/${ACCORDION_SAMPLE_BANK_ID}/${sample.file}`;
}
