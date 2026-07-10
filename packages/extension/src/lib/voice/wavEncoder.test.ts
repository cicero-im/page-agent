import { describe, expect, it } from 'vitest'

import { encodeWav } from './wavEncoder'

/** Read a 4-byte ASCII tag from a DataView at the given byte offset. */
function readTag(view: DataView, offset: number): string {
	let text = ''
	for (let i = 0; i < 4; i++) {
		text += String.fromCharCode(view.getUint8(offset + i))
	}
	return text
}

describe('encodeWav', () => {
	const sampleRate = 16000
	const sampleCount = 1600 // 0.1s of audio
	const samples = new Float32Array(sampleCount)
	for (let i = 0; i < sampleCount; i++) {
		// Deterministic 440 Hz sine wave at half amplitude (no randomness).
		samples[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / sampleRate)
	}

	it('produces an audio/wav Blob', () => {
		const blob = encodeWav(samples, sampleRate)
		expect(blob.type).toBe('audio/wav')
	})

	it('writes a RIFF/WAVE header', async () => {
		const blob = encodeWav(samples, sampleRate)
		const view = new DataView(await blob.arrayBuffer())
		expect(readTag(view, 0)).toBe('RIFF')
		expect(readTag(view, 8)).toBe('WAVE')
	})

	it('has a byte length of 44 + samples * 2', async () => {
		const blob = encodeWav(samples, sampleRate)
		const buffer = await blob.arrayBuffer()
		expect(buffer.byteLength).toBe(44 + sampleCount * 2)
	})
})
