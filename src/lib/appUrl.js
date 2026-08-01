const stripTrailingSlash = (value) => value.replace(/\/+$/, '')

export const getAppBaseUrl = () => {
  const configuredUrl = import.meta.env.VITE_APP_URL?.trim()
  if (configuredUrl) return stripTrailingSlash(configuredUrl)

  if (typeof window !== 'undefined' && window.location?.origin) {
    return stripTrailingSlash(window.location.origin)
  }

  return 'http://localhost:5173'
}

export const getAppUrl = (path = '') => {
  const baseUrl = getAppBaseUrl()
  if (!path) return baseUrl
  return new URL(path, baseUrl).toString()
}