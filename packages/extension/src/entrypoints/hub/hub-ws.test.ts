import { afterEach, describe, expect, it, vi } from 'vitest'

import { HUB_TOKEN_KEY } from '@/agent/tokens'

import { HubWs, type HubWsHandlers } from './hub-ws'

/**
 * The hub accepts execute/stop "calls" from an external app over the local WS.
 * A caller that presents the matching hub token is pre-authorized and must NOT
 * be prompted; a caller with a wrong/absent token still falls back to the
 * per-session confirm dialog. These tests pin that gate.
 */

type Listener = (event: unknown) => void

class FakeWebSocket {
	static OPEN = 1
	static instances: FakeWebSocket[] = []
	readyState = FakeWebSocket.OPEN
	sent: string[] = []
	#listeners: Record<string, Listener[]> = {}

	constructor(public url: string) {
		FakeWebSocket.instances.push(this)
	}

	addEventListener(type: string, cb: Listener) {
		;(this.#listeners[type] ??= []).push(cb)
	}

	send(data: string) {
		this.sent.push(data)
	}

	close() {
		this.emit('close', {})
	}

	emit(type: string, event: unknown) {
		for (const cb of this.#listeners[type] ?? []) cb(event)
	}

	emitMessage(payload: unknown) {
		this.emit('message', { data: JSON.stringify(payload) })
	}
}

function installEnv(hubToken: string | undefined, confirmReturns: boolean) {
	const store: Record<string, unknown> = { [HUB_TOKEN_KEY]: hubToken }
	const get = vi.fn(async (key: string) => ({ [key]: store[key] }))
	;(globalThis as any).chrome = { storage: { local: { get } } }
	;(globalThis as any).WebSocket = FakeWebSocket
	const confirm = vi.fn(() => confirmReturns)
	;(globalThis as any).window = { confirm }
	return { confirm }
}

function makeHubWs() {
	const onExecute = vi.fn<HubWsHandlers['onExecute']>(async () => ({
		success: true,
		data: 'ok',
	}))
	const onStop = vi.fn()
	const hub = new HubWs(38401, { onExecute, onStop }, () => {})
	hub.connect()
	const ws = FakeWebSocket.instances.at(-1)!
	ws.emit('open', {})
	return { hub, ws, onExecute, onStop }
}

afterEach(() => {
	vi.restoreAllMocks()
	FakeWebSocket.instances = []
	delete (globalThis as any).chrome
	delete (globalThis as any).WebSocket
	delete (globalThis as any).window
})

describe('HubWs token gate', () => {
	it('pre-authorizes a call carrying the matching hub token without prompting', async () => {
		const { confirm } = installEnv('secret-token', false)
		const { ws, onExecute } = makeHubWs()

		ws.emitMessage({ type: 'execute', task: 'do x', token: 'secret-token' })
		await vi.waitFor(() => expect(onExecute).toHaveBeenCalledWith('do x', undefined))

		expect(confirm).not.toHaveBeenCalled()
	})

	it('falls back to the confirm dialog when the token is wrong', async () => {
		const { confirm } = installEnv('secret-token', false)
		const { ws, onExecute } = makeHubWs()

		ws.emitMessage({ type: 'execute', task: 'do x', token: 'WRONG' })

		await vi.waitFor(() => expect(confirm).toHaveBeenCalled())
		expect(onExecute).not.toHaveBeenCalled()
		// caller is told it was denied
		await vi.waitFor(() => expect(ws.sent.some((m) => m.includes('denied'))).toBe(true))
	})

	it('falls back to the confirm dialog when no token is provided', async () => {
		const { confirm } = installEnv('secret-token', true)
		const { ws, onExecute } = makeHubWs()

		ws.emitMessage({ type: 'execute', task: 'do x' })

		await vi.waitFor(() => expect(confirm).toHaveBeenCalled())
		// confirm returned true → the call proceeds
		await vi.waitFor(() => expect(onExecute).toHaveBeenCalledWith('do x', undefined))
	})
})
