import { BookOpen, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { siGithub } from 'simple-icons'
import { Link } from 'wouter'

import { formatStars, useGitHubStars } from '@/hooks/useGitHubStars'
import { useLanguage } from '@/i18n/context'

import LanguageSwitcher from './LanguageSwitcher'
import ThemeSwitcher from './ThemeSwitcher'
import { AdaptiveLogo } from './icons/AdaptiveLogo'
import { HyperText } from './ui/hyper-text'

export default function Header() {
	const { t } = useLanguage()
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
	const stars = useGitHubStars()

	return (
		<>
			<header
				className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700"
				role="banner"
			>
				<div className="max-w-7xl mx-auto px-6 py-4">
					<div className="flex items-center justify-between gap-2">
						{/* Logo */}
						<Link
							href="/"
							className="flex items-center gap-2 sm:gap-3 group shrink-0"
							aria-label={t('Cícero home', 'Cícero 首页', 'Início Cícero')}
							onClick={() => setMobileMenuOpen(false)}
						>
							<AdaptiveLogo className="w-10 h-10 group-hover:scale-110 transition-transform duration-200" />
							<div>
								<span className="text-base sm:text-xl font-bold text-gray-900 dark:text-white leading-tight flex items-baseline gap-1.5">
									Cícero
									<span className="hidden sm:inline text-[10px] font-mono font-normal text-gray-400 dark:text-gray-500 tabular-nums before:content-['v']">
										{import.meta.env.VERSION}
									</span>
								</span>
								<HyperText
									as="p"
									className="hidden sm:block text-xs text-gray-600 dark:text-gray-300 py-0 font-normal overflow-visible"
									duration={600}
									animateOnHover={true}
									aria-hidden="true"
								>
									{t(
										'AI Agent In Your Webpage',
										'网页里的 AI Agent',
										'Agente de IA na sua página'
									)}
								</HyperText>
							</div>
						</Link>

						{/* Mobile Icon Navigation (横向滚动) */}
						<nav
							className="md:hidden flex items-center gap-1 overflow-x-auto scrollbar-hide flex-1"
							role="navigation"
							aria-label="Mobile navigation"
						>
							<Link
								href="/docs/introduction/overview"
								className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 shrink-0"
								aria-label={t('Docs', '文档', 'Docs')}
							>
								<BookOpen className="w-5 h-5" />
							</Link>
							<a
								href="https://github.com/arthrod/page-agent"
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-1 p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 shrink-0"
								aria-label="GitHub"
							>
								<svg
									role="img"
									viewBox="0 0 24 24"
									className="w-5 h-5 fill-current"
									aria-hidden="true"
								>
									<path d={siGithub.path} />
								</svg>
								{stars !== null && (
									<span className="text-sm tabular-nums">★ {formatStars(stars)}</span>
								)}
							</a>
						</nav>

						{/* Desktop Navigation */}
						<nav
							className="hidden md:flex items-center space-x-6"
							role="navigation"
							aria-label={t('Docs', '文档', 'Docs')}
						>
							<Link
								href="/docs/introduction/overview"
								className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
							>
								<BookOpen className="w-4 h-4" />
								{t('Docs', '文档', 'Docs')}
							</Link>
							<a
								href="https://github.com/arthrod/page-agent"
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
								aria-label="GitHub"
							>
								<svg
									role="img"
									viewBox="0 0 24 24"
									className="w-4 h-4 fill-current"
									aria-hidden="true"
								>
									<path d={siGithub.path} />
								</svg>
								GitHub
								{stars !== null && (
									<span className="text-sm font-medium tabular-nums ">★ {formatStars(stars)}</span>
								)}
							</a>
							<ThemeSwitcher />
							<LanguageSwitcher />
						</nav>

						{/* Mobile menu button */}
						<button
							type="button"
							className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 shrink-0"
							aria-label={t('Open navigation', '打开导航栏', 'Abrir navegação')}
							aria-expanded={mobileMenuOpen}
							aria-controls="mobile-menu"
							onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
						>
							{mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
						</button>
					</div>

					{/* Mobile Navigation */}
					{mobileMenuOpen && (
						<nav
							id="mobile-menu"
							className="md:hidden pt-4 pb-2 space-y-3 border-t border-gray-200 dark:border-gray-700 mt-4"
							role="navigation"
						>
							<Link
								href="/docs/introduction/overview"
								className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
								onClick={() => setMobileMenuOpen(false)}
							>
								<BookOpen className="w-5 h-5" />
								{t('Docs', '文档', 'Docs')}
							</Link>
							<a
								href="https://github.com/arthrod/page-agent"
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
								aria-label="GitHub"
							>
								<svg
									role="img"
									viewBox="0 0 24 24"
									className="w-5 h-5 fill-current"
									aria-hidden="true"
								>
									<path d={siGithub.path} />
								</svg>
								GitHub
								{stars !== null && (
									<span className="text-xs tabular-nums text-gray-400 dark:text-gray-500">
										★ {formatStars(stars)}
									</span>
								)}
							</a>
							<div className="flex items-center gap-3 px-3 py-2">
								<ThemeSwitcher />
								<LanguageSwitcher />
							</div>
						</nav>
					)}
				</div>
			</header>
		</>
	)
}
