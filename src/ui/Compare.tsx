// Compare load cases side by side: drafts, stability values, GZ curves and every criterion.
import { Fragment, useMemo, useState } from 'react';
import type { LoadCase, Results, Vessel } from '../engine/types';
import { compareCsv, critRows, valueRows, weakest, type CompareCase } from '../report/compare';
import { saveFile } from '../report/save';
import { fileSafe } from './chartExport';
import { f } from './format';
import { Icon } from './Icon';
import { StatusBadge } from './Screens';

const MAX = 6;
const KEY = 'stabilitysoft.compare';

function loadPick(vesselId: string): string[] | null {
  try { const all = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return Array.isArray(all[vesselId]) ? all[vesselId] : null; } catch { return null; }
}
function savePick(vesselId: string, ids: string[]) {
  try { const all = JSON.parse(localStorage.getItem(KEY) ?? '{}'); all[vesselId] = ids; localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private window */ }
}

export function CompareScreen({ vessel, vesselId, cases, activeId, calc, onOpen }: {
  vessel: Vessel; vesselId: string; cases: LoadCase[]; activeId: string;
  calc: (lc: LoadCase) => { r: Results | null; error: string | null };
  onOpen: (id: string) => void;
}) {
  const [pick, setPickState] = useState<string[]>(() => {
    const saved = loadPick(vesselId)?.filter((id) => cases.some((c) => c.id === id));
    if (saved && saved.length >= 2) return saved;
    const i = Math.max(0, cases.findIndex((c) => c.id === activeId));
    return [cases[i], ...cases.filter((_, k) => k !== i)].slice(0, 3).map((c) => c.id);
  });
  const setPick = (ids: string[]) => { setPickState(ids); savePick(vesselId, ids); };
  const [diff, setDiff] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const cs: CompareCase[] = useMemo(() => pick.map((id) => cases.find((c) => c.id === id)).filter((c): c is LoadCase => !!c).map((lc) => ({ lc, ...calc(lc) })), [pick, cases, calc]);
  const rows = useMemo(() => valueRows(cs), [cs]);
  const crit = useMemo(() => critRows(cs), [cs]);
  const toggle = (id: string) => setPick(pick.includes(id) ? pick.filter((x) => x !== id) : pick.length >= MAX ? pick : [...pick, id]);
  const move = (id: string, d: -1 | 1) => { const i = pick.indexOf(id), j = i + d; if (j < 0 || j >= pick.length) return; const n = [...pick]; [n[i], n[j]] = [n[j], n[i]]; setPick(n); };

  const cell = (row: (typeof rows)[number], i: number) => {
    const v = row.values[i], ref = row.values[0];
    if (v === null) return '—';
    if (diff && i > 0 && ref !== null) { const d = v - ref; return Math.abs(d) < 0.5 * 10 ** -row.dp ? '±0' : `${d > 0 ? '+' : '−'}${f(Math.abs(d), row.dp)}`; }
    return row.text?.[i] ?? f(v, row.dp);
  };

  async function exportCsv() {
    const out = await saveFile(`${fileSafe(vessel.name)}_load_case_comparison.csv`, new Blob([compareCsv(vessel.name, cs)], { type: 'text/csv' }));
    setMsg(out === 'saved' ? 'Comparison saved as CSV.' : out === 'declined' ? 'Save cancelled.' : 'Saving files is not available here.');
  }

  let section = '';
  let group = '';
  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-head">
          <h2>Load cases to compare ({pick.length} of {cases.length}, up to {MAX})</h2>
          <span className="form-row" style={{ gap: 8, alignItems: 'center' }}>
            <label className="check inline" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={diff} onChange={(e) => setDiff(e.target.checked)} /> Show differences to the first case</label>
            <button className="ghost" disabled={cs.length < 1} onClick={exportCsv}><Icon name="download" />Export CSV</button>
          </span>
        </div>
        {msg && <p className="muted small" role="status">{msg}</p>}
        <div className="pick-list">
          {cases.map((c) => (
            <label key={c.id} className={`pick-chip${pick.includes(c.id) ? ' on' : ''}`} title={c.name}>
              <input type="checkbox" checked={pick.includes(c.id)} disabled={!pick.includes(c.id) && pick.length >= MAX} onChange={() => toggle(c.id)} />
              {pick.includes(c.id) && <span className="pick-no">{pick.indexOf(c.id) + 1}</span>}
              <span className="pick-name">{c.name}</span>
            </label>
          ))}
        </div>
      </section>

      {cs.length < 2 && <div className="notice">Tick at least two load cases to compare them.</div>}

      {cs.length >= 1 && (
        <section className="panel">
          <div className="panel-head"><h2>Condition and stability</h2><span className="muted small">{cs.length > 1 ? 'The weakest value of each stability row is marked.' : ''}</span></div>
          <div className="table-wrap">
            <table className="grid compare">
              <thead>
                <tr>
                  <th>Quantity</th><th>Unit</th>
                  {cs.map((c, i) => (
                    <th key={c.lc.id} className="num case-col">
                      <span className="case-head">
                        <span className="pick-no">{i + 1}</span>
                        <button className="link" onClick={() => onOpen(c.lc.id)} title={`Open “${c.lc.name}”`}>{c.lc.name}</button>
                      </span>
                      <span className="case-tools">
                        <span className="muted small">{c.lc.type}</span>
                        <button className="ghost tiny" disabled={i === 0} onClick={() => move(c.lc.id, -1)} aria-label={`Move ${c.lc.name} left`} title={i === 1 ? 'Make this the reference (first) case' : 'Move left'}>‹</button>
                        <button className="ghost tiny" disabled={i === cs.length - 1} onClick={() => move(c.lc.id, 1)} aria-label={`Move ${c.lc.name} right`}>›</button>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="section-row"><td>Result</td><td />{cs.map((c) => <td key={c.lc.id} className="num">{c.r ? <StatusBadge pass={c.r.overallPass} /> : <span className="fail-text small">cannot calculate</span>}</td>)}</tr>
                {rows.map((row) => {
                  const head = row.section !== section ? (section = row.section) : null;
                  const w = weakest(row);
                  return (
                    <Fragment key={row.key}>
                      {head && <tr className="type-head"><td colSpan={2 + cs.length}>{head}</td></tr>}
                      <tr>
                        <td>{row.label}</td><td className="muted">{row.unit}</td>
                        {row.values.map((_, i) => <td key={i} className={`num${i === w ? ' weak' : ''}`} title={i === w ? 'Weakest of the compared cases' : undefined}>{cell(row, i)}</td>)}
                      </tr>
                    </Fragment>
                  );
                })}
                {cs.some((c) => c.error) && (
                  <tr><td colSpan={2}>Message</td>{cs.map((c) => <td key={c.lc.id} className="fail-text small wrap">{c.error ?? ''}</td>)}</tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {cs.some((c) => c.r) && (
        <section className="panel">
          <div className="panel-head"><h2>GZ curves</h2><span className="muted small">Point at the chart to read every curve at one angle</span></div>
          <GzOverlay cs={cs} />
        </section>
      )}

      {crit.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>Criteria</h2><span className="muted small">Actual value of each case; required value in the second column. — = group not checked in that case.</span></div>
          <div className="table-wrap">
            <table className="grid compare">
              <thead><tr><th>Criterion</th><th className="num">Required</th>{cs.map((c, i) => <th key={c.lc.id} className="num"><span className="pick-no">{i + 1}</span></th>)}</tr></thead>
              <tbody>
                {crit.map((r) => {
                  const head = r.group !== group ? (group = r.group) : null;
                  const reqs = r.required.filter((x): x is number => x !== null);
                  const dp = r.unit === 'm·rad' ? 4 : r.unit === '°' ? 1 : 3;
                  const same = reqs.every((x) => Math.abs(x - reqs[0]) < 0.5 * 10 ** -dp);
                  const req = reqs[0];
                  const sign = r.comparator === '>=' ? '≥' : '≤';
                  return (
                    <Fragment key={`${r.group}|${r.code}`}>
                      {head && <tr className="type-head"><td colSpan={2 + cs.length}>{r.groupName}</td></tr>}
                      <tr>
                        <td className="wrap">{r.description}</td>
                        <td className="num muted">{req === undefined ? '' : same ? `${sign} ${f(req, dp)} ${r.unit}` : <span title="The requirement depends on the load case">{sign} differs per case</span>}</td>
                        {r.actual.map((a, i) => (
                          <td key={i} className={`num ${r.passed[i] === false ? 'cell-fail' : ''}`} title={r.marginPct[i] !== null ? `margin ${f(r.marginPct[i], 1)} %` : 'group not checked'}>
                            {a === null ? <span className="muted">—</span> : <>{f(a, dp)} <span className={r.passed[i] ? 'pass-text' : 'fail-text'}>{r.passed[i] ? '✓' : '✗'}</span>
                              {!same && r.required[i] !== null && <div className="muted small">{sign} {f(r.required[i], dp)}</div>}</>}
                          </td>
                        ))}
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

/** All GZ curves in one diagram, one colour per case, with a readout of every curve at the pointer. */
function GzOverlay({ cs }: { cs: CompareCase[] }) {
  const W = 820, H = 340, m = { l: 52, r: 20, t: 18, b: 40 };
  const [hover, setHover] = useState<number | null>(null);
  const curves = cs.map((c, i) => ({ i, name: c.lc.name, pts: c.r?.gzCurve ?? [] })).filter((c) => c.pts.length > 1);
  const xMax = Math.max(...curves.map((c) => c.pts[c.pts.length - 1].heel));
  const all = curves.flatMap((c) => c.pts.map((p) => p.gz));
  const step = (span: number) => { const raw = span / 6, p = 10 ** Math.floor(Math.log10(raw)), n = raw / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
  const yS = step(Math.max(0.3, Math.max(...all)) - Math.min(0, Math.min(...all)));
  const yMax = Math.ceil((Math.max(0.3, ...all) * 1.08) / yS) * yS, yMin = Math.min(0, Math.floor(Math.min(...all) / yS) * yS);
  const sx = (x: number) => m.l + (x / xMax) * (W - m.l - m.r);
  const sy = (y: number) => m.t + ((yMax - y) / (yMax - yMin)) * (H - m.t - m.b);
  const at = (pts: { heel: number; gz: number }[], x: number) => {
    for (let k = 1; k < pts.length; k++) if (pts[k].heel >= x) { const a = pts[k - 1], b = pts[k]; return a.gz + ((b.gz - a.gz) * (x - a.heel)) / (b.heel - a.heel || 1); }
    return null;
  };
  const yTicks: number[] = []; for (let y = yMin; y <= yMax + 1e-9; y += yS) yTicks.push(Math.round(y * 1000) / 1000);
  const xTicks: number[] = []; for (let x = 0; x <= xMax + 1e-9; x += 10) xTicks.push(x);
  return (
    <>
      <div className="legend">{curves.map((c) => <span key={c.i}><i style={{ borderColor: `var(--c${c.i + 1})`, borderTopWidth: 3 }} /><span className="pick-no">{c.i + 1}</span>{c.name}</span>)}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="GZ curves of the compared load cases"
        onPointerMove={(e) => { const ctm = e.currentTarget.getScreenCTM(); if (!ctm) return; const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse()); const x = ((p.x - m.l) / (W - m.l - m.r)) * xMax; setHover(x >= 0 && x <= xMax ? Math.round(x * 2) / 2 : null); }}
        onPointerLeave={() => setHover(null)}>
        {yTicks.map((y) => <g key={`y${y}`}><line x1={m.l} x2={W - m.r} y1={sy(y)} y2={sy(y)} className={Math.abs(y) < 1e-9 ? 'axis' : 'grid'} /><text x={m.l - 6} y={sy(y) + 4} textAnchor="end" className="tick">{y.toFixed(yS < 0.1 ? 2 : 1)}</text></g>)}
        {xTicks.map((x) => <g key={`x${x}`}><line x1={sx(x)} x2={sx(x)} y1={m.t} y2={H - m.b} className={x === 0 ? 'axis' : 'grid'} /><text x={sx(x)} y={H - m.b + 16} textAnchor="middle" className="tick">{x}</text></g>)}
        <text x={(m.l + W - m.r) / 2} y={H - 6} textAnchor="middle" className="label">Heel angle (°)</text>
        <text x={14} y={(m.t + H - m.b) / 2} textAnchor="middle" className="label" transform={`rotate(-90 14 ${(m.t + H - m.b) / 2})`}>GZ (m)</text>
        {curves.map((c) => <path key={c.i} d={c.pts.filter((p) => p.heel <= xMax).map((p, k) => `${k ? 'L' : 'M'}${sx(p.heel).toFixed(1)},${sy(p.gz).toFixed(1)}`).join(' ')} className="cmp-curve" style={{ stroke: `var(--c${c.i + 1})` }} pathLength={1} />)}
        {hover !== null && (() => {
          const vals = curves.map((c) => ({ ...c, v: at(c.pts, hover) })).filter((c) => c.v !== null) as { i: number; name: string; v: number }[];
          const right = sx(hover) > W - 220, bx = right ? sx(hover) - 182 : sx(hover) + 12, by = m.t + 4, h = 22 + vals.length * 16;
          return (
            <g pointerEvents="none">
              <line x1={sx(hover)} x2={sx(hover)} y1={m.t} y2={H - m.b} className="hover-line" />
              {vals.map((c) => <circle key={c.i} cx={sx(hover)} cy={sy(c.v)} r={4} style={{ fill: `var(--c${c.i + 1})` }} className="hover-dot-plain" />)}
              <rect x={bx} y={by} width={170} height={h} rx={4} className="hover-box" />
              <text x={bx + 10} y={by + 15} className="hover-sub">{`at ${hover.toFixed(1)}° heel`}</text>
              {vals.map((c, k) => <text key={c.i} x={bx + 10} y={by + 31 + k * 16} className="hover-text" style={{ fill: `var(--c${c.i + 1})` }}>{`${c.i + 1}: GZ ${c.v.toFixed(3)} m`}</text>)}
            </g>
          );
        })()}
      </svg>
    </>
  );
}
