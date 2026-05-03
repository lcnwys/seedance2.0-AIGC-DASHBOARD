export type ConfigurableProviderId = 'volcengine' | 'aliyun' | 'grsai'

export type ConfigurableProviderKind = 'video' | 'image' | 'text'

export interface ConfigurableGenerationProvider {
  id: ConfigurableProviderId
  label: string
  defaultApiUrl: string
  capabilities: ConfigurableProviderKind[]
  implementedKinds: ConfigurableProviderKind[]
}

export const CONFIGURABLE_GENERATION_PROVIDERS: ConfigurableGenerationProvider[] = [
  {
    id: 'volcengine',
    label: 'Volcengine Seedance / Seedream',
    defaultApiUrl: 'https://ark.cn-beijing.volces.com',
    capabilities: ['video', 'image'],
    implementedKinds: ['video', 'image'],
  },
  {
    id: 'aliyun',
    label: 'Aliyun Wan',
    defaultApiUrl: 'https://dashscope.aliyuncs.com',
    capabilities: ['video', 'image'],
    implementedKinds: ['video', 'image'],
  },
  {
    id: 'grsai',
    label: 'GRSAI',
    defaultApiUrl: 'https://grsai.dakka.com.cn',
    capabilities: ['text', 'image', 'video'],
    implementedKinds: ['image'],
  },
]

export function normalizeConfigurableProviderId(
  providerId: string | null | undefined,
): ConfigurableProviderId {
  return providerId === 'volcengine' || providerId === 'aliyun' || providerId === 'grsai'
    ? providerId
    : 'volcengine'
}

export function getConfigurableGenerationProvider(
  providerId: string | null | undefined,
): ConfigurableGenerationProvider {
  const normalizedProviderId = normalizeConfigurableProviderId(providerId)
  return CONFIGURABLE_GENERATION_PROVIDERS.find((provider) => provider.id === normalizedProviderId)
    || CONFIGURABLE_GENERATION_PROVIDERS[0]
}

export function getAllConfigurableGenerationProviders(): ConfigurableGenerationProvider[] {
  return CONFIGURABLE_GENERATION_PROVIDERS
}

export function isVideoConfigurableProviderId(
  providerId: string | null | undefined,
): providerId is 'volcengine' | 'aliyun' {
  return getConfigurableGenerationProvider(providerId).implementedKinds.includes('video')
}
