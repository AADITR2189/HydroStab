// One consistent line-icon set (24×24 grid, stroked with the text colour) instead of emoji and text symbols,
// which look different on every computer.
const P: Record<string, string> = {
  dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  ship: 'M3 15l2 5h14l2-5H3zM6 15V9h12v6M9 9V5h6v4M12 2v3',
  import: 'M12 3v12M7 10l5 5 5-5M4 17v3h16v-3',
  table: 'M4 4h16v16H4zM4 9h16M4 14h16M10 4v16',
  loadcase: 'M8 4h8v3H8zM6 5H5v16h14V5h-1M8 11h8M8 15h8M8 19h5',
  results: 'M3 20h18M5 20c2-9 5-13 9-13 3 0 5 3 6 6M14 7v13',
  library: 'M4 5h5v15H4zM10 5h5v15h-5zM16 6l3.5-1 2.5 14.5-3.5 1z',
  report: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7M9 9h3',
  anchor: 'M12 8v13M8 12H5a7 7 0 0014 0h-3M12 8a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM9 21h6',
  sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z',
  monitor: 'M3 4h18v12H3zM8 20h8M12 16v4',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3',
  download: 'M12 3v12M7 10l5 5 5-5M4 20h16',
  upload: 'M12 15V3M7 8l5-5 5 5M4 20h16',
  alert: 'M12 3l10 18H2zM12 10v5M12 18v.01',
  info: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 11v6M12 7v.01',
  check: 'M4 12l5 5L20 6',
  close: 'M6 6l12 12M18 6L6 18',
  keyboard: 'M2 6h20v12H2zM6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10',
  save: 'M5 3h11l3 3v15H5zM8 3v5h7V3M8 14h8v7H8z',
  plus: 'M12 5v14M5 12h14',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  compare: 'M4 4h6v16H4zM14 4h6v16h-6zM7 8v.01M17 12v.01M7 14h0M4 12h6M14 16h6',
};

export type IconName = keyof typeof P;

export function Icon({ name, title, className }: { name: IconName; title?: string; className?: string }) {
  return (
    <svg className={`icon-svg${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <path d={P[name]} />
    </svg>
  );
}
