// KML in the hydrostatic tables; tank tables that give FSM (t·m) at a stated SG instead of i_T.
import { describe, expect, it } from 'vitest';
import type { Conversion, ConvCell } from '../src/importer/convert';
import { autoMapping } from '../src/importer/convert';
import { datasetDef } from '../src/importer/datasets';
import { applyToVessel, compareRows, expectedRows, fsmBasisCheck, storedRows } from '../src/importer/apply';
import { calculate } from '../src/engine/stability';
import { VESSELS } from '../src/data/vessels';

const marsol = VESSELS[0].vessel;
const cell = (v: number): ConvCell => ({ raw: String(v), value: v, read: v, status: 'ok' });
const conv = (rows: Record<string, number>[]): Conversion => ({
  rows: rows.map((r, i) => ({ src: i, cells: Object.fromEntries(Object.entries(r).map(([k, v]) => [k, cell(v)])) })),
  skipped: [], stats: { rowsInRange: rows.length, cellsRead: 0, cellsOk: 0, cellsError: 0, digitChecks: 0, digitFailures: 0, positionsConverted: 0 },
});

describe('KML', () => {
  it('a KML column is recognised and not taken for KMT', () => {
    const rows = [['Draft', 'Disp', 'LCB', 'LCF', 'KMT', 'KML', 'TPC', 'MTC'], ['1.0', '500', '28', '27', '9.1', '120.5', '6.1', '30.2'], ['1.2', '600', '28', '27', '8.6', '110.2', '6.2', '31.0']];
    const m = autoMapping(datasetDef('HYDRO'), rows, '.', 57.4);
    expect(m.cols.kmt).toBe(4);
    expect(m.cols.kml).toBe(5);
  });
  it('is stored with the hydrostatics, read back, and shown in the results', () => {
    const c = conv(marsol.hydro.rows.map((h, i) => ({ draft: h.draft, displacement: h.displacement, lcb: h.lcb, lcf: h.lcf, kmt: h.kmt, tpc: h.tpc, mtc: h.mtc, kml: 100 + i })));
    const o = { trim: 0 };
    const v = applyToVessel('HYDRO', { ...marsol, hydro: { ...marsol.hydro, trims: undefined } }, c, o);
    expect(v.hydro.rows[3].kml).toBe(103);
    expect(compareRows(expectedRows('HYDRO', c, o), storedRows('HYDRO', v, o), true).ok).toBe(true);
  });
  it('MARSOL booklet KML is carried into the calculation result (information only)', () => {
    const r = calculate(marsol, VESSELS[0].defaultLoadCases[0]);
    expect(typeof r.kml).toBe('number');
  });
});

describe('tank table with FSM (t·m) instead of i_T', () => {
  const rows = [{ volume: 0, lcg: 10, tcg: 0, vcg: 0.5, fsm: 0 }, { volume: 10, lcg: 10, tcg: 0, vcg: 0.8, fsm: 41 }, { volume: 20, lcg: 10, tcg: 0, vcg: 1.2, fsm: 41 }];
  const tank = { name: 'NO1 FO', group: 'FUEL_OIL', density: 0.85, isConsumable: true };
  it('default: FSM is taken at the tank liquid density', () => {
    const v = applyToVessel('TANK', marsol, conv(rows), { trim: 0, tank });
    expect(v.tanks.find((t) => t.name === 'NO1 FO')!.calibration[1].inertia).toBeCloseTo(41 / 0.85, 9);
    expect(fsmBasisCheck(conv(rows), 0.85, undefined)!.title).toMatch(/SG 0.85 \(the tank liquid density\)/);
  });
  it('FSM given at SG 1.025 (booklet basis) → i_T = FSM / 1.025, not / tank density', () => {
    const o = { trim: 0, tank: { ...tank, fsmDensity: 1.025 } };
    const v = applyToVessel('TANK', marsol, conv(rows), o);
    expect(v.tanks.find((t) => t.name === 'NO1 FO')!.calibration[1].inertia).toBeCloseTo(40, 9);
    expect(compareRows(expectedRows('TANK', conv(rows), o), storedRows('TANK', v, o), false).ok).toBe(true);
    expect(fsmBasisCheck(conv(rows), 0.85, 1.025)!.detail).toMatch(/0.85/);
  });
  it('no message when the table gives i_T', () => {
    expect(fsmBasisCheck(conv(rows.map(({ fsm, ...r }) => ({ ...r, inertia: fsm }))), 0.85, undefined)).toBeNull();
  });
});
