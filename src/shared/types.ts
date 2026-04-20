export type SetupStage =
  | 'checking'
  | 'installing-ollama'
  | 'starting-ollama'
  | 'downloading-model'
  | 'ready'
  | 'error'

export interface SetupStatus {
  stage: SetupStage
  message: string
  progress?: number
  bytesDone?: number
  bytesTotal?: number
  error?: string
}

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
  result?: string
  error?: string
  running?: boolean
}

export type Role = 'user' | 'assistant' | 'system' | 'tool'

export interface ChatMessage {
  id: string
  role: Role
  content: string
  toolCalls?: ToolCall[]
  createdAt: number
  model?: string
  done?: boolean
  activity?: AgentActivity
}

export type AgentMode = 'chat' | 'code'

export interface ChatRequest {
  conversationId: string
  messages: Array<{ role: Role; content: string; toolCalls?: ToolCall[] }>
  model: string
  enableTools: boolean
  mode: AgentMode
}

export interface WorkspaceInfo {
  conversationId: string
  path: string
  previewUrl: string
}

export interface WorkspaceFile {
  path: string
  kind: 'file' | 'dir'
  size?: number
}

export interface FileChangeEvent {
  conversationId: string
}

export type AgentActivity =
  | { kind: 'idle' }
  | { kind: 'thinking'; chars?: number }
  | { kind: 'generating'; chars?: number }
  | { kind: 'tool'; tool: string; target?: string; chars?: number }

export type StreamChunk =
  | { type: 'token'; text: string }
  | { type: 'tool_call'; call: ToolCall }
  | { type: 'tool_result'; id: string; result?: string; error?: string }
  | { type: 'activity'; activity: AgentActivity }
  | { type: 'done' }
  | { type: 'error'; error: string }

export interface ModelInfo {
  name: string
  size: string
  sizeBytes: number
  description: string
  recommended?: boolean
}

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    name: 'gemma4:e2b',
    size: '7.2 GB',
    sizeBytes: 7_200_000_000,
    description: 'Edge-sized. 128K context. Text + image + audio. Runs on 8GB+ Macs.'
  },
  {
    name: 'gemma4:e4b',
    size: '9.6 GB',
    sizeBytes: 9_600_000_000,
    description: 'Best all-rounder. 128K context. Text + image + audio. 16GB+ Macs.',
    recommended: true
  },
  {
    name: 'gemma4:26b',
    size: '18 GB',
    sizeBytes: 18_000_000_000,
    description: 'Mixture-of-Experts. 256K context. Needs 32GB+ RAM.'
  },
  {
    name: 'gemma4:31b',
    size: '20 GB',
    sizeBytes: 20_000_000_000,
    description: 'Frontier dense. 256K context. Needs 32GB+ RAM.'
  }
]

export const DEFAULT_MODEL = 'gemma4:e4b'
