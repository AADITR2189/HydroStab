// Undo / redo for everything the user changes: load cases, own vessels and the criteria library.
// Before each change a snapshot of the data is kept (up to 60). Quick repeated edits of the same kind
// (typing in a field) are merged into one step, so one Undo restores the value before the typing.
// The last steps are also kept in the app's local database, so Undo still works after a reload.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as storage from '../storage';

export interface Snapshot<T> { data: T; label: string; at: number }

const LIMIT = 60;
const MERGE_MS = 1500;
/** steps kept after a reload (each step holds a copy of the data) */
export const PERSIST_LIMIT = 20;
const SAVE_DELAY_MS = 1500;
const CLEAR_EVENT = 'stabilitysoft-history-clear';

interface Kept<T> { past: Snapshot<T>[]; future: Snapshot<T>[] }
function loadKept<T>(): Kept<T> {
  const k = storage.get<Kept<T>>(storage.META.history);
  return k && Array.isArray(k.past) && Array.isArray(k.future) ? k : { past: [], future: [] };
}
/** number of undo steps kept on this computer */
export function keptSteps(): number { const k = loadKept(); return k.past.length + k.future.length; }
/** forget the undo history (also in an open app window) */
export function clearHistory(): void {
  storage.set(storage.META.history, { past: [], future: [] }, { userData: false });
  window.dispatchEvent(new Event(CLEAR_EVENT));
}

export function useHistory<T>(current: () => T, restore: (data: T) => void) {
  const kept = useRef<Kept<T> | null>(null);
  if (kept.current === null) kept.current = loadKept<T>();
  const past = useRef<Snapshot<T>[]>(kept.current.past);
  const future = useRef<Snapshot<T>[]>(kept.current.future);
  const [, bump] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  /** re-render, and save the last steps a moment later (one write for a burst of changes) */
  const refresh = () => {
    bump((x) => x + 1);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      storage.set(storage.META.history, { past: past.current.slice(-PERSIST_LIMIT), future: future.current.slice(-PERSIST_LIMIT) }, { userData: false });
    }, SAVE_DELAY_MS);
  };
  useEffect(() => {
    const on = () => { past.current = []; future.current = []; bump((x) => x + 1); };
    window.addEventListener(CLEAR_EVENT, on);
    // write a pending save before the window closes
    const flush = () => { if (timer.current !== undefined) { window.clearTimeout(timer.current); storage.set(storage.META.history, { past: past.current.slice(-PERSIST_LIMIT), future: future.current.slice(-PERSIST_LIMIT) }, { userData: false }); void storage.flush(); } };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener(CLEAR_EVENT, on); window.removeEventListener('pagehide', flush); };
  }, []);

  /** Call just before a change. */
  const record = useCallback((label: string) => {
    const last = past.current[past.current.length - 1];
    const now = Date.now();
    future.current = [];
    if (last && last.label === label && now - last.at < MERGE_MS) { last.at = now; refresh(); return; }
    past.current.push({ data: structuredClone(current()), label, at: now });
    if (past.current.length > LIMIT) past.current.shift();
    refresh();
  }, [current]);

  const undo = useCallback((): string | null => {
    const s = past.current.pop();
    if (!s) return null;
    future.current.push({ data: structuredClone(current()), label: s.label, at: Date.now() });
    restore(s.data);
    refresh();
    return s.label;
  }, [current, restore]);

  const redo = useCallback((): string | null => {
    const s = future.current.pop();
    if (!s) return null;
    past.current.push({ data: structuredClone(current()), label: s.label, at: 0 });
    restore(s.data);
    refresh();
    return s.label;
  }, [current, restore]);

  return {
    record, undo, redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    undoLabel: past.current[past.current.length - 1]?.label ?? null,
    redoLabel: future.current[future.current.length - 1]?.label ?? null,
  };
}
