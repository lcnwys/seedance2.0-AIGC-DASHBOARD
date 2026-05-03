# Dashboard UI Split Plan

Target split for `app/dashboard/page.tsx`:

- `dashboard-shell.tsx`
- `generation-panel.tsx`
- `task-list-panel.tsx`
- `task-detail-modal.tsx`
- `stats-overview-panel.tsx`
- `team-admin-panel.tsx`
- `settings-modal.tsx`

The page file should eventually keep only:

- auth/session bootstrap
- top-level layout composition
- shared page orchestration
