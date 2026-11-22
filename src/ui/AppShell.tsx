// App shell pieces: storage status, backup reminder, install button and update notice.
import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { applyTheme, getTheme, type ThemeChoice } from './theme';
import * as storage from '../storage';
import type { DbData } from '../importer/dbFile';
import { buildDbFile } from '../importer/dbFile';
import { saveFile } from '../report/save';

export function useStorageStatus() {
  const [st, setSt] = useState(storage.getStatus());
  useEffect(() => storage.onStatus(setSt), []);
  return st;
}

/** Save the whole database to a file and record the backup. */
export async function saveDatabaseFile(data: DbData): Promise<string> {
  const text = await buildDbFile(data);
  const name = `HydroStab_database_${new Date().toISOString().slice(0, 10)}.json`;
  const out = await saveFile(name, new Blob([text], { type: 'application/json' }));
  if (out === 'saved') storage.markBackedUp();
  return out === 'saved' ? `${name} (${Math.round(text.length / 1024)} KB) saved.` : out === 'declined' ? 'Save cancelled.' : 'Saving files is not available here.';
}

const ago = (iso: string | null) => {
  if (!iso) return 'never';
  const d = (Date.now() - Date.parse(iso)) / 86400e3;
  return d < 1 / 24 ? 'just now' : d < 1 ? `${Math.round(d * 24)} h ago` : `${Math.floor(d)} day${Math.floor(d) === 1 ? '' : 's'} ago`;
};

export function StorageBadge() {
  const st = useStorageStatus();
  const b = storage.backupDue();
  const label = st.error ? 'Not saved' : st.backend === 'indexeddb' ? `Saved on this device${st.persistent ? ' (kept permanently)' : ''}` : st.backend === 'localStorage' ? 'Saved in browser (basic storage)' : '⚠ Not stored';
  return (
    <span className={st.error || st.backend === 'memory' ? 'off' : 'ok'} title={`Storage: ${st.backend}; used ${storage.fmtBytes(st.usage)} of ${storage.fmtBytes(st.quota)}; last saved ${st.lastSaved ? new Date(st.lastSaved).toLocaleString() : '—'}; last database backup ${ago(b.lastBackup)}`}>
      ● {label} · last backup {ago(b.lastBackup)}
    </span>
  );
}

export function BackupBanner({ dbData }: { dbData: () => DbData }) {
  const st = useStorageStatus();
  const [, force] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const b = storage.backupDue();
  if (st.error) {
    return <div className="banner banner-fail" role="alert"><Icon name="alert" /> {st.error} <button onClick={async () => { setMsg(await saveDatabaseFile(dbData())); force((x) => x + 1); }}><Icon name="save" />Save database to file now</button>{msg && <span className="small"> {msg}</span>}</div>;
  }
  if (!b.due) return null;
  return (
    <div className="banner" role="status">
      <Icon name="info" />
      <span>Your changes are kept only on this computer. Last backup to a file: <b>{ago(b.lastBackup)}</b>.</span>
      <button onClick={async () => { setMsg(await saveDatabaseFile(dbData())); force((x) => x + 1); }}><Icon name="save" />Back up now</button>
      <button className="ghost" onClick={() => { storage.snoozeReminder(24); force((x) => x + 1); }}>Remind me tomorrow</button>
      {msg && <span className="small">{msg}</span>}
    </div>
  );
}

/** Storage gauge and settings for the Vessel Database screen. */
export function StoragePanel() {
  const st = useStorageStatus();
  const [, force] = useState(0);
  const b = storage.backupDue();
  const pct = st.usage !== null && st.quota ? (st.usage / st.quota) * 100 : null;
  useEffect(() => { void storage.refreshEstimate(); }, []);
  return (
    <section className="panel">
      <div className="panel-head"><h2>Storage on this device</h2></div>
      <table className="grid"><tbody>
        <tr><td>Where</td><td>{st.backend === 'indexeddb' ? 'Browser database (IndexedDB) of this app on this computer' : st.backend === 'localStorage' ? 'Browser storage (basic, about 5 MB): the browser database is not available here' : 'Not stored: this browser window does not allow saving'}</td></tr>
        <tr><td>Used (app files for offline use + your data)</td><td>{storage.fmtBytes(st.usage)} of {storage.fmtBytes(st.quota)} available{pct !== null && <> · <progress max={100} value={Math.max(0.5, pct)} style={{ width: 160, verticalAlign: 'middle' }} /> {pct < 0.1 ? '< 0.1' : pct.toFixed(1)} %</>}</td></tr>
        <tr><td>Kept permanently</td><td>{st.persistent ? <span className="pass-text">✓ yes: the browser will not delete this data to free space</span> : st.persistent === false ? <><span className="warn-text">not granted yet: the browser may clear it if the disk is very full.</span> <button className="ghost tiny" onClick={async () => { await storage.requestPersistence(); force((x) => x + 1); }}>Ask again</button><div className="muted small">Installing the app (Install button, top right) usually lets the browser grant this.</div></> : <span className="muted">the browser does not say</span>}</td></tr>
        <tr><td>Last saved</td><td>{st.lastSaved ? new Date(st.lastSaved).toLocaleString() : 'no change saved in this session yet'}</td></tr>
        <tr><td>Last database backup (file)</td><td>{b.lastBackup ? new Date(b.lastBackup).toLocaleString() : <span className="warn-text">never</span>}{b.lastChange && (!b.lastBackup || Date.parse(b.lastChange) > Date.parse(b.lastBackup)) && <span className="warn-text"> · changes since then are only on this device</span>}</td></tr>
        <tr><td>Backup reminder</td><td>
          <select value={b.days} onChange={(e) => { storage.setBackupDays(Number(e.target.value)); force((x) => x + 1); }} aria-label="Backup reminder">
            {[1, 3, 7, 14, 30].map((d) => <option key={d} value={d}>every {d} day{d > 1 ? 's' : ''} (when there are changes)</option>)}
            <option value={0}>off</option>
          </select>
        </td></tr>
        {st.migrated > 0 && <tr><td>Moved</td><td className="pass-text">✓ {st.migrated} data set(s) of the older storage were moved into the browser database at this start.</td></tr>}
      </tbody></table>
      <p className="muted small">Data stays on this computer, in this browser, for this web address. Another computer or browser starts empty: use the database file to back up and to move data.</p>
    </section>
  );
}

// ---------- install and update ----------
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallButton() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); };
    const done = () => { setEvt(null); void storage.requestPersistence(); };
    window.addEventListener('beforeinstallprompt', on);
    window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('beforeinstallprompt', on); window.removeEventListener('appinstalled', done); };
  }, []);
  // shown only when this browser can install the app right now
  if (!evt) return null;
  return <button className="ghost" onClick={async () => { await evt.prompt(); const c = await evt.userChoice; if (c.outcome === 'accepted') setEvt(null); }}><Icon name="download" />Install app</button>;
}

// ---------- theme, messages, shortcuts ----------
export function ThemeSwitch() {
  const [t, setT] = useState<ThemeChoice>(getTheme);
  // the switch in the top bar and the one in Settings stay in step
  useEffect(() => { const on = (e: Event) => setT((e as CustomEvent<ThemeChoice>).detail); window.addEventListener('stabilitysoft-theme', on); return () => window.removeEventListener('stabilitysoft-theme', on); }, []);
  const opts: [ThemeChoice, IconName, string][] = [['light', 'sun', 'Light'], ['dark', 'moon', 'Dark'], ['system', 'monitor', 'Same as this computer']];
  return (
    <span className="seg" role="group" aria-label="Colour theme">
      {opts.map(([v, icon, label]) => (
        <button key={v} className={t === v ? 'on' : ''} aria-pressed={t === v} title={`Theme: ${label}`} aria-label={`Theme: ${label}`} onClick={() => applyTheme(v, true)}><Icon name={icon} /></button>
      ))}
    </span>
  );
}

export interface ToastMsg { text: string; icon?: IconName; action?: { label: string; run: () => void } }

/** Short message at the bottom of the screen; leaves by itself after a few seconds (longer when it offers an action). */
export function Toast({ msg, onDone }: { msg: ToastMsg | null; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    setLeaving(false);
    if (!msg) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLeaving(true), msg.action ? 7000 : 3500);
    return () => window.clearTimeout(timer.current);
  }, [msg]);
  if (!msg) return null;
  return (
    <div className={`toast${leaving ? ' leaving' : ''}${msg.icon === 'check' ? ' ok' : ''}`} role="status" onAnimationEnd={() => { if (leaving) onDone(); }}
      onMouseEnter={() => window.clearTimeout(timer.current)} onMouseLeave={() => { timer.current = window.setTimeout(() => setLeaving(true), 2000); }}>
      {msg.icon && <Icon name={msg.icon} />}<span>{msg.text}</span>
      {msg.action && <button className="ghost" onClick={() => { msg.action!.run(); }}>{msg.action.label}</button>}
      <button className="ghost" aria-label="Close" onClick={() => setLeaving(true)} style={{ padding: '4px 6px' }}><Icon name="close" /></button>
    </div>
  );
}

export function ShortcutsSheet({ screens, onClose }: { screens: string[]; onClose: () => void }) {
  const rows: [string, string][] = [
    ...screens.map((s, i) => [s, `Alt + ${i < 9 ? i + 1 : 0}`] as [string, string]),
    ['Undo the last change', 'Ctrl + Z'], ['Redo', 'Ctrl + Y'], ['Save the database to a file', 'Ctrl + S'],
    ['Back / forward between screens', 'Alt + ← / →'], ['Show or hide this list', '?'],
  ];
  return (
    <div className="shortcuts" onClick={onClose} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head"><h2><Icon name="keyboard" /> Keyboard shortcuts</h2><button className="ghost" onClick={onClose} aria-label="Close"><Icon name="close" /></button></div>
        <table><tbody>{rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v.split(' + ').map((x, i) => <span key={i}>{i > 0 && ' + '}<kbd>{x}</kbd></span>)}</td></tr>)}</tbody></table>
        <p className="muted small">On a Mac use ⌘ instead of Ctrl. Undo inside a text field undoes the typing first.</p>
      </div>
    </div>
  );
}
