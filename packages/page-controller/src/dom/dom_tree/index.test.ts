import { afterEach, describe, expect, it, vi } from 'vitest'

import buildDomTree from './index.js'

/**
 * Regression test for the cross-origin iframe SecurityError flood.
 *
 * On ad-heavy pages (Google results, news portals like valor.globo.com) the DOM
 * walk descends into dozens of third-party <iframe>s it is NOT allowed to read.
 * Touching `iframe.contentDocument` throws a SecurityError. The walker must
 * (1) never crash and (2) skip those frames SILENTLY — otherwise the user's
 * console is flooded with identical stacks. A genuinely unexpected
 * (non-SecurityError) failure must still be surfaced via console.warn.
 */

function appendIframeThrowing(error: unknown): HTMLIFrameElement {
	const iframe = document.createElement('iframe')
	document.body.appendChild(iframe)
	// Simulate the browser blocking cross-origin frame access.
	Object.defineProperty(iframe, 'contentDocument', {
		configurable: true,
		get() {
			throw error
		},
	})
	Object.defineProperty(iframe, 'contentWindow', {
		configurable: true,
		get() {
			throw error
		},
	})
	return iframe
}

afterEach(() => {
	vi.restoreAllMocks()
	document.body.innerHTML = ''
})

describe('buildDomTree — cross-origin iframe handling', () => {
	it('skips a cross-origin iframe without throwing or warning', () => {
		appendIframeThrowing(new DOMException('Blocked a frame', 'SecurityError'))
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

		const result = buildDomTree({ doHighlightElements: false, viewportExpansion: -1 })

		// Walk completes (does not crash on the inaccessible frame).
		expect(result).toHaveProperty('rootId')
		expect(result).toHaveProperty('map')

		// And it stays quiet about the expected cross-origin block.
		const warnedAboutIframe = warn.mock.calls.some((args) =>
			String(args[0]).includes('Unable to access iframe')
		)
		expect(warnedAboutIframe).toBe(false)
	})

	it('still warns for a genuinely unexpected (non-SecurityError) iframe failure', () => {
		appendIframeThrowing(new Error('boom'))
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

		const result = buildDomTree({ doHighlightElements: false, viewportExpansion: -1 })

		expect(result).toHaveProperty('rootId')
		const warnedAboutIframe = warn.mock.calls.some((args) =>
			String(args[0]).includes('Unable to access iframe')
		)
		expect(warnedAboutIframe).toBe(true)
	})
})
