# Generation Provider Refactor Plan

## Purpose

This document records the planned refactor for video and image generation providers. It is intended as a handoff point so future work can continue from the current state without re-discovering the architecture.

The target principle is:

> Users choose a model. The model chooses a provider. The provider adapter owns upstream protocol differences. The task engine owns lifecycle, storage, billing, and finalization.

## Current State

As of 2026-04-23:

- Video providers live under `lib/modules/provider`.
  - `volcengine`
  - `aliyun`
- Image providers live under `lib/modules/image`.
  - `volcengine`
  - `aliyun`
  - `grsai`
- Image model catalog lives in `lib/modules/image/models.ts`.
- Video model catalog lives in `lib/modules/video/models.ts`.
- Team-level provider credentials are stored in `TeamProviderConfig`.
- `grsai` should be modeled as a large-model aggregation platform, not an image-only vendor.
  - Platform capability: text + image + video.
  - Current system integration: image generation only, via its GPT Image API adapter.
  - Default API URL: `https://grsai.dakka.com.cn`
  - Create endpoint: `POST /v1/draw/completions`
  - Result endpoint: `POST /v1/draw/result`
  - Current implementation submits with `webHook: "-1"` and polls for the result.
- A temporary shared provider config list exists at `lib/modules/provider/configurable-providers.ts`.
- Existing naming is still mixed:
  - `getUserVideoProviderConfig` is also used by image tasks.
  - `TeamVideoProviderConfig` is effectively a generic provider config.

## Problem

The codebase already supports multiple upstream vendors, but the boundaries are uneven:

- Video and image providers use separate registries and interfaces.
- Some generic provider configuration still uses video-specific names.
- Route and execution code still know too much about individual provider protocols.
- Debug payloads and endpoint metadata are partly hardcoded.
- Adding a new vendor currently requires touching provider code, model config, team config UI, label helpers, and execution details.

The refactor should make new provider onboarding mostly a matter of:

1. Add provider metadata.
2. Add image and/or video adapter.
3. Add model catalog entries.
4. Add normalizer tests.

## Target Directory Shape

This is the desired long-term shape. It does not need to be moved all at once.

```text
lib/modules/generation/
  types.ts
  registry.ts
  config.ts

  models/
    image.ts
    video.ts
    pricing.ts

  providers/
    volcengine/
      index.ts
      image.ts
      video.ts
      normalizers.ts
    aliyun/
      index.ts
      image.ts
      video.ts
      normalizers.ts
    grsai/
      index.ts
      image.ts
      normalizers.ts

  execution/
    create-task.ts
    execute-image-task.ts
    execute-video-task.ts
    poll-task.ts
    handle-callback.ts
    finalize-success.ts
    finalize-failure.ts

  storage/
    import-result.ts

  billing/
    estimate.ts
    settle.ts
```

## Target Provider Metadata

Unify provider metadata across image, video, and text. A provider may support one or more generation kinds. Platform capability and current application implementation should be tracked separately.

```ts
export type GenerationKind = 'image' | 'video' | 'text'

export type GenerationProviderId =
  | 'volcengine'
  | 'aliyun'
  | 'grsai'

export interface GenerationProvider {
  id: GenerationProviderId
  label: string
  defaultApiUrl: string
  auth: {
    type: 'bearer'
    headerName?: string
  }
  capabilities: GenerationKind[]
  implementedKinds: GenerationKind[]
}
```

Provider examples:

- `volcengine`: image + video
- `aliyun`: image + video
- `grsai`: platform capability includes text + image + video; current app implementation only includes image

## Target Model Catalog

The model catalog should be the single source of truth for selecting a provider.

```ts
export interface GenerationModelConfig {
  id: string
  key: string
  providerId: GenerationProviderId
  kind: GenerationKind
  providerModelId: string

  label: string
  description: string

  supportedModes: string[]
  supportedSizes?: string[]
  supportedRatios?: string[]
  supportedOutputFormats?: string[]

  limits: {
    maxReferenceImages?: number
    maxOutputs?: number
    maxPromptLength?: number
  }

  features: {
    references: boolean
    sequential: boolean
    bboxEdit: boolean
    webSearch: boolean
    watermark: boolean
    callback: boolean
    polling: boolean
    streaming: boolean
  }

  pricing?: {
    strategy: 'per_image' | 'per_second' | 'token' | 'custom'
    rateYuan?: number
  }
}
```

Keep image and video catalogs in separate files if that is easier, but use a shared type.

## Target Normalized Input

Do not pass provider-specific payloads through routes or task orchestration. Convert user input to a normalized internal request first.

```ts
export interface NormalizedGenerationInput {
  kind: 'image' | 'video'
  mode: string
  model: string
  prompt: string

  references: Array<{
    type: 'image' | 'video' | 'audio'
    url: string
    assetId?: string
  }>

  params: {
    size?: string
    ratio?: string
    resolution?: string
    duration?: number
    outputFormat?: 'png' | 'jpeg' | 'mp4'
    watermark?: boolean
    seed?: string | number
    maxOutputs?: number
    bboxList?: unknown
    webSearch?: boolean
  }

  callbackUrl?: string | null
}
```

## Target Adapter Interfaces

Provider adapters own request construction, submission, polling, callback normalization, and upstream error normalization.

```ts
export interface ImageGenerationAdapter {
  providerId: GenerationProviderId

  buildRequest(input: NormalizedGenerationInput): ProviderRequest

  submit(params: {
    apiUrl: string
    apiKey: string
    request: ProviderRequest
  }): Promise<ProviderSubmitResult>

  poll?(params: {
    apiUrl: string
    apiKey: string
    taskId: string
  }): Promise<ProviderGenerationResult>

  normalizeCallback?(payload: unknown): ProviderGenerationResult
}
```

Video should use the same shape with optional `cancel` and provider-specific task listing if needed.

```ts
export interface VideoGenerationAdapter {
  providerId: GenerationProviderId

  buildRequest(input: NormalizedGenerationInput): ProviderRequest
  submit(params: SubmitParams): Promise<ProviderSubmitResult>
  poll(params: PollParams): Promise<ProviderGenerationResult>
  cancel?(params: CancelParams): Promise<void>
  normalizeCallback?(payload: unknown): ProviderGenerationResult
}
```

## Target Provider Result

All upstream responses should normalize into one result shape.

```ts
export interface ProviderGenerationResult {
  providerTaskId?: string
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'expired'
  progress?: number

  outputs: Array<{
    type: 'image' | 'video'
    url: string
    size?: string | null
    duration?: number | null
  }>

  usage?: {
    generatedImages?: number
    outputTokens?: number
    totalTokens?: number
    durationSeconds?: number
  }

  error?: {
    code?: string | null
    message?: string | null
    raw?: unknown
  }

  raw?: unknown
}
```

This should cover:

- GRSAI `results[].url`
- Aliyun `output.choices[].message.content[].image`
- Volcengine image result arrays
- Video output URLs and duration metadata

## Execution Flow

The desired generation flow:

1. Route authenticates user and parses input.
2. Route resolves `modelConfig`.
3. Route enforces budget and submission guard.
4. Route creates a local task row.
5. Background executor loads the task.
6. Executor resolves provider config by `modelConfig.providerId`.
7. Executor gets adapter by `kind + providerId`.
8. Adapter builds and submits upstream request.
9. Executor handles one of:
   - Direct successful result.
   - Provider task id requiring polling.
   - Webhook-only task id.
   - Submit failure.
10. Finalizer imports remote outputs to object storage.
11. Billing settlement captures or releases reservation.
12. Local task is updated with normalized status, outputs, usage, cost, and raw provider data.

Routes should not know upstream payload formats.

## Refactor Phases

### Phase 1: Provider Config Naming

Goal: remove video-specific naming from generic provider config.

- Add `getUserProviderConfig(userId, providerId)`.
- Add `getTeamProviderConfigByTeamId(teamId, providerId)`.
- Add `resolveTeamProviderConfig(team, providerId)`.
- Keep `getUserVideoProviderConfig` as a deprecated wrapper.
- Rename `TeamVideoProviderConfig` type to `TeamProviderConfigResolved`.
- Update image paths to use the generic helper first.

Suggested first files:

- `lib/seedance-config.ts`
- `app/api/team/config/route.ts`
- `lib/modules/image/task-execution.ts`
- `app/api/generate/image/route.ts`

### Phase 2: Image Adapter First

Goal: normalize image providers before touching video.

- Introduce `lib/modules/generation/types.ts`.
- Introduce `lib/modules/generation/providers/*/image.ts`.
- Move image provider implementations behind a shared adapter interface.
- Make `lib/modules/image/task-execution.ts` depend on the adapter interface.
- Remove hardcoded endpoint selection from `buildDebugPayload`.

Provider migration order:

1. `grsai` image adapter because it is currently the smallest implemented surface. Do not model the whole GRSAI platform as image-only.
2. `aliyun` because it has a distinct multimodal response shape.
3. `volcengine` because it is closest to OpenAI-style image generation.

### Phase 3: Video Adapter

Goal: make video providers follow the same provider boundary.

- Wrap current `VideoGenerationProvider` behind the generation adapter concept.
- Keep existing video routes working while moving protocol-specific code out.
- Normalize create, get, delete, list, callback, and status mapping outputs.

Suggested files:

- `lib/modules/provider/providers/volcengine.ts`
- `lib/modules/provider/providers/aliyun.ts`
- `app/api/generate/video/route.ts`
- `app/api/tasks/[id]/status/route.ts`
- `app/api/webhook/video/route.ts`

### Phase 4: Unified Orchestration

Goal: move lifecycle ownership out of routes and provider adapters.

- Introduce `executeGenerationTask(taskId, kind)`.
- Introduce shared success finalizer.
- Introduce shared failure finalizer.
- Route responsibilities should shrink to auth, validation, task creation, and response.
- Polling and webhook should converge on the same terminal-state finalizer.

### Phase 5: Provider Tests

Goal: make provider onboarding safe.

For each provider adapter, add fixtures for:

- Submit success with immediate result.
- Submit success with task id.
- Poll running.
- Poll succeeded.
- Poll failed.
- Auth failure.
- Bad request.
- Empty output.
- Unexpected upstream payload.

Recommended test focus:

- Normalizer output.
- Error normalization.
- Request body construction.

## Provider Onboarding Checklist

Use this checklist for every new upstream vendor.

- [ ] Add provider metadata.
- [ ] Add image adapter and/or video adapter.
- [ ] Add model catalog entries.
- [ ] Add pricing rule or explicitly mark pricing unknown.
- [ ] Add team config UI label automatically through provider metadata.
- [ ] Add normalizer fixtures and tests.
- [ ] Verify `npm run build`.
- [ ] Verify one manual task creation path.
- [ ] Verify failed upstream request releases reserved budget.
- [ ] Verify successful output is imported to object storage.

## Current Next Step

Start with Phase 1.

The first concrete task should be:

> Rename and wrap generic provider config helpers in `lib/seedance-config.ts`, then update image generation code to call the generic helper while leaving video call sites on the compatibility wrapper.

This is low risk and unlocks cleaner image adapter work.

Progress update:

- Generic provider config helpers have been introduced.
- Image generation paths have already been switched to generic helpers.
- Video generation, task status, task deletion, sync, and admin reconciliation paths have also started switching to generic helpers.
- Video model catalog now also carries `providerProtocol`, so both image and video are moving toward "model decides protocol".
- Video adapter registry has been introduced as a compatibility layer:
  - `volcengine-seedance-v1`
  - `aliyun-wan-27-video`
- Current video routes and sync paths should resolve adapter by model protocol first, then only fall back to provider id for old records.
- The next cleanup step has started:
  - each video protocol should live in its own adapter file
  - task/model based adapter resolution should be centralized instead of repeated in routes and sync jobs

## Notes From GRSAI Integration

GRSAI platform notes:

- GRSAI is a large-model aggregation platform, not a dedicated image-only provider.
- It may later expose text and video models through the same team credential and provider config.
- Current app integration only implements selected image API paths.

GRSAI image-specific behavior currently implemented:

- Uses bearer token auth.
- Uses `webHook: "-1"` to force immediate task id response.
- Polls `/v1/draw/result` until `succeeded` or `failed`.
- Normalizes `results[].url` into image items.
- Uses `gpt-image-2` as model id.
- Also implements Nano Banana image endpoint for the selected models:
  - `nano-banana-pro`
  - `nano-banana-2`
- Nano Banana uses `POST /v1/draw/nano-banana`.
- Nano Banana request maps the app `size` field to upstream `aspectRatio`.
- Nano Banana currently submits `imageSize: "1K"` by default. Add explicit UI/API support before exposing 2K/4K.
- GRSAI image protocol selection should be driven by model metadata such as `providerProtocol`, not hardcoded model-name branches inside the provider.
- GPT Image supported ratios are:
  - `auto`
  - `1:1`
  - `3:2`
  - `2:3`
  - `16:9`
  - `9:16`
  - `4:3`
  - `3:4`
  - `21:9`
  - `9:21`
  - `1:3`
  - `3:1`
  - `2:1`
  - `1:2`
- Pricing is currently unknown and not configured.
