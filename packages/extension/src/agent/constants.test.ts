import { describe, expect, it } from 'vitest'

import { DEFAULT_CONFIG, DEMO_BASE_URL, DEMO_MODEL } from './constants'

describe('DEFAULT_CONFIG (Cicero Gemini default)', () => {
	it('targets gemini-3.5-flash', () => {
		expect(DEFAULT_CONFIG.model).toBe('gemini-3.5-flash')
	})

	it('uses the Gemini OpenAI-compatible endpoint', () => {
		expect(DEFAULT_CONFIG.baseURL).toContain('generativelanguage.googleapis.com/v1beta/openai')
	})

	it('ships with no embedded API key (she pastes it once)', () => {
		expect(DEFAULT_CONFIG.apiKey ?? '').toBe('')
	})

	it('does not repurpose the DEMO_* testing endpoint (keeps isTestingEndpoint correct)', () => {
		expect(DEMO_MODEL).toBe('qwen3.5-plus')
		expect(DEFAULT_CONFIG.baseURL).not.toBe(DEMO_BASE_URL)
		expect(DEFAULT_CONFIG.model).not.toBe(DEMO_MODEL)
	})
})
