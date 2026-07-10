import type { Speaker } from './Speaker'

/** BCP-47 language tag for the assistant's voice. */
const SPEECH_LANG = 'pt-BR'

/**
 * Text-to-speech via the browser's `window.speechSynthesis`.
 *
 * Speaks in pt-BR, preferring an installed Brazilian-Portuguese voice when one
 * is available. Cancelable so speech stops the moment she presses STOP or the
 * mic again (barge-in friendly).
 */
export class WebSpeechSpeaker implements Speaker {
	readonly supported: boolean

	#voice: SpeechSynthesisVoice | null = null

	constructor() {
		this.supported = typeof window !== 'undefined' && 'speechSynthesis' in window
		if (this.supported) {
			this.#loadVoice()
			// Voices often load asynchronously; refresh the pick when they arrive.
			window.speechSynthesis.addEventListener?.('voiceschanged', () => {
				this.#loadVoice()
			})
		}
	}

	get speaking(): boolean {
		return this.supported && window.speechSynthesis.speaking
	}

	speak(text: string): void {
		if (!this.supported) return
		const trimmed = text.trim()
		if (!trimmed) return
		// Cancel current speech so messages never overlap or pile up.
		window.speechSynthesis.cancel()
		const utterance = new SpeechSynthesisUtterance(trimmed)
		utterance.lang = SPEECH_LANG
		if (this.#voice) utterance.voice = this.#voice
		window.speechSynthesis.speak(utterance)
	}

	cancel(): void {
		if (!this.supported) return
		window.speechSynthesis.cancel()
	}

	#loadVoice(): void {
		const voices = window.speechSynthesis.getVoices()
		this.#voice =
			voices.find((voice) => voice.lang === SPEECH_LANG) ??
			voices.find((voice) => voice.lang?.toLowerCase().startsWith('pt')) ??
			null
	}
}
