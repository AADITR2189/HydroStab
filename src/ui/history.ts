// Undo / redo for everything the user changes: load cases, own vessels and the criteria library.
// Before each change a snapshot of the data is kept (up to 60). Quick repeated edits of the same kind
// (typing in a field) are merged into one step, so one Undo restores the value before the typing.
import { useCallback, useRef, useState } from 'react';

export interface Snapshot<T> { data: T; label: string; at: number }

const LIMIT = 60;
const MERGE_MS = 1500;

export function useHistory<T>(current: () => T, restore: (data: T) => void) {
  const past = useRef<Snapshot<T>[]>([]);
  const future = useRef<Snapshot<T>[]>([]);
  const [, bump] = useState(0);
  const refresh = () => bump((x) => x + 1);

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
