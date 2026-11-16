# StabilitySoft — Vessel Stability Software

**StabilitySoft** is vessel intact-stability software that replaces Excel-based stability calculations with a controlled, checked and traceable system.

It runs as an installable **web app (PWA)** on PC and laptop: it opens in the browser, installs like a program, and works **fully offline** after the first start. All data stays on the computer.

**Live app:** https://aaditr2189.github.io/StabiltySoft/

> **Status:** working version, in daily use for planning. The built-in vessel **MARSOL SPLENDOR** is loaded from its stability booklet and all 13 booklet conditions are benchmarked; the results have been checked by several users. How every number is calculated is written out in **[Calculation Formulas](docs/Calculation-Formulas.md)**.

---

## Why this exists

| Problem with Excel | How StabilitySoft solves it |
|---|---|
| Human input errors | Controlled entry with range checks, units and validation; imported tables are checked against the source cell by cell |
| Formula modification errors | Formulas are fixed inside a tested calculation engine (220 automatic tests); users cannot edit them |
| Version control problems | Every data set keeps its source file, who verified it and every later edit with name and reason |
| Many load cases | Unlimited load cases per vessel: duplicate, generate arrival, compare side by side, export |
| No automatic criteria checks | IMO criteria checked automatically with pass / fail, margins and an explanation of every failure |

---

## What the app does

### Vessels and data
- **Vessels:** built-in vessels, your own vessels (new, or "copy as mine"), particulars and lightship editors, bilge keel area for the roll factor k.
- **Import Data:** read tables from the stability booklet: **PDF** (text or scanned, with text recognition), **Excel** (.xlsx and old .xls), **Word**, **CSV**, or pasted.
  - Particulars and lightship, hydrostatics and cross curves (**all trims at once**), tank calibration (**all tanks at once**), windage, flooding openings, weights.
  - Every value shows its source text and is re-read digit by digit; engineering checks (rising values, spikes, shifted decimals, totals); row-by-row sign-off; the stored data is read back and compared value by value.
  - Drafts given at the **LCF, AP, FP** or any point are converted to midship drafts; cross curves given against **draft or volume** are converted to displacement.
  - Tank tables with **FSM (t·m)** instead of inertia: the SG of the FSM column can be stated; an optional **maximum FSM** can be entered when the true maximum falls between two sounding rows.
  - **KML** is imported and listed with the hydrostatics (information only).
- **Data Tables:** every stored table with its source record and edit history; edit rows with checks and a logged reason; tank types and categories.
- **Database file:** save the whole database to one file (sealed with a checksum) and load it on another computer; backup reminder.

### Load cases and results
- **Load Case:** tanks by filled / % / volume / weight / sounding, split by tank type; variable weights; operation data; **Max FSM** tick per tank or per tank type; free surface by actual filling, maximum, or one total.
- **Stability Results:** GZ curve (point at it to read GZ), GZ table and every criterion per stability group, with margins and failure explanations; operational limits (draft, trim, heel, GM, air draft), each with its own tick.
- **Compare:** up to 6 load cases side by side: drafts, stability values (weakest marked), all GZ curves in one chart, every criterion; CSV export.
- **Arrival generator:** an arrival condition from a departure, with % consumed per tank type.
- **Reports:** PDF and Excel (summary, particulars, condition, tanks, criteria, one page per stability group with GZ curve and tables, trace); report ID = checksum of inputs and results. Charts as PNG / SVG, tables as CSV, one load case as a file.

### Criteria
- IMO IS Code 2008 general criteria and weather criterion; OSV; passenger ships; grain; pontoons; MODU; BV fire-fighting; crane and lifting (IS Code B 2.9); anchor handling, towing and escort (MSC.415(97)); timber deck cargo (A 3.3.2); superseded IMO A.167 / A.562 / A.749.
- **Ice accretion** (IS Code B 6.3.1, also for OSVs) as a tick per load case: deck and side ice, more wind area.
- **Criteria Setup:** your own criteria, heeling moments from formulas linked to the load case or entered as a table against heel, and your own stability groups.

### Working with the app
- Light and dark theme (follows the computer, or chosen), keyboard shortcuts (press **?**), **undo / redo** of every change (kept after closing the app), Back / Forward between screens.
- **Settings:** your name (filled in for sign-offs and reports), company (report header), defaults for new load cases, tank fill warning, reduce motion.

### Waiting for input
| Item | Needs |
|---|---|
| MODU column-stabilised alternative, 46 CFR, DDS 079-1 extras, class notations | the rule texts |
| More vessels | vessel data: see the [Vessel Data Checklist](docs/DATA-CHECKLIST.md) |
| Longitudinal strength | Bonjean / sectional areas or offsets, lightweight distribution, tank extents, frame table, permissible SF / BM |
| Damage stability, fleet overview, desktop app | later phases: see the [Roadmap](docs/05-Development-Roadmap.md) |

---

## Documents

| # | Document | What it answers |
|---|---|---|
| — | [Calculation Formulas](docs/Calculation-Formulas.md) | *Which formulas does the app use, exactly?* (written from the code) |
| — | [Installing as an app / hosting](docs/HOSTING.md) | *How is it installed and published?* |
| 1 | [Software Requirements Specification (SRS)](docs/01-SRS.md) | *What must the software do?* (numbered requirements) |
| 2 | [Product Requirements Document (PRD)](docs/02-PRD.md) | *Who is it for and why?* |
| 3 | [System Architecture](docs/03-System-Architecture.md) | *How is it built?* |
| 4 | [UI/UX Specification](docs/04-UI-UX-Specification.md) | *What does it look like?* (see "As built" at the top) |
| 5 | [Development Roadmap](docs/05-Development-Roadmap.md) | *What comes next?* (see "Progress" at the top) |
| 6 | [Technology Recommendation](docs/06-Technology-Recommendation.md) | *Which tools and why?* |
| A | [Appendix A: Calculation Methods](docs/A-Calculation-Methods.md) | *The original method specification* (the formulas actually used are in Calculation Formulas) |

---

## Approval

To be used as an **approved onboard stability instrument**, software needs **classification society type approval** (IACS UR L5, IMO MSC.1/Circ.1229) and **approval of the installed vessel data**. StabilitySoft does not have these approvals yet. The on-screen and report notice about this was removed at the owner's decision, after its results were checked by several users. The design follows the approval requirements (traceable data, fixed formulas, report checksums), so it can be submitted later (Roadmap, Phase 5).

---

## For developers

```bash
npm install
npm run dev      # start locally at http://localhost:5173
npm test         # run the tests (engine, import, reports, storage, settings)
npm run build    # production build in dist/
```

Code layout: `src/engine/` the calculation engine (pure TypeScript, no UI) · `src/importer/` reading and checking source files · `src/report/` PDF, Excel and comparison · `src/ui/` the screens · `src/data/` built-in vessels · `tests/` automatic tests. Pushing to the default branch publishes the app with GitHub Pages ([HOSTING](docs/HOSTING.md)).
