import {
  buildSafetyIdentifier,
  createArkTask,
  DEFAULT_ARK_API_URL,
  deleteArkTask,
  getArkTask,
  listAllArkTasks,
  listArkTasks,
} from '@/lib/modules/provider/seedance/ark'
import type { VideoGenerationAdapter } from '@/lib/modules/video/adapters/types'
import {
  buildVolcengineSeedanceCreateTaskBody,
  getVolcengineSeedanceTaskGenerationTimeSeconds,
  mapVolcengineSeedanceStatusToLocal,
  normalizeVolcengineSeedanceTask,
} from '@/lib/modules/video/adapters/volcengine-seedance-v1-shared'

export const volcengineSeedanceV1Adapter: VideoGenerationAdapter = {
  id: 'volcengine',
  label: 'Volcengine Ark Seedance',
  defaultApiUrl: DEFAULT_ARK_API_URL,
  protocol: 'volcengine-seedance-v1',
  providerId: 'volcengine',
  buildSafetyIdentifier,
  buildCreateTaskBody(input) {
    return buildVolcengineSeedanceCreateTaskBody(input)
  },
  async createTask(params) {
    return createArkTask(params)
  },
  async getTask(params) {
    const task = await getArkTask(params.apiUrl, params.apiKey, params.taskId)
    return normalizeVolcengineSeedanceTask(task)
  },
  async deleteTask(params) {
    await deleteArkTask(params.apiUrl, params.apiKey, params.taskId)
  },
  async listTasks(params) {
    const response = await listArkTasks(params)
    return {
      ...response,
      items: response.items.map(normalizeVolcengineSeedanceTask),
    }
  },
  async listAllTasks(params) {
    const response = await listAllArkTasks(params)
    return {
      ...response,
      items: response.items.map(normalizeVolcengineSeedanceTask),
    }
  },
  normalizeIncomingTask(payload: unknown) {
    return normalizeVolcengineSeedanceTask(payload)
  },
  mapStatusToLocal(status: string) {
    return mapVolcengineSeedanceStatusToLocal(status)
  },
  getTaskGenerationTimeSeconds(task) {
    return getVolcengineSeedanceTaskGenerationTimeSeconds(task)
  },
}
