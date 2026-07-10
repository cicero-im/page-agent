/**
 * Dependency-free WAV (RIFF) encoder for mono 16-bit PCM audio.
 *
 * Gemini audio input does NOT accept WebM (Chrome's `MediaRecorder` default),
 * so we encode WAV ourselves from raw Float32 samples captured via WebAudio.
 * Pure and side-effect-free, hence trivially unit-testable.
 */

/** Size of the canonical WAV/RIFF header in bytes. */
const WAV_HEADER_BYTES = 44

/**
 * Convert normalized Float32 samples (`-1..1`) into little-endian signed
 * 16-bit PCM, writing into `view` starting at byte `offset`.
 */
export function floatTo16BitPCM(view: DataView, offset: number, input: Float32Array): void {
	for (let i = 0; i < input.length; i++) {
		// Clamp to the valid range, then scale into the signed 16-bit domain.
		const sample = Math.max(-1, Math.min(1, input[i]))
		const value = sample < 0 ? sample * 0x8000 : sample * 0x7fff
		view.setInt16(offset + i * 2, value, true)
	}
}

/** Write an ASCII string into `view` byte-by-byte (used for RIFF chunk ids). */
function writeString(view: DataView, offset: number, text: string): void {
	for (let i = 0; i < text.length; i++) {
		view.setUint8(offset + i, text.charCodeAt(i))
	}
}

/**
 * Encode mono Float32 PCM samples into a valid `audio/wav` Blob (16-bit PCM,
 * single channel) at the given `sampleRate`.
 */
export function encodeWav(float32: Float32Array, sampleRate: number): Blob {
	const dataBytes = float32.length * 2
	const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes)
	const view = new DataView(buffer)
	const numChannels = 1
	const bitsPerSample = 16
	const byteRate = (sampleRate * numChannels * bitsPerSample) / 8
	const blockAlign = (numChannels * bitsPerSample) / 8

	// RIFF chunk descriptor
	writeString(view, 0, 'RIFF')
	view.setUint32(4, WAV_HEADER_BYTES - 8 + dataBytes, true)
	writeString(view, 8, 'WAVE')

	// "fmt " sub-chunk
	writeString(view, 12, 'fmt ')
	view.setUint32(16, 16, true) // PCM sub-chunk size
	view.setUint16(20, 1, true) // audio format = PCM
	view.setUint16(22, numChannels, true)
	view.setUint32(24, sampleRate, true)
	view.setUint32(28, byteRate, true)
	view.setUint16(32, blockAlign, true)
	view.setUint16(34, bitsPerSample, true)

	// "data" sub-chunk
	writeString(view, 36, 'data')
	view.setUint32(40, dataBytes, true)
	floatTo16BitPCM(view, WAV_HEADER_BYTES, float32)

	return new Blob([view], { type: 'audio/wav' })
}

/**
 * Read a Blob and return its raw base64 payload (WITHOUT the
 * `data:<mime>;base64,` prefix), suitable for an `input_audio.data` field.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
	const dataUrl = await new Promise<string>((resolve, reject) => {
		const reader = new FileReader()
		reader.onloadend = () => {
			resolve(reader.result as string)
		}
		reader.onerror = () => {
			reject(reader.error ?? new Error('Failed to read audio blob'))
		}
		reader.readAsDataURL(blob)
	})
	const commaIndex = dataUrl.indexOf(',')
	return commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1)
}
