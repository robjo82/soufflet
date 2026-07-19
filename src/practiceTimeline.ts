import type { Hand, Song, SongEvent } from './types';

export function createPracticeTimeline(song: Song, hand: Hand): SongEvent[] {
  if (hand !== 'left') return song.events;
  return (song.accompaniment ?? []).map((event) => ({
    id: `left-${event.id}`,
    beat: event.beat,
    duration: event.duration,
    midi: event.midi,
    note: event.note,
    buttonId: '',
    direction: event.direction,
    finger: 4,
    hand: 'left',
    bassButtonId: event.buttonId,
    bassLabel: event.chord,
    confidence: event.confidence,
  }));
}
