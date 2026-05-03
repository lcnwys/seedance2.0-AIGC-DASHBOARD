# Dashboard Hooks Split Plan

Target hooks to extract from `app/dashboard/page.tsx`:

- `use-dashboard-bootstrap`
- `use-dashboard-stats`
- `use-task-list`
- `use-task-submission`
- `use-task-polling`
- `use-asset-library`
- `use-team-admin`

Goal:

- isolate network/data concerns from presentation
- make dashboard UI components mostly declarative

Current extracted hooks:

- `use-asset-picker`
- `use-asset-library`
- `use-dashboard-bootstrap`
- `use-dashboard-data`
- `use-dashboard-ui`
- `use-generation-estimate`
- `use-reference-assets`
- `use-task-display`
- `use-task-presentation`
- `use-task-polling`
- `use-task-submission`
- `use-team-admin`

Recent adjustments:

- team config bootstrap now only fetches non-sensitive summary flags
- team settings detail is lazy-loaded on modal open by `use-team-admin`
