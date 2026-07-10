/**
 * A swappable text-to-speech engine.
 *
 * Kept tiny so a browser `speechSynthesis` implementation
 * ({@link WebSpeechSpeaker}) and a future realtime audio session can sit behind
 * the same boundary.
 */
export interface Speaker {
	/** Speak the given text aloud. Implementations cancel any current speech first. */
	speak(text: string): void
	/** Immediately stop in-progress and queued speech (barge-in / STOP). */
	cancel(): void
	/** Whether something is currently being spoken. */
	readonly speaking: boolean
	/** Whether text-to-speech is available in the current environment. */
	readonly supported: boolean
}
