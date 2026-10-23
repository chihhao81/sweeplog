const TOKEN_KEY = 'API_TOKEN'

export function getToken(): string | null {
  return PropertiesService.getScriptProperties().getProperty(TOKEN_KEY)
}

/** Creates a new random token, replacing any existing one. */
export function rotateToken(): string {
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '')
  PropertiesService.getScriptProperties().setProperty(TOKEN_KEY, token)
  return token
}

export function isAuthorized(candidate: unknown): boolean {
  const token = getToken()
  if (!token || typeof candidate !== 'string' || candidate.length !== token.length) return false
  // Constant-time compare
  let diff = 0
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ candidate.charCodeAt(i)
  return diff === 0
}
