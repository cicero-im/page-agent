/**
 * Realtime (audio-to-audio) voice session — DEFERRED.
 *
 * The current model (`gemini-3.5-flash`) is NOT Live-capable, so this file is an
 * intentional placeholder. It marks the single swap point where a Gemini Live
 * implementation drops in later, behind the same boundary as
 * {@link Transcriber} / {@link Speaker}.
 */
export interface RealtimeSession {
	/** Open the realtime connection (mic in, audio out). */
	connect(): Promise<void>
	/** Tear down the realtime connection and release resources. */
	disconnect(): void
}

const NOT_IMPLEMENTED =
	'Realtime (Gemini Live) not implemented yet — deferred. gemini-3.5-flash is not Live-capable; wire gemini-3.1-flash-live-preview here later.'

/**
 * Stub {@link RealtimeSession}. Every method throws until realtime is wired, so
 * the rest of the app can already depend on the interface without behavior
 * changes.
 */
export class GeminiLiveSession implements RealtimeSession {
	connect(): Promise<void> {
		throw new Error(NOT_IMPLEMENTED)
	}

	disconnect(): void {
		throw new Error(NOT_IMPLEMENTED)
	}
}
