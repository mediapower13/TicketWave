const stripTrailingSlash = (value) => value.replace(/\/+$/, '')

export const getAppBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return stripTrailingSlash(window.location.origin)
  }

  const configuredUrl = import.meta.env.VITE_APP_URL?.trim()
  if (configuredUrl) return stripTrailingSlash(configuredUrl)

  return 'http://localhost:5173'
}

export const getAppUrl = (path = '') => {
  const baseUrl = getAppBaseUrl()
  if (!path) return baseUrl
  return new URL(path, baseUrl).toString()
}