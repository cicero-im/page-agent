// English translations (base/reference language)
const enUS = {
	ui: {
		panel: {
			ready: 'Ready',
			thinking: 'Thinking...',
			taskInput: 'Enter new task, describe steps in detail, press Enter to submit',
			userAnswerPrompt: 'Please answer the question above, press Enter to submit',
			taskTerminated: 'Task terminated',
			taskCompleted: 'Task completed',
			userAnswer: 'User answer: {{input}}',
			question: 'Question: {{question}}',
			waitingPlaceholder: 'Waiting for task to start...',
			stop: 'Stop',
			close: 'Close',
			expand: 'Expand history',
			collapse: 'Collapse history',
			step: 'Step {{number}}',
		},
		tools: {
			clicking: 'Clicking element [{{index}}]...',
			inputting: 'Inputting text to element [{{index}}]...',
			selecting: 'Selecting option "{{text}}"...',
			scrolling: 'Scrolling page...',
			waiting: 'Waiting {{seconds}} seconds...',
			askingUser: 'Asking user...',
			done: 'Task done',
			clicked: '🖱️ Clicked element [{{index}}]',
			inputted: '⌨️ Inputted text "{{text}}"',
			selected: '☑️ Selected option "{{text}}"',
			scrolled: '🛞 Page scrolled',
			waited: '⌛️ Wait completed',
			executing: 'Executing {{toolName}}...',
			resultSuccess: 'success',
			resultFailure: 'failed',
			resultError: 'error',
		},
		errors: {
			elementNotFound: 'No interactive element found at index {{index}}',
			taskRequired: 'Task description is required',
			executionFailed: 'Task execution failed',
			notInputElement: 'Element is not an input or textarea',
			notSelectElement: 'Element is not a select element',
			optionNotFound: 'Option "{{text}}" not found',
		},
	},
} as const

// Chinese translations (must match the structure of enUS)
const zhCN = {
	ui: {
		panel: {
			ready: '准备就绪',
			thinking: '正在思考...',
			taskInput: '输入新任务，详细描述步骤，回车提交',
			userAnswerPrompt: '请回答上面问题，回车提交',
			taskTerminated: '任务已终止',
			taskCompleted: '任务结束',
			userAnswer: '用户回答: {{input}}',
			question: '询问: {{question}}',
			waitingPlaceholder: '等待任务开始...',
			stop: '终止',
			close: '关闭',
			expand: '展开历史',
			collapse: '收起历史',
			step: '步骤 {{number}}',
		},
		tools: {
			clicking: '正在点击元素 [{{index}}]...',
			inputting: '正在输入文本到元素 [{{index}}]...',
			selecting: '正在选择选项 "{{text}}"...',
			scrolling: '正在滚动页面...',
			waiting: '等待 {{seconds}} 秒...',
			askingUser: '正在询问用户...',
			done: '结束任务',
			clicked: '🖱️ 已点击元素 [{{index}}]',
			inputted: '⌨️ 已输入文本 "{{text}}"',
			selected: '☑️ 已选择选项 "{{text}}"',
			scrolled: '🛞 页面滚动完成',
			waited: '⌛️ 等待完成',
			executing: '正在执行 {{toolName}}...',
			resultSuccess: '成功',
			resultFailure: '失败',
			resultError: '错误',
		},
		errors: {
			elementNotFound: '未找到索引为 {{index}} 的交互元素',
			taskRequired: '任务描述不能为空',
			executionFailed: '任务执行失败',
			notInputElement: '元素不是输入框或文本域',
			notSelectElement: '元素不是选择框',
			optionNotFound: '未找到选项 "{{text}}"',
		},
	},
} as const

// Brazilian Portuguese translations (must match the structure of enUS)
const ptBR = {
	ui: {
		panel: {
			ready: 'Pronto',
			thinking: 'Pensando...',
			taskInput: 'Digite a nova tarefa, descreva os passos em detalhe, Enter para enviar',
			userAnswerPrompt: 'Responda a pergunta acima e pressione Enter para enviar',
			taskTerminated: 'Tarefa interrompida',
			taskCompleted: 'Tarefa concluída',
			userAnswer: 'Resposta do usuário: {{input}}',
			question: 'Pergunta: {{question}}',
			waitingPlaceholder: 'Aguardando o início da tarefa...',
			stop: 'Parar',
			close: 'Fechar',
			expand: 'Expandir histórico',
			collapse: 'Recolher histórico',
			step: 'Passo {{number}}',
		},
		tools: {
			clicking: 'Clicando no elemento [{{index}}]...',
			inputting: 'Digitando texto no elemento [{{index}}]...',
			selecting: 'Selecionando a opção "{{text}}"...',
			scrolling: 'Rolando a página...',
			waiting: 'Aguardando {{seconds}} segundos...',
			askingUser: 'Perguntando ao usuário...',
			done: 'Tarefa concluída',
			clicked: '🖱️ Clicou no elemento [{{index}}]',
			inputted: '⌨️ Digitou o texto "{{text}}"',
			selected: '☑️ Selecionou a opção "{{text}}"',
			scrolled: '🛞 Página rolada',
			waited: '⌛️ Espera concluída',
			executing: 'Executando {{toolName}}...',
			resultSuccess: 'sucesso',
			resultFailure: 'falhou',
			resultError: 'erro',
		},
		errors: {
			elementNotFound: 'Nenhum elemento interativo encontrado no índice {{index}}',
			taskRequired: 'A descrição da tarefa é obrigatória',
			executionFailed: 'Falha na execução da tarefa',
			notInputElement: 'O elemento não é um input ou textarea',
			notSelectElement: 'O elemento não é um select',
			optionNotFound: 'Opção "{{text}}" não encontrada',
		},
	},
} as const

// Type definitions generated from English base structure (but with string values)
type DeepStringify<T> = {
	[K in keyof T]: T[K] extends string ? string : T[K] extends object ? DeepStringify<T[K]> : T[K]
}

export type TranslationSchema = DeepStringify<typeof enUS>

// Utility type: Extract all nested paths from translation object
type NestedKeyOf<ObjectType extends object> = {
	[Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
		? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
		: `${Key}`
}[keyof ObjectType & (string | number)]

// Extract all possible key paths from translation structure
export type TranslationKey = NestedKeyOf<TranslationSchema>

// Parameterized translation types
export type TranslationParams = Record<string, string | number>

export const locales = {
	'en-US': enUS,
	'zh-CN': zhCN,
	'pt-BR': ptBR,
} as const

export type SupportedLanguage = keyof typeof locales
