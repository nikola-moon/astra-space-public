import { Platform } from 'react-native';
import type { DiscussionReply, MeState, ReportCategory, ReportResult, StationAction, Topic } from './types';

/**
 * Adresse de la station. Elle vient de EXPO_PUBLIC_ASTRA_API_URL et peut être
 * remplacée depuis l'écran de connexion. Ce n'est jamais un secret.
 */
export const PUBLIC_WEB = Platform.OS === 'web' && process.env.EXPO_PUBLIC_ASTRA_SHOWCASE === '1';
export const DEFAULT_API_URL = PUBLIC_WEB && typeof window !== 'undefined'
  ? window.location.origin
  : (process.env.EXPO_PUBLIC_ASTRA_API_URL ?? '').replace(/\/+$/, '');

let baseUrl = DEFAULT_API_URL;

export function setApiUrl(url: string) {
  baseUrl = url.trim().replace(/\/+$/, '');
}

export function getApiUrl() {
  return baseUrl;
}

export function validateStationUrl(value: string) {
  const origin = /^(https?):\/\/([a-z0-9.-]+|\[[a-f0-9:]+\])(?::([0-9]{1,5}))?\/?$/i.exec(value.trim());
  if (!origin || (origin[3] && (+origin[3] === 0 || +origin[3] > 65535))) throw new Error('Adresse de station invalide.');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(origin[2].toLowerCase());
  if (origin[1].toLowerCase() !== 'https' && !loopback) {
    throw new Error('Utilisez une adresse HTTPS. HTTP est réservé au test sur ce PC.');
  }
}

/** La station ne répond pas (réseau local coupé, serveur arrêté, mauvaise adresse). */
export class StationUnreachableError extends Error {
  constructor(message = 'Station injoignable sur le réseau local.') {
    super(message);
    this.name = 'StationUnreachableError';
  }
}

/** La station a répondu avec une erreur. `detail` est le message renvoyé par FastAPI. */
export class ApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail);
    this.name = 'ApiError';
  }
}

/** Lecture rapide pour détecter une coupure ; les écritures laissent plus de temps à la station. */
const READ_TIMEOUT_MS = 6000;
const WRITE_TIMEOUT_MS = 20000;

async function request<T>(path: string, init: RequestInit = {}, extraHeaders: Record<string, string> = {}): Promise<T> {
  if (!baseUrl) {
    throw new StationUnreachableError('Adresse de la station non configurée (EXPO_PUBLIC_ASTRA_API_URL).');
  }
  validateStationUrl(baseUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.method === 'POST' ? WRITE_TIMEOUT_MS : READ_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(baseUrl + path, {
      ...init,
      // La session du serveur est un cookie httponly : le système le conserve et le renvoie.
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...extraHeaders },
      signal: controller.signal,
    });
  } catch {
    throw new StationUnreachableError();
  } finally {
    clearTimeout(timer);
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const detail =
      body && typeof body === 'object' && 'detail' in body && typeof (body as { detail: unknown }).detail === 'string'
        ? (body as { detail: string }).detail
        : `Erreur ${response.status}`;
    throw new ApiError(response.status, detail);
  }
  return body as T;
}

export const api = {
  login: (crew: string, code: string) =>
    request<{ name: string }>('/api/login', { method: 'POST', body: JSON.stringify({ crew, code }) }),
  logout: () => request<{ ok: boolean }>('/api/logout', { method: 'POST' }),
  me: () => request<MeState>('/api/me'),
  discussion: (topic: Topic) =>
    request<DiscussionReply>('/api/me/discussion', { method: 'POST', body: JSON.stringify({ topic }) }),
  report: (category: ReportCategory) =>
    request<ReportResult>('/api/me/report', { method: 'POST', body: JSON.stringify({ category }) }),
  /** Console de simulation de la démo (`/api/demo/*`), protégée par le code de console. */
  stationAction: (stationCode: string, action: StationAction, sample: 3 | 4 | 5 = 3) =>
    request<{ message: string; state: MeState }>(
      '/api/demo/action',
      { method: 'POST', body: JSON.stringify({ action, sample }) },
      { 'X-Demo-Code': encodeURIComponent(stationCode) },
    ),
};
