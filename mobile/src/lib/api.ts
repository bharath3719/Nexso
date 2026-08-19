/**
 * api.ts — Nexso mobile API client.
 *
 * Port of frontend/src/services/api.js, narrowed to the endpoints the mobile
 * app actually calls (auth + resident + secretary) and adapted for React Native:
 *
 *   web                                  mobile
 *   ───────────────────────────────────  ─────────────────────────────────────
 *   import.meta.env.VITE_API_BASE        process.env.EXPO_PUBLIC_API_BASE
 *   localStorage.getItem (sync)          in-memory cache fed from SecureStore
 *   window.dispatchEvent('nexso:…')      onUnauthorized() listener registry
 *   URL.createObjectURL + <a download>   expo-file-system + expo-sharing
 *   (no timeout)                         REQUEST_TIMEOUT_MS via AbortController
 *
 * The endpoint surface is otherwise kept deliberately identical — same paths,
 * same argument order — so a change on either client is easy to mirror.
 */

import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// ─── Config ───────────────────────────────────────────────────────────────────

/**
 * EXPO_PUBLIC_* vars are inlined into the bundle at build time, so this must be
 * read as a whole property access — destructuring `process.env` breaks the
 * transform and yields undefined at runtime.
 *
 * Set per build profile in eas.json. The localhost fallback only ever applies to
 * `expo start` on a simulator; note that on an Android emulator the host machine
 * is 10.0.2.2, not localhost.
 */
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:3000';

/**
 * Mobile networks stall rather than fail. Without a ceiling a request on a dead
 * connection hangs until the OS gives up — minutes — and the spinner never stops.
 */
const REQUEST_TIMEOUT_MS = 20_000;

// ─── Errors ───────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  /** HTTP status, or 0 for a network/timeout failure. */
  readonly status: number;
  /** Server-supplied error code, e.g. 'invalid_credentials'. */
  readonly code: string | null;
  readonly data: Record<string, unknown>;

  constructor(message: string, status: number, code?: string | null, data?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code ?? null;
    this.data = data ?? {};
  }
}

/**
 * The backend returns machine codes; residents need sentences. Anything not
 * listed falls through to the server's own message.
 */
const ERROR_COPY: Record<string, string> = {
  invalid_credentials: 'That username or password is not right.',
  username_password_required: 'Enter both your username and password.',
  phone_required: 'Enter your 10-digit mobile number.',
  phone_not_registered: 'This number is not registered with any society. Ask your secretary to add you.',
  invalid_or_expired_otp: 'That code is wrong or has expired. Request a new one.',
  phone_and_otp_required: 'Enter the code sent to your WhatsApp.',
  resident_not_found: 'We could not find your resident record. Contact your secretary.',
  too_many_requests: 'Too many attempts. Wait a few minutes and try again.',
  current_password_wrong: 'Your current password is not right.',
  password_too_short: 'Choose a password of at least 8 characters.',
  both_passwords_required: 'Fill in both password fields.',
  network_error: 'No connection. Check your internet and try again.',
  timeout: 'The server took too long to respond. Try again.',
  internal_error: 'Something went wrong on our side. Try again shortly.',
};

/** Human-readable text for any thrown error, safe to render directly. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return (err.code && ERROR_COPY[err.code]) || err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong.';
}

// ─── Token cache ──────────────────────────────────────────────────────────────
// SecureStore reads are async, so the token is mirrored here and kept current by
// AuthProvider. Without this every request would await a keychain round trip.

let cachedToken: string | null = null;

export function setAuthToken(token: string | null): void {
  cachedToken = token;
}

// ─── Unauthorized listeners ───────────────────────────────────────────────────
// Replaces the web's window CustomEvent. AuthProvider subscribes and signs out.

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();

/** Subscribe to 401s. Returns an unsubscribe function. */
export function onUnauthorized(listener: Listener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

function emitUnauthorized(): void {
  unauthorizedListeners.forEach((fn) => fn());
}

// ─── Core request ─────────────────────────────────────────────────────────────

type RequestOptions = {
  body?: unknown;
  signal?: AbortSignal;
  /** Set false to omit the Authorization header (login endpoints). */
  auth?: boolean;
};

async function request<T = any>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const { body, signal, auth = true } = opts;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && cachedToken) headers.Authorization = `Bearer ${cachedToken}`;

  // Own controller so the timeout can abort, while still honouring a caller's
  // signal (screens abort in-flight requests on unmount).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), REQUEST_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', onCallerAbort);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err: any) {
    // A caller-driven abort is control flow, not an error — screens rely on it
    // for unmount cleanup, so it must propagate untouched.
    if (signal?.aborted) throw err;
    if (err?.name === 'TimeoutError' || controller.signal.aborted) {
      throw new ApiError('The server took too long to respond.', 0, 'timeout');
    }
    throw new ApiError('Could not reach the server.', 0, 'network_error');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }

  // A 7-day JWT expiring mid-session lands here. Clearing the cached token
  // before notifying stops a burst of parallel requests each firing a sign-out.
  if (res.status === 401) {
    cachedToken = null;
    const errData = await res.json().catch(() => ({} as any));
    emitUnauthorized();
    throw new ApiError(errData.error || 'Your session has expired. Sign in again.', 401, errData.error, errData);
  }

  const data = await res.json().catch(() => ({} as any));

  if (!res.ok) {
    throw new ApiError(data.message || data.error || `Request failed (${res.status})`, res.status, data.error, data);
  }

  return data as T;
}

const get = <T = any>(path: string, opts: RequestOptions = {}) => request<T>('GET', path, opts);
const post = <T = any>(path: string, body?: unknown, opts: RequestOptions = {}) =>
  request<T>('POST', path, { ...opts, body: body ?? {} });
const put = <T = any>(path: string, body?: unknown, opts: RequestOptions = {}) =>
  request<T>('PUT', path, { ...opts, body: body ?? {} });
const patch = <T = any>(path: string, body?: unknown, opts: RequestOptions = {}) =>
  request<T>('PATCH', path, { ...opts, body: body ?? {} });
const del = <T = any>(path: string, opts: RequestOptions = {}) => request<T>('DELETE', path, opts);

/** Builds a query string, dropping empty/undefined params rather than sending `?x=`. */
function qs(params: Record<string, string | number | undefined | null> = {}): string {
  const pairs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return pairs.length ? `?${pairs.join('&')}` : '';
}

// ─── File download ────────────────────────────────────────────────────────────

/**
 * Downloads an authenticated PDF and opens the OS share sheet on it.
 *
 * The web version writes a blob to an <a download>. There is no filesystem to
 * download into here, so the file goes to the cache directory and is handed to
 * the share sheet — which is how a user "saves" a file on Android and iOS alike.
 *
 * Uses the SDK 54+ class API (File/Directory/Paths); the old
 * FileSystem.downloadAsync now lives behind 'expo-file-system/legacy'.
 */
export async function downloadAndShare(path: string, filename: string): Promise<void> {
  const dir = new Directory(Paths.cache, 'nexso-downloads');
  if (!dir.exists) dir.create({ intermediates: true });

  // Overwrite any earlier copy — File.downloadFileAsync will not clobber an
  // existing file, so a second download of the same bill would otherwise fail
  // or silently serve a stale one.
  const existing = new File(dir, filename);
  if (existing.exists) existing.delete();

  let file: File;
  try {
    file = await File.downloadFileAsync(path.startsWith('http') ? path : `${API_BASE}${path}`, existing, {
      headers: cachedToken ? { Authorization: `Bearer ${cachedToken}` } : {},
    });
  } catch {
    throw new ApiError('Could not download the file.', 0, 'network_error');
  }

  // downloadFileAsync resolves on any HTTP response, 4xx included — an expired
  // token yields a JSON error body saved as "invoice-….pdf". Anything far too
  // small to be a PDF is treated as that error rather than shared to the user.
  if (!file.exists || (file.size ?? 0) < 1024) {
    file.delete();
    throw new ApiError('That document is not available.', 0, 'download_failed');
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new ApiError('Sharing is not available on this device.', 0, 'sharing_unavailable');
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    dialogTitle: filename,
    UTI: 'com.adobe.pdf',
  });
}

// ─── Domain API ───────────────────────────────────────────────────────────────

export const api = {
  // Escape hatch for anything not covered below.
  request,
  get,
  post,
  put,
  patch,
  del,

  // ── Authentication ──────────────────────────────────────────────────────────
  auth: {
    /** Staff (secretary) login. Does NOT attach a Bearer token. */
    login: (username: string, password: string) =>
      post('/api/auth/login', { username, password }, { auth: false }),

    changePassword: (currentPassword: string, newPassword: string) =>
      post('/api/auth/change-password', { currentPassword, newPassword }),

    me: () => get('/api/auth/me'),

    /** Resident login step 1 — sends a 6-digit OTP over WhatsApp. */
    otpRequest: (phone: string) => post('/api/auth/otp/request', { phone }, { auth: false }),

    /** Resident login step 2 — exchanges the OTP for a JWT. */
    otpVerify: (phone: string, otp: string) =>
      post('/api/auth/otp/verify', { phone, otp }, { auth: false }),
  },

  // ── Resident portal ─────────────────────────────────────────────────────────
  resident: {
    profile: (signal?: AbortSignal) => get('/api/resident/profile', { signal }),
    updateProfile: (data: unknown) => patch('/api/resident/profile', data),

    announcements: (signal?: AbortSignal) => get('/api/resident/announcements', { signal }),

    visitorPasses: {
      list: (params: Record<string, string> = {}, signal?: AbortSignal) =>
        get(`/api/resident/visitor-passes${qs(params)}`, { signal }),
      create: (data: unknown) => post('/api/resident/visitor-passes', data),
      revoke: (id: number) => patch(`/api/resident/visitor-passes/${id}/revoke`, {}),
    },

    complaints: {
      list: (signal?: AbortSignal) => get('/api/resident/complaints', { signal }),
      get: (id: number, signal?: AbortSignal) => get(`/api/resident/complaints/${id}`, { signal }),
      create: (data: unknown) => post('/api/resident/complaints', data),
    },

    events: {
      list: (signal?: AbortSignal) => get('/api/resident/events', { signal }),
      rsvp: (id: number, response: string) => post(`/api/resident/events/${id}/rsvp`, { response }),
    },

    polls: {
      list: (signal?: AbortSignal) => get('/api/resident/polls', { signal }),
      vote: (id: number, option_index: number) => post(`/api/resident/polls/${id}/vote`, { option_index }),
    },

    maintenance: {
      /** type = 'pending' | 'history', or omit for all. */
      dues: (type?: string, signal?: AbortSignal) =>
        get(`/api/resident/maintenance/dues${qs({ type })}`, { signal }),

      downloadInvoicePdf: (dueId: number, label?: string) =>
        downloadAndShare(`/api/resident/maintenance/invoice/${dueId}/pdf`, `invoice-${label || dueId}.pdf`),
    },
  },

  // ── Secretary portal ────────────────────────────────────────────────────────
  secretary: {
    stats: (signal?: AbortSignal) => get('/api/secretary/stats', { signal }),

    tickets: (params: Record<string, string> = {}, signal?: AbortSignal) =>
      get(`/api/secretary/tickets${qs(params)}`, { signal }),

    units: (signal?: AbortSignal) => get('/api/secretary/units', { signal }),
    structure: (signal?: AbortSignal) => get('/api/secretary/structure', { signal }),
    towers: (signal?: AbortSignal) => get('/api/secretary/towers', { signal }),

    residents: {
      list: (params: Record<string, string> = {}, signal?: AbortSignal) =>
        get(`/api/secretary/residents${qs(params)}`, { signal }),
      add: (data: unknown) => post('/api/secretary/residents', data),
      update: (id: number, data: unknown) => patch(`/api/secretary/residents/${id}`, data),
      delete: (id: number) => del(`/api/secretary/residents/${id}`),
    },

    maintenance: {
      /** month = 'YYYY-MM'; status = ALL | PENDING | PENDING_VERIFICATION | PAID | OVERDUE | WAIVED */
      list: (params: Record<string, string> = {}, signal?: AbortSignal) =>
        get(`/api/secretary/maintenance${qs(params)}`, { signal }),
      updateDue: (id: number, data: unknown) => patch(`/api/secretary/maintenance/dues/${id}`, data),
      pendingVerification: (signal?: AbortSignal) =>
        get('/api/secretary/maintenance/pending-verification', { signal }),
      verifyPayment: (id: number) => post(`/api/secretary/maintenance/dues/${id}/verify`, {}),
      rejectPayment: (id: number, reason: string) =>
        post(`/api/secretary/maintenance/dues/${id}/reject`, { reason }),
      generate: (month?: string) => post('/api/secretary/maintenance/generate', month ? { month } : {}),
      sendReminders: (month?: string) =>
        post('/api/secretary/maintenance/send-reminders', month ? { month } : {}),
      getConfig: (signal?: AbortSignal) => get('/api/secretary/maintenance/config', { signal }),
      updateConfig: (data: unknown) => patch('/api/secretary/maintenance/config', data),

      downloadInvoicePdf: (dueId: number, label?: string) =>
        downloadAndShare(`/api/secretary/maintenance/invoice/${dueId}/pdf`, `invoice-${label || dueId}.pdf`),
      downloadCollectionRegister: (month: string) =>
        downloadAndShare(
          `/api/secretary/maintenance/collection-register/pdf?month=${month}`,
          `collection-register-${month}.pdf`,
        ),
    },

    announcements: {
      list: (signal?: AbortSignal) => get('/api/secretary/announcements', { signal }),
      create: (data: unknown) => post('/api/secretary/announcements', data),
      update: (id: number, data: unknown) => patch(`/api/secretary/announcements/${id}`, data),
      delete: (id: number) => del(`/api/secretary/announcements/${id}`),
    },

    events: {
      list: (signal?: AbortSignal) => get('/api/secretary/events', { signal }),
      create: (data: unknown) => post('/api/secretary/events', data),
      update: (id: number, data: unknown) => patch(`/api/secretary/events/${id}`, data),
      delete: (id: number) => del(`/api/secretary/events/${id}`),
    },

    polls: {
      list: (signal?: AbortSignal) => get('/api/secretary/polls', { signal }),
      results: (id: number, signal?: AbortSignal) => get(`/api/secretary/polls/${id}/results`, { signal }),
      create: (data: unknown) => post('/api/secretary/polls', data),
      delete: (id: number) => del(`/api/secretary/polls/${id}`),
    },

    broadcastPreview: (target: string, tower_id?: string, signal?: AbortSignal) =>
      get(`/api/secretary/broadcast/preview${qs({ target, tower_id })}`, { signal }),
    broadcast: (data: unknown) => post('/api/secretary/broadcast', data),
    emergencyAlert: (data: unknown) => post('/api/secretary/emergency-alert', data),
    broadcasts: (limit = 20, signal?: AbortSignal) =>
      get(`/api/secretary/broadcasts${qs({ limit })}`, { signal }),

    expenses: {
      summary: (month?: string, signal?: AbortSignal) =>
        get(`/api/secretary/expenses/summary${qs({ month })}`, { signal }),
      annual: (year?: string, signal?: AbortSignal) =>
        get(`/api/secretary/expenses/annual${qs({ year })}`, { signal }),
      list: (params: Record<string, string> = {}, signal?: AbortSignal) =>
        get(`/api/secretary/expenses${qs(params)}`, { signal }),
      create: (data: unknown) => post('/api/secretary/expenses', data),
      update: (id: number, data: unknown) => patch(`/api/secretary/expenses/${id}`, data),
      delete: (id: number) => del(`/api/secretary/expenses/${id}`),
    },

    otherIncome: {
      list: (params: Record<string, string> = {}, signal?: AbortSignal) =>
        get(`/api/secretary/other-income${qs(params)}`, { signal }),
      create: (data: unknown) => post('/api/secretary/other-income', data),
      delete: (id: number) => del(`/api/secretary/other-income/${id}`),
    },
  },
};
