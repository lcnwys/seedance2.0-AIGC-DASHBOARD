import {
  buildArkCreateBody,
  getTaskGenerationTimeSeconds,
  mapArkStatusToLocal,
  normalizeArkTask,
  type ArkTask,
} from '@/lib/modules/provider/seedance/ark'
import type { BuildProviderCreateTaskInput } from '@/lib/modules/provider/types'

function assertVolcenginePayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid provider payload')
  }
}

export function normalizeVolcengineSeedanceTask(payload: unknown) {
  assertVolcenginePayload(payload)
  return normalizeArkTask(payload as ArkTask)
}

export function buildVolcengineSeedanceCreateTaskBody(input: BuildProviderCreateTaskInput) {
  return buildArkCreateBody(input)
}

export function mapVolcengineSeedanceStatusToLocal(status: string) {
  return mapArkStatusToLocal(status)
}

export { getTaskGenerationTimeSeconds as getVolcengineSeedanceTaskGenerationTimeSeconds }
