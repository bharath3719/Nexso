/**
 * session.ts — persisted auth session.
 *
 * Port of frontend/src/utils/authSession.js. Two differences that matter:
 *
 *  1. Storage is expo-secure-store (Keychain / Android Keystore), not
 *     localStorage. A JWT sitting in AsyncStorage is world-readable on a rooted
 *     device; this one is not.
 *
 *  2. SecureStore is ASYNC, so `getToken()` returns a Promise. The API client
 *     therefore keeps the token in a module-level cache (see api.ts) so the
 *     common path does not await a keychain read on every request.
 *
 * SecureStore keys must match /^[A-Za-z0-9._-]+$/ — the web's snake_case keys
 * are already compliant, so they are reused verbatim.
 */

import * as SecureStore from 'expo-secure-store';

/**
 * Values as the backend emits them — `auth_accounts.portal_role`, returned
 * verbatim by /api/auth/login. The secretary role is `SOCIETY_ADMIN`, not
 * `SECRETARY`; naming it otherwise here silently routed every secretary login
 * to the unsupported-role screen.
 */
export type PortalRole = 'RESIDENT' | 'SOCIETY_ADMIN' | 'VENDOR' | 'GUARD' | 'NEXSO_ADMIN';

export type Session = {
  token: string;
  portalRole: PortalRole;
  societyId: number | null;
  societyName: string | null;
  username: string | null;
  residentId: number | null;
  unitId: number | null;
  unitNumber: string | null;
  name: string | null;
  /** Staff account on a temporary password — must change it before proceeding. */
  forcePasswordReset: boolean;
  /** Resident who has never completed their profile — see routes/auth.js otp/verify. */
  forceProfileSetup: boolean;
};

const KEY = 'nexso.session';

/** Everything the login endpoints return, before it is normalised into a Session. */
type LoginResponse = {
  token: string;
  portalRole: PortalRole;
  societyId?: number | null;
  societyName?: string | null;
  username?: string | null;
  residentId?: number | null;
  unitId?: number | null;
  unitNumber?: string | null;
  name?: string | null;
  forcePasswordReset?: boolean;
  forceProfileSetup?: boolean;
};

/**
 * Normalises a login/verify response into a Session.
 *
 * `/api/auth/login` and `/api/auth/otp/verify` return overlapping but not
 * identical shapes — password login has no residentId/unitNumber, OTP login has
 * no forcePasswordReset. Defaulting the absent half here keeps every consumer
 * off `?? undefined` chains.
 */
export function toSession(res: LoginResponse): Session {
  return {
    token: res.token,
    portalRole: res.portalRole,
    societyId: res.societyId ?? null,
    societyName: res.societyName ?? null,
    username: res.username ?? null,
    residentId: res.residentId ?? null,
    unitId: res.unitId ?? null,
    unitNumber: res.unitNumber ?? null,
    name: res.name ?? null,
    forcePasswordReset: Boolean(res.forcePasswordReset),
    forceProfileSetup: Boolean(res.forceProfileSetup),
  };
}

export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(KEY).catch(() => null);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    // A stored blob with no token is unusable — treat it as signed out rather
    // than letting an Authorization: Bearer undefined header reach the API.
    return parsed?.token ? parsed : null;
  } catch {
    // Corrupt entry (interrupted write, or a shape from an older build).
    // Drop it instead of wedging the app on the splash screen forever.
    await SecureStore.deleteItemAsync(KEY).catch(() => {});
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY).catch(() => {});
}
