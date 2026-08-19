/**
 * auth.tsx — session state for the whole app.
 *
 * Owns the one piece of state every screen depends on: who is signed in. The
 * root layout renders nothing but a splash until `restoring` flips false, so no
 * screen ever has to handle "signed in, probably, still checking".
 *
 * Replaces the web's App.jsx `session` useState block plus its
 * 'nexso:unauthorized' window listener.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken, onUnauthorized } from './api';
import {
  clearSession,
  loadSession,
  saveSession,
  toSession,
  type PortalRole,
  type Session,
} from './session';

type AuthValue = {
  session: Session | null;
  /** True until the stored session has been read back from SecureStore. */
  restoring: boolean;
  role: PortalRole | null;
  signInWithPassword: (username: string, password: string) => Promise<Session>;
  requestOtp: (phone: string) => Promise<{ devOtp?: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<Session>;
  signOut: () => Promise<void>;
  /** Merges fields into the live session and persists — e.g. clearing a force-* flag. */
  patchSession: (patch: Partial<Session>) => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);

  // Restore on cold start.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadSession();
      if (cancelled) return;
      // Seed the API client's token cache BEFORE any screen mounts, so the first
      // request of the session already carries its Authorization header.
      setAuthToken(stored?.token ?? null);
      setSession(stored);
      setRestoring(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    setAuthToken(null);
    setSession(null);
    await clearSession();
  }, []);

  // A 401 from anywhere — an expired 7-day JWT, a revoked account — drops the
  // session, and the root layout's redirect takes the user back to sign-in.
  useEffect(() => onUnauthorized(() => void signOut()), [signOut]);

  const adopt = useCallback(async (raw: any): Promise<Session> => {
    const next = toSession(raw);
    setAuthToken(next.token);
    await saveSession(next);
    setSession(next);
    return next;
  }, []);

  const signInWithPassword = useCallback(
    async (username: string, password: string) => adopt(await api.auth.login(username.trim(), password)),
    [adopt],
  );

  const requestOtp = useCallback(async (phone: string) => {
    // With no WHATSAPP_TOKEN configured the backend returns the OTP in the
    // response body so the app is testable against a local server. It is absent
    // in production — see routes/auth.js `devMode`.
    const res = await api.auth.otpRequest(phone);
    return { devOtp: res?.otp as string | undefined };
  }, []);

  const verifyOtp = useCallback(
    async (phone: string, otp: string) => adopt(await api.auth.otpVerify(phone, otp.trim())),
    [adopt],
  );

  const patchSession = useCallback(async (patch: Partial<Session>) => {
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      // Fire-and-forget: state is the source of truth for this render, and a
      // failed keychain write should not block the UI. Worst case the flag
      // reappears on next cold start.
      void saveSession(next);
      return next;
    });
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      restoring,
      role: session?.portalRole ?? null,
      signInWithPassword,
      requestOtp,
      verifyOtp,
      signOut,
      patchSession,
    }),
    [session, restoring, signInWithPassword, requestOtp, verifyOtp, signOut, patchSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/**
 * The session, asserted non-null. For screens inside a signed-in group, where
 * the layout guard has already redirected anyone without one.
 */
export function useSession(): Session {
  const { session } = useAuth();
  if (!session) throw new Error('useSession used outside a signed-in route group');
  return session;
}
