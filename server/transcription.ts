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
  events: Array<{ beat: number; duration: number; midi: number; note: string; chord?: string; confidence: number }>;
}

const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteFromMidi = (midi: number) => `${noteNames[midi % 12]}${Math.floor(midi / 12) - 1}`;

const PROMPT = `You are assisting a diatonic accordion learner. Analyze only what is audibly or visibly supported by the supplied source.
Return one JSON object and no markdown, with: title, artist, bpm, key, timeSignature as [numerator, denominator], confidence from 0 to 1, warnings as short French strings, and events.
Each event must contain beat (zero-based decimal beats), duration (beats), midi, note (scientific pitch like C4), optional chord, confidence 0..1.
Prioritize the main monophonic melody, detect tempo and bar boundaries. Never invent certainty: use confidence below 0.65 for ambiguous/polyphonic/noisy passages. Keep at most 256 meaningful events. Do not map to accordion buttons; the application does that deterministically from its configured layout.`;

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
  return {
    title: typeof data.title === 'string' ? data.title : 'Morceau importé', artist: typeof data.artist === 'string' ? data.artist : 'Artiste inconnu',
    bpm: Math.max(30, Math.min(260, Number(data.bpm) || 100)), key: typeof data.key === 'string' ? data.key : 'Inconnue',
    timeSignature: Array.isArray(data.timeSignature) && data.timeSignature.length === 2 ? [Number(data.timeSignature[0]) || 4, Number(data.timeSignature[1]) || 4] : [4, 4],
    confidence: Math.max(0, Math.min(1, Number(data.confidence) || 0.5)), warnings: Array.isArray(data.warnings) ? data.warnings.filter((item): item is string => typeof item === 'string').slice(0, 10) : [], events,
  };
}

function parseJsonText(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return sanitize(JSON.parse(cleaned) as unknown);
}

async function callGemini(apiKey: string, parts: Array<Record<string, unknown>>) {
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: PROMPT }, ...parts] }], generationConfig: { responseMimeType: 'application/json' } }),
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

function inferMimeType(file: Express.Multer.File) {
  if (file.mimetype && file.mimetype !== 'application/octet-stream') return file.mimetype;
  const mimeByExtension: Record<string, string> = {
    '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.pdf': 'application/pdf',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mid': 'audio/midi', '.midi': 'audio/midi',
  };
  return mimeByExtension[extname(file.originalname).toLowerCase()] ?? 'application/octet-stream';
}

function parseTablature(text: string, accordion: NonNullable<ReturnType<SouffletDatabase['getAccordion']>>): RawTranscription {
  const bpm = Number(text.match(/(?:tempo|bpm)\s*[:=]?\s*(\d+)/i)?.[1] ?? 80);
  const title = text.match(/titre\s*:\s*(.+)/i)?.[1]?.trim() ?? 'Tablature importée';
  const tokens = [...text.matchAll(/\b(\d{1,2})(['′]?)([PpTt])(?::(\d+(?:\.\d+)?))?(\s*[-–—])?/g)];
  let beat = 0;
  const events = tokens.flatMap((match) => {
    const index = Number(match[1]);
    const row = match[2] ? 2 : 1;
    const direction = match[3].toUpperCase() === 'T' ? 'pull' : 'push';
    const duration = match[4] ? Number(match[4]) : match[5] ? 2 : 1;
    const found = accordion.buttons.find((item) => item.row === row && item.index === index);
    if (!found) { beat += duration; return []; }
    const midi = direction === 'push' ? found.pushMidi : found.pullMidi;
    const event = { beat, duration, midi, note: noteFromMidi(midi), confidence: 1 };
    beat += duration;
    return [event];
  });
  if (!events.length) throw new Error('Aucun symbole reconnu. Utilise par exemple « 4P 4T 5P » et une apostrophe pour le rang intérieur : « 4′T ».');
  return { title, artist: 'Tablature texte', bpm, key: 'À confirmer', timeSignature: [4, 4], confidence: 0.9, warnings: ['Le rythme absent du texte a été interprété à une noire par symbole.'], events };
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
      const key = requestKey || process.env.GEMINI_API_KEY;
      if (!key) throw new Error('Aucune clé Gemini n’est configurée.');
      return callGemini(key, [{ fileData: { fileUri: url } }]);
    },
  };
}
