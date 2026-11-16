// Maximum FSM: per-tank tick in the load case, and a maximum entered on import (between table rows).
import { describe, expect, it } from 'vitest';
import { resolveTank } from '../src/engine/tanks';
import type { Tank } from '../src/engine/types';
import type { Conversion, ConvCell } from '../src/importer/convert';
import { applyToVessel, maxFsmCheck } from '../src/importer/apply';
import { calculate } from '../src/engine/stability';
import { VESSELS } from '../src/data/vessels';

const tank: Tank = {
  id: 'FO1', name: 'FO1', group: 'FUEL_OIL', capacity: 20, density: 0.85, isConsumable: true,
  calibration: [
    { volume: 0, lcg: 10, tcg: 0, vcg: 0.2, inertia: 0 },
    { volume: 10, lcg: 10, tcg: 0, vcg: 0.8, inertia: 40 },
    { volume: 20, lcg: 10, tcg: 0, vcg: 1.4, inertia: 30 },
  ],
};

describe('max FSM per tank', () => {
  it('not ticked: FSM at the actual filling', () => {
    expect(resolveTank(tank, { input: { mode: 'VOLUME', value: 15 } }, 'ACTUAL', []).fsm).toBeCloseTo(35 * 0.85, 9);
  });
  it('ticked: maximum of the table, at any filling (also full and empty)', () => {
    for (const value of [0, 5, 15, 20]) {
      const r = resolveTank(tank, { input: { mode: 'VOLUME', value }, maxFsm: true }, 'ACTUAL', []);
      expect(r.fsm).toBeCloseTo(40 * 0.85, 9);
      expect(r.fsmMax).toBe(true);
    }
  });
  it('a maximum entered for the tank (between two rows) is used, at the density in the tank', () => {
    const t2 = { ...tank, maxInertia: 44 };
    expect(resolveTank(t2, { input: { mode: 'VOLUME', value: 5 }, maxFsm: true, density: 0.9 }, 'ACTUAL', []).fsm).toBeCloseTo(44 * 0.9, 9);
    expect(resolveTank(t2, { input: { mode: 'VOLUME', value: 5 } }, 'MAXIMUM', []).fsm).toBeCloseTo(44 * 0.85, 9);
  });
  it('an entered maximum below the table maximum does not lower it', () => {
    expect(resolveTank({ ...tank, maxInertia: 20 }, { input: { mode: 'VOLUME', value: 5 }, maxFsm: true }, 'ACTUAL', []).fsm).toBeCloseTo(40 * 0.85, 9);
  });
  it('total FSM entered manually: the tick is not used', () => {
    expect(resolveTank(tank, { input: { mode: 'VOLUME', value: 5 }, maxFsm: true }, 'MANUAL_TOTAL', []).fsm).toBe(0);
  });
  it('in a whole load case, ticking raises ΣFSM and KG fluid', () => {
    const m = VESSELS[0];
    const lc = { ...m.defaultLoadCases[0], fsmMethod: 'ACTUAL' as const };
    const t = m.vessel.tanks.find((x) => x.calibration.some((c) => c.inertia > 0))!;
    const a = calculate(m.vessel, { ...lc, tanks: { ...lc.tanks, [t.id]: { input: { mode: 'PERCENT', value: 0 } } } });
    const b = calculate(m.vessel, { ...lc, tanks: { ...lc.tanks, [t.id]: { input: { mode: 'PERCENT', value: 0 }, maxFsm: true } } });
    expect(b.sumFsm).toBeGreaterThan(a.sumFsm);
    expect(b.kgFluid).toBeGreaterThan(a.kgFluid);
  });
});

describe('max FSM entered on import', () => {
  const cell = (v: number): ConvCell => ({ raw: String(v), value: v, read: v, status: 'ok' });
  const conv: Conversion = {
    rows: [[0, 0], [10, 34], [20, 25.5]].map(([volume, fsm], i) => ({ src: i, cells: { volume: cell(volume), lcg: cell(10), tcg: cell(0), vcg: cell(1), fsm: cell(fsm) } })),
    skipped: [], stats: { rowsInRange: 3, cellsRead: 0, cellsOk: 0, cellsError: 0, digitChecks: 0, digitFailures: 0, positionsConverted: 0 },
  };
  const o = (maxFsm?: number) => ({ trim: 0, tank: { name: 'FO9', group: 'FUEL_OIL', density: 0.85, isConsumable: true, maxFsm } });
  it('is stored as i_T = max FSM / SG and kept on re-import without a value', () => {
    const v = applyToVessel('TANK', VESSELS[0].vessel, conv, o(37.4));
    expect(v.tanks.find((t) => t.name === 'FO9')!.maxInertia).toBeCloseTo(44, 9);
    const v2 = applyToVessel('TANK', v, conv, o());
    expect(v2.tanks.find((t) => t.name === 'FO9')!.maxInertia).toBeCloseTo(44, 9);
    expect(maxFsmCheck(conv, o(37.4))!.level).toBe('ok');
  });
  it('a value below the table maximum is flagged', () => {
    expect(maxFsmCheck(conv, o(30))!.level).toBe('warn');
    expect(maxFsmCheck(conv, o())).toBeNull();
  });
});
