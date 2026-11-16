// Side-by-side comparison of load cases: main particulars, stability values and every criterion.
// Pure functions (no UI), so the numbers can be tested and exported to CSV.
import type { LoadCase, Results } from '../engine/types';

export interface CompareCase { lc: LoadCase; r: Results | null; error: string | null }

export interface ValueRow {
  key: string;
  label: string;
  unit: string;
  dp: number;
  section: 'Weight and drafts' | 'Stability' | 'GZ curve';
  values: (number | null)[];
  /** text instead of the number (e.g. "0.27 A" for trim) */
  text?: (string | null)[];
  /** which direction is safer, for highlighting the weakest case */
  better?: 'high' | 'low';
}

export interface CritRow {
  group: string;
  groupName: string;
  code: string;
  description: string;
  unit: string;
  comparator: '>=' | '<=';
  required: (number | null)[];
  actual: (number | null)[];
  passed: (boolean | null)[];
  marginPct: (number | null)[];
}

const val = (cs: CompareCase[], fn: (r: Results) => number | null) => cs.map((c) => (c.r ? fn(c.r) : null));

export function valueRows(cs: CompareCase[]): ValueRow[] {
  const trimText = cs.map((c) => (c.r ? `${Math.abs(c.r.trim).toFixed(3)} ${c.r.trim >= 0 ? 'A' : 'F'}` : null));
  const heelText = cs.map((c) => (c.r ? `${Math.abs(c.r.heel).toFixed(2)} ${c.r.heel > 0.005 ? 'S' : c.r.heel < -0.005 ? 'P' : ''}`.trim() : null));
  return [
    { key: 'disp', label: 'Displacement', unit: 't', dp: 1, section: 'Weight and drafts', values: val(cs, (r) => r.displacement) },
    { key: 'dwt', label: 'Deadweight', unit: 't', dp: 1, section: 'Weight and drafts', values: val(cs, (r) => r.deadweight) },
    { key: 'dap', label: 'Draft AP', unit: 'm', dp: 3, section: 'Weight and drafts', values: val(cs, (r) => r.draftAP) },
    { key: 'dms', label: 'Draft midship', unit: 'm', dp: 3, section: 'Weight and drafts', values: val(cs, (r) => r.draftMS) },
    { key: 'dfp', label: 'Draft FP', unit: 'm', dp: 3, section: 'Weight and drafts', values: val(cs, (r) => r.draftFP) },
    { key: 'dmean', label: 'Draft mean (AP+FP)/2', unit: 'm', dp: 3, section: 'Weight and drafts', values: val(cs, (r) => (r.draftAP + r.draftFP) / 2) },
    { key: 'trim', label: 'Trim (A = by stern)', unit: 'm', dp: 3, section: 'Weight and drafts', values: val(cs, (r) => r.trim), text: trimText },
    { key: 'heel', label: 'Heel (S / P)', unit: '°', dp: 2, section: 'Weight and drafts', values: val(cs, (r) => r.heel), text: heelText },
    { key: 'kg', label: 'KG (solid)', unit: 'm', dp: 3, section: 'Stability', values: val(cs, (r) => r.kg) },
    { key: 'fsm', label: 'Σ FSM', unit: 't·m', dp: 1, section: 'Stability', values: val(cs, (r) => r.sumFsm) },
    { key: 'fsc', label: 'FS correction', unit: 'm', dp: 3, section: 'Stability', values: val(cs, (r) => r.fsc) },
    { key: 'kgf', label: 'KG fluid', unit: 'm', dp: 3, section: 'Stability', values: val(cs, (r) => r.kgFluid) },
    { key: 'km', label: 'KM', unit: 'm', dp: 3, section: 'Stability', values: val(cs, (r) => r.kmt) },
    { key: 'gm', label: 'GM fluid', unit: 'm', dp: 3, section: 'Stability', values: val(cs, (r) => r.gmFluid), better: 'high' },
    { key: 'gzmax', label: 'GZ max', unit: 'm', dp: 3, section: 'GZ curve', values: val(cs, (r) => r.gzMax), better: 'high' },
    { key: 'gzang', label: 'Angle of GZ max', unit: '°', dp: 1, section: 'GZ curve', values: val(cs, (r) => r.gzMaxAngle), better: 'high' },
    { key: 'range', label: 'Range of positive stability', unit: '°', dp: 1, section: 'GZ curve', values: val(cs, (r) => (r.avs === null ? null : r.avs - Math.abs(r.heel))), better: 'high' },
    { key: 'flood', label: 'Down-flooding angle', unit: '°', dp: 1, section: 'GZ curve', values: val(cs, (r) => r.floodAngle), better: 'high' },
    { key: 'deck', label: 'Deck edge immersion angle', unit: '°', dp: 1, section: 'GZ curve', values: val(cs, (r) => r.deckEdgeAngle), better: 'high' },
  ];
}

/** Index of the weakest case of a row (lowest where higher is better), or −1. */
export function weakest(row: ValueRow): number {
  if (!row.better) return -1;
  let k = -1;
  row.values.forEach((v, i) => {
    if (v === null) return;
    if (k < 0 || (row.better === 'high' ? v < (row.values[k] as number) : v > (row.values[k] as number))) k = i;
  });
  return row.values.filter((v) => v !== null).length > 1 ? k : -1;
}

/** Every criterion of every stability group checked in at least one of the cases, in group order. */
export function critRows(cs: CompareCase[]): CritRow[] {
  const out: CritRow[] = [];
  const key = (g: string, c: string) => `${g}|${c}`;
  const seen = new Map<string, CritRow>();
  cs.forEach((c, i) => {
    for (const g of c.r?.groups ?? []) {
      for (const cr of g.criteria) {
        let row = seen.get(key(g.id, cr.code));
        if (!row) {
          row = {
            group: g.id, groupName: g.name, code: cr.code, description: cr.description, unit: cr.unit, comparator: cr.comparator,
            required: cs.map(() => null), actual: cs.map(() => null), passed: cs.map(() => null), marginPct: cs.map(() => null),
          };
          seen.set(key(g.id, cr.code), row);
          out.push(row);
        }
        row.required[i] = cr.required; row.actual[i] = cr.actual; row.passed[i] = cr.passed; row.marginPct[i] = cr.marginPct;
      }
    }
  });
  // keep the rows of one group together (groups appear in the order first met)
  const order = [...new Set(out.map((r) => r.group))];
  return order.flatMap((g) => out.filter((r) => r.group === g));
}

const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export function compareCsv(vesselName: string, cs: CompareCase[]): string {
  const lines: string[] = [];
  lines.push(`# Load case comparison · ${vesselName}`);
  lines.push(['Quantity', 'Unit', ...cs.map((c) => c.lc.name)].map(q).join(','));
  for (const r of valueRows(cs)) lines.push([r.label, r.unit, ...r.values.map((v) => (v === null ? '' : v.toFixed(r.dp)))].map(q).join(','));
  lines.push('');
  lines.push(['Stability group', 'Criterion', 'Unit', 'Required', ...cs.flatMap((c) => [`${c.lc.name}: actual`, `${c.lc.name}: required`, `${c.lc.name}: result`])].map(q).join(','));
  for (const r of critRows(cs)) {
    const req = r.required.find((x) => x !== null);
    lines.push([r.groupName, r.description, r.unit, req === undefined || req === null ? '' : `${r.comparator === '>=' ? '>=' : '<='} ${req}`,
      ...r.actual.flatMap((a, i) => [a === null ? '' : String(Number(a.toFixed(4))), r.required[i] === null ? '' : String(Number(r.required[i]!.toFixed(4))), r.passed[i] === null ? 'not checked' : r.passed[i] ? 'PASS' : 'FAIL'])].map(q).join(','));
  }
  lines.push('');
  lines.push(['Overall result', '', '', '', ...cs.flatMap((c) => ['', '', c.r ? (c.r.overallPass ? 'PASS' : 'FAIL') : `cannot calculate: ${c.error ?? ''}`])].map(q).join(','));
  return lines.join('\n');
}
