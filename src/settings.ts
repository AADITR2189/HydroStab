// User settings of this computer: name and company (pre-filled in imports, edits and reports),
// defaults for new load cases, the tank fill warning and display options.
// Stored in the app's local database (not in the database file: they belong to the computer / user).
import { useEffect, useState } from 'react';
import * as storage from './storage';
import type { FsmMethod } from './engine/types';
import type { GzRange } from './engine/opLimits';

export interface AppSettings {
  userName: string;
  company: string;
  /** new load cases */
  seaDensity: number;
  fsmMethod: FsmMethod;
  /** stability groups ticked in a new load case when the vessel has no own default (empty = IS 2008 general + weather) */
  groups: string[];
  gzRange: GzRange | null;
  /** tanks filled between this % and 100 % give a warning */
  overfillWarnPct: number;
  /** turn animations off in this app (in addition to the computer's own setting) */
  reduceMotion: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  userName: '', company: '', seaDensity: 1.025, fsmMethod: 'ACTUAL', groups: [], gzRange: null, overfillWarnPct: 98, reduceMotion: false,
};

const listeners = new Set<(s: AppSettings) => void>();

export function getSettings(): AppSettings {
  const s = storage.get<Partial<AppSettings>>(storage.META.settings);
  return { ...DEFAULT_SETTINGS, ...(s && typeof s === 'object' ? s : {}) };
}

/** Check a value before it is saved; returns the problem or null. */
export function settingProblem<K extends keyof AppSettings>(k: K, v: AppSettings[K]): string | null {
  if (k === 'seaDensity' && !(typeof v === 'number' && v >= 0.98 && v <= 1.1)) return 'Sea water density must be between 0.980 and 1.100 t/m³.';
  if (k === 'overfillWarnPct' && !(typeof v === 'number' && v >= 80 && v < 100)) return 'The fill warning must be between 80 % and 99.9 %.';
  if (k === 'gzRange' && v) {
    const r = v as GzRange;
    if (!(r.from >= 0 && r.to > r.from && r.to <= 180 && r.step >= 0.1)) return 'GZ range: from ≥ 0°, to greater than from (at most 180°), step at least 0.1°.';
  }
  return null;
}

export function setSetting<K extends keyof AppSettings>(k: K, v: AppSettings[K]): void {
  const next = { ...getSettings(), [k]: v };
  storage.set(storage.META.settings, next, { userData: false });
  applyMotion(next.reduceMotion);
  listeners.forEach((l) => l(next));
}

export function resetSettings(): void {
  storage.set(storage.META.settings, { ...DEFAULT_SETTINGS }, { userData: false });
  applyMotion(false);
  listeners.forEach((l) => l({ ...DEFAULT_SETTINGS }));
}

export function applyMotion(reduce: boolean): void {
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('reduce-motion', reduce);
}

export function useSettings(): AppSettings {
  const [s, setS] = useState(getSettings);
  useEffect(() => { listeners.add(setS); return () => { listeners.delete(setS); }; }, []);
  return s;
}
