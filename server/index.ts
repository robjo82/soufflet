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

app.get('/api/health', (_request, response) => response.json({ status: 'ok', version: '0.1.0', aiConfigured: Boolean(process.env.GEMINI_API_KEY) }));
app.get('/api/accordions', (_request, response) => response.json({ accordions: db.listAccordions() }));

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

app.post('/api/accordions', (request, response) => {
  try {
    const payload = accordionSchema.parse(request.body);
    const id = `custom-${crypto.randomUUID()}`;
    const config = db.saveAccordion({ ...payload, id, verified: false, sourceNote: payload.sourceNote || 'Configuration personnalisée à vérifier avec l’accordeur.' });
    response.status(201).json({ accordion: config });
  } catch (error) {
    response.status(422).json({ error: error instanceof Error ? error.message : 'Configuration invalide.' });
  }
});

app.post('/api/transcriptions', upload.single('file'), async (request, response) => {
  try {
    const result = await transcriber.fromUpload(request.file, typeof request.body.tablature === 'string' ? request.body.tablature : undefined, String(request.body.accordionId ?? ''), request.get('x-gemini-key'));
    response.json({ result });
  } catch (error) {
    response.status(error instanceof multer.MulterError ? 413 : 422).json({ error: error instanceof Error ? error.message : 'Transcription impossible.' });
  }
});

app.post('/api/transcriptions/youtube', async (request, response) => {
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
