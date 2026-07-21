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
  method?: 'deterministic' | 'verified-library' | 'gemini-preview' | 'multimodal-research';
  events: Array<{ beat: number; duration: number; midi: number; note: string; chord?: string; confidence: number }>;
  accompaniment?: Array<{
    beat: number;
    duration: number;
    rootMidi: number;
    midi: number;
    note: string;
    chord: string;
    role: 'bass' | 'chord';
    confidence: number;
  }>;
  sources?: TranscriptionSource[];
  coverage?: TranscriptionCoverage;
}

interface TranscriptionSource {
  title: string;
  url: string;
  kind: 'abc' | 'midi' | 'musicxml' | 'tablature' | 'score' | 'chords' | 'metadata' | 'other';
  usedFor: string;
  reliability: number;
}

interface TranscriptionCoverage {
  sourceDurationSeconds: number;
  transcribedDurationSeconds: number;
  ratio: number;
  sectionsFound: number;
  sectionsTranscribed: number;
}

interface ResearchBrief {
  title: string;
  artist: string;
  composer: string;
  bpm: number;
  key: string;
  timeSignature: [number, number];
  durationSeconds: number;
  confidence: number;
  sections: Array<{ label: string; startSeconds: number; endSeconds: number; description: string }>;
  sources: TranscriptionSource[];
  chordProgression: string[];
  referenceEvents: Array<{ beat: number; duration: number; note: string; confidence: number }>;
  referenceAccompaniment: Array<{ beat: number; duration: number; note: string; chord: string; role: 'bass' | 'chord'; confidence: number }>;
  referenceNotation: string;
  warnings: string[];
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
  accompaniment?: RawTranscription['accompaniment'];
}

interface YoutubeMetadata {
  title: string;
  authorName: string;
}

const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteFromMidi = (midi: number) => `${noteNames[midi % 12]}${Math.floor(midi / 12) - 1}`;

export function midiFromNote(note: string) {
  const match = note.trim().replace(/♯/g, '#').replace(/♭/g, 'b').replace(/−/g, '-').match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!match) return undefined;
  const pitchClasses: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  const midi = (Number(match[3]) + 1) * 12 + pitchClasses[match[1].toUpperCase()] + accidental;
  return midi >= 0 && midi <= 127 ? midi : undefined;
}

function midiFromChord(chord: string) {
  const match = chord.trim().replace(/♯/g, '#').replace(/♭/g, 'b').match(/^([A-Ga-g])([#b]?)/);
  if (!match) return undefined;
  return midiFromNote(`${match[1].toUpperCase()}${match[2]}3`);
}

const PROMPT = `You are assisting a diatonic accordion learner. Analyze only what is audibly or visibly supported by the supplied source.
Return one JSON object and no markdown, with: title, artist, bpm, key, timeSignature as [numerator, denominator], confidence from 0 to 1, warnings as short French strings, and events.
Each event must contain beat (zero-based decimal beats), duration (beats), midi, note (scientific pitch like C4), optional chord, confidence 0..1.
Prioritize the main monophonic melody, detect tempo and bar boundaries. Never invent certainty: use confidence below 0.65 for ambiguous/polyphonic/noisy passages, and return no events if exact pitches cannot be grounded in the supplied media. Keep at most 256 meaningful events. Do not map to accordion buttons; the application does that deterministically from its configured layout.`;

export function sanitizeTranscription(value: unknown): RawTranscription {
  if (!value || typeof value !== 'object') throw new Error('La réponse IA ne contient pas de transcription exploitable.');
  const data = value as Partial<RawTranscription>;
  let correctedPitchCount = 0;
  const events = Array.isArray(data.events) ? data.events.slice(0, 4096).flatMap((event) => {
    const statedMidi = Number.isFinite(Number(event.midi)) ? Math.round(Number(event.midi)) : undefined;
    const parsedMidi = typeof event.note === 'string' ? midiFromNote(event.note) : undefined;
    const midi = parsedMidi ?? (statedMidi !== undefined && statedMidi >= 0 && statedMidi <= 127 ? statedMidi : undefined);
    if (midi === undefined) return [];
    if (parsedMidi !== undefined && statedMidi !== undefined && statedMidi !== parsedMidi) correctedPitchCount += 1;
    return [{
      beat: Math.max(0, Number(event.beat) || 0),
      duration: Math.max(0.0625, Number(event.duration) || 1),
      midi,
      note: noteFromMidi(midi),
      ...(typeof event.chord === 'string' && event.chord.trim() ? { chord: event.chord.trim() } : {}),
      confidence: Math.max(0, Math.min(1, Number(event.confidence) || 0.5)),
    }];
  }).sort((a, b) => a.beat - b.beat) : [];
  if (!events.length) throw new Error('Aucune note fiable n’a été détectée. Essaie un passage plus court et plus clair.');
  const accompaniment = Array.isArray(data.accompaniment) ? data.accompaniment.slice(0, 4096).flatMap((event) => {
    const chord = typeof event.chord === 'string' ? event.chord.trim() : '';
    const rootMidi = (typeof event.note === 'string' ? midiFromNote(event.note) : undefined)
      ?? (Number.isFinite(Number(event.rootMidi)) ? Math.round(Number(event.rootMidi)) : undefined)
      ?? midiFromChord(chord);
    if (rootMidi === undefined || rootMidi < 0 || rootMidi > 127 || !chord) return [];
    return [{
      beat: Math.max(0, Number(event.beat) || 0),
      duration: Math.max(0.0625, Number(event.duration) || .7),
      rootMidi,
      midi: rootMidi,
      note: noteFromMidi(rootMidi),
      chord,
      role: event.role === 'chord' ? 'chord' as const : 'bass' as const,
      confidence: Math.max(0, Math.min(1, Number(event.confidence) || 0.5)),
    }];
  }).sort((a, b) => a.beat - b.beat) : undefined;
  const method = ['deterministic', 'verified-library', 'gemini-preview', 'multimodal-research'].includes(String(data.method)) ? data.method : undefined;
  const warnings = Array.isArray(data.warnings) ? data.warnings.filter((item): item is string => typeof item === 'string').slice(0, 12) : [];
  if (correctedPitchCount) warnings.unshift(`${correctedPitchCount} incohérence${correctedPitchCount > 1 ? 's' : ''} entre nom de note et valeur MIDI corrigée${correctedPitchCount > 1 ? 's' : ''} automatiquement.`);
  const sources = Array.isArray(data.sources) ? data.sources.flatMap((source) => {
    if (!source || typeof source !== 'object' || typeof source.url !== 'string' || !/^https?:\/\//i.test(source.url)) return [];
    const kinds = ['abc', 'midi', 'musicxml', 'tablature', 'score', 'chords', 'metadata', 'other'] as const;
    return [{
      title: typeof source.title === 'string' ? source.title.slice(0, 180) : 'Source musicale',
      url: source.url.slice(0, 1_500),
      kind: kinds.includes(source.kind as typeof kinds[number]) ? source.kind as typeof kinds[number] : 'other' as const,
      usedFor: typeof source.usedFor === 'string' ? source.usedFor.slice(0, 260) : 'Vérification de la transcription',
      reliability: Math.max(0, Math.min(1, Number(source.reliability) || .5)),
    }];
  }).slice(0, 12) : undefined;
  const rawCoverage = data.coverage;
  const sourceDurationSeconds = Math.max(0, Number(rawCoverage?.sourceDurationSeconds) || 0);
  const transcribedDurationSeconds = Math.max(0, Number(rawCoverage?.transcribedDurationSeconds) || 0);
  const coverage = rawCoverage ? {
    sourceDurationSeconds,
    transcribedDurationSeconds,
    ratio: Math.max(0, Math.min(1, Number(rawCoverage.ratio) || (sourceDurationSeconds ? transcribedDurationSeconds / sourceDurationSeconds : 0))),
    sectionsFound: Math.max(0, Math.round(Number(rawCoverage.sectionsFound) || 0)),
    sectionsTranscribed: Math.max(0, Math.round(Number(rawCoverage.sectionsTranscribed) || 0)),
  } : undefined;
  return {
    title: typeof data.title === 'string' ? data.title : 'Morceau importé', artist: typeof data.artist === 'string' ? data.artist : 'Artiste inconnu',
    bpm: Math.max(30, Math.min(260, Number(data.bpm) || 100)), key: typeof data.key === 'string' ? data.key : 'Inconnue',
    timeSignature: Array.isArray(data.timeSignature) && data.timeSignature.length === 2 ? [Number(data.timeSignature[0]) || 4, Number(data.timeSignature[1]) || 4] : [4, 4],
    confidence: Math.max(0, Math.min(1, Number(data.confidence) || 0.5)), warnings, method, events,
    ...(accompaniment?.length ? { accompaniment } : {}),
    ...(sources?.length ? { sources } : {}),
    ...(coverage ? { coverage } : {}),
  };
}

function parseJsonText(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return sanitizeTranscription(JSON.parse(cleaned) as unknown);
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

const sourceSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    url: { type: 'string' },
    kind: { type: 'string', enum: ['abc', 'midi', 'musicxml', 'tablature', 'score', 'chords', 'metadata', 'other'] },
    usedFor: { type: 'string' },
    reliability: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['title', 'url', 'kind', 'usedFor', 'reliability'],
};

const researchSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    artist: { type: 'string' },
    composer: { type: 'string' },
    bpm: { type: 'number' },
    key: { type: 'string' },
    timeSignature: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'integer' } },
    durationSeconds: { type: 'number' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' }, startSeconds: { type: 'number' }, endSeconds: { type: 'number' }, description: { type: 'string' },
        },
        required: ['label', 'startSeconds', 'endSeconds', 'description'],
      },
    },
    sources: { type: 'array', items: sourceSchema },
    chordProgression: { type: 'array', items: { type: 'string' } },
    referenceEvents: {
      type: 'array',
      items: {
        type: 'object',
        properties: { beat: { type: 'number' }, duration: { type: 'number' }, note: { type: 'string' }, confidence: { type: 'number', minimum: 0, maximum: 1 } },
        required: ['beat', 'duration', 'note', 'confidence'],
      },
    },
    referenceAccompaniment: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          beat: { type: 'number' }, duration: { type: 'number' }, note: { type: 'string' }, chord: { type: 'string' },
          role: { type: 'string', enum: ['bass', 'chord'] }, confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['beat', 'duration', 'note', 'chord', 'role', 'confidence'],
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'artist', 'composer', 'bpm', 'key', 'timeSignature', 'durationSeconds', 'confidence', 'sections', 'sources', 'chordProgression', 'referenceEvents', 'referenceAccompaniment', 'warnings'],
};

const transcriptionSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    artist: { type: 'string' },
    bpm: { type: 'number' },
    key: { type: 'string' },
    timeSignature: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'integer' } },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    warnings: { type: 'array', items: { type: 'string' } },
    events: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          beat: { type: 'number' }, duration: { type: 'number' }, note: { type: 'string' }, chord: { type: 'string' }, confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['beat', 'duration', 'note', 'confidence'],
      },
    },
    accompaniment: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          beat: { type: 'number' }, duration: { type: 'number' }, note: { type: 'string' }, chord: { type: 'string' },
          role: { type: 'string', enum: ['bass', 'chord'] }, confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['beat', 'duration', 'note', 'chord', 'role', 'confidence'],
      },
    },
    sources: { type: 'array', items: sourceSchema },
    coverage: {
      type: 'object',
      properties: {
        sourceDurationSeconds: { type: 'number' }, transcribedDurationSeconds: { type: 'number' }, ratio: { type: 'number', minimum: 0, maximum: 1 },
        sectionsFound: { type: 'integer' }, sectionsTranscribed: { type: 'integer' },
      },
      required: ['sourceDurationSeconds', 'transcribedDurationSeconds', 'ratio', 'sectionsFound', 'sectionsTranscribed'],
    },
  },
  required: ['title', 'artist', 'bpm', 'key', 'timeSignature', 'confidence', 'warnings', 'events', 'accompaniment', 'sources', 'coverage'],
};

interface StructuredOptions {
  schema: Record<string, unknown>;
  thinkingLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  maxOutputTokens: number;
  tools?: boolean;
  timeoutMs?: number;
}

async function callGeminiStructured<T>(apiKey: string, parts: Array<Record<string, unknown>>, prompt: string, options: StructuredOptions): Promise<T> {
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [...parts, { text: prompt }] }],
        ...(options.tools ? { tools: [{ googleSearch: {} }, { urlContext: {} }] } : {}),
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: options.schema,
          temperature: .1,
          maxOutputTokens: options.maxOutputTokens,
          thinkingConfig: { thinkingLevel: options.thinkingLevel },
        },
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 240_000),
    });
    const payload = await response.json() as {
      candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    };
    if (response.ok) {
      const candidate = payload.candidates?.[0];
      const text = candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
      if (!text) throw new Error(candidate?.finishReason === 'MAX_TOKENS'
        ? 'Gemini a utilisé tout son budget pour analyser la vidéo sans produire la partition.'
        : 'Gemini n’a renvoyé aucun résultat exploitable.');
      return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) as T;
    }
    const retryable = response.status === 429 || response.status === 503;
    if (!retryable || attempt === 2) throw new Error(payload.error?.message ?? `Gemini a répondu avec le code ${response.status}.`);
    await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
  }
  throw new Error('Gemini est temporairement indisponible.');
}

function sanitizeResearch(value: unknown, metadata?: YoutubeMetadata): ResearchBrief {
  const data = value && typeof value === 'object' ? value as Partial<ResearchBrief> : {};
  const sources = Array.isArray(data.sources) ? data.sources.flatMap((source) => {
    if (!source || typeof source.url !== 'string' || !/^https?:\/\//i.test(source.url)) return [];
    const kinds = ['abc', 'midi', 'musicxml', 'tablature', 'score', 'chords', 'metadata', 'other'] as const;
    return [{
      title: typeof source.title === 'string' ? source.title.slice(0, 180) : 'Source musicale',
      url: source.url.slice(0, 1_500),
      kind: kinds.includes(source.kind as typeof kinds[number]) ? source.kind as typeof kinds[number] : 'other' as const,
      usedFor: typeof source.usedFor === 'string' ? source.usedFor.slice(0, 260) : 'Contexte musical',
      reliability: Math.max(0, Math.min(1, Number(source.reliability) || .5)),
    }];
  }).slice(0, 12) : [];
  const sections = Array.isArray(data.sections) ? data.sections.flatMap((section) => {
    if (!section || typeof section.label !== 'string') return [];
    return [{
      label: section.label.slice(0, 80),
      startSeconds: Math.max(0, Number(section.startSeconds) || 0),
      endSeconds: Math.max(0, Number(section.endSeconds) || 0),
      description: typeof section.description === 'string' ? section.description.slice(0, 220) : '',
    }];
  }).sort((left, right) => left.startSeconds - right.startSeconds).slice(0, 40) : [];
  return {
    title: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : metadata?.title ?? 'Morceau YouTube',
    artist: typeof data.artist === 'string' && data.artist.trim() ? data.artist.trim() : metadata?.authorName ?? 'Interprète inconnu',
    composer: typeof data.composer === 'string' ? data.composer.trim() : '',
    bpm: Math.max(30, Math.min(260, Number(data.bpm) || 100)),
    key: typeof data.key === 'string' ? data.key : 'Inconnue',
    timeSignature: Array.isArray(data.timeSignature) && data.timeSignature.length === 2 ? [Number(data.timeSignature[0]) || 4, Number(data.timeSignature[1]) || 4] : [4, 4],
    durationSeconds: Math.max(0, Number(data.durationSeconds) || sections.at(-1)?.endSeconds || 0),
    confidence: Math.max(0, Math.min(1, Number(data.confidence) || .45)),
    sections,
    sources,
    chordProgression: Array.isArray(data.chordProgression) ? data.chordProgression.filter((item): item is string => typeof item === 'string').slice(0, 128) : [],
    referenceEvents: Array.isArray(data.referenceEvents) ? data.referenceEvents.slice(0, 2048).flatMap((event) => {
      const midi = typeof event.note === 'string' ? midiFromNote(event.note) : undefined;
      if (midi === undefined) return [];
      return [{ beat: Math.max(0, Number(event.beat) || 0), duration: Math.max(.0625, Number(event.duration) || 1), note: noteFromMidi(midi), confidence: Math.max(0, Math.min(1, Number(event.confidence) || .5)) }];
    }) : [],
    referenceAccompaniment: Array.isArray(data.referenceAccompaniment) ? data.referenceAccompaniment.slice(0, 2048).flatMap((event) => {
      const midi = typeof event.note === 'string' ? midiFromNote(event.note) : undefined;
      if (midi === undefined || typeof event.chord !== 'string') return [];
      return [{
        beat: Math.max(0, Number(event.beat) || 0), duration: Math.max(.0625, Number(event.duration) || .7), note: noteFromMidi(midi), chord: event.chord.trim(),
        role: event.role === 'chord' ? 'chord' as const : 'bass' as const, confidence: Math.max(0, Math.min(1, Number(event.confidence) || .5)),
      }];
    }) : [],
    referenceNotation: '',
    warnings: Array.isArray(data.warnings) ? data.warnings.filter((item): item is string => typeof item === 'string').slice(0, 10) : [],
  };
}

function fallbackResearch(metadata?: YoutubeMetadata): ResearchBrief {
  return {
    title: metadata?.title ?? 'Morceau YouTube', artist: metadata?.authorName ?? 'Interprète inconnu', composer: '',
    bpm: 100, key: 'Inconnue', timeSignature: [4, 4], durationSeconds: 0, confidence: .3,
    sections: [], sources: [], chordProgression: [], referenceEvents: [], referenceAccompaniment: [], referenceNotation: '', warnings: ['La recherche de partitions en ligne n’a pas abouti ; analyse directe de la vidéo.'],
  };
}

const CURATED_SOURCE_HINTS = [{
  aliases: ['valse a ollu', 'valse ollu', 'la valse a ollu'],
  title: 'Valse à Ollu',
  composer: 'Alain Ollu',
  url: 'https://hcfolks.kazoo.fr/datas/HC-Folks/Autres-Divers/diato.org/tablat/204.abc',
  sourceTitle: 'Fichier ABC et tablature CADB — Bernard Loffet',
}];

async function curatedResearch(metadata: YoutubeMetadata | undefined): Promise<ResearchBrief | undefined> {
  if (!metadata) return undefined;
  const normalized = normalizeTitle(metadata.title);
  const hint = CURATED_SOURCE_HINTS.find((candidate) => candidate.aliases.some((alias) => normalized.includes(alias)));
  if (!hint) return undefined;
  try {
    const response = await fetch(hint.url, { signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return undefined;
    const notation = (await response.text()).slice(0, 120_000);
    if (!/^\s*X:/m.test(notation) || !/^\s*K:/m.test(notation)) return undefined;
    return {
      title: hint.title,
      artist: metadata.authorName,
      composer: hint.composer,
      bpm: 100,
      key: 'À confirmer sur la vidéo',
      timeSignature: [3, 4],
      durationSeconds: 0,
      confidence: .9,
      sections: [],
      sources: [{ title: hint.sourceTitle, url: hint.url, kind: 'abc', usedFor: 'Mélodie, métrique et accompagnement de l’édition de référence', reliability: .9 }],
      chordProgression: [],
      referenceEvents: [],
      referenceAccompaniment: [],
      referenceNotation: notation,
      warnings: ['Une édition ABC publique a été retrouvée ; la vidéo reste prioritaire pour la tonalité, les variantes et les reprises.'],
    };
  } catch {
    return undefined;
  }
}

const researchPrompt = (metadata?: YoutubeMetadata) => `Tu constitues rapidement un dossier documentaire musical avant l’analyse d’une vidéo d’accordéon diatonique. Ne cherche pas à regarder ou transcrire la vidéo à cette étape : pars uniquement de ses métadonnées fiables.
Utilise Google Search de façon ciblée avec le titre exact, l’interprète et les variantes orthographiques. Cherche en priorité des sources musicales consultables : ABC, MIDI, MusicXML, tablature CADB, partition de l’auteur ou page de référence. Retourne leurs URL canoniques directes quand elles sont publiques.
Ouvre les meilleures sources textuelles avec URL context. Si elles contiennent une notation exploitable, convertis l’édition de référence en referenceEvents et referenceAccompaniment sur une chronologie en temps musicaux. Pour une valse, distingue la basse du premier temps des accords des temps suivants. Laisse ces tableaux vides plutôt que d’inventer une partition absente.
Une source trouvée n’est qu’une hypothèse : distingue le compositeur de l’interprète, et la composition de l’arrangement joué. durationSeconds et sections peuvent rester à zéro/vides : ils seront déterminés par l’analyse audiovisuelle suivante.
Décris les avertissements en français et ne fournis pas ton raisonnement interne.
Métadonnées YouTube faisant autorité pour l’identité de la vidéo : ${metadata ? `« ${metadata.title} », chaîne « ${metadata.authorName} »` : 'indisponibles'}.`;

const transcriptionPrompt = (research: ResearchBrief, instrumentContext: string, review?: RawTranscription) => `Tu es un transcripteur expert de musique traditionnelle et d’accordéon diatonique. Produis une transcription complète et vérifiable de TOUTE la performance de la vidéo, pas seulement son premier thème.

DOSSIER DE RECHERCHE (à contrôler, jamais à recopier aveuglément) :
${JSON.stringify(research)}
INSTRUMENT CIBLE : ${instrumentContext}. Transcris les hauteurs réellement jouées ; ne les fausse pas pour les rendre disponibles. La couche d’adaptation choisira ensuite boutons, rangées et soufflet. Pour la main gauche pédagogique, privilégie toutefois une harmonie réalisable sur cet instrument et baisse la confiance si une substitution est nécessaire.
${review ? `\nPREMIÈRE TRANSCRIPTION À AUDITER ET RÉPARER :\n${JSON.stringify(review)}` : ''}
${review?.coverage?.sourceDurationSeconds ? `\nCONTRAT DE RÉPARATION MESURABLE : la chronologie précédente finit au beat ${Math.max(0, ...review.events.map((event) => event.beat + event.duration))}, alors que la durée source et son tempo imposent environ ${Math.round(review.coverage.sourceDurationSeconds * review.bpm / 60)} beats. Le nouveau dernier beat doit atteindre au moins 90 % de cette cible. Déplie réellement les reprises et variantes dans events et accompaniment ; modifier seulement coverage, les avertissements ou la confiance est un échec.` : ''}

Règles obligatoires :
- Analyse conjointement l’audio, les gestes visibles et le dossier documentaire déjà consulté par la passe de recherche. Vérifie dans la vidéo la tonalité, les variantes, les reprises et l’alignement avant d’utiliser une notation de référence.
- Transcris toutes les sections réellement jouées, reprises comprises. Déplie les répétitions sur une chronologie linéaire. N’impose aucune limite artificielle à 256 notes.
- beat est exprimé depuis zéro dans l’unité du dénominateur de timeSignature. duration utilise la même unité. Le tempo doit correspondre à cette pulsation.
- events contient la mélodie principale monophonique, y compris les anacrouses et ornements audibles. note est toujours une hauteur scientifique (C4, F#5, Bb3). N’écris pas de valeur MIDI : le serveur la calcule.
- accompaniment contient la main gauche sur la même chronologie. Distingue chaque basse (role=bass) de chaque accord (role=chord), avec la fondamentale scientifique dans note et un symbole d’accord explicite dans chord (Am, F, G, E7…). Si la main gauche est masquée mais qu’une source et l’harmonie permettent une proposition pédagogique, inclus-la avec une confiance réduite et explique-le.
- Quand plusieurs versions en ligne diffèrent, la vidéo gagne. Si une hauteur reste ambiguë, conserve la meilleure hypothèse avec une confiance inférieure à 0.55 et signale le passage au lieu de supprimer silencieusement toute la phrase.
- Calcule coverage sur la durée musicale utile de la source. sectionsTranscribed doit refléter la réalité, pas l’intention.
- sources ne contient que les pages effectivement consultées et précise exactement ce qu’elles ont permis de vérifier.
- La confiance globale ne doit jamais masquer les incertitudes événement par événement. Les avertissements sont courts, précis et en français.
- Effectue un dernier contrôle silencieux : ordre des beats, mesures, durée totale, cohérence des notes, présence de la main gauche et couverture de chaque section. Retourne uniquement le JSON demandé.`;

function mergeSources(...groups: Array<TranscriptionSource[] | undefined>) {
  const merged = new Map<string, TranscriptionSource>();
  for (const source of groups.flatMap((group) => group ?? [])) {
    const key = source.url.replace(/\/$/, '');
    const previous = merged.get(key);
    if (!previous || source.reliability > previous.reliability) merged.set(key, source);
  }
  return [...merged.values()].slice(0, 12);
}

export function calculateTimelineCoverage(events: RawTranscription['events'], bpm: number, sourceDurationSeconds: number) {
  const lastBeat = Math.max(0, ...events.map((event) => event.beat + event.duration));
  const transcribedDurationSeconds = lastBeat * 60 / Math.max(1, bpm);
  return {
    transcribedDurationSeconds,
    ratio: sourceDurationSeconds ? Math.min(1, transcribedDurationSeconds / sourceDurationSeconds) : 0,
  };
}

function finalizeYoutubeResult(result: RawTranscription, research: ResearchBrief, metadata?: YoutubeMetadata): RawTranscription {
  // The transcription pass has no browsing tool. Never expose URLs it may
  // improvise; only the grounded research pass and curated registry can attest
  // that a source was actually consulted.
  const sources = mergeSources(research.sources);
  const sourceDurationSeconds = result.coverage?.sourceDurationSeconds || research.durationSeconds;
  // Coverage is a measurable property of the returned timeline. Models tend to
  // overestimate it when they identify every section but only emit one repeat.
  const measuredCoverage = calculateTimelineCoverage(result.events, result.bpm, sourceDurationSeconds);
  const transcribedDurationSeconds = measuredCoverage.transcribedDurationSeconds;
  const ratio = sourceDurationSeconds ? measuredCoverage.ratio : result.coverage?.ratio ?? 0;
  const notationSource = Boolean(research.referenceNotation || research.referenceEvents.length)
    && sources.some((source) => ['abc', 'midi', 'musicxml', 'tablature', 'score'].includes(source.kind) && source.reliability >= .6);
  const confidenceCap = notationSource ? .94 : .76;
  const modelWarnings = result.warnings.filter((warning) => ratio >= .85 || !/couvr(?:e|ent).*intégralit|couverture (?:est )?(?:intégrale|complète)/i.test(warning));
  const warnings = [
    ...research.warnings,
    ...modelWarnings,
    ...(sources.length ? [`${sources.length} source${sources.length > 1 ? 's' : ''} en ligne consultée${sources.length > 1 ? 's' : ''} et affichée${sources.length > 1 ? 's' : ''} dans le studio.`] : ['Aucune édition musicale exploitable n’a été trouvée : contrôle à l’oreille indispensable.']),
    ...(ratio > 0 && ratio < .85 ? [`La transcription ne couvre qu’environ ${Math.round(ratio * 100)} % de la durée détectée.`] : []),
  ].filter((warning, index, all) => all.indexOf(warning) === index).slice(0, 12);
  return {
    ...result,
    title: research.title || metadata?.title || result.title,
    artist: metadata?.authorName || result.artist,
    confidence: Math.min(result.confidence, confidenceCap),
    warnings,
    method: 'multimodal-research',
    sources,
    coverage: {
      sourceDurationSeconds,
      transcribedDurationSeconds,
      ratio,
      sectionsFound: result.coverage?.sectionsFound || research.sections.length,
      sectionsTranscribed: Math.min(
        result.coverage?.sectionsFound || research.sections.length,
        ratio >= .98
          ? result.coverage?.sectionsTranscribed || research.sections.length
          : Math.floor((result.coverage?.sectionsFound || research.sections.length) * ratio),
      ),
    },
  };
}

export function youtubeResultNeedsRepair(result: RawTranscription) {
  const duration = result.coverage?.sourceDurationSeconds ?? 0;
  const coverageLow = duration > 20 && (result.coverage?.ratio ?? 0) < .78;
  const melodyTooSparse = duration > 30 && result.events.length < duration * .32;
  const leftHandTooSparse = (result.accompaniment?.length ?? 0) < Math.max(4, result.events.length / 14);
  return coverageLow || melodyTooSparse || leftHandTooSparse;
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
    ...(song.accompaniment?.length ? {
      accompaniment: song.accompaniment.map((event) => ({ ...event })),
    } : {}),
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
    async fromYoutube(url: string, accordionId: string, requestKey?: string) {
      if (!/^https:\/\/(?:www\.)?(?:youtube\.com\/|youtu\.be\/)/i.test(url)) throw new Error('L’URL YouTube n’est pas valide.');
      const accordion = db.getAccordion(accordionId);
      if (!accordion) throw new Error('Configuration d’accordéon inconnue.');
      const metadata = await youtubeMetadata(url);
      const verifiedSong = metadata ? findVerifiedSongByTitle(metadata.title, db.listCommonSongs() as unknown[]) : undefined;
      if (metadata && verifiedSong) return transcriptionFromVerifiedSong(verifiedSong, metadata);
      const key = requestKey || process.env.GEMINI_API_KEY;
      if (!key) throw new Error('Aucune clé Gemini n’est configurée.');
      const videoPart = { fileData: { fileUri: url, mimeType: 'video/*' } };
      let research = await curatedResearch(metadata);
      if (!research) {
        try {
          research = sanitizeResearch(await callGeminiStructured<unknown>(key, [], researchPrompt(metadata), {
            schema: researchSchema,
            thinkingLevel: 'LOW',
            maxOutputTokens: 16_384,
            tools: true,
            timeoutMs: 90_000,
          }), metadata);
        } catch {
          research = fallbackResearch(metadata);
        }
      }

      const bassRoots = [...new Set(accordion.basses.flatMap((button) => [noteFromMidi(button.pushMidi).replace(/-?\d+$/, ''), noteFromMidi(button.pullMidi).replace(/-?\d+$/, '')]))];
      const instrumentContext = `${accordion.maker} ${accordion.model}, accordage ${accordion.tuning}, ${accordion.buttons.length} boutons main droite, fondamentales main gauche ${bassRoots.join(', ') || 'non renseignées'}`;
      const runTranscription = async (review?: RawTranscription) => {
        const prompt = transcriptionPrompt(research, instrumentContext, review);
        const raw = await callGeminiStructured<unknown>(key, [videoPart], prompt, {
          schema: transcriptionSchema,
          thinkingLevel: review ? 'LOW' : 'MEDIUM',
          maxOutputTokens: 65_536,
          tools: false,
          timeoutMs: 420_000,
        });
        return finalizeYoutubeResult(sanitizeTranscription({ ...(raw as object), method: 'multimodal-research' }), research, metadata);
      };

      let result = await runTranscription();
      if (youtubeResultNeedsRepair(result)) {
        try {
          result = await runTranscription(result);
          result.warnings = [
            youtubeResultNeedsRepair(result)
              ? 'La seconde passe n’a pas suffi à couvrir toute la vidéo : les passages manquants ne sont pas inventés.'
              : 'Une seconde passe a réparé la couverture ou la main gauche incomplète.',
            ...result.warnings,
          ].slice(0, 12);
        } catch {
          result.warnings = [...result.warnings, 'La passe de contrôle n’a pas pu compléter les passages manquants.'].slice(0, 12);
        }
      }
      return result;
    },
  };
}
