import { describe, expect, it } from 'vitest'

import { createHelperTools } from './helperTools'

const EXPECTED_KEYS = [
	'click_text',
	'fill_field',
	'read_page_text',
	'find_text',
	'scroll_page',
	'dismiss_overlays',
	'list_actions',
	'page_info',
	'go_back',
	'go_forward',
	'reload_page',
	'go_to_url',
	'wait_for_text',
]

describe('createHelperTools (Cicero helper toolbelt)', () => {
	const tools = createHelperTools()

	it('returns an object with exactly the expected tool keys', () => {
		expect(Object.keys(tools).sort()).toEqual([...EXPECTED_KEYS].sort())
	})

	it.each(EXPECTED_KEYS)('tool "%s" has the PageAgentTool shape', (key) => {
		const entry = tools[key]
		expect(entry).toBeDefined()
		expect(typeof entry.description).toBe('string')
		expect(entry.description.length).toBeGreaterThan(0)
		expect(entry.inputSchema).toBeDefined()
		expect(typeof entry.execute).toBe('function')
	})
})
