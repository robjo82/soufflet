import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Request, Response } from 'express';
import type { SouffletDatabase } from './database.js';

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = 'soufflet_session';
const SESSION_DAYS = 30;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, expectedHex] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = await scrypt(password, salt, expected.length) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function sessionHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function readSessionToken(request: Request) {
  const cookie = request.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${SESSION_COOKIE}=`));
  return cookie ? decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1)) : undefined;
}

export function setSession(response: Response, db: SouffletDatabase, userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  db.createSession(sessionHash(token), userId, expiresAt.toISOString());
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: SESSION_DAYS * 86_400_000,
  });
}

export function clearSession(response: Response) {
  response.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', path: '/' });
}

export function createUserId() {
  return `usr_${randomUUID()}`;
}
