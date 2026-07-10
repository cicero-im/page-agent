import { afterEach, describe, expect, it, vi } from 'vitest'

import { handlePageControlMessage } from './RemotePageController.background'

/**
 * Regression tests for the screenshot bug: the agent drives tabs by id and opens
 * them in the background (active: false), but `captureVisibleTab` can only grab
 * the *visible* tab of a window. So the capture handler must make the target tab
 * visible before capturing — otherwise it grabs the wrong page, or throws on a
 * chrome:// page → the model receives no screenshot. These tests would FAIL on the
 * old handler (which called captureVisibleTab without ever activating the tab).
 */

interface FakeTab {
	id: number
	windowId: number
	active: boolean
}

function installChrome(tab: FakeTab) {
	const get = vi.fn().mockResolvedValue(tab)
	const update = vi.fn().mockResolvedValue({ ...tab, active: true })
	const captureVisibleTab = vi.fn().mockResolvedValue('data:image/jpeg;base64,AAAA')
	const sendMessage = vi.fn().mockResolvedValue(undefined)
	;(globalThis as any).chrome = { tabs: { get, update, captureVisibleTab, sendMessage } }
	return { get, update, captureVisibleTab }
}

function captureMessage(targetTabId: number) {
	return {
		type: 'PAGE_CONTROL' as const,
		action: 'capture_screenshot',
		payload: [],
		targetTabId,
	}
}

afterEach(() => {
	vi.restoreAllMocks()
	delete (globalThis as any).chrome
})

describe('handlePageControlMessage — capture_screenshot', () => {
	it('activates an inactive target tab before capturing it', async () => {
		const { update, captureVisibleTab } = installChrome({ id: 5, windowId: 9, active: false })
		const sendResponse = vi.fn()

		const ret = handlePageControlMessage(captureMessage(5), {} as any, sendResponse)
		expect(ret).toBe(true) // keeps the message channel open for the async response

		await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), { timeout: 2000 })

		expect(update).toHaveBeenCalledWith(5, { active: true })
		expect(captureVisibleTab).toHaveBeenCalledWith(9, { format: 'jpeg', quality: 60 })
		expect(sendResponse).toHaveBeenCalledWith({
			success: true,
			dataUrl: 'data:image/jpeg;base64,AAAA',
		})
	})

	it('captures directly when the target tab is already visible (no needless activation)', async () => {
		const { update, captureVisibleTab } = installChrome({ id: 7, windowId: 3, active: true })
		const sendResponse = vi.fn()

		handlePageControlMessage(captureMessage(7), {} as any, sendResponse)

		await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), { timeout: 2000 })

		expect(update).not.toHaveBeenCalled()
		expect(captureVisibleTab).toHaveBeenCalledWith(3, { format: 'jpeg', quality: 60 })
		expect(sendResponse).toHaveBeenCalledWith({
			success: true,
			dataUrl: 'data:image/jpeg;base64,AAAA',
		})
	})

	it('reports dataUrl:null (never throws) when capture fails', async () => {
		const { captureVisibleTab } = installChrome({ id: 1, windowId: 1, active: true })
		captureVisibleTab.mockRejectedValueOnce(new Error('cannot capture chrome:// page'))
		vi.spyOn(console, 'error').mockImplementation(() => {})
		const sendResponse = vi.fn()

		handlePageControlMessage(captureMessage(1), {} as any, sendResponse)

		await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), { timeout: 2000 })
		expect(sendResponse).toHaveBeenCalledWith({ success: false, dataUrl: null })
	})
})
