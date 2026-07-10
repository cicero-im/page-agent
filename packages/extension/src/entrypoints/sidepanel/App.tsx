import {
	History,
	Loader2,
	Mic,
	Send,
	Settings,
	Square,
	SquarePen,
	Volume2,
	VolumeX,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ConfigPanel } from '@/components/ConfigPanel'
import { HistoryDetail } from '@/components/HistoryDetail'
import { HistoryList } from '@/components/HistoryList'
import { ActivityCard, EventCard } from '@/components/cards'
import { EmptyState, Logo, MotionOverlay, StatusDot } from '@/components/misc'
import { Button } from '@/components/ui/button'
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupTextarea,
} from '@/components/ui/input-group'
import { saveSession } from '@/lib/db'
import { type Speaker, type Transcriber, createSpeaker, createTranscriber } from '@/lib/voice'

import { useAgent } from '../../agent/useAgent'

type View =
	| { name: 'chat' }
	| { name: 'config' }
	| { name: 'history' }
	| { name: 'history-detail'; sessionId: string }

type MicState = 'idle' | 'listening' | 'transcribing'

export default function App() {
	const [view, setView] = useState<View>({ name: 'chat' })
	const [inputValue, setInputValue] = useState('')
	const [micState, setMicState] = useState<MicState>('idle')
	const historyRef = useRef<HTMLDivElement>(null)
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const transcriberRef = useRef<Transcriber | null>(null)
	// Text already in the box when listening began, so dictation appends to it.
	const recordingBaseRef = useRef('')

	// One speaker (TTS) for the whole session — she hears answers/status hands-free.
	const [speaker] = useState<Speaker>(() => createSpeaker())

	const { status, history, activity, currentTask, config, execute, stop, reset, configure } =
		useAgent()

	const isRunning = status === 'running'

	// Whether the agent speaks responses aloud (TTS). Default OFF — speech is
	// opt-in (her ears are fine, but she may not always want voice). The mic is
	// always available regardless of this toggle.
	const [speakEnabled, setSpeakEnabled] = useState(false)
	useEffect(() => {
		chrome.storage.local.get('speakEnabled').then((r) => {
			if (typeof r.speakEnabled === 'boolean') setSpeakEnabled(r.speakEnabled)
		})
	}, [])
	const speak = useCallback(
		(text: string) => {
			if (speakEnabled) speaker.speak(text)
		},
		[speakEnabled, speaker]
	)
	const toggleSpeak = useCallback(() => {
		setSpeakEnabled((prev) => {
			const next = !prev
			void chrome.storage.local.set({ speakEnabled: next })
			if (!next) speaker.cancel()
			return next
		})
	}, [speaker])

	// Focus the task box. Uses the element id (not a ref) because the shadcn
	// InputGroupTextarea doesn't reliably forward refs. rAF + a short timeout
	// covers the disabled→enabled transition right after the agent finishes.
	const focusInput = useCallback(() => {
		const doFocus = () => {
			const el = document.getElementById('cicero-task-input') as HTMLTextAreaElement | null
			// Only focus once it's enabled again (focus() is a no-op on a disabled field).
			if (el && !el.disabled) el.focus()
		}
		// Retry across the disabled→enabled re-render right after a task finishes.
		requestAnimationFrame(doFocus)
		setTimeout(doFocus, 60)
		setTimeout(doFocus, 200)
		setTimeout(doFocus, 450)
	}, [])

	const runTask = useCallback(
		(task: string) => {
			const normalizedTask = task.trim()
			if (!normalizedTask || status === 'running') return

			setInputValue('')
			setView({ name: 'chat' })
			speaker.cancel()

			execute(normalizedTask)
				.then((result) => {
					// Speak the answer back (only if the speak toggle is on).
					if (result?.success && result.data) {
						speak(result.data)
					} else if (result && !result.success) {
						speak('Não consegui concluir agora. Podemos tentar de outro jeito?')
					}
				})
				.catch((error) => {
					console.error('[SidePanel] Failed to execute task:', error)
				})
		},
		[execute, status, speak, speaker]
	)

	// Persist session + autofocus + spoken feedback when a task finishes.
	const prevStatusRef = useRef(status)
	useEffect(() => {
		const prev = prevStatusRef.current
		prevStatusRef.current = status

		const justFinished =
			prev === 'running' && (status === 'completed' || status === 'error' || status === 'stopped')

		if (justFinished && history.length > 0 && currentTask) {
			saveSession({ task: currentTask, history, status }).catch((err) =>
				console.error('[SidePanel] Failed to save session:', err)
			)
		}

		if (justFinished) {
			// Autofocus the chat box so she can immediately give the next command.
			focusInput()
			if (status === 'error') speak('Tive um probleminha, mas pode tentar de novo.')
			if (status === 'stopped') speak('Parei.')
		}
	}, [status, history, currentTask, speak, focusInput])

	// Auto-scroll to bottom on new events
	useEffect(() => {
		if (historyRef.current) {
			historyRef.current.scrollTop = historyRef.current.scrollHeight
		}
	}, [history, activity])

	// Reflect Cícero's state on the toolbar icon (badge + tooltip), so status is
	// visible even when the side panel isn't focused. (chrome.action API.)
	useEffect(() => {
		const action = chrome.action
		if (!action?.setBadgeText) return
		const badge = (text: string, color?: string) => {
			void action.setBadgeText({ text })
			if (text && color) void action.setBadgeBackgroundColor({ color })
		}
		let title = 'Cícero'
		if (micState === 'listening') {
			badge('●', '#ef4444')
			title = 'Cícero — ouvindo'
		} else if (micState === 'transcribing') {
			badge('●', '#f59e0b')
			title = 'Cícero — entendendo'
		} else if (isRunning) {
			badge('●', '#2563eb')
			title = 'Cícero — trabalhando'
		} else if (status === 'error') {
			badge('!', '#ef4444')
		} else if (status === 'completed') {
			badge('✓', '#16a34a')
			void action.setTitle?.({ title })
			const t = setTimeout(() => void action.setBadgeText({ text: '' }), 2500)
			return () => clearTimeout(t)
		} else {
			badge('')
		}
		void action.setTitle?.({ title })
	}, [status, micState, isRunning])

	// Combine the pre-recording text with the running dictation.
	const joinBase = useCallback((dictated: string) => {
		const base = recordingBaseRef.current.trim()
		const text = dictated.trim()
		return base ? `${base} ${text}`.trim() : text
	}, [])

	// Start listening; the transcript streams live into the input box.
	const startListening = useCallback(async () => {
		if (!config) return
		speaker.cancel()
		recordingBaseRef.current = inputValue
		const transcriber = createTranscriber({
			baseURL: config.baseURL,
			model: config.model,
			apiKey: config.apiKey,
			lang: 'pt-BR',
		})
		transcriber.onResult = (text) => setInputValue(joinBase(text))
		transcriberRef.current = transcriber
		try {
			await transcriber.start()
			setMicState('listening')
			// Keep focus in the text box while she dictates so a single Enter sends —
			// she can't type, so the fewer keys the better.
			focusInput()
		} catch (error) {
			console.error('[SidePanel] Mic start failed:', error)
			transcriberRef.current = null
			setMicState('idle')
			speak('Não consegui acessar o microfone. Verifique a permissão e tente de novo.')
		}
	}, [config, inputValue, joinBase, speaker, speak, focusInput])

	// Stop listening and settle the final text into the box. Does NOT submit.
	const stopListening = useCallback(async (): Promise<string> => {
		const transcriber = transcriberRef.current
		if (!transcriber) return inputValue
		setMicState('transcribing')
		let finalText = inputValue
		try {
			const transcript = await transcriber.stop()
			finalText = joinBase(transcript)
			setInputValue(finalText)
		} catch (error) {
			console.error('[SidePanel] Transcription failed:', error)
			speak('Tive um problema com o microfone. Pode tentar de novo?')
		} finally {
			transcriberRef.current = null
			setMicState('idle')
			// After recording ends, focus the box so she can press Enter to send.
			focusInput()
		}
		return finalText
	}, [inputValue, joinBase, speak, focusInput])

	// Mic button / shortcut: press to listen, press again to stop (text stays in
	// the box). Sending is a separate action (Enter or the Send button).
	const handleMic = useCallback(() => {
		if (isRunning) return
		if (micState === 'listening') {
			void stopListening()
		} else if (micState === 'idle') {
			void startListening()
		}
	}, [isRunning, micState, startListening, stopListening])

	const handleSubmit = useCallback(
		async (e?: React.SyntheticEvent) => {
			e?.preventDefault()
			// If still dictating, finalize the buffer first, then send it.
			const text =
				micState === 'listening' || micState === 'transcribing' ? await stopListening() : inputValue
			runTask(text)
		},
		[inputValue, micState, stopListening, runTask]
	)

	const handleStop = useCallback(() => {
		console.log('[SidePanel] Stopping task...')
		speaker.cancel()
		stop()
	}, [stop, speaker])

	// Start a fresh conversation: stop any run/recording and clear the screen.
	const handleNewChat = useCallback(() => {
		transcriberRef.current?.abort()
		transcriberRef.current = null
		setMicState('idle')
		speaker.cancel()
		setInputValue('')
		reset()
		setView({ name: 'chat' })
		focusInput()
	}, [reset, speaker, focusInput])

	// In-panel keys for the main hands-free flow. The mic/send shortcuts themselves
	// are the GLOBAL chrome.commands (Alt+L / Alt+K — see the storage effect below),
	// so we don't duplicate them here (that would double-fire when the panel is
	// focused). Here we only need:
	// - Enter: send (also handled by the textarea when focused; this covers the case
	//   where she's dictating and the box isn't focused yet)
	// - Esc: stop the running task (or cancel listening)
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (
				e.key === 'Enter' &&
				!e.shiftKey &&
				(micState === 'listening' || micState === 'transcribing') &&
				(document.activeElement as HTMLElement | null)?.id !== 'cicero-task-input'
			) {
				e.preventDefault()
				void handleSubmit()
				return
			}
			if (e.key === 'Escape') {
				if (isRunning) {
					e.preventDefault()
					handleStop()
				} else if (micState === 'listening') {
					e.preventDefault()
					transcriberRef.current?.abort()
					transcriberRef.current = null
					setMicState('idle')
				}
			}
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [handleSubmit, handleStop, isRunning, micState])

	// Global shortcuts (chrome.commands) are delivered by the background through
	// chrome.storage (`ciceroPendingCommand`), so they reach the panel even if it
	// was closed/unfocused when the key was pressed. De-duplicate by timestamp and
	// ignore stale intents.
	const lastCommandAtRef = useRef(0)
	const consumeCommand = useCallback(
		(payload?: { command?: string; at?: number }) => {
			if (!payload?.command || typeof payload.at !== 'number') return
			if (payload.at <= lastCommandAtRef.current) return
			if (Date.now() - payload.at > 8000) return // ignore stale intents
			lastCommandAtRef.current = payload.at
			if (payload.command === 'listen_mic') {
				handleMic() // toggle: start if idle, stop (keep text) if listening
			} else if (payload.command === 'submit_now') {
				void handleSubmit()
			}
		},
		[handleMic, handleSubmit]
	)
	// Command issued while the panel was CLOSED: read it once config is ready
	// (startListening needs config). Re-running on config change is safe — the
	// timestamp de-dup above drops anything already handled or stale.
	useEffect(() => {
		if (!config) return
		void chrome.storage.local
			.get('ciceroPendingCommand')
			.then((r) => consumeCommand(r.ciceroPendingCommand as { command?: string; at?: number }))
	}, [config, consumeCommand])
	// Live commands while the panel is open.
	useEffect(() => {
		const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
			if (area === 'local' && changes.ciceroPendingCommand) {
				consumeCommand(changes.ciceroPendingCommand.newValue as { command?: string; at?: number })
			}
		}
		chrome.storage.onChanged.addListener(onChanged)
		return () => chrome.storage.onChanged.removeListener(onChanged)
	}, [consumeCommand])

	// Ping-pong mode: after a task finishes, auto-restart the mic so she can keep
	// going hands-free. Placed after startListening is defined (avoids TDZ).
	const pingPongPrevRef = useRef(status)
	useEffect(() => {
		const prev = pingPongPrevRef.current
		pingPongPrevRef.current = status
		if (
			config?.pingPong &&
			prev === 'running' &&
			(status === 'completed' || status === 'error') &&
			micState === 'idle'
		) {
			// Small delay so a spoken answer can start first and the UI can settle.
			const t = setTimeout(() => void startListening(), 700)
			return () => clearTimeout(t)
		}
	}, [status, config, micState, startListening])

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
			e.preventDefault()
			handleSubmit()
		}
	}

	// --- View routing ---

	if (view.name === 'config') {
		return (
			<ConfigPanel
				config={config}
				onSave={async (newConfig) => {
					await configure(newConfig)
					setView({ name: 'chat' })
				}}
				onClose={() => setView({ name: 'chat' })}
			/>
		)
	}

	if (view.name === 'history') {
		return (
			<HistoryList
				onSelect={(id) => setView({ name: 'history-detail', sessionId: id })}
				onBack={() => setView({ name: 'chat' })}
				onRerun={runTask}
			/>
		)
	}

	if (view.name === 'history-detail') {
		return (
			<HistoryDetail
				sessionId={view.sessionId}
				onBack={() => setView({ name: 'history' })}
				onRerun={runTask}
			/>
		)
	}

	// --- Chat view ---

	const showEmptyState = !currentTask && history.length === 0 && !isRunning
	const listening = micState === 'listening'
	const transcribing = micState === 'transcribing'

	const statusLabel = listening
		? 'Estou ouvindo…'
		: transcribing
			? 'Entendendo…'
			: isRunning
				? 'Estou trabalhando…'
				: ''

	return (
		<div className="relative flex flex-col h-screen bg-background">
			<MotionOverlay active={isRunning} />
			{/* Header */}
			<header className="flex items-center justify-between border-b px-3 py-2">
				<div className="flex items-center gap-2">
					<Logo className="size-5" />
					<span className="text-sm font-medium">Cícero</span>
				</div>
				<div className="flex items-center gap-1">
					<StatusDot status={status} />
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={handleNewChat}
						className="cursor-pointer"
						aria-label="Nova conversa"
						title="Nova conversa"
					>
						<SquarePen className="size-3.5" />
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={toggleSpeak}
						className="cursor-pointer"
						aria-label={speakEnabled ? 'Desligar voz' : 'Ligar voz'}
						title={
							speakEnabled
								? 'Voz ligada (clique para desligar)'
								: 'Voz desligada (clique para ligar)'
						}
					>
						{speakEnabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={() => setView({ name: 'history' })}
						className="cursor-pointer"
						aria-label="Histórico"
						title="Histórico"
					>
						<History className="size-3.5" />
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={() => setView({ name: 'config' })}
						className="cursor-pointer"
						aria-label="Configurações"
						title="Configurações"
					>
						<Settings className="size-3.5" />
					</Button>
				</div>
			</header>

			{/* Content */}
			<main className="flex-1 overflow-hidden flex flex-col">
				{/* Current task */}
				{currentTask && (
					<div className="border-b px-3 py-2 bg-muted/30">
						<div className="text-[10px] text-muted-foreground uppercase tracking-wide">Tarefa</div>
						<div className="text-xs font-medium truncate" title={currentTask}>
							{currentTask}
						</div>
					</div>
				)}

				{/* History */}
				<div ref={historyRef} className="flex-1 overflow-y-auto p-3 space-y-2">
					{showEmptyState && <EmptyState />}

					{history.map((event, index) => (
						<EventCard key={index} event={event} />
					))}

					{/* Activity indicator at bottom */}
					{activity && <ActivityCard activity={activity} />}
				</div>
			</main>

			{/* Input */}
			<footer className="border-t p-3 space-y-2">
				{statusLabel && (
					<div className="text-center text-xs text-muted-foreground" aria-live="polite">
						{statusLabel}
					</div>
				)}
				<div className="flex items-end gap-2">
					{/* Big microphone button — the primary, hands-free control */}
					<Button
						type="button"
						onClick={handleMic}
						disabled={isRunning || !config || transcribing}
						aria-label={listening ? 'Parar de ouvir' : 'Falar (⌥/Alt+L)'}
						title={listening ? 'Parar de ouvir' : 'Falar (⌥/Alt+L)'}
						className={`size-12 shrink-0 rounded-full cursor-pointer ${
							listening ? 'bg-red-500 hover:bg-red-600 animate-pulse' : ''
						}`}
					>
						{transcribing ? (
							<Loader2 className="size-5 animate-spin" />
						) : (
							<Mic className="size-5" />
						)}
					</Button>

					<InputGroup className="relative rounded-lg flex-1">
						<InputGroupTextarea
							id="cicero-task-input"
							ref={textareaRef}
							placeholder="Descreva a tarefa, ou aperte o microfone e fale…"
							value={inputValue}
							onChange={(e) => setInputValue(e.target.value)}
							onKeyDown={handleKeyDown}
							disabled={isRunning}
							className="text-xs pr-12 min-h-12"
						/>
						<InputGroupAddon align="inline-end" className="absolute bottom-0 right-0">
							{isRunning ? (
								<InputGroupButton
									size="icon-sm"
									variant="destructive"
									onClick={handleStop}
									className="size-8"
									aria-label="Parar"
									title="Parar"
								>
									<Square className="size-3.5" />
								</InputGroupButton>
							) : (
								<InputGroupButton
									size="icon-sm"
									variant="default"
									onClick={() => handleSubmit()}
									disabled={!inputValue.trim()}
									className="size-8 cursor-pointer"
									aria-label="Enviar"
									title="Enviar"
								>
									<Send className="size-3.5" />
								</InputGroupButton>
							)}
						</InputGroupAddon>
					</InputGroup>
				</div>
				{/* Shortcut legend — discoverable but unobtrusive. The L/K combos are the
				    global ones (chrome.commands); M/J/Esc work when the panel is focused. */}
				<div className="text-center text-[10px] text-muted-foreground/70 leading-relaxed">
					Fale e tecle <b>Enter</b> para enviar · ⌥/Alt+L microfone · ⌥/Alt+K enviar · Esc parar
				</div>
			</footer>
		</div>
	)
}
