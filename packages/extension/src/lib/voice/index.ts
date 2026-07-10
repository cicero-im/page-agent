/**
 * Voice layer for Cicero Agent.
 *
 * Two interchangeable speech-to-text engines sit behind {@link Transcriber} and
 * one text-to-speech engine behind {@link Speaker}, so the side panel never
 * needs to know which is active. Today STT is batch (record → WAV → Gemini) or
 * the browser's Web Speech engine; TTS is `speechSynthesis`.
 *
 * Swap point for realtime: when a Live-capable model is wired, implement
 * {@link RealtimeSession} (see {@link GeminiLiveSession}) and switch the
 * factories below — nothing else in the app needs to change.
 */
import { GeminiAudioTranscriber } from './GeminiAudioTranscriber'
import type { Speaker } from './Speaker'
import type { Transcriber, TranscriberConfig } from './Transcriber'
import { WebSpeechSpeaker } from './WebSpeechSpeaker'
import { WebSpeechTranscriber } from './WebSpeechTranscriber'

export { GeminiAudioTranscriber } from './GeminiAudioTranscriber'
export { GeminiLiveSession } from './realtime'
export { WebSpeechSpeaker } from './WebSpeechSpeaker'
export { WebSpeechTranscriber } from './WebSpeechTranscriber'
export { blobToBase64, encodeWav, floatTo16BitPCM } from './wavEncoder'
export type { RealtimeSession } from './realtime'
export type { Speaker } from './Speaker'
export type { Transcriber, TranscriberConfig } from './Transcriber'

/**
 * Pick a {@link Transcriber}: the instant, key-less Web Speech engine when the
 * browser supports it, otherwise the robust Gemini-audio fallback. Both classes
 * are also exported so the UI can force a specific one.
 */
export function createTranscriber(config: TranscriberConfig): Transcriber {
	const webSpeech = new WebSpeechTranscriber(config)
	if (webSpeech.supported) return webSpeech
	return new GeminiAudioTranscriber(config)
}

/** Create the default {@link Speaker} (browser `speechSynthesis`). */
export function createSpeaker(): Speaker {
	return new WebSpeechSpeaker()
}
