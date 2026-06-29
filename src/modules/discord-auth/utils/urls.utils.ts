/**
 * Utility functions for dynamic URL generation
 */

export const getBackendUrl = (): string => {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL;
  const baseUrl = configuredBaseUrl || `${window.location.origin}/api`;

  return baseUrl.endsWith('/api') ? baseUrl : `${baseUrl.replace(/\/$/, '')}/api`
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
  return `${getBackendUrl()}${endpoint}`
} 
