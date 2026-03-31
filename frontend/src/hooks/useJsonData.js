import { useEffect, useState } from "react";

export function useJsonData(url) {
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    if (!url) return undefined;
    const controller = new AbortController();
    setState({ loading: true, data: null, error: null });

    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then((json) => setState({ loading: false, data: json, error: null }))
      .catch((err) => {
        if (err.name === "AbortError") return;
        setState({ loading: false, data: null, error: err.message || "Failed" });
      });

    return () => controller.abort();
  }, [url]);

  return state;
}
