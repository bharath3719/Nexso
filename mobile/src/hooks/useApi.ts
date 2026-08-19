/**
 * useApi.ts — the read path for every screen.
 *
 * Successor to the web's useJsonData. Two things it adds that a phone needs and
 * a desktop browser does not:
 *
 *   • `refresh()` for pull-to-refresh, which re-fetches WITHOUT clearing the
 *     current data — so the list stays on screen under the spinner instead of
 *     flashing back to a skeleton.
 *   • refetch on screen focus, so returning from a form shows the new row
 *     without the user having to pull down.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ApiError, errorMessage } from '../lib/api';

type Options = {
  /** Skip fetching entirely — for requests that depend on a not-yet-chosen param. */
  enabled?: boolean;
  /** Re-fetch whenever the screen regains focus. Default true. */
  refetchOnFocus?: boolean;
};

export type ApiState<T> = {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  /** Silent re-fetch, keeps current data visible. For pull-to-refresh. */
  refresh: () => Promise<void>;
  /** Re-fetch from scratch, showing the loading state. For retry buttons. */
  reload: () => Promise<void>;
  /** Local optimistic update, e.g. after voting in a poll. */
  setData: React.Dispatch<React.SetStateAction<T | null>>;
};

export function useApi<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: React.DependencyList = [],
  options: Options = {},
): ApiState<T> {
  const { enabled = true, refetchOnFocus = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The fetcher is a new closure every render; holding it in a ref keeps it out
  // of the effect's dependency list, so callers do not have to useCallback it.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Tracks the in-flight request so a slow first response cannot overwrite a
  // fast later one — the classic out-of-order fetch bug on a flaky connection.
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const run = useCallback(async (mode: 'load' | 'refresh') => {
    if (!enabled) return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    if (mode === 'load') setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const result = await fetcherRef.current(controller.signal);
      if (controller.signal.aborted || !mountedRef.current) return;
      setData(result);
    } catch (err) {
      if (controller.signal.aborted || !mountedRef.current) return;
      // A 401 has already triggered a global sign-out; surfacing "session
      // expired" on a screen that is being torn down is just noise.
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    } finally {
      if (mountedRef.current && !controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [enabled]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void run('load'); }, [enabled, ...deps]);

  // Skips the mount-time focus event, which would otherwise fire a second
  // identical request immediately after the effect above.
  const hasFocusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!refetchOnFocus) return;
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }
      void run('refresh');
    }, [refetchOnFocus, run]),
  );

  return {
    data,
    loading,
    refreshing,
    error,
    refresh: useCallback(() => run('refresh'), [run]),
    reload: useCallback(() => run('load'), [run]),
    setData,
  };
}

/**
 * The write path: wraps a mutation with pending/error state so screens do not
 * hand-roll `const [saving, setSaving] = useState(false)` in every form.
 */
export function useMutation<Args extends unknown[], R>(fn: (...args: Args) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const mutate = useCallback(
    async (...args: Args): Promise<R | null> => {
      setPending(true);
      setError(null);
      try {
        const result = await fn(...args);
        return result;
      } catch (err) {
        if (mountedRef.current) setError(errorMessage(err));
        return null;
      } finally {
        if (mountedRef.current) setPending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return { mutate, pending, error, clearError: useCallback(() => setError(null), []) };
}
