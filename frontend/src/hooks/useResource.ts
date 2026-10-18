import { useCallback, useEffect, useState } from "react";
export function useResource<T>(load: () => Promise<T>, interval = 15000) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const result = await load();
        if (active) {
          setData(result);
          setError("");
        }
      } catch (e) {
        if (active) {
          setData(undefined);
          setError(e instanceof Error ? e.message : "Unable to load data");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    const timer = setInterval(() => void run(), interval);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [load, interval, revision]);
  return { data, error, loading, refresh };
}
