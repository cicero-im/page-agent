import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'

import { HubBridge } from './hub-bridge.js'

/**
 * The bridge presents the hub token on every call so the extension can accept it
 * without prompting. These tests use a real loopback WS (the bridge IS a WS
 * server) and a fake hub client to assert the token rides along.
 */

/** @type {HubBridge | null} */
let bridge = null

afterEach(async () => {
	if (bridge) {
		await bridge.stop?.()
		bridge = null
	}
})

// Pick a high port unlikely to collide; vary per test to avoid EADDRINUSE races.
function startBridge(port, token) {
	bridge = new HubBridge(port, token)
	return bridge.start().then(() => bridge)
}

/** Connect a fake hub client and resolve once the bridge marks it connected. */
function connectFakeHub(port) {
	return new Promise((resolve) => {
		const ws = new WebSocket(`ws://localhost:${port}`)
		ws.on('open', () => resolve(ws))
	})
}

describe('HubBridge token forwarding', () => {
	it('includes the configured hub token in execute messages', async () => {
		const port = 39111
		await startBridge(port, 'secret-xyz')
		const hub = await connectFakeHub(port)

		const received = new Promise((resolve) => {
			hub.on('message', (raw) => {
				const msg = JSON.parse(raw.toString('utf-8'))
				if (msg.type === 'execute') {
					hub.send(JSON.stringify({ type: 'result', success: true, data: 'done' }))
					resolve(msg)
				}
			})
		})

		// give the bridge a tick to register the connection
		await new Promise((r) => setTimeout(r, 20))
		const result = await bridge.executeTask('do a thing')
		const msg = await received

		expect(msg.token).toBe('secret-xyz')
		expect(msg.task).toBe('do a thing')
		expect(result).toEqual({ success: true, data: 'done' })

		hub.close()
	})

	it('sends an empty token when none is configured', async () => {
		const port = 39112
		await startBridge(port, undefined)
		const hub = await connectFakeHub(port)

		const received = new Promise((resolve) => {
			hub.on('message', (raw) => {
				const msg = JSON.parse(raw.toString('utf-8'))
				if (msg.type === 'execute') {
					hub.send(JSON.stringify({ type: 'result', success: true, data: 'ok' }))
					resolve(msg)
				}
			})
		})

		await new Promise((r) => setTimeout(r, 20))
		await bridge.executeTask('task')
		const msg = await received

		expect(msg.token).toBe('')
		hub.close()
	})

	it('includes the token in stop messages', async () => {
		const port = 39113
		await startBridge(port, 'stoptok')
		const hub = await connectFakeHub(port)

		const received = new Promise((resolve) => {
			hub.on('message', (raw) => {
				const msg = JSON.parse(raw.toString('utf-8'))
				if (msg.type === 'stop') resolve(msg)
			})
		})

		await new Promise((r) => setTimeout(r, 20))
		bridge.stopTask()
		const msg = await received

		expect(msg.token).toBe('stoptok')
		hub.close()
	})
})
