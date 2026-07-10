import { describe, expect, it, vi } from 'vitest'

import { RemotePageController } from './RemotePageController'

function makeController() {
	const tabsController = { currentTabId: 1 } as any
	return new RemotePageController(tabsController)
}

describe('RemotePageController.executeJavascript (agent-side bridge)', () => {
	it('forwards the script via the execute_javascript action', async () => {
		const controller = makeController()
		const spy = vi
			.spyOn(controller as any, 'remoteCallDomAction')
			.mockResolvedValue({ success: true, message: '4' })

		const result = await controller.executeJavascript('return 2 + 2')

		expect(spy).toHaveBeenCalledWith('execute_javascript', ['return 2 + 2'])
		expect(result).toEqual({ success: true, message: '4' })
	})

	it('strips the AbortSignal — it cannot cross the messaging boundary', async () => {
		const controller = makeController()
		const spy = vi
			.spyOn(controller as any, 'remoteCallDomAction')
			.mockResolvedValue({ success: true, message: 'ok' })

		const signal = new AbortController().signal
		await controller.executeJavascript('doStuff()', signal)

		// the forwarded payload must contain ONLY the script, never the signal
		const [, payload] = spy.mock.calls[0] as [string, unknown[]]
		expect(payload).toEqual(['doStuff()'])
		expect(payload).not.toContain(signal)
	})
})
