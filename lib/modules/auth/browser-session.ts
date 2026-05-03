export function clearBrowserSession() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  localStorage.removeItem('seedance_api_key')
  localStorage.removeItem('seedance_url')
}

export function getStoredToken() {
  return localStorage.getItem('token')
}

export function getStoredUser<T>() {
  const raw = localStorage.getItem('user')
  if (!raw) return null

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function getStoredSeedanceConfig() {
  return {
    seedanceUrl: localStorage.getItem('seedance_url') || 'https://ark.cn-beijing.volces.com',
  }
}
