import { describe, expect, it } from 'vitest'

import { createBrowserTools } from './browserTools'

const EXPECTED_KEYS = [
	'download_file',
	'save_bookmark',
	'add_to_reading_list',
	'recent_sites',
	'open_recent',
	'top_sites',
	'notify',
	'copy_text',
	'read_clipboard',
]

describe('createBrowserTools (Cícero browser-capability toolbelt)', () => {
	const tools = createBrowserTools()

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
