// Load case comparison: values, weakest case, criteria across cases, CSV.
import { describe, expect, it } from 'vitest';
import { calculate } from '../src/engine/stability';
import { compareCsv, critRows, valueRows, weakest, type CompareCase } from '../src/report/compare';
import { VESSELS } from '../src/data/vessels';
import { parseCsv } from '../src/importer/csv';

const m = VESSELS[0];
const cs: CompareCase[] = m.defaultLoadCases.slice(0, 4).map((lc) => ({ lc, r: calculate(m.vessel, lc), error: null }));

describe('compare load cases', () => {
  it('each row holds the value of every case, as calculated', () => {
    const rows = valueRows(cs);
    const gm = rows.find((r) => r.key === 'gm')!;
    expect(gm.values).toEqual(cs.map((c) => c.r!.gmFluid));
    expect(rows.find((r) => r.key === 'disp')!.values).toEqual(cs.map((c) => c.r!.displacement));
  });
  it('marks the weakest case (lowest GM)', () => {
    const gm = valueRows(cs).find((r) => r.key === 'gm')!;
    const lowest = cs.map((c) => c.r!.gmFluid).indexOf(Math.min(...cs.map((c) => c.r!.gmFluid)));
    expect(weakest(gm)).toBe(lowest);
    expect(weakest(valueRows(cs).find((r) => r.key === 'disp')!)).toBe(-1); // no "better" direction
  });
  it('criteria: one row per group criterion, null where the group is not checked in a case', () => {
    const rows = critRows(cs);
    for (const [i, c] of cs.entries()) {
      for (const g of c.r!.groups) for (const cr of g.criteria) {
        const row = rows.find((r) => r.group === g.id && r.code === cr.code)!;
        expect(row.actual[i]).toBe(cr.actual);
        expect(row.passed[i]).toBe(cr.passed);
      }
    }
    const notIn = rows.find((r) => r.actual.some((a) => a === null));
    if (notIn) expect(notIn.passed[notIn.actual.indexOf(null)]).toBeNull();
    // rows of one group stay together
    const groups = rows.map((r) => r.group);
    expect(groups.filter((g, k) => k > 0 && g !== groups[k - 1]).length).toBe(new Set(groups).size - 1);
  });
  it('a case that cannot be calculated shows empty values and the message in the CSV', () => {
    const bad: CompareCase[] = [cs[0], { lc: cs[1].lc, r: null, error: 'no equilibrium' }];
    expect(valueRows(bad).find((r) => r.key === 'gm')!.values[1]).toBeNull();
    expect(compareCsv('MARSOL', bad)).toMatch(/cannot calculate: no equilibrium/);
  });
  it('CSV has a column per case and one line per quantity and criterion', () => {
    const csv = compareCsv('MARSOL', cs).split('\n');
    const table = parseCsv(compareCsv('MARSOL', cs));
    const header = table.find((r) => r[0] === 'Quantity')!;
    expect(header.length).toBe(2 + cs.length);
    expect(header.slice(2)).toEqual(cs.map((c) => c.lc.name)); // names with commas stay whole
    expect(csv.some((l) => l.startsWith('GM fluid,m,'))).toBe(true);
    expect(csv.filter((l) => /,(PASS|FAIL|not checked)/.test(l)).length).toBeGreaterThanOrEqual(critRows(cs).length);
  });
});
