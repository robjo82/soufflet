import compression from 'compression';
import { config as loadEnv } from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { SouffletDatabase } from './database.js';
import { createTranscriber, DEFAULT_GEMINI_MODEL } from './transcription.js';
import { clearSession, createUserId, hashPassword, readSessionToken, sessionHash, setSession, verifyPassword } from './auth.js';
import { inferSessionHand } from './progress.js';
import { staticAssetCacheControl } from './staticAssets.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
loadEnv({ path: resolve(root, '.env.local'), quiet: true });
loadEnv({ path: resolve(root, '.env'), quiet: true });
const port = Number(process.env.PORT ?? 8787);
const dataDir = resolve(root, process.env.DATA_DIR ?? 'data');
const db = new SouffletDatabase(dataDir);
const transcriber = createTranscriber(db);
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 1 } });

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));

const authAttempts = new Map<string, { count: number; resetAt: number }>();
function authRateLimit(request: express.Request, response: express.Response, next: express.NextFunction) {
  const key = request.ip || 'unknown';
  const now = Date.now();
  const current = authAttempts.get(key);
  if (!current || current.resetAt <= now) authAttempts.set(key, { count: 1, resetAt: now + 15 * 60_000 });
  else if (current.count >= 20) { response.status(429).json({ error: 'Trop de tentatives. Réessaie dans quelques minutes.' }); return; }
  else current.count += 1;
  next();
}

function currentUser(request: express.Request) {
  const token = readSessionToken(request);
  return token ? db.getSessionUser(sessionHash(token)) : undefined;
}

function requireUser(request: express.Request, response: express.Response, next: express.NextFunction) {
  const user = currentUser(request);
  if (!user) { response.status(401).json({ error: 'Connecte-toi pour continuer.' }); return; }
  response.locals.user = user;
  next();
}

app.get('/api/health', (_request, response) => response.json({
  status: 'ok',
  version: process.env.APP_VERSION ?? 'development',
  aiConfigured: Boolean(process.env.GEMINI_API_KEY),
  aiModel: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
}));
app.get('/api/accordions', (request, response) => response.json({ accordions: db.listAccordions(currentUser(request)?.id) }));
app.get('/api/instruments', (request, response) => {
  const instrumentType = z.enum(['piano', 'guitar']).optional().catch(undefined).parse(request.query.type);
  response.json({ instruments: db.listInstruments(currentUser(request)?.id, instrumentType) });
});

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(10, 'Le mot de passe doit contenir au moins 10 caractères.').max(200),
});

app.post('/api/auth/register', authRateLimit, async (request, response) => {
  try {
    const body = credentialsSchema.extend({ displayName: z.string().trim().min(2).max(60) }).parse(request.body);
    const user = db.createUser({ id: createUserId(), email: body.email, displayName: body.displayName, passwordHash: await hashPassword(body.password) });
    if (!user) throw new Error('Le compte n’a pas pu être créé.');
    setSession(response, db, user.id);
    response.status(201).json({ user });
  } catch (error) {
    const duplicate = error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
    response.status(duplicate ? 409 : 422).json({ error: duplicate ? 'Un compte existe déjà avec cette adresse.' : error instanceof Error ? error.message : 'Compte invalide.' });
  }
});

app.post('/api/auth/login', authRateLimit, async (request, response) => {
  try {
    const body = credentialsSchema.parse(request.body);
    const credentials = db.getUserCredentials(body.email);
    if (!credentials || !await verifyPassword(body.password, credentials.password_hash)) {
      response.status(401).json({ error: 'Adresse ou mot de passe incorrect.' });
      return;
    }
    const user = db.getUserById(credentials.id)!;
    setSession(response, db, user.id);
    response.json({ user });
  } catch (error) {
    response.status(422).json({ error: error instanceof Error ? error.message : 'Connexion impossible.' });
  }
});

app.get('/api/auth/me', (request, response) => {
  const user = currentUser(request);
  response.json({ user: user ?? null });
});

app.post('/api/auth/logout', (request, response) => {
  const token = readSessionToken(request);
  if (token) db.deleteSession(sessionHash(token));
  clearSession(response);
  response.status(204).end();
});

const preferencesSchema = z.object({
  accordionId: z.string().min(1).max(120),
  instrumentType: z.enum(['accordion', 'piano', 'guitar']).default('accordion'),
  pianoId: z.string().min(1).max(120).default('piano-standard-61'),
  guitarId: z.string().min(1).max(120).default('guitar-standard-6'),
  notation: z.enum(['french', 'english', 'tablature', 'button']),
  countIn: z.boolean(),
  onboardingDone: z.boolean(),
  tutorialDone: z.boolean(),
}).refine((preferences) => !preferences.tutorialDone || preferences.onboardingDone, {
  message: 'Le tutoriel ne peut pas être terminé avant la configuration initiale.',
});

app.get('/api/preferences', requireUser, (_request, response) => {
  response.json({ preferences: db.getUserPreferences(response.locals.user.id as string) });
});

app.put('/api/preferences', requireUser, (request, response) => {
  try {
    const preferences = preferencesSchema.parse(request.body);
    const userId = response.locals.user.id as string;
    const accessible = db.listAccordions(userId) as Array<{ id: string }>;
    if (!accessible.some((accordion) => accordion.id === preferences.accordionId)) {
      response.status(422).json({ error: 'Cet accordéon n’est pas disponible sur ton compte.' });
      return;
    }
    if (preferences.instrumentType !== 'accordion') {
      const instruments = db.listInstruments(userId, preferences.instrumentType);
      const selectedId = preferences.instrumentType === 'piano' ? preferences.pianoId : preferences.guitarId;
      if (!instruments.some((instrument) => instrument.id === selectedId)) {
        response.status(422).json({ error: 'Cet instrument n’est pas disponible sur ton compte.' });
        return;
      }
    }
    response.json({ preferences: db.saveUserPreferences(userId, preferences) });
  } catch (error) {
    response.status(422).json({ error: error instanceof z.ZodError ? error.issues[0]?.message : 'Préférences invalides.' });
  }
});

const pianoConfigSchema = z.object({
  id: z.string().min(1).max(120),
  instrumentType: z.literal('piano'),
  name: z.string().trim().min(2).max(120),
  keyboardSize: z.union([z.literal(25), z.literal(32), z.literal(49), z.literal(61), z.literal(76), z.literal(88)]),
  input: z.enum(['midi', 'microphone', 'computer-keyboard']),
  notation: z.enum(['french', 'english']),
  builtIn: z.boolean().optional(),
}).transform((config) => ({ ...config, builtIn: false }));

app.post('/api/instruments', requireUser, (request, response) => {
  try {
    const config = pianoConfigSchema.parse(request.body);
    response.status(201).json({ instrument: db.saveInstrument(config, response.locals.user.id as string) });
  } catch (error) {
    response.status(422).json({ error: error instanceof z.ZodError ? error.issues[0]?.message : 'Configuration invalide.' });
  }
});

const profileSchema = z.object({
  email: z.string().trim().email('Saisis une adresse e-mail valide.').max(254),
  displayName: z.string().trim().min(2, 'Le nom doit contenir au moins 2 caractères.').max(60),
});

app.patch('/api/account/profile', requireUser, (request, response) => {
  try {
    const profile = profileSchema.parse(request.body);
    const user = db.updateUserProfile(response.locals.user.id as string, profile);
    if (!user) { response.status(404).json({ error: 'Compte introuvable.' }); return; }
    response.json({ user });
  } catch (error) {
    const duplicate = error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
    response.status(duplicate ? 409 : 422).json({
      error: duplicate ? 'Cette adresse e-mail est déjà utilisée.' : error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : 'Profil invalide.',
    });
  }
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(10, 'Le nouveau mot de passe doit contenir au moins 10 caractères.').max(200),
}).refine((value) => value.currentPassword !== value.newPassword, { message: 'Choisis un mot de passe différent de l’ancien.', path: ['newPassword'] });

app.put('/api/account/password', authRateLimit, requireUser, async (request, response) => {
  try {
    const body = passwordChangeSchema.parse(request.body);
    const credentials = db.getUserCredentials(response.locals.user.email as string);
    if (!credentials || !await verifyPassword(body.currentPassword, credentials.password_hash)) {
      response.status(401).json({ error: 'Le mot de passe actuel est incorrect.' });
      return;
    }
    const userId = response.locals.user.id as string;
    db.updateUserPassword(userId, await hashPassword(body.newPassword));
    db.deleteSessionsForUser(userId);
    setSession(response, db, userId);
    response.json({ message: 'Mot de passe modifié. Les autres appareils ont été déconnectés.' });
  } catch (error) {
    response.status(422).json({ error: error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : 'Mot de passe invalide.' });
  }
});

const accountDeletionSchema = z.object({
  email: z.string().trim().email().max(254).optional(),
  password: z.string().min(1).max(200),
});

app.post('/api/account/delete', authRateLimit, async (request, response) => {
  try {
    const body = accountDeletionSchema.parse(request.body);
    const sessionUser = currentUser(request);
    if (sessionUser && body.email && body.email.toLowerCase() !== sessionUser.email.toLowerCase()) {
      response.status(401).json({ error: 'L’adresse saisie ne correspond pas au compte connecté.' });
      return;
    }
    const email = sessionUser?.email ?? body.email;
    if (!email) { response.status(422).json({ error: 'Saisis l’adresse e-mail du compte.' }); return; }
    const credentials = db.getUserCredentials(email);
    if (!credentials || (sessionUser && credentials.id !== sessionUser.id) || !await verifyPassword(body.password, credentials.password_hash)) {
      response.status(401).json({ error: 'Adresse ou mot de passe incorrect.' });
      return;
    }
    db.deleteUser(credentials.id);
    clearSession(response);
    response.json({ message: 'Le compte et toutes ses données ont été supprimés.' });
  } catch (error) {
    response.status(422).json({ error: error instanceof z.ZodError ? error.issues[0]?.message : 'Suppression impossible.' });
  }
});

const songEventSchema = z.object({
  id: z.string().min(1).max(160),
  beat: z.number().min(0).max(1_000_000),
  duration: z.number().positive().max(10_000),
  midi: z.number().int().min(0).max(127),
  note: z.string().min(1).max(16),
  buttonId: z.string().max(120),
  direction: z.enum(['push', 'pull']),
  finger: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1).optional(),
}).passthrough();

const accompanimentEventSchema = z.object({
  id: z.string().min(1).max(160),
  beat: z.number().min(0).max(1_000_000),
  duration: z.number().positive().max(10_000),
  rootMidi: z.number().int().min(0).max(127),
  midi: z.number().int().min(0).max(127),
  note: z.string().min(1).max(16),
  chord: z.string().min(1).max(32),
  role: z.enum(['bass', 'chord']),
  buttonId: z.string().max(120),
  direction: z.enum(['push', 'pull']),
  confidence: z.number().min(0).max(1).optional(),
}).passthrough();

const userSongSchema = z.object({
  id: z.string().min(1).max(160),
  title: z.string().trim().min(1).max(160),
  artist: z.string().trim().min(1).max(160),
  sourceType: z.enum(['lesson', 'audio', 'youtube', 'spotify', 'tablature']),
  sourceUrl: z.string().url().max(2_048).optional(),
  bpm: z.number().min(0).max(400),
  timeSignature: z.tuple([z.number().int().min(1).max(32), z.number().int().min(1).max(32)]),
  key: z.string().min(1).max(80),
  duration: z.number().min(0).max(86_400),
  difficulty: z.number().min(0).max(10),
  status: z.enum(['ready', 'analyzing', 'needs-review', 'reference-only']),
  events: z.array(songEventSchema).max(10_000),
  accompaniment: z.array(accompanimentEventSchema).max(10_000).optional(),
  confidence: z.number().min(0).max(1).optional(),
  builtIn: z.literal(false).optional(),
}).passthrough().transform((song) => ({ ...song, builtIn: false as const }));

app.get('/api/library', requireUser, (_request, response) => response.json({
  songs: db.listLibrarySongs(response.locals.user.id as string),
}));

app.post('/api/library', requireUser, (request, response) => {
  try {
    const song = userSongSchema.parse(request.body);
    response.status(201).json({ song: db.saveUserSong(response.locals.user.id as string, song) });
  } catch (error) {
    response.status(422).json({ error: error instanceof Error ? error.message : 'Morceau invalide.' });
  }
});

app.delete('/api/library/:id', requireUser, (request, response) => {
  const removed = db.deleteUserSong(response.locals.user.id as string, String(request.params.id));
  response.status(removed ? 204 : 404).end();
});

const practiceSessionSchema = z.object({
  id: z.string().uuid(),
  songId: z.string().min(1).max(120),
  songTitle: z.string().trim().min(1).max(160),
  mode: z.enum(['demo', 'guided', 'wait', 'notes', 'rhythm', 'bellows', 'right', 'left', 'combined', 'game', 'performance']),
  hand: z.enum(['right', 'left', 'both']).optional(),
  instrumentType: z.enum(['accordion', 'piano', 'guitar']).default('accordion'),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  activeSeconds: z.number().int().min(0).max(43_200),
  correctCount: z.number().int().min(0).max(100_000),
  earlyCount: z.number().int().min(0).max(100_000),
  lateCount: z.number().int().min(0).max(100_000),
  wrongCount: z.number().int().min(0).max(100_000),
  completionPercent: z.number().min(0).max(100),
  tempoPercent: z.number().int().min(40).max(120),
  flagged: z.boolean(),
  assessmentBreakdown: z.object({
    right: z.object({ correct: z.number().int().min(0).max(100_000), early: z.number().int().min(0).max(100_000), late: z.number().int().min(0).max(100_000), wrong: z.number().int().min(0).max(100_000) }),
    left: z.object({ correct: z.number().int().min(0).max(100_000), early: z.number().int().min(0).max(100_000), late: z.number().int().min(0).max(100_000), wrong: z.number().int().min(0).max(100_000) }),
    coordination: z.object({ correct: z.number().int().min(0).max(100_000), early: z.number().int().min(0).max(100_000), late: z.number().int().min(0).max(100_000), wrong: z.number().int().min(0).max(100_000) }),
  }).optional(),
}).transform((session) => ({
  ...session,
  hand: inferSessionHand(session.mode, session.hand),
})).refine((session) => new Date(session.endedAt).getTime() >= new Date(session.startedAt).getTime(), { message: 'La fin de séance précède son début.' });

app.get('/api/progress', requireUser, (request, response) => {
  const timezoneOffset = z.coerce.number().int().min(-840).max(840).catch(0).parse(request.query.timezoneOffset);
  response.json({ stats: db.getPracticeStats(response.locals.user.id as string, timezoneOffset) });
});

app.post('/api/practice-sessions', requireUser, (request, response) => {
  try {
    const session = practiceSessionSchema.parse(request.body);
    db.savePracticeSession(response.locals.user.id as string, session);
    const timezoneOffset = z.coerce.number().int().min(-840).max(840).catch(0).parse(request.query.timezoneOffset);
    response.json({ session, stats: db.getPracticeStats(response.locals.user.id as string, timezoneOffset) });
  } catch (error) {
    response.status(422).json({ error: error instanceof Error ? error.message : 'Séance invalide.' });
  }
});

const tunerReadingSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  accordionId: z.string().min(1).max(100),
  accordionModel: z.string().min(1).max(120),
  buttonId: z.string().min(1).max(80),
  row: z.number().int().min(0).max(5),
  buttonIndex: z.number().int().min(1).max(30),
  hand: z.enum(['right', 'left']).default('right'),
  direction: z.enum(['push', 'pull']),
  expectedMidi: z.number().int().min(0).max(127),
  detectedMidi: z.number().int().min(0).max(127),
  frequency: z.number().positive().max(5000),
  cents: z.number().min(-100).max(100),
  confidence: z.number().min(0).max(1),
  volume: z.number().min(0).max(2),
  outcome: z.enum(['matched', 'corrected']),
  measuredAt: z.string().datetime(),
});

app.get('/api/tuner-readings', requireUser, (request, response) => {
  try {
    const sessionId = z.string().uuid().optional().parse(request.query.sessionId);
    response.json({ readings: db.listTunerReadings(response.locals.user.id as string, sessionId) });
  } catch (error) {
    response.status(422).json({ error: error instanceof Error ? error.message : 'Campagne d’accordage invalide.' });
  }
});

app.post('/api/tuner-readings', requireUser, (request, response) => {
  try {
    const reading = tunerReadingSchema.parse(request.body);
    response.status(201).json({ reading: db.saveTunerReading(response.locals.user.id as string, reading) });
  } catch (error) {
    response.status(422).json({ error: error instanceof Error ? error.message : 'Relevé d’accordage invalide.' });
  }
});

const leftHandScanSampleSchema = z.object({
  buttonId: z.string().min(1).max(80),
  buttonIndex: z.number().int().min(1).max(40),
  row: z.number().int().min(0).max(8),
  direction: z.enum(['push', 'pull']),
  role: z.enum(['bass', 'chord']),
  expectedLabel: z.string().min(1).max(20),
  detectedLabel: z.string().min(1).max(20),
  expectedRootPitchClass: z.number().int().min(0).max(11),
  detectedRootPitchClass: z.number().int().min(0).max(11),
  chordQuality: z.enum(['major', 'minor']).optional(),
  confidence: z.number().min(0).max(1),
  tuningCents: z.number().min(-100).max(100).optional(),
  chroma: z.array(z.number().min(0).max(1)).length(12),
  outcome: z.enum(['matched', 'uncertain', 'mismatch']),
  measuredAt: z.string().datetime(),
});

const leftHandAcousticProfileSchema = z.object({
  accordionId: z.string().min(1).max(100),
  accordionModel: z.string().min(1).max(120),
  referencePitchHz: z.number().min(400).max(480),
  completedAt: z.string().datetime(),
  samples: z.array(leftHandScanSampleSchema).min(1).max(80),
});

app.get('/api/audio-profiles/left-hand', requireUser, (_request, response) => {
  response.json({ profiles: db.listLeftHandAcousticProfiles(response.locals.user.id as string) });
});

app.put('/api/audio-profiles/left-hand', requireUser, (request, response) => {
  try {
    const profile = leftHandAcousticProfileSchema.parse(request.body);
    const userId = response.locals.user.id as string;
    const accessible = db.listAccordions(userId) as Array<{ id: string; basses: Array<{ id: string; role?: 'bass' | 'chord' }> }>;
    const selectedAccordion = accessible.find((accordion) => accordion.id === profile.accordionId);
    if (!selectedAccordion) {
      response.status(422).json({ error: 'Cet accordéon n’est pas disponible sur ton compte.' });
      return;
    }
    const leftButtons = new Map(selectedAccordion.basses.map((button) => [button.id, button]));
    if (profile.samples.some((sample) => !leftButtons.has(sample.buttonId) || leftButtons.get(sample.buttonId)?.role !== sample.role)) {
      response.status(422).json({ error: 'Ce profil contient un bouton main gauche inconnu.' });
      return;
    }
    response.json({ profile: db.saveLeftHandAcousticProfile(userId, profile) });
  } catch (error) {
    response.status(422).json({ error: error instanceof z.ZodError ? error.issues[0]?.message : 'Profil acoustique invalide.' });
  }
});

const accordionButtonSchema = z.object({
  id: z.string().min(1).max(80), row: z.number().int().min(0).max(5), index: z.number().int().min(1).max(30),
  push: z.string().min(1).max(8), pull: z.string().min(1).max(8), pushMidi: z.number().int().min(0).max(127), pullMidi: z.number().int().min(0).max(127),
  pushChord: z.string().min(1).max(16).optional(), pullChord: z.string().min(1).max(16).optional(),
  finger: z.number().int().min(1).max(5).optional(), role: z.enum(['melody', 'accidental', 'bass', 'chord']).optional(), isGleichton: z.boolean().optional(),
});
const accordionSchema = z.object({
  maker: z.string().min(1).max(80), model: z.string().min(1).max(100), tuning: z.string().min(1).max(80), color: z.string().regex(/^#[0-9a-f]{6}$/i),
  rightRows: z.array(z.number().int().min(1).max(30)).min(1).max(4), bassCount: z.number().int().min(0).max(36), description: z.string().max(300),
  buttons: z.array(accordionButtonSchema).min(1).max(120), basses: z.array(accordionButtonSchema).max(40), verified: z.boolean(), sourceNote: z.string().max(300).optional(),
  referencePitchHz: z.number().min(400).max(480).optional(),
});

app.post('/api/accordions', requireUser, (request, response) => {
  try {
    const payload = accordionSchema.parse(request.body);
    const id = `custom-${crypto.randomUUID()}`;
    const config = db.saveAccordion({ ...payload, id, verified: false, sourceNote: payload.sourceNote || 'Configuration personnalisée à vérifier avec l’accordeur.' }, response.locals.user.id as string);
    response.status(201).json({ accordion: config });
  } catch (error) {
    response.status(422).json({ error: error instanceof Error ? error.message : 'Configuration invalide.' });
  }
});

app.put('/api/accordions/:id', requireUser, (request, response) => {
  try {
    const payload = accordionSchema.parse(request.body);
    const id = String(request.params.id);
    const config = { ...payload, id, verified: false, sourceNote: payload.sourceNote || 'Configuration personnalisée contrôlée avec l’accordeur.' };
    const updated = db.updateAccordion(id, config, response.locals.user.id as string);
    if (!updated) { response.status(404).json({ error: 'Configuration personnelle introuvable. Copie d’abord le modèle intégré.' }); return; }
    response.json({ accordion: updated });
  } catch (error) {
    response.status(422).json({ error: error instanceof Error ? error.message : 'Configuration invalide.' });
  }
});

function transcriptionUserRef(userId: string) {
  return createHash('sha256').update(userId).digest('hex').slice(0, 12);
}

function youtubeReference(value: unknown) {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return url.hostname === 'youtu.be'
      ? url.pathname.split('/').filter(Boolean)[0]
      : url.searchParams.get('v') ?? url.pathname.split('/').filter(Boolean).at(-1);
  } catch { return undefined; }
}

function transcriptionLog(level: 'info' | 'error', event: string, details: Record<string, unknown>) {
  const line = `${JSON.stringify({ timestamp: new Date().toISOString(), event, ...details })}\n`;
  if (level === 'error') process.stderr.write(line); else process.stdout.write(line);
}

app.post('/api/transcriptions', requireUser, upload.single('file'), async (request, response) => {
  const requestId = randomUUID();
  const startedAt = Date.now();
  response.setHeader('X-Request-Id', requestId);
  const details = {
    requestId,
    userRef: transcriptionUserRef(response.locals.user.id as string),
    source: request.file ? 'upload' : 'tablature',
    bytes: request.file?.size ?? Buffer.byteLength(typeof request.body.tablature === 'string' ? request.body.tablature : ''),
    mimeType: request.file?.mimetype,
    accordionId: String(request.body.accordionId ?? ''),
  };
  transcriptionLog('info', 'transcription.started', details);
  try {
    const result = await transcriber.fromUpload(request.file, typeof request.body.tablature === 'string' ? request.body.tablature : undefined, String(request.body.accordionId ?? ''), request.get('x-gemini-key'));
    transcriptionLog('info', 'transcription.completed', {
      ...details,
      elapsedMs: Date.now() - startedAt,
      title: result.title,
      method: result.method,
      events: result.events.length,
      accompanimentEvents: result.accompaniment?.length ?? 0,
      confidence: result.confidence,
      coverage: result.coverage?.ratio,
    });
    response.json({ result, requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transcription impossible.';
    transcriptionLog('error', 'transcription.failed', { ...details, elapsedMs: Date.now() - startedAt, error: message });
    response.status(error instanceof multer.MulterError ? 413 : 422).json({ error: message, requestId });
  }
});

const discoveryRequestSchema = z.object({
  request: z.string().trim().min(2).max(800),
  accordionId: z.string().min(1).max(100),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(1_500),
  })).max(20).default([]),
  previousResult: z.unknown().optional(),
});

app.post('/api/transcriptions/discover', requireUser, async (request, response) => {
  const requestId = randomUUID();
  const startedAt = Date.now();
  response.setHeader('X-Request-Id', requestId);
  const details = {
    requestId,
    userRef: transcriptionUserRef(response.locals.user.id as string),
    source: 'natural-language-discovery',
    accordionId: String(request.body?.accordionId ?? ''),
    requestLength: typeof request.body?.request === 'string' ? request.body.request.length : 0,
    revision: Boolean(request.body?.previousResult),
  };
  transcriptionLog('info', 'transcription.started', details);
  try {
    const body = discoveryRequestSchema.parse(request.body);
    const proposal = await transcriber.fromDiscovery(body.request, body.accordionId, body.history, body.previousResult, request.get('x-gemini-key'));
    transcriptionLog('info', 'transcription.completed', {
      ...details,
      elapsedMs: Date.now() - startedAt,
      title: proposal.result.title,
      method: proposal.result.method,
      events: proposal.result.events.length,
      accompanimentEvents: proposal.result.accompaniment?.length ?? 0,
      confidence: proposal.result.confidence,
      sources: proposal.result.sources?.length ?? 0,
    });
    response.json({ ...proposal, requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Recherche musicale impossible.';
    transcriptionLog('error', 'transcription.failed', { ...details, elapsedMs: Date.now() - startedAt, error: message });
    response.status(422).json({ error: message, requestId });
  }
});

app.post('/api/transcriptions/youtube', requireUser, async (request, response) => {
  const requestId = randomUUID();
  const startedAt = Date.now();
  response.setHeader('X-Request-Id', requestId);
  const details = {
    requestId,
    userRef: transcriptionUserRef(response.locals.user.id as string),
    source: 'youtube',
    videoId: youtubeReference(request.body?.url),
    accordionId: String(request.body?.accordionId ?? ''),
  };
  transcriptionLog('info', 'transcription.started', details);
  try {
    const body = z.object({ url: z.string().url(), accordionId: z.string().min(1) }).parse(request.body);
    const result = await transcriber.fromYoutube(body.url, body.accordionId, request.get('x-gemini-key'));
    transcriptionLog('info', 'transcription.completed', {
      ...details,
      elapsedMs: Date.now() - startedAt,
      title: result.title,
      method: result.method,
      events: result.events.length,
      accompanimentEvents: result.accompaniment?.length ?? 0,
      confidence: result.confidence,
      coverage: result.coverage?.ratio,
    });
    response.json({ result, requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Vidéo impossible à analyser.';
    transcriptionLog('error', 'transcription.failed', { ...details, elapsedMs: Date.now() - startedAt, error: message });
    response.status(422).json({ error: message, requestId });
  }
});

if (process.env.NODE_ENV === 'production') {
  const dist = resolve(root, 'dist');
  if (!existsSync(dist)) throw new Error('Le dossier dist est absent. Exécute `npm run build` avant de démarrer en production.');
  app.use(express.static(dist, {
    maxAge: '1y',
    immutable: true,
    index: false,
    setHeaders: (response, filePath) => {
      const cacheControl = staticAssetCacheControl(filePath);
      if (cacheControl) response.setHeader('Cache-Control', cacheControl);
    },
  }));
  app.get('*splat', (_request, response) => response.sendFile(resolve(dist, 'index.html')));
}

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  void _next;
  if (error instanceof multer.MulterError) response.status(413).json({ error: 'Le fichier dépasse la limite de 25 Mo.' });
  else response.status(500).json({ error: 'Erreur interne.' });
});

app.listen(port, '0.0.0.0', () => {
  process.stdout.write(`Soufflet API listening on http://0.0.0.0:${port}\n`);
});
