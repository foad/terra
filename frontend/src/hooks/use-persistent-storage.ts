import { useState, useEffect } from "react";

interface StorageState {
  persisted: boolean | null;
  quota: number | null;
  usage: number | null;
}

export const usePersistentStorage = () => {
  const [state, setState] = useState<StorageState>({
    persisted: null,
    quota: null,
    usage: null,
  });

  useEffect(() => {
    if (!navigator.storage) return;

    const request = async () => {
      const persisted = await navigator.storage.persist();
      const estimate = await navigator.storage.estimate();

      setState({
        persisted,
        quota: estimate.quota ?? null,
        usage: estimate.usage ?? null,
      });
    };

    request();
  }, []);

  return state;
};
