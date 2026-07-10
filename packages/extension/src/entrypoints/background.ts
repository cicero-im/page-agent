import { handlePageControlMessage } from '@/agent/RemotePageController.background'
import { handleTabControlMessage, setupTabEventsPort } from '@/agent/TabsController.background'
import { HUB_TOKEN_KEY, USER_AUTH_TOKEN_KEY, ensureStorageToken } from '@/agent/tokens'

export default defineBackground(() => {
	console.log('[Background] Service Worker started')

	// tab change events

	setupTabEventsPort()

	// Generate the access tokens on first run. Both are empty by default,
	// generated randomly on first use, and never overwritten once present:
	//   - user auth token: lets a web page call the in-page agent API.
	//   - hub token: lets an external app (MCP hub) accept calls without the
	//     per-session confirm dialog.
	void ensureStorageToken(USER_AUTH_TOKEN_KEY)
	void ensureStorageToken(HUB_TOKEN_KEY)

	// message proxy

	chrome.runtime.onMessage.addListener((message, sender, sendResponse): true | undefined => {
		if (message.type === 'TAB_CONTROL') {
			return handleTabControlMessage(message, sender, sendResponse)
		} else if (message.type === 'PAGE_CONTROL') {
			return handlePageControlMessage(message, sender, sendResponse)
		} else {
			sendResponse({ error: 'Unknown message type' })
			return
		}
	})

	// global keyboard shortcuts (chrome.commands)
	//
	// onCommand fires here in the service worker — it cannot touch the side-panel
	// UI directly. So we (1) open the side panel (this handler is a user gesture,
	// which sidePanel.open() requires) and (2) drop the intent into chrome.storage.
	// The panel reads it on mount AND via storage.onChanged, so the shortcut works
	// whether the panel was already open or closed when the key was pressed.
	chrome.commands?.onCommand.addListener((command) => {
		if (command !== 'listen_mic' && command !== 'submit_now') return
		void (async () => {
			await chrome.storage.local.set({
				ciceroPendingCommand: { command, at: Date.now() },
			})
			try {
				const win = await chrome.windows.getLastFocused()
				if (win?.id != null) await chrome.sidePanel.open({ windowId: win.id })
			} catch (error) {
				console.debug('[Background] Could not open side panel for command', command, error)
			}
		})()
	})

	// external messages (from localhost launcher page via externally_connectable)

	chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
		if (message.type === 'OPEN_HUB') {
			openOrFocusHubTab(message.wsPort).then(() => {
				if (sender.tab?.id) chrome.tabs.remove(sender.tab.id)
				sendResponse({ ok: true })
			})
			return true
		}
	})

	// setup

	chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})
})

async function openOrFocusHubTab(wsPort: number) {
	const hubUrl = chrome.runtime.getURL('hub.html')
	const existing = await chrome.tabs.query({ url: `${hubUrl}*` })

	if (existing.length > 0 && existing[0].id) {
		await chrome.tabs.update(existing[0].id, {
			active: true,
			url: `${hubUrl}?ws=${wsPort}`,
		})
		return
	}

	await chrome.tabs.create({ url: `${hubUrl}?ws=${wsPort}`, pinned: true })
}
