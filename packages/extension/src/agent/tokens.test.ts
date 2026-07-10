import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	HUB_TOKEN_KEY,
	USER_AUTH_TOKEN_KEY,
	ensureStorageToken,
	isHubTokenAuthorized,
} from './tokens'

/**
 * The hub/user tokens gate who may "accept calls" into the extension. They must be
 * generated randomly on first run, persisted, and — crucially — never overwritten
 * once present, so a configured caller keeps working across reloads.
 */

interface FakeStore {
	[key: string]: unknown
}

function installChrome(initial: FakeStore = {}) {
	const store: FakeStore = { ...initial }
	const get = vi.fn(async (key: string) => ({ [key]: store[key] }))
	const set = vi.fn(async (items: FakeStore) => {
		Object.assign(store, items)
	})
	;(globalThis as any).chrome = { storage: { local: { get, set } } }
	return { store, get, set }
}

afterEach(() => {
	vi.restoreAllMocks()
	delete (globalThis as any).chrome
})

describe('ensureStorageToken', () => {
	beforeEach(() => {
		// Deterministic token so assertions are stable.
		vi.spyOn(crypto, 'randomUUID').mockReturnValue(
			'11111111-1111-4111-8111-111111111111' as `${string}-${string}-${string}-${string}-${string}`
		)
	})

	it('generates and persists a random token when none exists', async () => {
		const { store, set } = installChrome()

		const token = await ensureStorageToken(HUB_TOKEN_KEY)

		expect(token).toBe('11111111-1111-4111-8111-111111111111')
		expect(store[HUB_TOKEN_KEY]).toBe(token)
		expect(set).toHaveBeenCalledWith({ [HUB_TOKEN_KEY]: token })
	})

	it('does NOT overwrite an existing token', async () => {
		const existing = 'existing-token-keep-me'
		const { store, set } = installChrome({ [HUB_TOKEN_KEY]: existing })

		const token = await ensureStorageToken(HUB_TOKEN_KEY)

		expect(token).toBe(existing)
		expect(store[HUB_TOKEN_KEY]).toBe(existing)
		expect(set).not.toHaveBeenCalled()
	})

	it('regenerates when the stored value is an empty string', async () => {
		const { store, set } = installChrome({ [USER_AUTH_TOKEN_KEY]: '' })

		const token = await ensureStorageToken(USER_AUTH_TOKEN_KEY)

		expect(token).toBe('11111111-1111-4111-8111-111111111111')
		expect(store[USER_AUTH_TOKEN_KEY]).toBe(token)
		expect(set).toHaveBeenCalledTimes(1)
	})

	it('regenerates when the stored value is a non-string', async () => {
		const { set } = installChrome({ [HUB_TOKEN_KEY]: 12345 })

		const token = await ensureStorageToken(HUB_TOKEN_KEY)

		expect(token).toBe('11111111-1111-4111-8111-111111111111')
		expect(set).toHaveBeenCalledTimes(1)
	})
})

describe('isHubTokenAuthorized', () => {
	it('authorizes when provided matches a non-empty stored token', () => {
		expect(isHubTokenAuthorized('secret-abc', 'secret-abc')).toBe(true)
	})

	it('rejects a mismatching token', () => {
		expect(isHubTokenAuthorized('secret-abc', 'wrong')).toBe(false)
	})

	it('rejects when no token is provided', () => {
		expect(isHubTokenAuthorized('secret-abc', undefined)).toBe(false)
		expect(isHubTokenAuthorized('secret-abc', '')).toBe(false)
	})

	it('never authorizes against an empty/missing stored token (no token = no bypass)', () => {
		expect(isHubTokenAuthorized('', '')).toBe(false)
		expect(isHubTokenAuthorized(undefined, undefined)).toBe(false)
		expect(isHubTokenAuthorized(null, 'anything')).toBe(false)
	})
})
