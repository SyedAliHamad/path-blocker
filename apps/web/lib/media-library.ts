'use client';

import { useCallback, useEffect, useState } from 'react';
import { emptyLibrary, parseLibrary, type MediaLibrary } from '@pb/moments';

const STORAGE_KEY = 'path-blocker.media-library.v1';

/**
 * Where the media library lives, for now.
 *
 * The library is only URLs and settings — a few kilobytes of JSON — so it sits
 * in `localStorage` and needs no backend at all. That does mean it is per
 * browser: the export and import buttons in the admin panel are how a library
 * moves between machines, and when the game server arrives this is the one
 * module that has to change.
 */
export function loadLibrary(): MediaLibrary {
  if (typeof window === 'undefined') return emptyLibrary();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyLibrary();
    return parseLibrary(JSON.parse(raw));
  } catch {
    // Private windows, cleared site data, or a half-written value: a broken
    // library should cost you your memes, not the game.
    return emptyLibrary();
  }
}

/** True when this browser has ever had a library saved. */
export function hasStoredLibrary(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function saveLibrary(library: MediaLibrary): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  } catch {
    // Out of quota or blocked: nothing useful to do, and the session keeps
    // working with the in-memory copy.
  }
}

export interface UseLibraryResult {
  library: MediaLibrary;
  /** True once the stored library has been read, so the UI can wait for it. */
  ready: boolean;
  update: (next: MediaLibrary) => void;
  replace: (next: MediaLibrary) => void;
}

/**
 * Read the library into React.
 *
 * It deliberately starts from `emptyLibrary()` rather than from storage: the
 * server has no `localStorage`, so reading during render would make the first
 * client paint disagree with the server's HTML. The stored copy arrives in an
 * effect instead.
 */
export function useLibrary(): UseLibraryResult {
  const [library, setLibrary] = useState<MediaLibrary>(emptyLibrary);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (hasStoredLibrary()) {
      setLibrary(loadLibrary());
      setReady(true);
    } else {
      // Nothing saved in this browser yet. The library used to start empty,
      // which meant a brand-new browser played nothing at all and looked
      // broken — so seed it from the bundled starter set on first visit.
      // A library the user has deliberately emptied is left alone, because
      // the key exists by then.
      void fetch('/starter-library.json')
        .then((response) => (response.ok ? response.json() : null))
        .then((json) => {
          if (cancelled) return;
          if (json) {
            const seeded = parseLibrary(json);
            setLibrary(seeded);
            saveLibrary(seeded);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setReady(true);
        });
    }

    // Keep a game tab in step with edits made in the admin tab.
    const onStorage = (event: StorageEvent): void => {
      if (event.key === STORAGE_KEY) setLibrary(loadLibrary());
    };
    window.addEventListener('storage', onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const update = useCallback((next: MediaLibrary) => {
    setLibrary(next);
    saveLibrary(next);
  }, []);

  return { library, ready, update, replace: update };
}

/** Ids for new categories and assets; the library is plain data otherwise. */
export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
