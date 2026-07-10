/* eslint-disable @typescript-eslint/no-deprecated -- ScriptProcessorNode / createScriptProcessor
 * are deprecated but are still universally supported and rock-solid across every browser today.
 * Migrating to AudioWorklet means loading a separate worklet module at runtime (extra failure
 * surface + CSP considerations in an extension) for a microphone this user literally cannot afford
 * to have break. Keep ScriptProcessorNode for now; AudioWorklet migration is tracked separately. */
import type { Transcriber, TranscriberConfig } from './Transcriber'
import { blobToBase64, encodeWav } from './wavEncoder'

/** Gemini downsamples audio to ~16 kHz anyway, so 16 kHz mono is plenty. */
const TARGET_SAMPLE_RATE = 16000

/** ScriptProcessor buffer size (power of two). 4096 balances latency and CPU. */
const PROCESSOR_BUFFER_SIZE = 4096

/** Instruction asking Gemini to return only the pt-BR transcript. */
const TRANSCRIBE_PROMPT =
	'Transcreva este áudio em português do Brasil. Responda APENAS com o texto transcrito, sem comentários.'

/**
 * Batch speech-to-text via Gemini's OpenAI-compatible `chat/completions`
 * endpoint.
 *
 * Records mic audio with WebAudio, encodes it to WAV (PCM 16 kHz mono) — because
 * Gemini does NOT accept Chrome's default WebM — and sends it as an
 * `input_audio` part. Robust to accents and independent of the browser's (flaky
 * inside a side panel) speech engine.
 */
export class GeminiAudioTranscriber implements Transcriber {
	readonly supported: boolean

	#config: TranscriberConfig
	#stream: MediaStream | null = null
	#context: AudioContext | null = null
	#source: MediaStreamAudioSourceNode | null = null
	#processor: ScriptProcessorNode | null = null
	#chunks: Float32Array[] = []
	#sampleRate = TARGET_SAMPLE_RATE
	#aborted = false
	#fetchController: AbortController | null = null

	constructor(config: TranscriberConfig) {
		this.#config = config
		this.supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
	}

	async start(): Promise<void> {
		if (!this.supported) {
			throw new Error('O microfone não está disponível neste navegador.')
		}
		this.#aborted = false
		this.#chunks = []

		try {
			this.#stream = await navigator.mediaDevices.getUserMedia({ audio: true })
		} catch {
			throw new Error('Não consegui acessar o microfone. Verifique a permissão e tente de novo.')
		}

		const AudioCtor: typeof AudioContext =
			(window as any).AudioContext || (window as any).webkitAudioContext
		this.#context = new AudioCtor()
		this.#sampleRate = this.#context.sampleRate
		this.#source = this.#context.createMediaStreamSource(this.#stream)
		this.#processor = this.#context.createScriptProcessor(PROCESSOR_BUFFER_SIZE, 1, 1)

		this.#processor.onaudioprocess = (event) => {
			if (this.#aborted) return
			// Copy: the event buffer is reused across callbacks.
			const input = event.inputBuffer.getChannelData(0)
			this.#chunks.push(new Float32Array(input))
		}

		this.#source.connect(this.#processor)
		this.#processor.connect(this.#context.destination)
	}

	async stop(): Promise<string> {
		const sampleRate = this.#sampleRate
		const samples = this.#concatChunks()
		this.#teardownCapture()

		if (this.#aborted || samples.length === 0) return ''

		const downsampled = downsampleBuffer(samples, sampleRate, TARGET_SAMPLE_RATE)
		const wav = encodeWav(downsampled, TARGET_SAMPLE_RATE)
		const base64 = await blobToBase64(wav)

		if (this.#aborted) return ''
		return this.#transcribe(base64)
	}

	abort(): void {
		this.#aborted = true
		this.#fetchController?.abort()
		this.#teardownCapture()
	}

	async #transcribe(base64: string): Promise<string> {
		const { baseURL, apiKey, model } = this.#config
		this.#fetchController = new AbortController()

		let response: Response
		try {
			response = await fetch(`${baseURL}/chat/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
				},
				body: JSON.stringify({
					model,
					messages: [
						{
							role: 'user',
							content: [
								{ type: 'text', text: TRANSCRIBE_PROMPT },
								{ type: 'input_audio', input_audio: { data: base64, format: 'wav' } },
							],
						},
					],
				}),
				signal: this.#fetchController.signal,
			})
		} catch {
			if (this.#aborted) return ''
			throw new Error('Não consegui falar com o serviço de transcrição. Verifique a internet.')
		}

		if (!response.ok) {
			throw new Error('O serviço de transcrição recusou o áudio. Tente novamente.')
		}

		let json: any
		try {
			json = await response.json()
		} catch {
			throw new Error('Recebi uma resposta inválida do serviço de transcrição.')
		}

		const text = json?.choices?.[0]?.message?.content
		if (typeof text !== 'string') {
			throw new Error('Não consegui entender o áudio. Pode repetir?')
		}
		return text.trim()
	}

	#concatChunks(): Float32Array {
		const total = this.#chunks.reduce((sum, chunk) => sum + chunk.length, 0)
		const merged = new Float32Array(total)
		let offset = 0
		for (const chunk of this.#chunks) {
			merged.set(chunk, offset)
			offset += chunk.length
		}
		this.#chunks = []
		return merged
	}

	#teardownCapture(): void {
		if (this.#processor) {
			this.#processor.disconnect()
			this.#processor.onaudioprocess = null
			this.#processor = null
		}
		if (this.#source) {
			this.#source.disconnect()
			this.#source = null
		}
		if (this.#context) {
			void this.#context.close()
			this.#context = null
		}
		if (this.#stream) {
			for (const track of this.#stream.getTracks()) track.stop()
			this.#stream = null
		}
	}
}

/**
 * Linearly downsample a mono Float32 buffer from `inputRate` to `outputRate`,
 * averaging the source samples per output sample to soften aliasing. Returns
 * the input unchanged when no downsampling is required.
 */
function downsampleBuffer(
	buffer: Float32Array,
	inputRate: number,
	outputRate: number
): Float32Array {
	if (outputRate >= inputRate) return buffer
	const ratio = inputRate / outputRate
	const newLength = Math.round(buffer.length / ratio)
	const result = new Float32Array(newLength)
	let offsetResult = 0
	let offsetBuffer = 0
	while (offsetResult < newLength) {
		const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio)
		let accum = 0
		let count = 0
		for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
			accum += buffer[i]
			count++
		}
		result[offsetResult] = count > 0 ? accum / count : 0
		offsetResult++
		offsetBuffer = nextOffsetBuffer
	}
	return result
}
