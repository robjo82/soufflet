import type { Song } from './types';

export function reconcileLibrarySongs(serverSongs: Song[], currentSongs: Song[]) {
  const serverIds = new Set(serverSongs.map((song) => song.id));
  const pendingLocalSongs = currentSongs.filter((song) => !song.builtIn && !serverIds.has(song.id));
  const merged = new Map<string, Song>();
  for (const song of [...serverSongs, ...pendingLocalSongs]) merged.set(song.id, song);
  return [...merged.values()];
}
