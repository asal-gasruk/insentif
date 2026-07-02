"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createItem,
  deleteItem,
  loadData,
  resetData,
  updateItem,
} from "@/lib/storage";
import type { AppData, CollectionKey } from "@/types";

type AppDataContextValue = {
  data: AppData | null;
  ready: boolean;
  create: <T extends { id: string }>(key: CollectionKey, item: T) => AppData;
  update: <T extends { id: string }>(key: CollectionKey, item: T) => AppData;
  remove: (key: CollectionKey, id: string) => AppData;
  reset: () => AppData;
  refresh: () => void;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    try {
      setData(loadData());
    } catch (err) {
      console.error("Gagal memuat data aplikasi:", err);
      setData(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("lahans-storage-update", handler);
    return () => window.removeEventListener("lahans-storage-update", handler);
  }, [refresh]);

  const create = useCallback(
    <T extends { id: string }>(key: CollectionKey, item: T) => {
      const current = loadData();
      const next = createItem(current, key, item);
      setData(next);
      return next;
    },
    [],
  );

  const update = useCallback(
    <T extends { id: string }>(key: CollectionKey, item: T) => {
      const current = loadData();
      const next = updateItem(current, key, item);
      setData(next);
      return next;
    },
    [],
  );

  const remove = useCallback((key: CollectionKey, id: string) => {
    const current = loadData();
    const next = deleteItem(current, key, id);
    setData(next);
    return next;
  }, []);

  const reset = useCallback(() => {
    const next = resetData();
    setData(next);
    return next;
  }, []);

  const value = useMemo(
    () => ({ data, ready, create, update, remove, reset, refresh }),
    [data, ready, create, update, remove, reset, refresh],
  );

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return ctx;
}
