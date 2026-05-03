# Refactor Blueprint

## Goal

Move the project from a route-driven prototype into a modular monolith that can grow toward a commercial product without continuing to accumulate billing and dashboard debt.

## Current Pain Points

- `app/dashboard/page.tsx` is a 4k+ line god component.
- Billing logic is duplicated across submit, polling, webhook, manual refund, and admin sync paths.
- Task state and billing state are mixed in the same condition branches.
- Upstream provider integration logic is spread across multiple routes.
- Statistics are partially derived from task rows instead of a stable domain boundary.

## Target Module Boundaries

The application should be split by domain, not by route.

### `lib/modules/auth`

- Session validation
- Current-user loading
- Role/team guards

### `lib/modules/jobs`

- Job state machine
- Job repositories and selectors
- Upstream-to-local status mapping
- Idempotent finalization entrypoints

### `lib/modules/billing`

- Reservation policy
- Estimated/actual cost resolution
- Billing type inference
- Reservation capture/release semantics
- Later: ledger and reservation records

### `lib/modules/provider/seedance`

- Seed normalization
- Request payload construction
- Response mapping
- Webhook/polling normalization

### `lib/modules/stats`

- Read models for dashboard/admin reporting
- Aggregations built from stable domain rules
- Later: move to ledger-backed queries

### `components/dashboard`

- Layout shell
- Generation panel
- Task list panel
- Task detail modal
- Stats panels
- Team/admin panels

## Recommended Domain Model Evolution

The current single-task-row approach should evolve toward these concepts:

1. `GenerationJob`
   - Request identity and execution lifecycle
2. `BillingReservation`
   - Reserved estimate per job
3. `BillingLedgerEntry`
   - Immutable money movement history
4. `ProviderTaskEvent`
   - Stored upstream webhook/poll snapshots for audit/replay

Short-term, the code should simulate these boundaries in services even before all tables exist.

## State Machines

### Job State

- `draft`
- `submitted`
- `queued`
- `running`
- `succeeded`
- `failed`
- `expired`
- `cancelled`

### Billing State

- `none`
- `reserved`
- `captured`
- `released`
- `adjusted`

The codebase should stop inferring billing state from a mix of `status`, `billingType`, and nullable cost fields.

## Refactor Phases

### Phase 1: Stabilize Boundaries

- Extract shared session helpers
- Extract provider seed normalization
- Extract billing cost helpers
- Keep behavior unchanged where possible

### Phase 2: Centralize Finalization

- Introduce one success finalization path
- Introduce one failure finalization path
- Make webhook and polling call the same domain service
- Fix submit-failure compensation

### Phase 3: Split Dashboard

- Move dashboard stats, generation form, task list, and modals into separate components/hooks
- Reduce `app/dashboard/page.tsx` to orchestration only

### Phase 4: Introduce Ledger/Reservation Records

- Add reservation and ledger tables
- Move stats to ledger-driven aggregation
- Keep task rows as execution records, not accounting truth

## Non-Negotiable Engineering Rules

- All billing mutations must be transactional.
- Success/failure finalization must be idempotent.
- Webhook and polling must not own separate accounting logic.
- Upstream submit failure must release reservations immediately.
- Statistics must use one authoritative cost interpretation.

## Immediate Next Steps

1. Continue extracting reusable helpers into `lib/modules/*`
2. Introduce centralized task finalization services
3. Begin splitting dashboard UI into `components/dashboard/*`
