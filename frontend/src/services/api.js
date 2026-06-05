/**
 * api.js — Centralised API service for Nexso.
 *
 * Usage:
 *   import { api } from '../services/api.js';
 *   const data = await api.vendors.list({ limit: 200 });
 *
 * All calls automatically attach the Bearer token from localStorage.
 * A 401 response clears the session and fires a 'nexso:unauthorized' window
 * event so App.jsx can redirect to the login screen without a circular import.
 *
 * Errors are thrown as ApiError instances (extends Error) with:
 *   err.status  — HTTP status code (0 for network errors)
 *   err.code    — server-supplied error code string, if present
 *   err.data    — full parsed response body
 */

import { getToken, clearSession } from '../utils/authSession.js';

// ─── Config ───────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

// ─── ApiError ─────────────────────────────────────────────────────────────────

class ApiError extends Error {
  /**
   * @param {string} message   Human-readable message.
   * @param {number} status    HTTP status code.
   * @param {string} [code]    Server error code (e.g. 'invalid_credentials').
   * @param {object} [data]    Full parsed response body.
   */
  constructor(message, status, code, data) {
    super(message);
    this.name   = 'ApiError';
    this.status = status;
    this.code   = code   ?? null;
    this.data   = data   ?? {};
  }
}

// ─── Core request ─────────────────────────────────────────────────────────────

/**
 * Core fetch wrapper.
 *
 * @param {string}  method            HTTP verb ('GET', 'POST', …)
 * @param {string}  path              API path, e.g. '/api/vendors'
 * @param {object}  [opts]
 * @param {any}     [opts.body]       Request body (JSON-serialised automatically).
 * @param {AbortSignal} [opts.signal] AbortController signal for cancellation.
 * @param {boolean} [opts.auth=true]  Set false to skip the Authorization header.
 * @returns {Promise<any>}            Parsed JSON response.
 * @throws  {ApiError}                On non-2xx responses or network failures.
 */
async function request(method, path, { body, signal, auth = true } = {}) {
  const headers = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    // Don't swallow AbortError — callers rely on it for cleanup.
    if (err.name === 'AbortError') throw err;
    throw new ApiError(
      'Network error — could not reach the server.',
      0,
      'network_error',
    );
  }

  // ── Handle session expiry ────────────────────────────────────────────────
  if (res.status === 401) {
    clearSession();
    window.dispatchEvent(new CustomEvent('nexso:unauthorized'));
    const errData = await res.json().catch(() => ({}));
    throw new ApiError(
      errData.error || 'Unauthorized — please sign in again.',
      401,
      errData.error,
      errData,
    );
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      data.message || data.error || `Request failed (${res.status})`,
      res.status,
      data.error,
      data,
    );
  }

  return data;
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

const get   = (path, opts = {})        => request('GET',    path, opts);
const post  = (path, body, opts = {})  => request('POST',   path, { ...opts, body });
const put   = (path, body, opts = {})  => request('PUT',    path, { ...opts, body });
const patch = (path, body, opts = {})  => request('PATCH',  path, { ...opts, body });
const del   = (path, opts = {})        => request('DELETE', path, opts);

// ─── Domain API ───────────────────────────────────────────────────────────────

export const api = {
  // ── Low-level (escape hatch if domain methods don't cover a use-case) ──────
  request,
  get,
  post,
  put,
  patch,
  del,

  // ── Authentication ────────────────────────────────────────────────────────
  auth: {
    /** Login — does NOT attach the Bearer token. */
    login: (username, password) =>
      post('/api/auth/login', { username, password }, { auth: false }),

    /** Change password (requires an active session). */
    changePassword: (currentPassword, newPassword) =>
      post('/api/auth/change-password', { currentPassword, newPassword }),

    /** Fetch current user profile. */
    me: () => get('/api/auth/me'),
  },

  // ── Vendors ───────────────────────────────────────────────────────────────
  vendors: {
    /**
     * List vendors with optional query params.
     * @param {Record<string,string|number>} params e.g. { limit: 200 }
     */
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return get(`/api/vendors${qs ? `?${qs}` : ''}`);
    },

    create:   (data)              => post('/api/vendors', data),
    update:   (id, data)          => put(`/api/vendors/${id}`, data),
    approve:  (id)                => post(`/api/vendors/${id}/approve`),
    reject:   (id, reason)        => post(`/api/vendors/${id}/reject`, { reason }),
    suspend:  (id, reason)        => post(`/api/vendors/${id}/suspend`, { reason }),
    queue:    ()                  => get('/api/vendors/queue/pending'),
  },

  // ── Tickets ───────────────────────────────────────────────────────────────
  tickets: {
    /**
     * List tickets with optional query params.
     * @param {Record<string,string|number>} params e.g. { limit: 200 }
     * @param {AbortSignal} [signal]
     */
    list: (params = {}, signal) => {
      const qs = new URLSearchParams(params).toString();
      return get(`/api/tickets${qs ? `?${qs}` : ''}`, { signal });
    },

    update: (id, data) => patch(`/api/tickets/${id}`, data),
    stats:  ()         => get('/api/tickets/stats'),
  },

  // ── Onboarding ────────────────────────────────────────────────────────────
  onboarding: {
    /** List all societies. */
    list: () => get('/api/onboarding/societies'),

    /** Fetch a single society (includes towers array). */
    getSociety: (id) => get(`/api/onboarding/societies/${id}`),

    /** Create a new society — returns { society, secretaryCredentials? }. */
    createSociety: (data) => post('/api/onboarding/societies', data),

    /** Update basic society info (Step 1 edit). */
    updateSociety: (id, data) => patch(`/api/onboarding/societies/${id}`, data),

    /** Save / replace the tower–floor–unit structure (Step 2). */
    saveStructure: (id, towers) =>
      post(`/api/onboarding/societies/${id}/structure`, { towers }),

    /** Import residents (Step 3). */
    importResidents: (id, residents) =>
      post(`/api/onboarding/societies/${id}/residents`, { residents }),

    /** Generate a new temporary password for the society secretary. */
    resetSecretaryPassword: (id) =>
      post(`/api/onboarding/societies/${id}/reset-secretary-password`),

    /** Fetch residents for a society (detail view). */
    getResidents: (id) => get(`/api/onboarding/societies/${id}/residents`),

    /** Add a single resident to a specific unit. */
    addUnitResident: (societyId, unitId, data) =>
      post(`/api/onboarding/societies/${societyId}/units/${unitId}/residents`, data),

    /** Update a single resident. */
    updateResident: (societyId, residentId, data) =>
      patch(`/api/onboarding/societies/${societyId}/residents/${residentId}`, data),

    /** Delete a single resident. */
    deleteResident: (societyId, residentId) =>
      del(`/api/onboarding/societies/${societyId}/residents/${residentId}`),
  },

  // ── Secretary portal ──────────────────────────────────────────────────────
  secretary: {
    stats: () => get('/api/secretary/stats'),

    /**
     * @param {Record<string,string>} params e.g. { status: 'OPEN', limit: '100' }
     */
    tickets: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return get(`/api/secretary/tickets${qs ? `?${qs}` : ''}`);
    },

    /** Flat list of all units belonging to the secretary's society. */
    units: () => get('/api/secretary/units'),

    /** Full tower/floor/unit structure with a unitMap for O(1) lookups. */
    structure: () => get('/api/secretary/structure'),

    residents: {
      list:   (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return get(`/api/secretary/residents${qs ? `?${qs}` : ''}`);
      },
      add:    (data)     => post('/api/secretary/residents',        data),
      update: (id, data) => patch(`/api/secretary/residents/${id}`, data),
      delete: (id)       => del(`/api/secretary/residents/${id}`),
    },

    maintenance: {
      /** List dues for the secretary's society. month = 'YYYY-MM', status = 'ALL' | 'PENDING' | 'PAID' | 'OVERDUE' | 'WAIVED' */
      list: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return get(`/api/secretary/maintenance${qs ? `?${qs}` : ''}`);
      },
      /** Mark a due as paid / waived / pending */
      updateDue: (id, data) => patch(`/api/secretary/maintenance/dues/${id}`, data),
      /** Generate dues for a given month (defaults to current month) */
      generate: (month) => post('/api/secretary/maintenance/generate', month ? { month } : {}),
      /** Send WhatsApp reminders to unpaid residents */
      sendReminders: (month) => post('/api/secretary/maintenance/send-reminders', month ? { month } : {}),
      /** Toggle feature on/off + set UPI ID */
      updateConfig: (data) => patch('/api/secretary/maintenance/config', data),
      /** Get saved expense sheet for a month (or default empty template) */
      getExpenseSheet: (month) => get(`/api/secretary/maintenance/expense-sheet${month ? `?month=${month}` : ''}`),
      /** Save / update the expense sheet for a month */
      saveExpenseSheet: (data) => put('/api/secretary/maintenance/expense-sheet', data),
      /** Preview the itemised bill for a specific resident */
      getBillPreview: (month, residentId) => {
        const qs = new URLSearchParams({ month, residentId }).toString();
        return get(`/api/secretary/maintenance/bill-preview?${qs}`);
      },
    },
  },

  // ── Maintenance (admin) ───────────────────────────────────────────────────
  maintenance: {
    /** List dues for any society. params: { societyId, month, status } */
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return get(`/api/maintenance/dues${qs ? `?${qs}` : ''}`);
    },
    updateDue:     (id, data)             => patch(`/api/maintenance/dues/${id}`, data),
    generate:      (societyId, month)     => post('/api/maintenance/generate', { societyId, month }),
    sendReminders: (societyId, month)     => post('/api/maintenance/send-reminders', { societyId, month }),
    getSociety:    (societyId)            => get(`/api/maintenance/society/${societyId}`),
    patchSociety:  (societyId, data)      => patch(`/api/maintenance/society/${societyId}`, data),
  },

  // ── Vendor portal ─────────────────────────────────────────────────────────
  vendorPortal: {
    /** Vendor profile + name. */
    profile: () => get('/api/vendor-portal/profile'),

    /** Dashboard stats — assigned / inProgress / resolved / total. */
    stats: () => get('/api/vendor-portal/stats'),

    /**
     * Assigned tickets with enriched society / unit / resident data.
     * @param {Record<string,string|number>} params e.g. { status: 'ASSIGNED', limit: 50 }
     */
    tickets: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return get(`/api/vendor-portal/tickets${qs ? `?${qs}` : ''}`);
    },

    /**
     * Advance a ticket's status (ASSIGNED → IN_PROGRESS → RESOLVED).
     * @param {number} id  Ticket DB id.
     */
    updateStatus: (id) =>
      patch(`/api/vendor-portal/tickets/${id}/status`, {}),

    /** Count of ASSIGNED (new, unacknowledged) tickets — used for the bell badge. */
    notifications: () => get('/api/vendor-portal/notifications'),
  },
};
