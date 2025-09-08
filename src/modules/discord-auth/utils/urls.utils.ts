/**
 * Utility functions for dynamic URL generation
 */

export const getBackendUrl = (): string => {
  // Use environment variable if available
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL
  }

  const protocol = window.location.protocol
  const hostname = window.location.hostname
  const port = import.meta.env.VITE_BACKEND_PORT
  return `${protocol}//${hostname}:${port}`
}

export const getRedirectUri = (): string => {
  // Use environment variable if available
  if (import.meta.env.VITE_DISCORD_REDIRECT_URI) {
    return import.meta.env.VITE_DISCORD_REDIRECT_URI;
  }
  
  // Dynamic redirect URI
  return `${location.origin}`
}

export const getApiUrl = (endpoint: string): string => {
  return `${getBackendUrl()}/api${endpoint}`
} 