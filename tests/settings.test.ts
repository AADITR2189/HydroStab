// Settings: defaults for new load cases, tank fill warning, validation, kept in the local database.
import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import * as storage from '../src/storage';
import { DEFAULT_SETTINGS, getSettings, resetSettings, setSetting, settingProblem } from '../src/settings';
import { emptyLoadCase } from '../src/store';
import { calculate } from '../src/engine/stability';
import { VESSELS } from '../src/data/vessels';

const m = VESSELS[0];

describe('settings', () => {
  beforeEach(async () => { await storage.initStorage({ idb: new IDBFactory() }); });

  it('start with the defaults', () => {
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('a new load case takes density, FSM method, GZ range and stability groups from Settings', () => {
    setSetting('seaDensity', 1.0);
    setSetting('fsmMethod', 'MAXIMUM');
    setSetting('gzRange', { from: 0, to: 60, step: 2 });
    setSetting('groups', ['IS2008_GENERAL', 'OSV_INTACT']);
    const v = { ...m.vessel, criteriaGroups: undefined };
    const lc = emptyLoadCase(v, 1);
    expect(lc.seaDensity).toBe(1.0);
    expect(lc.fsmMethod).toBe('MAXIMUM');
    expect(lc.gzRange).toEqual({ from: 0, to: 60, step: 2 });
    expect(lc.criteriaGroups).toEqual(['IS2008_GENERAL', 'OSV_INTACT']);
    // a vessel with its own default groups keeps them
    expect(emptyLoadCase({ ...m.vessel, criteriaGroups: ['BV_FIFI'] }, 1).criteriaGroups).toEqual(['BV_FIFI']);
  });

  it('is kept in the local database and survives a restart', async () => {
    const idb = new IDBFactory();
    await storage.initStorage({ idb });
    setSetting('userName', 'A. Kumar');
    await storage.flush();
    await storage.initStorage({ idb }); // start again with the same database
    expect(getSettings().userName).toBe('A. Kumar');
  });

  it('reset puts every setting back', () => {
    setSetting('company', 'X Marine'); resetSettings();
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('refuses impossible values', () => {
    expect(settingProblem('seaDensity', 1.5)).not.toBeNull();
    expect(settingProblem('seaDensity', 1.025)).toBeNull();
    expect(settingProblem('overfillWarnPct', 100)).not.toBeNull();
    expect(settingProblem('overfillWarnPct', 95)).toBeNull();
    expect(settingProblem('gzRange', { from: 40, to: 30, step: 5 })).not.toBeNull();
    expect(settingProblem('gzRange', { from: 0, to: 60, step: 0 })).not.toBeNull();
  });
});

describe('tank fill warning follows the setting', () => {
  it('a tank at 96 % warns with 95 %, not with the default 98 %', () => {
    const lc = structuredClone(m.defaultLoadCases[0]);
    const t = m.vessel.tanks[0];
    lc.tanks[t.id] = { input: { mode: 'PERCENT', value: 96 } };
    const has = (pct?: number) => calculate(m.vessel, lc, undefined, pct === undefined ? {} : { overfillWarnPct: pct }).warnings.some((w) => w.code === 'TANK_ABOVE_98' && w.message.includes(t.name));
    expect(has()).toBe(false);
    expect(has(95)).toBe(true);
  });
});
