import compression from 'compression';
import { config as loadEnv } from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { SouffletDatabase } from './database.js';
import { createTranscriber } from './transcription.js';
import { clearSession, createUserId, hashPassword, readSessionToken, sessionHash, setSession, verifyPassword } from './auth.js';

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

app.get('/api/health', (_request, response) => response.json({ status: 'ok', version: process.env.APP_VERSION ?? 'development', aiConfigured: Boolean(process.env.GEMINI_API_KEY) }));
app.get('/api/accordions', (request, response) => response.json({ accordions: db.listAccordions(currentUser(request)?.id) }));

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

app.get('/api/library', requireUser, (_request, response) => response.json({ songs: db.listCommonSongs() }));

const practiceSessionSchema = z.object({
  id: z.string().uuid(),
  songId: z.string().min(1).max(120),
  songTitle: z.string().trim().min(1).max(160),
  mode: z.enum(['demo', 'guided', 'wait', 'notes', 'rhythm', 'bellows', 'right', 'left', 'combined', 'performance']),
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
}).refine((session) => new Date(session.endedAt).getTime() >= new Date(session.startedAt).getTime(), { message: 'La fin de séance précède son début.' });

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

const accordionButtonSchema = z.object({
  id: z.string().min(1).max(80), row: z.number().int().min(0).max(5), index: z.number().int().min(1).max(30),
  push: z.string().min(1).max(8), pull: z.string().min(1).max(8), pushMidi: z.number().int().min(0).max(127), pullMidi: z.number().int().min(0).max(127),
  finger: z.number().int().min(1).max(5).optional(), role: z.enum(['melody', 'accidental', 'bass', 'chord']).optional(), isGleichton: z.boolean().optional(),
});
const accordionSchema = z.object({
  maker: z.string().min(1).max(80), model: z.string().min(1).max(100), tuning: z.string().min(1).max(80), color: z.string().regex(/^#[0-9a-f]{6}$/i),
  rightRows: z.array(z.number().int().min(1).max(30)).min(1).max(4), bassCount: z.number().int().min(0).max(36), description: z.string().max(300),
  buttons: z.array(accordionButtonSchema).min(1).max(120), basses: z.array(accordionButtonSchema).max(40), verified: z.boolean(), sourceNote: z.string().max(300).optional(),
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

app.post('/api/transcriptions', requireUser, upload.single('file'), async (request, response) => {
  try {
    const result = await transcriber.fromUpload(request.file, typeof request.body.tablature === 'string' ? request.body.tablature : undefined, String(request.body.accordionId ?? ''), request.get('x-gemini-key'));
    response.json({ result });
  } catch (error) {
    response.status(error instanceof multer.MulterError ? 413 : 422).json({ error: error instanceof Error ? error.message : 'Transcription impossible.' });
  }
});

app.post('/api/transcriptions/youtube', requireUser, async (request, response) => {
  try {
    const body = z.object({ url: z.string().url(), accordionId: z.string().min(1) }).parse(request.body);
    const result = await transcriber.fromYoutube(body.url, request.get('x-gemini-key'));
    response.json({ result });
  } catch (error) {
    response.status(422).json({ error: error instanceof Error ? error.message : 'Vidéo impossible à analyser.' });
  }
});

if (process.env.NODE_ENV === 'production') {
  const dist = resolve(root, 'dist');
  if (!existsSync(dist)) throw new Error('Le dossier dist est absent. Exécute `npm run build` avant de démarrer en production.');
  app.use(express.static(dist, { maxAge: '1y', immutable: true, index: false }));
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
