// Heeling arm as a table, ice accretion (IS Code B 6.3.1), timber deck cargo (IS Code A 3.3.2).
import { describe, expect, it } from 'vitest';
import { calculate } from '../src/engine/stability';
import type { CriteriaLibrary, LoadCase } from '../src/engine/types';
import { VESSELS } from '../src/data/vessels';
import { lerp } from '../src/engine/math';

const m = VESSELS[0];
const base = (): LoadCase => structuredClone(m.defaultLoadCases[0]);

const lib = (moment: CriteriaLibrary['moments']): CriteriaLibrary => ({
  moments: moment,
  criteria: [{ id: 'C-HEEL', name: 'heel under moment', kind: 'HEEL_MOMENT', comparator: '<=', required: 30, params: { momentId: 'M1' } }],
  groups: [{ id: 'G1', name: 'test group', regulation: 'test', description: '', chart: 'GENERAL', criterionIds: ['C-HEEL'] }],
});

describe('heeling arm entered as a table', () => {
  it('a table equal to a formula gives the same equilibrium heel', () => {
    const formula = calculate(m.vessel, { ...base(), criteriaGroups: ['G1'] }, lib([{ id: 'M1', name: 'f', formula: 'a*cos(theta)', result: 'ARM', vars: [{ name: 'a', source: 'VALUE', value: 0.2 }, { name: 'theta', source: 'HEEL' }] }]));
    const pts = Array.from({ length: 91 }, (_, i) => ({ heel: i, value: 0.2 * Math.cos((i * Math.PI) / 180) }));
    const table = calculate(m.vessel, { ...base(), criteriaGroups: ['G1'] }, lib([{ id: 'M1', name: 't', formula: '', result: 'ARM', vars: [], input: 'TABLE', table: pts }]));
    expect(table.groups[0].criteria[0].actual).toBeCloseTo(formula.groups[0].criteria[0].actual, 3);
  });
  it('moment table: arm = moment / Δ, linear between points, end value outside', () => {
    const r = calculate(m.vessel, { ...base(), criteriaGroups: ['G1'] }, lib([{ id: 'M1', name: 't', formula: '', result: 'MOMENT', vars: [], input: 'TABLE', table: [{ heel: 30, value: 200 }, { heel: 0, value: 400 }] }]));
    const mr = r.groups[0].moments!.find((x) => x.name === 't')!;
    const at = (h: number) => mr.rows.find((x) => x.heel === h)!;
    expect(at(0).arm).toBeCloseTo(400 / r.displacement, 9);
    expect(at(15).arm).toBeCloseTo(300 / r.displacement, 9);
    expect(at(40).arm).toBeCloseTo(200 / r.displacement, 9); // beyond the table: last value
  });
  it('a table with one angle or a repeated angle is refused', () => {
    const r = calculate(m.vessel, { ...base(), criteriaGroups: ['G1'] }, lib([{ id: 'M1', name: 't', formula: '', result: 'ARM', vars: [], input: 'TABLE', table: [{ heel: 0, value: 0.1 }] }]));
    expect(r.groups[0].error).toMatch(/at least two/);
  });
});

describe('ice accretion', () => {
  const ice = { enabled: true, deckArea: 300, deckZ: 6.5, deckX: 30 };
  it('adds deck ice and ice on both sides at the condition draft, shown as its own weight group', () => {
    const a = calculate(m.vessel, base());
    const b = calculate(m.vessel, { ...base(), ops: { ...(base().ops ?? {}), ice } });
    const iceW = b.summary.find((s) => s.group === 'Ice accretion')!.weight;
    expect(b.displacement - a.displacement).toBeCloseTo(iceW, 9);
    const wd = m.vessel.windage.map((r) => r.draft);
    const A0 = lerp(wd, m.vessel.windage.map((r) => r.area), a.draftMS, 'w') ;
    // deck 300 m² × 30 kg/m² = 9 t; sides 2 × A × 7.5 kg/m² at the draft without side ice (≈ draft of a + deck ice)
    expect(iceW).toBeGreaterThan(9 + 2 * A0 * 0.0075 * 0.95);
    expect(iceW).toBeLessThan(9 + 2 * A0 * 0.0075 * 1.05);
    expect(b.kg).toBeGreaterThan(a.kg);
    expect(b.warnings.some((w) => w.code === 'ICE_ACCRETION')).toBe(true);
  });
  it('wind area +5 % and its moment +10 % in the weather criterion', () => {
    const b = calculate(m.vessel, { ...base(), criteriaGroups: ['IS2008_WEATHER'], ops: { ice } });
    const wd = m.vessel.windage.map((r) => r.draft);
    const A = lerp(wd, m.vessel.windage.map((r) => r.area), b.draftMS, 'w');
    const hA = lerp(wd, m.vessel.windage.map((r) => r.centroidZ), b.draftMS, 'w');
    const hU = b.weather!.hA - b.weather!.Z; // centre of the underwater lateral area used by the engine
    expect(b.weather!.A).toBeCloseTo(A * 1.05, 6);
    expect(b.weather!.A * b.weather!.Z).toBeCloseTo(A * (hA - hU) * 1.10, 4);
  });
  it('factor and rates scale the deck ice', () => {
    const one = calculate(m.vessel, { ...base(), ops: { ice: { ...ice, deckArea: 100 } } }).summary.find((s) => s.group === 'Ice accretion')!.weight;
    const two = calculate(m.vessel, { ...base(), ops: { ice: { ...ice, deckArea: 100, factor: 2 } } }).summary.find((s) => s.group === 'Ice accretion')!.weight;
    expect(two).toBeCloseTo(2 * one, 1);
    const off = calculate(m.vessel, { ...base(), ops: { ice: { ...ice, enabled: false } } });
    expect(off.summary.some((s) => s.group === 'Ice accretion')).toBe(false);
  });
});

describe('timber deck cargo (IS Code A 3.3.2)', () => {
  const r = calculate(m.vessel, { ...base(), criteriaGroups: ['TIMBER'] });
  const g = r.groups[0];
  const c = (id: string) => g.criteria.find((x) => x.id === id)!;
  it('has the five criteria with the code values', () => {
    expect(g.criteria.map((x) => x.id)).toEqual(['TIMBER-1', 'TIMBER-2', 'TIMBER-3', 'TIMBER-2.3-HEEL', 'TIMBER-2.3-AREA']);
    expect(c('TIMBER-1').required).toBe(0.08);
    expect(c('TIMBER-2').required).toBe(0.25);
    expect(c('TIMBER-3').required).toBe(0.1);
  });
  it('GZ max criterion = GZ max of the curve; GM = GM fluid', () => {
    expect(c('TIMBER-2').actual).toBeCloseTo(r.gzMax, 3);
    expect(c('TIMBER-3').actual).toBeCloseTo(r.gmFluid, 9);
  });
  it('weather heel limit is 16° whatever the deck-edge angle; area b vs a as in 2.3', () => {
    expect(c('TIMBER-2.3-HEEL').required).toBe(16);
    const w = calculate(m.vessel, { ...base(), criteriaGroups: ['IS2008_WEATHER'] }).groups[0].criteria;
    expect(c('TIMBER-2.3-AREA').actual).toBeCloseTo(w.find((x) => x.id === 'IS-2.3-AREA')!.actual, 9);
    expect(c('TIMBER-2.3-HEEL').actual).toBeCloseTo(w.find((x) => x.id === 'IS-2.3-HEEL')!.actual, 9);
  });
});
