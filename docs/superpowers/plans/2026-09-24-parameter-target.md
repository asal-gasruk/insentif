# Parameter Target Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** CRUD + seed import TARGET per Tim × Parameter × Periode dari Excel Agustus 2026.

**Architecture:** Entity `ParameterTarget` di AppData; generator Python → JSON; page `/target`; seed merge.

**Tech Stack:** Next.js, TypeScript, openpyxl, localStorage AppData.

## Global Constraints

- Fase 1 hanya TARGET (no Actual)
- Unique key: (teamId|employeeId, paramId, period)
- Period import default: `2026-08`

---

### Task 1: Types + storage
- [ ] Add `ParameterTarget` + `parameterTargets` to AppData/CollectionKey
- [ ] Migrate storage default `[]`; bump STORAGE_KEY v13

### Task 2: Excel generator + import
- [ ] `scripts/generate-parameter-targets.py`
- [ ] `src/data/parameter-targets-excel.json`
- [ ] `src/lib/parameter-target-import.ts` + seed wire

### Task 3: UI `/target` + nav
- [ ] Page CRUD with filters
- [ ] AppShell nav link

### Task 4: Verify
- [ ] `generate` + assert sample + `tsc`
