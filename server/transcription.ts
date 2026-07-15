import type { SouffletDatabase } from './database.js';
import { extname } from 'node:path';

interface RawTranscription {
  title: string;
  artist: string;
  bpm: number;
  key: string;
  timeSignature: [number, number];
  confidence: number;
  warnings: string[];
  method?: 'deterministic' | 'verified-library' | 'gemini-preview';
  events: Array<{ beat: number; duration: number; midi: number; note: string; chord?: string; confidence: number }>;
}

interface VerifiedSongCandidate {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  key: string;
  timeSignature: [number, number];
  status: string;
  confidence?: number;
  builtIn?: boolean;
  license?: string;
  provenance?: string;
  events: RawTranscription['events'];
}

interface YoutubeMetadata {
  title: string;
  authorName: string;
}

const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteFromMidi = (midi: number) => `${noteNames[midi % 12]}${Math.floor(midi / 12) - 1}`;

const PROMPT = `You are assisting a diatonic accordion learner. Analyze only what is audibly or visibly supported by the supplied source.
Return one JSON object and no markdown, with: title, artist, bpm, key, timeSignature as [numerator, denominator], confidence from 0 to 1, warnings as short French strings, and events.
Each event must contain beat (zero-based decimal beats), duration (beats), midi, note (scientific pitch like C4), optional chord, confidence 0..1.
Prioritize the main monophonic melody, detect tempo and bar boundaries. Never invent certainty: use confidence below 0.65 for ambiguous/polyphonic/noisy passages, and return no events if exact pitches cannot be grounded in the supplied media. Keep at most 256 meaningful events. Do not map to accordion buttons; the application does that deterministically from its configured layout.`;

function sanitize(value: unknown): RawTranscription {
  if (!value || typeof value !== 'object') throw new Error('La réponse IA ne contient pas de transcription exploitable.');
  const data = value as Partial<RawTranscription>;
  const events = Array.isArray(data.events) ? data.events.slice(0, 256).map((event) => ({
    beat: Math.max(0, Number(event.beat) || 0), duration: Math.max(0.125, Number(event.duration) || 1),
    midi: Math.max(0, Math.min(127, Math.round(Number(event.midi) || 60))),
    note: typeof event.note === 'string' ? event.note : noteFromMidi(Math.round(Number(event.midi) || 60)),
    ...(typeof event.chord === 'string' ? { chord: event.chord } : {}),
    confidence: Math.max(0, Math.min(1, Number(event.confidence) || 0.5)),
  })).sort((a, b) => a.beat - b.beat) : [];
  if (!events.length) throw new Error('Aucune note fiable n’a été détectée. Essaie un passage plus court et plus clair.');
  const method = ['deterministic', 'verified-library', 'gemini-preview'].includes(String(data.method)) ? data.method : undefined;
  return {
    title: typeof data.title === 'string' ? data.title : 'Morceau importé', artist: typeof data.artist === 'string' ? data.artist : 'Artiste inconnu',
    bpm: Math.max(30, Math.min(260, Number(data.bpm) || 100)), key: typeof data.key === 'string' ? data.key : 'Inconnue',
    timeSignature: Array.isArray(data.timeSignature) && data.timeSignature.length === 2 ? [Number(data.timeSignature[0]) || 4, Number(data.timeSignature[1]) || 4] : [4, 4],
    confidence: Math.max(0, Math.min(1, Number(data.confidence) || 0.5)), warnings: Array.isArray(data.warnings) ? data.warnings.filter((item): item is string => typeof item === 'string').slice(0, 10) : [], method, events,
  };
}

function parseJsonText(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return sanitize(JSON.parse(cleaned) as unknown);
}

async function callGemini(apiKey: string, parts: Array<Record<string, unknown>>, prompt = PROMPT) {
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [...parts, { text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } }),
      signal: AbortSignal.timeout(120_000),
    });
    const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };
    if (response.ok) {
      const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
      if (!text) throw new Error('Gemini n’a renvoyé aucun résultat.');
      return parseJsonText(text);
    }
    const retryable = response.status === 429 || response.status === 503;
    if (!retryable || attempt === 2) throw new Error(payload.error?.message ?? `Gemini a répondu avec le code ${response.status}.`);
    await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
  }
  throw new Error('Gemini est temporairement indisponible.');
}

const normalizeTitle = (title: string) => title
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export function findVerifiedSongByTitle(title: string, songs: unknown[]): VerifiedSongCandidate | undefined {
  const normalizedSource = normalizeTitle(title);
  return songs
    .filter((song): song is VerifiedSongCandidate => {
      if (!song || typeof song !== 'object') return false;
      const candidate = song as Partial<VerifiedSongCandidate>;
      return candidate.builtIn === true && candidate.status === 'ready' && Array.isArray(candidate.events) && candidate.events.length > 0 && typeof candidate.title === 'string';
    })
    .sort((left, right) => normalizeTitle(right.title).length - normalizeTitle(left.title).length)
    .find((song) => {
      const normalizedCandidate = normalizeTitle(song.title);
      return normalizedCandidate.length >= 8 && (normalizedSource === normalizedCandidate || normalizedSource.includes(normalizedCandidate));
    });
}

export function transcriptionFromVerifiedSong(song: VerifiedSongCandidate, metadata: YoutubeMetadata): RawTranscription {
  return {
    title: song.title,
    artist: song.artist,
    bpm: song.bpm,
    key: song.key,
    timeSignature: song.timeSignature,
    confidence: Math.min(1, song.confidence ?? 1),
    warnings: [
      `Vidéo reconnue par son titre : « ${metadata.title} » (${metadata.authorName}).`,
      'La mélodie provient de l’édition vérifiée de la bibliothèque ; la synchronisation avec cet enregistrement reste à ajuster.',
      ...(song.provenance ? [song.provenance] : []),
    ],
    method: 'verified-library',
    events: song.events.map((event) => ({
      beat: event.beat,
      duration: event.duration,
      midi: event.midi,
      note: event.note,
      ...(event.chord ? { chord: event.chord } : {}),
      confidence: event.confidence,
    })),
  };
}

async function youtubeMetadata(url: string): Promise<YoutubeMetadata | undefined> {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return undefined;
    const data = await response.json() as { title?: unknown; author_name?: unknown };
    if (typeof data.title !== 'string' || typeof data.author_name !== 'string') return undefined;
    return { title: data.title, authorName: data.author_name.replace(/\s*-\s*Topic$/i, '') };
  } catch {
    return undefined;
  }
}

function cautiousYoutubeResult(result: RawTranscription, metadata?: YoutubeMetadata): RawTranscription {
  const normalizedModelTitle = normalizeTitle(result.title);
  const normalizedMetadataTitle = metadata ? normalizeTitle(metadata.title) : '';
  const identityMatches = Boolean(metadata && (normalizedMetadataTitle.includes(normalizedModelTitle) || normalizedModelTitle.includes(normalizedMetadataTitle)));
  const confidenceCap = metadata ? (identityMatches ? .6 : .4) : .5;
  return {
    ...result,
    title: metadata?.title ?? result.title,
    artist: metadata?.authorName ?? result.artist,
    confidence: Math.min(result.confidence, confidenceCap),
    warnings: [
      ...(metadata && !identityMatches ? ['Gemini n’a pas identifié le même titre que les métadonnées YouTube.'] : []),
      ...result.warnings,
      'Transcription de hauteurs issue de Gemini Video en preview : vérifie chaque passage à l’oreille avant apprentissage.',
    ].slice(0, 10),
    method: 'gemini-preview',
    events: result.events.map((event) => ({ ...event, confidence: Math.min(event.confidence, confidenceCap) })),
  };
}

function inferMimeType(file: Express.Multer.File) {
  if (file.mimetype && file.mimetype !== 'application/octet-stream') return file.mimetype;
  const mimeByExtension: Record<string, string> = {
    '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.pdf': 'application/pdf',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mid': 'audio/midi', '.midi': 'audio/midi',
  };
  return mimeByExtension[extname(file.originalname).toLowerCase()] ?? 'application/octet-stream';
}

export function parseTablature(text: string, accordion: NonNullable<ReturnType<SouffletDatabase['getAccordion']>>): RawTranscription {
  const bpm = Number(text.match(/(?:tempo|bpm)\s*[:=]?\s*(\d+)/i)?.[1] ?? 80);
  const title = text.match(/titre\s*:\s*(.+)/i)?.[1]?.trim() ?? 'Tablature importée';
  const tokenPattern = /(\d{1,2})(['′]?)([PpTt])(?::(\d+(?:\.\d+)?))?/g;
  const resolveToken = (match: RegExpMatchArray, beat: number, duration: number) => {
    const index = Number(match[1]);
    const row = match[2] ? 2 : 1;
    const direction = match[3].toUpperCase() === 'T' ? 'pull' : 'push';
    const found = accordion.buttons.find((item) => item.row === row && item.index === index);
    if (!found) return undefined;
    const midi = direction === 'push' ? found.pushMidi : found.pullMidi;
    return { beat, duration: match[4] ? Number(match[4]) : duration, midi, note: noteFromMidi(midi), confidence: 1 };
  };

  const measuredLines = text.split(/\r?\n/).map((line) => {
    const measure = line.match(/^\s*(\d{1,3})\s+/);
    const firstTab = line.search(/\b\d{1,2}['′]?[PpTt]\b/);
    return measure && firstTab >= 0 ? { number: Number(measure[1]), tab: line.slice(firstTab) } : undefined;
  }).filter((line): line is { number: number; tab: string } => Boolean(line));

  let events: RawTranscription['events'] = [];
  if (measuredLines.length >= 2) {
    events = measuredLines.flatMap(({ number, tab }) => {
      const measureStart = (number - 1) * 4;
      const heldLastNote = /2\s*temps/i.test(tab);
      const groups = tab.replace(/\(?2\s*temps\)?/gi, '').split('/').slice(0, 4);
      return groups.flatMap((group, groupIndex) => {
        const groupStart = measureStart + groupIndex;
        const graceMatches = [...group.matchAll(/\((\d{1,2})(['′]?)([PpTt])\)/g)].map((match) => {
          const compatible = [match[0], match[1], match[2], match[3]] as unknown as RegExpMatchArray;
          const graceBeat = groupIndex === 0 ? groupStart : groupStart - .25;
          return resolveToken(compatible, graceBeat, .25);
        }).filter((event): event is NonNullable<typeof event> => Boolean(event));
        const mainText = group.replace(/\([^)]*\)/g, ' ');
        const mainMatches = [...mainText.matchAll(tokenPattern)];
        const subdivision = mainMatches.length > 1 ? 1 / mainMatches.length : 1;
        const mainEvents = mainMatches.map((match, index) => resolveToken(match, groupStart + index * subdivision, heldLastNote && groupIndex === groups.length - 1 && index === mainMatches.length - 1 ? 2 : subdivision))
          .filter((event): event is NonNullable<typeof event> => Boolean(event));
        if (groupIndex === 0 && graceMatches.length && mainEvents[0]) mainEvents[0] = { ...mainEvents[0], beat: groupStart + .25, duration: Math.max(.25, mainEvents[0].duration - .25) };
        return [...graceMatches, ...mainEvents];
      });
    }).sort((left, right) => left.beat - right.beat);
  } else {
    let beat = 0;
    const sequentialGroups = text.split(/\s+|\//).filter(Boolean);
    events = sequentialGroups.flatMap((group) => {
      const matches = [...group.matchAll(tokenPattern)];
      if (!matches.length) return [];
      const duration = 1 / matches.length;
      const parsed = matches.map((match, index) => resolveToken(match, beat + index * duration, duration)).filter((event): event is NonNullable<typeof event> => Boolean(event));
      beat += 1;
      return parsed;
    });
  }
  if (!events.length) throw new Error('Aucun symbole reconnu. Utilise par exemple « 4P 4T 5P » et une apostrophe pour le rang intérieur : « 4′T ».');
  return { title, artist: 'Tablature texte', bpm, key: 'À confirmer', timeSignature: [4, 4], confidence: measuredLines.length >= 2 ? 1 : 0.9, warnings: measuredLines.length >= 2 ? ['Mesures, ornements, subdivisions et tenues interprétés depuis la tablature structurée.'] : ['Le rythme absent du texte a été interprété à une noire par groupe.'], method: 'deterministic', events };
}

export function createTranscriber(db: SouffletDatabase) {
  return {
    async fromUpload(file: Express.Multer.File | undefined, tablature: string | undefined, accordionId: string, requestKey?: string) {
      const accordion = db.getAccordion(accordionId);
      if (!accordion) throw new Error('Configuration d’accordéon inconnue.');
      if (tablature?.trim() && !file) return parseTablature(tablature, accordion);
      if (!file) throw new Error('Ajoute un fichier à analyser.');
      const key = requestKey || process.env.GEMINI_API_KEY;
      if (!key) throw new Error('Aucune clé Gemini n’est configurée. Ajoute GEMINI_API_KEY au serveur ou une clé personnelle dans Réglages.');
      return callGemini(key, [{ inlineData: { mimeType: inferMimeType(file), data: file.buffer.toString('base64') } }]);
    },
    async fromYoutube(url: string, requestKey?: string) {
      if (!/^https:\/\/(?:www\.)?(?:youtube\.com\/|youtu\.be\/)/i.test(url)) throw new Error('L’URL YouTube n’est pas valide.');
      const metadata = await youtubeMetadata(url);
      const verifiedSong = metadata ? findVerifiedSongByTitle(metadata.title, db.listCommonSongs() as unknown[]) : undefined;
      if (metadata && verifiedSong) return transcriptionFromVerifiedSong(verifiedSong, metadata);
      const key = requestKey || process.env.GEMINI_API_KEY;
      if (!key) throw new Error('Aucune clé Gemini n’est configurée.');
      const metadataContext = metadata
        ? `Authoritative YouTube metadata: title "${metadata.title}", author "${metadata.authorName}". Preserve these identity fields.`
        : 'YouTube metadata could not be verified. Do not guess the title or artist.';
      const prompt = `${PROMPT}\n${metadataContext}\nFor a YouTube source, transcribe only the first complete statement of the main theme. The result is a preview: never assign confidence above 0.60 to a pitch extracted from a mixed recording.`;
      const result = await callGemini(key, [{ fileData: { fileUri: url, mimeType: 'video/*' } }], prompt);
      return cautiousYoutubeResult(result, metadata);
    },
  };
}
