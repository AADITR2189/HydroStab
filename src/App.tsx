import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VESSELS } from './data/vessels';
import { calculate, ENGINE_VERSION } from './engine/stability';
import { EngineError } from './engine/math';
import type { LoadCase, Results } from './engine/types';
import { newId, toEntry, useLibrary, useLoadCases, useUserVessels } from './store';
import type { VesselEntry } from './data/vessels';
import type { DbData } from './importer/dbFile';
import { DataImportScreen } from './ui/DataImport';
import { VesselManager } from './ui/VesselManager';
import { ImportedDataScreen } from './ui/ImportedData';
import { BackupBanner, InstallButton, saveDatabaseFile, ShortcutsSheet, StorageBadge, ThemeSwitch, Toast, type ToastMsg } from './ui/AppShell';
import { Icon, type IconName } from './ui/Icon';
import { useHistory } from './ui/history';
import { UpdatePrompt } from './ui/UpdatePrompt';
import { CriteriaLibraryScreen } from './ui/CriteriaLibrary';
import { ReportsScreen } from './ui/Reports';
import { CompareScreen } from './ui/Compare';
import { SettingsScreen } from './ui/SettingsScreen';
import { applyMotion, useSettings } from './settings';
import { LoadCaseEditor } from './ui/LoadCaseEditor';
import { Criteria, Dashboard, ResultsSidebar, VesselData } from './ui/Screens';

type Screen = 'dashboard' | 'loadcase' | 'criteria' | 'compare' | 'library' | 'vessel' | 'reports' | 'import' | 'data' | 'settings';
const NAV: { id: Screen; label: string; icon: IconName; title: string; about: string; sepBefore?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', title: 'Dashboard', about: 'Vessel particulars and every load case at a glance.' },
  { id: 'vessel', label: 'Vessels', icon: 'ship', title: 'Vessels', about: 'Your vessels, the built-in ones, and the database file for backup and transfer.', sepBefore: true },
  { id: 'import', label: 'Import Data', icon: 'import', title: 'Import Data', about: 'Read tables from a stability booklet (PDF, Excel, Word, CSV), check them against the source and store them.' },
  { id: 'data', label: 'Data Tables', icon: 'table', title: 'Data Tables', about: 'Every table stored for this vessel, where it came from, and the changes made since.' },
  { id: 'loadcase', label: 'Load Case', icon: 'loadcase', title: 'Load Case', about: 'Tanks, weights and the stability groups to check for the selected load case.', sepBefore: true },
  { id: 'criteria', label: 'Stability Results', icon: 'results', title: 'Stability Results', about: 'GZ curve and every criterion of the selected load case.' },
  { id: 'compare', label: 'Compare', icon: 'compare', title: 'Compare Load Cases', about: 'Drafts, stability, GZ curves and every criterion of several load cases side by side.' },
  { id: 'library', label: 'Criteria Setup', icon: 'library', title: 'Criteria Setup', about: 'Your own criteria, heeling moments and stability groups.' },
  { id: 'reports', label: 'Reports', icon: 'report', title: 'Reports', about: 'PDF and Excel reports of the load cases.', sepBefore: true },
  { id: 'settings', label: 'Settings', icon: 'settings', title: 'Settings', about: 'Your name and company, defaults for new load cases, calculation and display options of this computer.' },
];
const SCREENS = NAV.map((n) => n.id);
const screenFromHash = (): Screen => { const h = location.hash.replace('#', '') as Screen; return SCREENS.includes(h) ? h : 'dashboard'; };
const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || (t.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'file', 'color'].includes((t as HTMLInputElement).type)) || t.tagName === 'TEXTAREA');

export default function App() {
  const userVessels = useUserVessels();
  const entries = useMemo(() => [...VESSELS, ...userVessels.list.map(toEntry)], [userVessels.list]);
  const store = useLoadCases(entries);
  const library = useLibrary();
  const settings = useSettings();
  useEffect(() => applyMotion(settings.reduceMotion), [settings.reduceMotion]);
  const vessel = store.entry.vessel;
  const status = store.entry.status;
  const lc = store.active;
  // each screen has its own address (#loadcase …), so Back / Forward and bookmarks work
  const [screen, setScreenState] = useState<Screen>(screenFromHash);
  const setScreen = useCallback((s: Screen) => { if (location.hash !== `#${s}`) location.hash = s; else setScreenState(s); }, []);
  useEffect(() => {
    const on = () => setScreenState(screenFromHash());
    window.addEventListener('hashchange', on);
    if (!location.hash) history.replaceState(null, '', '#dashboard');
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [showKeys, setShowKeys] = useState(false);

  // undo / redo of load cases, own vessels and the criteria library
  const latest = useRef({ all: store.all, vessels: userVessels.list, lib: library.lib });
  latest.current = { all: store.all, vessels: userVessels.list, lib: library.lib };
  const snapshot = useCallback(() => latest.current, []);
  const restore = useCallback((d: typeof latest.current) => { store.replaceAll(d.all); userVessels.replaceAll(d.vessels); library.replace(d.lib); }, [store, userVessels, library]);
  const hist = useHistory(snapshot, restore);
  const doUndo = useCallback(() => { const l = hist.undo(); if (l) setToast({ text: `Undone: ${l}`, icon: 'undo', action: { label: 'Redo', run: () => { const r = hist.redo(); if (r) setToast({ text: `Redone: ${r}`, icon: 'redo' }); } } }); }, [hist]);
  const doRedo = useCallback(() => { const l = hist.redo(); if (l) setToast({ text: `Redone: ${l}`, icon: 'redo' }); }, [hist]);
  /** wrap a change so it can be undone; deletions also offer Undo straight away */
  const tracked = <A extends unknown[]>(label: string, fn: (...a: A) => void, offer = false) => (...a: A) => {
    hist.record(label); fn(...a);
    if (offer) setToast({ text: `${label} done.`, icon: 'check', action: { label: 'Undo', run: doUndo } });
  };
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const calc = useMemo(() => (x: LoadCase): { r: Results | null; error: string | null } => {
    const missing = [!vessel.hydro.rows.length && 'hydrostatic table', !vessel.kn.displacements.length && 'cross curves (KN)', !(vessel.lbp > 0) && 'particulars', !(vessel.lightship.weight > 0) && 'lightship'].filter(Boolean);
    if (missing.length) return { r: null, error: `Vessel data incomplete: ${missing.join(', ')} missing. Add them in Vessels or Import Data.` };
    try {
      return { r: calculate(vessel, x, library.lib, { overfillWarnPct: settings.overfillWarnPct }), error: null };
    } catch (e) {
      if (e instanceof EngineError) return { r: null, error: e.message };
      return { r: null, error: String(e) };
    }
  }, [vessel, library.lib, settings.overfillWarnPct]);
  const { r, error } = useMemo(() => calc(lc), [calc, lc]);

  const makeCopy = (e: VesselEntry): string => {
    hist.record('Copy vessel');
    const id = `u-${newId()}`;
    userVessels.save({ id, vessel: { ...structuredClone(e.vessel), name: `${e.vessel.name} (my copy)` }, source: `Copy of ${e.vessel.name}: ${e.source}`, createdAt: new Date().toISOString(), provenance: structuredClone(e.provenance ?? {}) });
    const cs = store.all[e.id]?.length ? store.all[e.id] : e.defaultLoadCases;
    store.setCasesFor(id, cs.map((c) => ({ ...structuredClone(c), id: newId() })));
    return id;
  };
  const dbData = (): DbData => {
    const ids = new Set(entries.map((e) => e.id));
    return { vessels: userVessels.list, loadCases: Object.fromEntries(Object.entries(store.all).filter(([k]) => ids.has(k))), library: library.lib };
  };
  const applyDb = (d: DbData) => { userVessels.replaceAll(d.vessels); store.replaceAll(d.loadCases); library.replace(d.library); };

  const showSidebar = screen === 'loadcase' || screen === 'criteria';
  const nav = NAV.find((n) => n.id === screen)!;
  const saveDb = useCallback(async () => setToast({ text: await saveDatabaseFile(dbData()), icon: 'save' }), // eslint-disable-next-line react-hooks/exhaustive-deps
    [userVessels.list, store.all, library.lib]);

  // keyboard: Alt+1…9 screens, Ctrl+Z / Ctrl+Y undo / redo, Ctrl+S save database file, ? shortcuts
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (e.altKey && !mod && /^Digit[0-9]$/.test(e.code)) { e.preventDefault(); const k = Number(e.code.slice(5)); setScreen(SCREENS[k === 0 ? 9 : k - 1]); return; }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void saveDb(); return; }
      if (isTyping(e.target)) return; // inside a text field the browser's own undo works on the text
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); return; }
      if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); doRedo(); return; }
      if (e.key === '?' && !mod) { setShowKeys((x) => !x); return; }
      if (e.key === 'Escape') setShowKeys(false);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [setScreen, saveDb, doUndo, doRedo]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="logo"><Icon name="anchor" /></span>StabilitySoft</div>
        <div className="ctx-group">
          <select className="ctx-vessel" aria-label="Vessel" value={store.entry.id} onChange={(e) => store.setVessel(e.target.value)}>
            {entries.map((v) => <option key={v.id} value={v.id}>{v.vessel.name}{v.user ? ' (mine)' : ''}</option>)}
          </select>
          <span className="sub">
            <span className={`data-badge ${status.toLowerCase()}`}>{status === 'UNVERIFIED' ? 'Data not verified' : status === 'DEMO' ? 'Demo data' : 'Verified'}</span>
            <small>IMO {vessel.imo}</small>
          </span>
        </div>
        <label className="ctx ctx-lc">
          <span className="muted">Load case</span>
          <select value={lc.id} onChange={(e) => store.setActive(e.target.value)} title={lc.name}>
            {store.cases.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <div className="spacer" />
        <div className="top-tools">
          <button className="ghost" disabled={!hist.canUndo} onClick={doUndo} title={hist.undoLabel ? `Undo: ${hist.undoLabel} (Ctrl+Z)` : 'Nothing to undo'} aria-label="Undo"><Icon name="undo" />Undo</button>
          <button className="ghost" disabled={!hist.canRedo} onClick={doRedo} title={hist.redoLabel ? `Redo: ${hist.redoLabel} (Ctrl+Y)` : 'Nothing to redo'} aria-label="Redo"><Icon name="redo" /></button>
          <ThemeSwitch />
          <InstallButton />
        </div>
      </header>
      <div className="banner-slot"><BackupBanner dbData={dbData} /></div>

      <nav className="sidenav" aria-label="Screens">
        {NAV.map((n, i) => (
          <div key={n.id} style={{ display: 'contents' }}>
            {n.sepBefore && <div className="nav-sep" />}
            <button className={screen === n.id ? 'active' : ''} aria-current={screen === n.id ? 'page' : undefined} data-tip={n.label} aria-label={n.label} onClick={() => setScreen(n.id)}>
              <Icon name={n.icon} /><span className="label">{n.label}</span><span className="key">Alt {i < 9 ? i + 1 : 0}</span>
            </button>
          </div>
        ))}
      </nav>

      <main className={`workspace ${showSidebar ? 'with-sidebar' : ''}`}>
        <div className="content">
          <div className="screen" key={screen}>
          <div className="screen-head"><div><h1>{nav.title}</h1><p>{nav.about}</p></div></div>
          {screen === 'dashboard' && (
            <Dashboard vessel={vessel} status={status} source={store.entry.source} cases={store.cases} activeId={lc.id} calc={calc}
              onOpen={(id) => { store.setActive(id); setScreen('loadcase'); }}
              onDuplicate={tracked('Duplicate load case', store.duplicate)} onCreate={tracked('Add load case', store.create)} onRemove={tracked('Delete load case', store.remove, true)} onAdd={tracked('Add load case', store.add)} />
          )}
          {screen === 'loadcase' && <LoadCaseEditor vessel={vessel} lc={lc} r={r} onChange={tracked('Edit load case', store.update)} customGroups={library.lib.groups} onCreate={tracked('Add load case', store.add)} onCheck={() => setScreen('criteria')} />}
          {screen === 'settings' && <SettingsScreen customGroups={library.lib.groups} />}
          {screen === 'compare' && <CompareScreen vessel={vessel} vesselId={store.entry.id} cases={store.cases} activeId={lc.id} calc={calc} onOpen={(id) => { store.setActive(id); setScreen('loadcase'); }} />}
          {screen === 'library' && <CriteriaLibraryScreen lib={library.lib} addCriterion={tracked('Save criterion', library.addCriterion)} removeCriterion={tracked('Delete criterion', library.removeCriterion, true)} saveGroup={tracked('Save stability group', library.saveGroup)} removeGroup={tracked('Delete stability group', library.removeGroup, true)} saveMoment={tracked('Save heeling moment', library.saveMoment)} removeMoment={tracked('Delete heeling moment', library.removeMoment, true)} preview={r} lcName={lc.name} />}
          {screen === 'criteria' && (r ? <Criteria r={r} lc={lc} onChange={tracked('Edit load case', store.update)} /> : <div className="error-box">{error}</div>)}
          {screen === 'reports' && <ReportsScreen key={vessel.name} vessel={vessel} status={status} source={store.entry.source} cases={store.cases} activeId={lc.id} calc={calc} />}
          {screen === 'vessel' && <>
            <VesselManager entries={entries} current={store.entry} userVessels={userVessels.list} saveUserVessel={tracked('Save vessel', userVessels.save)}
              removeUserVessel={tracked('Delete vessel', (id: string) => { userVessels.remove(id); store.removeVesselCases(id); if (id === store.entry.id) store.setVessel(VESSELS[0].id); }, true)}
              makeCopy={makeCopy} openVessel={store.setVessel} dbData={dbData} applyDb={tracked('Load database file', applyDb)} builtinIds={VESSELS.map((v) => v.id)} storageError={userVessels.saveError} />
            <VesselData vessel={vessel} status={status} source={store.entry.source} />
          </>}
          {screen === 'data' && <ImportedDataScreen current={store.entry} userVessels={userVessels.list} saveUserVessel={tracked('Edit vessel data', userVessels.save)} makeCopy={makeCopy} openVessel={store.setVessel} />}
          {screen === 'import' && <DataImportScreen entries={entries} current={store.entry} userVessels={userVessels.list} saveUserVessel={tracked('Import data', userVessels.save)}
            lc={lc} updateLoadCase={tracked('Edit load case', store.update)} makeCopy={makeCopy} openVessel={store.setVessel} />}
          </div>
        </div>
        {showSidebar && <ResultsSidebar r={r} error={error} />}
      </main>

      <footer className="statusbar">
        <span className={online ? 'ok' : 'off'}>● {online ? 'Online' : 'Offline: all functions available'}</span>
        <StorageBadge />
        <span>Engine {ENGINE_VERSION}</span>
        <button className="link" onClick={() => setShowKeys(true)}>Keyboard shortcuts <kbd className="kbd">?</kbd></button>
      </footer>
      <UpdatePrompt />
      <Toast msg={toast} onDone={() => setToast(null)} />
      {showKeys && <ShortcutsSheet screens={NAV.map((n) => n.label)} onClose={() => setShowKeys(false)} />}
    </div>
  );
}
