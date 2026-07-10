/**
 * Configuration shared by every {@link Transcriber} implementation.
 *
 * The shape mirrors the OpenAI-compatible client used elsewhere in the
 * extension so a Gemini key/endpoint can be reused verbatim for batch STT.
 */
export interface TranscriberConfig {
	/** Base URL of the OpenAI-compatible API, WITHOUT a trailing slash. */
	baseURL: string
	/** Bearer API key. Optional so a key-less engine (Web Speech) can reuse the shape. */
	apiKey?: string
	/** Model id used for transcription, e.g. `gemini-3.5-flash`. */
	model: string
	/** BCP-47 language tag for recognition. Defaults to `pt-BR`. */
	lang?: string
}

/**
 * A swappable speech-to-text engine.
 *
 * The contract is intentionally tiny so a batch recorder
 * ({@link GeminiAudioTranscriber}), the browser engine
 * ({@link WebSpeechTranscriber}) and a future realtime session can all sit
 * behind it without the UI knowing which one is active.
 */
export interface Transcriber {
	/** Begin capturing audio. Resolves once capture has actually started. */
	start(): Promise<void>
	/** Stop capturing and resolve with the final transcript (may be empty). */
	stop(): Promise<string>
	/** Cancel capture and discard any pending transcript without resolving `stop()`. */
	abort(): void
	/** Whether this engine can run in the current environment. */
	readonly supported: boolean
	/**
	 * Optional live callback fired as speech is recognized, so the UI can stream
	 * the transcript into the input box while the user is still talking.
	 * `text` is the full transcript so far (final + interim). Engines without
	 * streaming (batch STT) may fire it once with the final text on `stop()`.
	 */
	onResult?: ((text: string, isFinal: boolean) => void) | null
}
