/**
 * Tokens that gate who may "accept calls" into the extension.
 *
 * - `PageAgentExtUserAuthToken` lets a web page call the in-page agent API.
 * - `PageAgentExtHubToken` lets an external app (via the MCP hub bridge) drive the
 *   browser without the per-session confirm dialog.
 *
 * Both follow the same lifecycle: empty by default, generated randomly on first
 * use, and never overwritten once present.
 */

export const USER_AUTH_TOKEN_KEY = 'PageAgentExtUserAuthToken'
export const HUB_TOKEN_KEY = 'PageAgentExtHubToken'

/**
 * Return the stored token for `key`, generating and persisting a random one on
 * first use. An existing non-empty string is returned untouched (never
 * overwritten); an empty/non-string value is treated as "missing" and replaced.
 */
export async function ensureStorageToken(key: string): Promise<string> {
	const result = await chrome.storage.local.get(key)
	const existing = result[key]
	if (typeof existing === 'string' && existing.length > 0) return existing

	const token = crypto.randomUUID()
	await chrome.storage.local.set({ [key]: token })
	return token
}

/**
 * Whether an incoming hub call is pre-authorized by its token. Authorization
 * requires a non-empty stored token AND an exact match — a missing or empty
 * stored token never grants a bypass.
 */
export function isHubTokenAuthorized(stored: unknown, provided: unknown): boolean {
	if (typeof stored !== 'string' || stored.length === 0) return false
	if (typeof provided !== 'string' || provided.length === 0) return false
	return stored === provided
}
