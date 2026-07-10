import type { Transcriber, TranscriberConfig } from './Transcriber'

/** Resolve the vendor-prefixed SpeechRecognition constructor, if any. */
function getSpeechRecognitionCtor(): any {
	if (typeof window === 'undefined') return undefined
	return (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
}

/** Map a raw SpeechRecognition error code to a friendly pt-BR message. */
function friendlyError(code: unknown): string {
	if (code === 'not-allowed' || code === 'service-not-allowed') {
		return 'Preciso de permissão para usar o microfone.'
	}
	if (code === 'no-speech') {
		return 'Não ouvi nada. Pode falar de novo?'
	}
	return 'Tive um problema com o reconhecimento de voz. Pode repetir?'
}

/**
 * Zero-latency, key-less speech-to-text via the browser's
 * `webkitSpeechRecognition`.
 *
 * Ideal as a fast path, but can be flaky inside an extension side panel — so
 * callers should fall back to {@link GeminiAudioTranscriber} when
 * {@link supported} is false or recognition errors out.
 */
export class WebSpeechTranscriber implements Transcriber {
	readonly supported: boolean
	/** Streams the running transcript into the UI while the user is talking. */
	onResult: ((text: string, isFinal: boolean) => void) | null = null

	#lang: string
	#recognition: any = null
	#transcript = ''
	#error: Error | null = null
	#ended = false
	#startResolve: (() => void) | null = null
	#startReject: ((reason: Error) => void) | null = null
	#stopResolve: ((value: string) => void) | null = null
	#stopReject: ((reason: Error) => void) | null = null

	constructor(config: TranscriberConfig) {
		this.#lang = config.lang || 'pt-BR'
		this.supported = !!getSpeechRecognitionCtor()
	}

	start(): Promise<void> {
		if (!this.supported) {
			return Promise.reject(
				new Error('O reconhecimento de voz não está disponível neste navegador.')
			)
		}
		return new Promise<void>((resolve, reject) => {
			const Ctor = getSpeechRecognitionCtor()
			const recognition = new Ctor()
			recognition.lang = this.#lang
			// Stream partial results and keep listening so the transcript buffers
			// into the input box until the user presses Enter/Send (or the mic again).
			recognition.interimResults = true
			recognition.continuous = true

			this.#transcript = ''
			this.#error = null
			this.#ended = false
			this.#startResolve = resolve
			this.#startReject = reject

			recognition.onstart = () => {
				this.#settleStart()
			}
			recognition.onresult = (event: any) => {
				let text = ''
				for (const result of event.results) {
					text += result[0].transcript
				}
				this.#transcript = text.trim()
				// Continuous mode: don't settle stop() here — stream the running
				// transcript to the UI and let the user decide when to stop/send.
				this.onResult?.(this.#transcript, false)
			}
			recognition.onerror = (event: any) => {
				this.#error = new Error(friendlyError(event?.error))
			}
			recognition.onend = () => {
				this.#ended = true
				// Covers an immediate failure where onstart never fired.
				this.#failStart(this.#error ?? new Error('O reconhecimento de voz não iniciou.'))
				// No result arrived -> settle with whatever we have (possibly empty).
				this.#settleStop()
			}

			this.#recognition = recognition
			try {
				recognition.start()
			} catch {
				this.#startResolve = null
				this.#startReject = null
				reject(new Error('Não consegui iniciar o reconhecimento de voz.'))
			}
		})
	}

	stop(): Promise<string> {
		if (!this.#recognition || this.#ended) {
			if (this.#error) return Promise.reject(this.#error)
			return Promise.resolve(this.#transcript)
		}
		return new Promise<string>((resolve, reject) => {
			this.#stopResolve = resolve
			this.#stopReject = reject
			try {
				this.#recognition.stop()
			} catch {
				this.#settleStop()
			}
		})
	}

	abort(): void {
		this.#startResolve = null
		this.#startReject = null
		this.#stopResolve = null
		this.#stopReject = null
		this.#transcript = ''
		this.#ended = true
		const recognition = this.#recognition
		this.#recognition = null
		if (recognition) {
			try {
				recognition.abort()
			} catch {
				// Ignore: the engine may already be stopped.
			}
		}
	}

	#settleStart(): void {
		const resolve = this.#startResolve
		this.#startResolve = null
		this.#startReject = null
		resolve?.()
	}

	#failStart(error: Error): void {
		const reject = this.#startReject
		this.#startResolve = null
		this.#startReject = null
		reject?.(error)
	}

	#settleStop(): void {
		if (this.#error) {
			const reject = this.#stopReject
			this.#stopResolve = null
			this.#stopReject = null
			reject?.(this.#error)
			return
		}
		const resolve = this.#stopResolve
		this.#stopResolve = null
		this.#stopReject = null
		resolve?.(this.#transcript)
	}
}
