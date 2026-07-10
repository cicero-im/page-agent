/**
 * background logics for RemotePageController
 * - redirect messages from RemotePageController(Agent, extension pages) to ContentScript
 */

export function handlePageControlMessage(
	message: { type: 'PAGE_CONTROL'; action: string; payload: any; targetTabId: number },
	sender: chrome.runtime.MessageSender,
	sendResponse: (response: unknown) => void
): true | undefined {
	const PREFIX = '[RemotePageController.background]'

	const debug = console.debug.bind(console, `\x1b[90m${PREFIX}\x1b[0m`)

	const { action, payload, targetTabId } = message

	if (action === 'get_my_tab_id') {
		debug('get_my_tab_id', sender.tab?.id)
		sendResponse({ tabId: sender.tab?.id || null })
		return
	}

	if (action === 'capture_screenshot') {
		// captureVisibleTab is a background/extension API — handle it here, do NOT
		// forward to the content script.
		//
		// ⚠️ captureVisibleTab grabs the *visible* (active) tab of a window — it
		// cannot target a tab by id. The agent drives tabs by id and opens them in
		// the background, so the target tab is frequently NOT the visible one. In
		// that case capture would grab the wrong page, or throw on a chrome:// new
		// tab page → the model would get no screenshot. So make the target tab
		// visible first, let the compositor paint, THEN capture it.
		void (async () => {
			try {
				const tab = await chrome.tabs.get(targetTabId)
				if (!tab.active) {
					await chrome.tabs.update(targetTabId, { active: true })
					// give the newly-activated tab a moment to actually paint,
					// otherwise captureVisibleTab can return a blank/stale frame
					await new Promise((r) => setTimeout(r, 300))
				}
				const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
					format: 'jpeg',
					quality: 60,
				})
				sendResponse({ success: true, dataUrl })
			} catch (error) {
				console.error(PREFIX, 'capture_screenshot', error)
				sendResponse({ success: false, dataUrl: null })
			}
		})()
		return true // async response
	}

	// proxy to content script
	chrome.tabs
		.sendMessage(targetTabId, {
			type: 'PAGE_CONTROL',
			action,
			payload,
		})
		.then((result) => {
			sendResponse(result)
		})
		.catch((error) => {
			console.error(PREFIX, error)
			sendResponse({
				success: false,
				error: error instanceof Error ? error.message : String(error),
			})
		})

	return true // async response
}
