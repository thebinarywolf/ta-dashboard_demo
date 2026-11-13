# Join-key convention

## Today: `Position ID`

All four synced tabs share a `Position ID` column, stored as `position_id`
on every table (`positions`, `candidate_feedback`, `upcoming_joiners`,
`drop_outs`). It is the join key across the hiring funnel:

```
positions.position_id
  ├── candidate_feedback.position_id   (interview activity for that req)
  ├── upcoming_joiners.position_id     (candidates progressing to joining)
  └── drop_outs.position_id            (candidates who dropped after offer)
```

**Data quality note:** `Position ID` is not always populated in the source
sheet — notably in `Drop Outs`, where most rows have no Position ID (only
9 of 54 sample rows did), and some `Position Tracker` rows (e.g. "All"
TA-assignment rows) have none either. Because of this, `positions` and
`drop_outs` use a surrogate `id uuid` primary key rather than treating
`position_id` as unique — a blank/duplicate `position_id` is expected, not
a bug. Metrics and UI that can't resolve a `position_id` are shown flagged
as "unlinked" rather than silently dropped (see `lib/metrics/dropouts.ts`).

There is also no per-candidate ID anywhere in the sheets — `candidate_name`
is the only cross-tab identity signal, so funnel matching across tabs
(`v_funnel_overall`, `v_funnel_by_department` in
`supabase/migrations/0003_metrics_views.sql`) is a best-effort
`(candidate_name, position_id)` match, not a guaranteed one.

## Future modules: bridge keys back to `Position ID`

The next planned module (Qandle HRMS employee data) has its own identity —
`Employee ID` / `employee_code` — that does not exist until a candidate
actually joins. The convention for wiring a new module in:

1. Add the source to `config/data-sources.ts` (name, type, location, key
   column) and a connector under `lib/connectors/<type>/` implementing
   `lib/connectors/types.ts#Connector`.
2. The new module's own primary key (e.g. `employee_code`) becomes the join
   key *within* that module's tables.
3. Bridge back to this dashboard's data via `upcoming_joiners`: once
   `upcoming_joiners.status` is `Joined`, that row's `position_id` (and
   `candidate_name`) is the link point — the new module should store
   `position_id` (or a resolved `positions.id`) on its employee record so
   a hire can be traced end-to-end from requisition open through ongoing
   employment.
4. Add new `lib/metrics/*.ts` functions that join across both modules'
   tables/views as needed. The UI still only ever imports from
   `lib/metrics/*` — it never gains a direct dependency on the new
   connector or its raw tables.
