import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/api.js";

/**
 * useJsonData — fetches JSON from an API path and returns { loading, data, error, refetch }.
 *
 * @param {string | null} path  API path relative to the base URL (e.g. '/api/tickets?limit=200').
 *                              Pass null / undefined / "" to skip the fetch.
 *
 * Behaviour:
 * - Automatically re-fetches when `path` changes.
 * - Cancels in-flight requests when the component unmounts or `path` changes (AbortController).
 * - `refetch()` re-runs the fetch for the current `path` without changing it.
 * - Errors from the api service are exposed as `error` (string message).
 * - AbortErrors are silently swallowed (they mean the component unmounted).
 */
export function useJsonData(path) {
  const [state, setState] = useState({ loading: !!path, data: null, error: null });
  // Bump this ref to force a refetch without changing `path`
  const revisionRef = useRef(0);

  const fetchData = useCallback(
    (signal) => {
      if (!path) return;
      setState({ loading: true, data: null, error: null });

      api.get(path, { signal })
        .then((json) => setState({ loading: false, data: json,  error: null }))
        .catch((err) => {
          if (err.name === "AbortError") return;
          setState({ loading: false, data: null, error: err.message || "Failed" });
        });
    },
    [path],
  );

  useEffect(() => {
    if (!path) return undefined;
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [path, fetchData]);

  const refetch = useCallback(() => {
    revisionRef.current += 1;
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  return { ...state, refetch };
}
