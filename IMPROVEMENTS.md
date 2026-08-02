# ShelfMind CV/Analytics Upgrade — What Changed and Why

Scope: `python-backend/shelfmind/` only for this pass. No frontend, auth,
product-recognition, OCR, or deployment changes. Architecture, folder
structure, and module boundaries were preserved; every change below
extends an existing module rather than replacing it wholesale.

## Starting point

Before touching anything, I audited the backend end-to-end
(`analytics/`, `restocking/`, `alerts/`, `history/`, `reports/`, `config.py`,
`service.py`, `tests/`). Findings:

- **Occupancy** and **gap detection** were *already* implemented on a
  rasterized union-mask (`analytics/occupancy_mask.py`), not naive
  box-summing — the double-counting / doesn't-scale-across-shelf-sizes
  problem I was worried about didn't apply to the codebase as it stood.
  Left mostly as-is; verified with the existing
  `test_occupancy_and_gaps.py` suite (all passing).
- **Health score** was real but incomplete: 5 components, missing
  "gap distribution" and "alignment quality" signals I wanted, and its
  label cutoffs were hardcoded twice (once in `health_score.py`, once in
  `report_generator.py`).
- **Recommendation engine** was a flat `IF occupancy < threshold THEN
  priority` pattern — single canned reason string, no confidence score,
  no use of history.
- **Historical analytics** only ever compared the two most recent scans;
  no moving average, no percentage change, no multi-scan trend series.
- **Dashboard aggregation** was missing critical/healthy/warning shelf
  counts, average largest gap, alert-severity breakdown, and any
  store-wide trend signal.
- **Business rules** were already well-centralized in `config.py`; a few
  stray hardcoded cutoffs were found and moved in.
- **Tests** covered occupancy/gaps only.

The work below targets exactly these gaps.

## Changes

### 1. New: `analytics/alignment.py`
Adds **Alignment Quality** — how consistently detected products share a
baseline within a shelf row (tidy facing vs. pushed-back/tilted product),
computed as a box-count-weighted inverse of per-row bottom-edge standard
deviation. Reuses `gaps.cluster_rows` (made public, was `_cluster_rows`)
instead of duplicating row-clustering logic.
- **Complexity:** O(n) in detection count.
- **Limitation:** assumes a roughly front-facing camera angle (same
  documented assumption as the existing row-based gap logic); is a
  tidiness proxy, not planogram compliance.

### 2. `analytics/health_score.py` — rewritten
Expanded from 5 to 7 normalized components: occupancy, confidence,
largest-gap, **gap-distribution** (new), **alignment** (new), utilization
(legacy, kept for backward compatibility), historical stability. All
weights live in `config.HealthScoreWeights` and are validated to sum to
1.0 at import time. Label thresholds (`Excellent`/`Good`/.../`Critical`)
now come from a single `config.HealthLabelThresholds`, so the per-shelf
label and the store-level label (`report_generator.py`) can never drift
apart.

### 3. `restocking/rules_engine.py` — rewritten
Still a deterministic, auditable rules engine (not a black-box model —
that was a deliberate choice for explainability), but now multi-factor:
1. Base priority from the existing occupancy/gap-ratio thresholds.
2. **Escalation** from historical signals — a large single-scan health
   drop, or N consecutive declining scans — each escalate priority by one
   level and contribute their own reason.
3. Every contributing signal is collected into `reasons: List[str]`
   (replacing the single templated string) and increments `confidence`
   (0–1, a heuristic signal-count score — documented as such, not a
   calibrated statistical interval).
4. `action` is a concrete SLA string looked up from the final priority.

A `reason` (singular, joined) field is kept for backward compatibility
with `llm/context_builder.py`, which reads it directly.
- **Complexity:** O(1) given the bounded lookback window
  (`RestockingConfig.trend_lookback_scans`, default 3).

### 4. `analytics/comparison.py` — extended
Kept `compare_scans` (pairwise, used by alerts/`compare_latest_two`) and
added `build_trend_summary()`: moving average, percentage change (oldest
→ newest), and trend direction for health/occupancy/gap series over an
arbitrary number of scans. `ScanSnapshot` gained a `largest_gap_ratio`
field so gap trend can be tracked alongside health/occupancy.

### 5. `service.py` — extended
- `run_scan` now computes alignment, passes recent history into the
  recommendation engine, and stores the expanded health/restocking JSON.
- New `shelf_history(shelf_id)`: health/occupancy/gap trends, alert
  history, and recommendation history for one shelf — JSON only.
- `dashboard_summary()` extended with critical/warning/healthy shelf
  counts, average largest gap, alert-severity breakdown, and a
  store-wide trend summary (per-shelf direction rolled up into
  improving/declining/stable counts).
- `_record_to_shelf_report_input` updated to rehydrate the new
  dataclass shapes from stored JSON, with `.get()` fallbacks so scans
  saved before this upgrade remain readable.

### 6. `config.py` — extended
Added `AlignmentConfig`, `HealthLabelThresholds`, `TrendConfig`, and
expanded `RestockingConfig`/`HealthScoreWeights`. Every new threshold,
weight, and SLA action string is configurable; no new hardcoded
constants were introduced. Remaining stray hardcoded label cutoffs in
`report_generator.py` were replaced with references to
`settings.health_labels`.

### 7. Tests
Added, alongside the existing `test_occupancy_and_gaps.py`:
- `test_health_score.py` — alignment quality, gap-distribution
  component, label thresholds, weight-sum invariant.
- `test_recommendation_engine.py` — base rules, historical escalation,
  confidence scaling, reasons/action serialization, graceful
  no-history degradation.
- `test_historical_analytics.py` — moving average, percentage change,
  trend direction (improving/declining/stable), pairwise `compare_scans`.
- `test_dashboard.py` — dashboard health-bucket counts, empty-store
  edge case, `shelf_history` output shape.

All 35 tests pass (`python -m pytest shelfmind/tests/ -v`), and the
existing `test_pipeline_smoke.py` end-to-end scenario (scan → compare →
dashboard → store report → chat) still runs clean.

## Bug found and fixed during testing

While writing the recommendation-engine tests, `_consecutive_declines`
was found to have an inverted diff direction (it compared
`current − older` instead of `older − current`), which meant the
"N consecutive declining scans" signal could never fire. Fixed and
covered by `test_consecutive_declines_trigger_streak_reason`.

## What was deliberately *not* done

- **Literal multi-shelf detection within one frame** ("assign every
  object to its shelf") was not added. The system's existing design
  already treats each photographed frame as one shelf scan (`shelf_id`
  is supplied per scan, and occupancy/gap/alignment are all computed
  over that frame) — the "assignment" step is the capture protocol
  itself. Building true multi-shelf segmentation within a single image
  would require a new CV model (shelf-boundary detection), which is a
  materially larger scope than an analytics redesign and was judged out
  of scope for this pass; flagging it here rather than fabricating a
  stub.
- **Frontend / `lib/api-zod` / `lib/api-client-react` / `openapi.yaml`**
  were left untouched for this pass. The health/restocking JSON payloads
  gained new fields but preserved old ones (`reason`, base component
  names), so existing consumers keep working; regenerating the OpenAPI
  types to formally expose `reasons`/`confidence`/`action` is a
  follow-up if the frontend needs to surface them.

## Follow-up pass: dashboard redesign, demand analytics, auto scan scheduler

Scope this time: country dropdown fix, dashboard/charts, demand analytics
+ analytics report, and the auto-scan scheduler — frontend, backend, and
the `openapi.yaml` → orval codegen pipeline all touched, since the new
endpoints needed typed hooks generated the same way the existing ones are.

- **Country dropdown** (`src/pages/login.tsx`, `profile.tsx`): the plain
  Radix `Select` rendering all 190+ countries could overflow small
  viewports with no reliable internal scroll. Replaced with a
  `CountrySelect` combobox (`components/country-select.tsx`) built on the
  existing `Popover` + `Command` components, giving a bounded,
  independently-scrollable list, type-to-filter search, and working
  keyboard nav — no new dependencies.
- **Dashboard** (`service.dashboard_summary`): added `total_scans`,
  `low_stock_products`, `restock_alerts`, all real tallies over stored
  scans (not derived/estimated). Frontend dashboard rebuilt with 8 stat
  cards plus 3 charts (shelf health comparison, inventory distribution,
  health trend) using `recharts`, matching the existing pattern already
  used in `shelf-detail.tsx`.
- **Demand Analytics + Analytics Report** (`analytics/demand.py`,
  `reports/insight_generator.py`): new modules, new
  `/analytics/demand` and `/analytics/report` endpoints, new `/analytics`
  page. See `shelfmind/README.md` for the ranking/insight rules — the
  short version is every number traces back to a real scan, and an
  "insufficient data" state is returned explicitly rather than an insight
  being fabricated for a shelf with too little history.
- **Auto Scan Scheduler** (`scheduling/`): real `APScheduler` background
  job, timezone-aware peak/off-peak interval logic, new `scan_schedules`
  table, new `/schedule` GET/PUT endpoints, and a settings card on the
  profile page. Deliberately does *not* pretend to capture a photo itself
  (no camera integration exists in this project) — see the module
  docstring and README section for the honest scope of what it does.
- **Tests**: `test_demand_analytics.py`, `test_analytics_report.py`,
  `test_scan_scheduler.py`, plus new endpoint-level test classes in
  `test_api_integration.py`. One existing test
  (`test_dashboard_empty_store_reports_zero_shelves`) was updated for the
  new `total_scans` field. Full suite: 77/77 passing.

## Async scan pipeline + no-permanent-image-storage (this pass)

Scope: convert scan processing from synchronous to an async job pipeline,
and stop storing uploaded shelf photos (and derived visualizations)
permanently. No frontend redesign, auth, or product-recognition changes.

### 1. Async scan pipeline: Celery + Redis

`POST /scan/{shelf_id}` used to block for the entire
detect -> analyze -> save cycle before responding. It now:

1. Validates the upload and confirms a detection model is configured
   (same checks as before, same status codes).
2. Writes the image to a temp scratch file under `settings.paths.temp_dir`.
3. Creates a `scan_jobs` row (`shelfmind/jobs/`) with status `PENDING`.
4. Enqueues `shelfmind.tasks.scan_tasks.process_scan_job` via Celery and
   returns **`202 Accepted`** with `{job_id, status, status_url}`
   immediately — no waiting on inference.

A separate worker process (`celery -A shelfmind.tasks.celery_app worker`)
picks the job up, marks it `PROCESSING`, runs the *exact same*
`ShelfMindService.run_scan()` pipeline as before (detection -> analytics ->
save), and marks the job `COMPLETED` (with the full result payload) or
`FAILED` (with an error message). Clients poll `GET /scan/jobs/{job_id}`
until the status is terminal; `GET /scan/jobs` lists recent jobs for the
current store. `docker-compose.yml` gained `redis`, `worker`, and `beat`
services; `SHELFMIND_CELERY_EAGER=true` runs tasks inline for local dev
without Redis.

### 2. Uploaded images are never stored permanently

`ShelfMindService.run_scan()` was reworked so the annotated/heatmap
visualizations it generates (previously written to `images_dir` /
`heatmaps_dir` and referenced from `ScanRecord.image_path` /
`heatmap_path`) are now written only to the same ephemeral `temp_dir` and
are **always** deleted in a `finally` block before `run_scan()` returns —
whether the scan succeeded or an exception was raised partway through.
`image_path`/`heatmap_path` are now always `None` in the database. The
original uploaded photo is deleted by the Celery task itself, also in a
`finally`, right after processing ends. A periodic `celery beat` task
(`cleanup_orphaned_temp_files`, every 15 min) is a backstop for the case
where a worker process is killed mid-task and the normal `finally` never
runs.

Only structured output is ever persisted: detections, occupancy/gap
analytics, health score, restocking recommendation, alerts, and the
generated report text — exactly the same fields `ScanRecord` stored
before, minus the two image paths.

### Tests

New `test_async_scan_pipeline.py`: job-repository lifecycle
(create/processing/completed/failed, store-scoped lookups), two
regression tests proving `temp_dir` is empty after both a *successful* and
a *failed* `run_scan()` call, and full HTTP-level tests for
`POST /scan/{shelf_id}` + `GET /scan/jobs/{id}` (auth required, 404 for
unknown jobs, 503 with no job created when the model isn't configured, and
a full run with Celery's eager mode). Full suite: 112/112 passing.
