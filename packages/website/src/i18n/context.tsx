import { ReactNode, createContext, use, useCallback, useState } from 'react'

export type Lang = 'en-US' | 'zh-CN' | 'pt-BR'

const LANGS: readonly Lang[] = ['en-US', 'zh-CN', 'pt-BR']

function detectLanguage(): Lang {
	const stored = localStorage.getItem('language')
	if (stored && (LANGS as readonly string[]).includes(stored)) {
		return stored as Lang
	}
	const nav = navigator.language || ''
	if (nav.startsWith('zh')) return 'zh-CN'
	if (nav.startsWith('pt')) return 'pt-BR'
	return 'en-US'
}

const LanguageContext = createContext<{
	language: Lang
	/** @deprecated Prefer `t(en, zh, pt)` for three-locale strings */
	isZh: boolean
	isPt: boolean
	setLanguage: (lang: Lang) => void
	/**
	 * Pick a string by active language.
	 * Portuguese falls back to English when `pt` is omitted.
	 */
	t: (en: string, zh: string, pt?: string) => string
} | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
	const [language, setLanguage] = useState<Lang>(detectLanguage)

	const switchLanguage = (lang: Lang) => {
		setLanguage(lang)
		localStorage.setItem('language', lang)
	}

	const t = useCallback(
		(en: string, zh: string, pt?: string) => {
			if (language === 'zh-CN') return zh
			if (language === 'pt-BR') return pt ?? en
			return en
		},
		[language]
	)

	return (
		<LanguageContext
			value={{
				language,
				isZh: language === 'zh-CN',
				isPt: language === 'pt-BR',
				setLanguage: switchLanguage,
				t,
			}}
		>
			{children}
		</LanguageContext>
	)
}

export function useLanguage() {
	const ctx = use(LanguageContext)
	if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
	return ctx
}
