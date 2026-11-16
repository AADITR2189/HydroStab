// Settings of this computer: your name and company, defaults for new load cases, calculation and display options.
import { useState } from 'react';
import type { FsmMethod, GroupDef } from '../engine/types';
import { BUILTIN_GROUPS, DEFAULT_GROUP_IDS } from '../engine/criteriaGroups';
import { resetSettings, setSetting, settingProblem, useSettings, type AppSettings } from '../settings';
import { StoragePanel, ThemeSwitch } from './AppShell';
import { clearHistory, keptSteps, PERSIST_LIMIT } from './history';

function Saved({ on }: { on: boolean }) { return on ? <span className="saved-tick" role="status">✓ Saved</span> : null; }

/** A number field that saves when it is valid and shows the problem when it is not. */
function NumField<K extends 'seaDensity' | 'overfillWarnPct'>({ k, value, step, unit }: { k: K; value: number; step: number; unit: string }) {
  const [text, setText] = useState(k === 'seaDensity' ? value.toFixed(3) : String(value));
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const commit = () => {
    const v = Number(text.replace(',', '.'));
    const p = settingProblem(k, v as AppSettings[K]);
    setErr(p);
    if (!p && v !== value) { setSetting(k, v as AppSettings[K]); setOk(true); window.setTimeout(() => setOk(false), 1500); }
  };
  return (
    <span>
      <span className="with-unit"><input type="number" step={step} value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} aria-invalid={!!err} /><em>{unit}</em></span> <Saved on={ok} />
      {err && <div className="err">{err}</div>}
    </span>
  );
}

function TextField({ k, value, placeholder }: { k: 'userName' | 'company'; value: string; placeholder: string }) {
  const [text, setText] = useState(value);
  const [ok, setOk] = useState(false);
  const commit = () => { if (text.trim() !== value) { setSetting(k, text.trim()); setOk(true); window.setTimeout(() => setOk(false), 1500); } };
  return <span><input type="text" value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} /> <Saved on={ok} /></span>;
}

export function SettingsScreen({ customGroups }: { customGroups: GroupDef[] }) {
  const s = useSettings();
  const [resetAsk, setResetAsk] = useState(false);
  const [rk, setRk] = useState(0);
  const [steps, setSteps] = useState(keptSteps);
  const [rangeErr, setRangeErr] = useState<string | null>(null);
  const [range, setRange] = useState(s.gzRange ?? { from: 0, to: 90, step: 5 });
  const groups = [...BUILTIN_GROUPS, ...customGroups];
  const sel = s.groups.length ? s.groups : DEFAULT_GROUP_IDS;
  const toggleGroup = (id: string) => setSetting('groups', sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);

  return (
    // key: after "reset to defaults" every field shows the default again
    <div className="stack" key={rk}>
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-head"><h2>You</h2></div>
          <div className="set-row">
            <span className="set-label">Your name<small>Pre-filled wherever a name is asked: import sign-off, edits of data, "Prepared by" in reports.</small></span>
            <TextField k="userName" value={s.userName} placeholder="e.g. A. Kumar, Chief Officer" />
          </div>
          <div className="set-row">
            <span className="set-label">Company<small>Printed in the header of PDF and Excel reports.</small></span>
            <TextField k="company" value={s.company} placeholder="optional" />
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Appearance</h2></div>
          <div className="set-row">
            <span className="set-label">Colour theme<small>Light, dark, or the same as this computer. Also in the top bar.</small></span>
            <span><ThemeSwitch /></span>
          </div>
          <div className="set-row">
            <span className="set-label">Reduce motion<small>No animations in this app. The computer's own "reduce motion" setting is always followed too.</small></span>
            <label className="check" style={{ alignItems: 'center' }}><input type="checkbox" checked={s.reduceMotion} onChange={(e) => setSetting('reduceMotion', e.target.checked)} /> Turn animations off</label>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>New load cases</h2><span className="muted small">Used when a load case is added; existing load cases are not changed.</span></div>
          <div className="set-row">
            <span className="set-label">Sea water density</span>
            <NumField k="seaDensity" value={s.seaDensity} step={0.001} unit="t/m³" />
          </div>
          <div className="set-row">
            <span className="set-label">Free surface method</span>
            <select value={s.fsmMethod} onChange={(e) => setSetting('fsmMethod', e.target.value as FsmMethod)}>
              <option value="ACTUAL">Actual filling</option>
              <option value="MAXIMUM">Maximum (conservative)</option>
              <option value="MANUAL_TOTAL">Total FSM entered manually</option>
            </select>
          </div>
          <div className="set-row">
            <span className="set-label">GZ table range<small>Standard: the KN angles and every 5°.</small></span>
            <span>
              <label className="check" style={{ alignItems: 'center', marginBottom: 6 }}>
                <input type="checkbox" checked={!!s.gzRange} onChange={(e) => { if (e.target.checked) { const p = settingProblem('gzRange', range); setRangeErr(p); if (!p) setSetting('gzRange', range); } else setSetting('gzRange', null); }} /> Own range
              </label>
              <span className="form-row" style={{ gap: 10 }}>
                {(['from', 'to', 'step'] as const).map((k) => (
                  <label key={k} className="small muted">{k === 'from' ? 'From °' : k === 'to' ? 'To °' : 'Step °'}
                    <input type="number" step="any" value={range[k]} disabled={!s.gzRange} onChange={(e) => setRange({ ...range, [k]: Number(e.target.value) })}
                      onBlur={() => { const p = settingProblem('gzRange', range); setRangeErr(p); if (!p && s.gzRange) setSetting('gzRange', range); }} />
                  </label>
                ))}
              </span>
              {rangeErr && <div className="err">{rangeErr}</div>}
            </span>
          </div>
          <div className="set-row">
            <span className="set-label">Stability groups<small>Ticked in a new load case when the vessel has no default of its own.</small></span>
            <div className="set-groups">
              {groups.filter((g) => !/superseded/i.test(g.name)).map((g) => (
                <label key={g.id} className="check"><input type="checkbox" checked={sel.includes(g.id)} onChange={() => toggleGroup(g.id)} /> {g.name}</label>
              ))}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Calculation</h2></div>
          <div className="set-row">
            <span className="set-label">Tank fill warning<small>Tanks filled between this value and 100 % give a warning (100 % = pressed up, no warning).</small></span>
            <NumField k="overfillWarnPct" value={s.overfillWarnPct} step={0.5} unit="%" />
          </div>
          <div className="set-row">
            <span className="set-label">Undo history<small>The last {PERSIST_LIMIT} changes are kept on this computer, so Undo still works after closing the app. Each step holds a copy of your data.</small></span>
            <span>{steps} step{steps === 1 ? '' : 's'} kept <button className="ghost tiny" disabled={!steps} onClick={() => { clearHistory(); setSteps(0); }}>Clear</button></span>
          </div>
        </section>
      </div>

      <StoragePanel />

      <section className="panel">
        <div className="panel-head"><h2>Reset</h2></div>
        <p className="muted">Put every setting on this page back to its default. Vessels, load cases and criteria are not touched.</p>
        {resetAsk
          ? <span className="confirm"><button className="danger" onClick={() => { resetSettings(); setRange({ from: 0, to: 90, step: 5 }); setResetAsk(false); setRk((x) => x + 1); }}>Reset settings</button><button className="ghost" onClick={() => setResetAsk(false)}>Keep</button></span>
          : <button className="ghost" onClick={() => setResetAsk(true)}>Reset settings to defaults…</button>}
      </section>
    </div>
  );
}
