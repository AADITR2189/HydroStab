// Light / dark / follow-the-computer theme. Stored per device (a display preference, not vessel data).
export type ThemeChoice = 'system' | 'light' | 'dark';
const KEY = 'stabilitysoft.theme';

export function getTheme(): ThemeChoice {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'system'; } catch { return 'system'; }
}

export function applyTheme(t: ThemeChoice, animate = false): void {
  const root = document.documentElement;
  if (animate && !reducedMotion()) {
    root.classList.add('theme-anim');
    window.setTimeout(() => root.classList.remove('theme-anim'), 380);
  }
  if (t === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
  try { if (t === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, t); } catch { /* private window */ }
  window.dispatchEvent(new CustomEvent('stabilitysoft-theme', { detail: t }));
}

/** Background colour of chart images: the panel colour of the current theme. */
export function surfaceColour(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#ffffff';
}

export const reducedMotion = () => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) || (typeof document !== 'undefined' && document.documentElement.classList.contains('reduce-motion'));
