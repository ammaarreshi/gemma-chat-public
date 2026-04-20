import { AVAILABLE_MODELS, type SetupStatus } from '@shared/types'

interface Props {
  status: SetupStatus
  model: string
  onModelChange: (m: string) => void
  onStart: (model: string) => void
}

function formatBytes(n?: number): string {
  if (!n) return ''
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = n
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`
}

export default function Setup({ status, model, onModelChange, onStart }: Props) {
  const isWorking =
    status.stage === 'checking' ||
    status.stage === 'installing-ollama' ||
    status.stage === 'starting-ollama' ||
    status.stage === 'downloading-model'

  if (status.stage === 'checking' && status.message === 'Welcome') {
    return <WelcomeScreen model={model} onModelChange={onModelChange} onStart={onStart} />
  }

  return (
    <div className="drag flex h-full w-full flex-col">
      <div className="h-9" />
      <div className="flex flex-1 items-center justify-center px-8">
        <div className="no-drag w-full max-w-md">
          <div className="mb-8 text-center">
            <GemmaLogo className="mx-auto mb-5 h-14 w-14" />
            <h1 className="text-[22px] font-semibold tracking-tight">Setting things up</h1>
            <p className="mt-1.5 text-sm text-ink-400">
              Everything runs locally. Nothing leaves your Mac.
            </p>
          </div>

          <StageList status={status} />

          {isWorking && status.progress != null && (
            <div className="mt-6">
              <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-white/70 transition-[width] duration-200 ease-out"
                  style={{ width: `${Math.max(2, Math.round((status.progress ?? 0) * 100))}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[11px] tabular-nums text-ink-400">
                <span>{Math.round((status.progress ?? 0) * 100)}%</span>
                {status.bytesDone != null && status.bytesTotal != null && (
                  <span>
                    {formatBytes(status.bytesDone)} / {formatBytes(status.bytesTotal)}
                  </span>
                )}
              </div>
            </div>
          )}

          {status.stage === 'error' && (
            <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              <div className="font-medium">Something went wrong</div>
              <div className="mt-1 text-red-300/80">{status.error}</div>
              <button
                onClick={() => onStart(model)}
                className="mt-3 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function WelcomeScreen({
  model,
  onModelChange,
  onStart
}: {
  model: string
  onModelChange: (m: string) => void
  onStart: (model: string) => void
}) {
  const selected = AVAILABLE_MODELS.find((m) => m.name === model) ?? AVAILABLE_MODELS[1]
  return (
    <div className="drag flex h-full w-full flex-col">
      <div className="h-9" />
      <div className="flex flex-1 items-center justify-center px-8">
        <div className="no-drag w-full max-w-md">
          <div className="mb-8 text-center">
            <GemmaLogo className="mx-auto mb-5 h-16 w-16" />
            <h1 className="text-[26px] font-semibold tracking-tight">Welcome to Gemma Chat</h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-400">
              A local AI assistant, powered by Google's Gemma 4.
              <br />
              Runs 100% on your Mac. No account, no cloud.
            </p>
          </div>

          <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-ink-400">
            Pick a model
          </div>
          <div className="space-y-2">
            {AVAILABLE_MODELS.map((m) => (
              <button
                key={m.name}
                onClick={() => onModelChange(m.name)}
                className={`group relative w-full rounded-xl border px-4 py-3 text-left transition ${
                  model === m.name
                    ? 'border-white/25 bg-white/[0.06]'
                    : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{m.name}</span>
                    {m.recommended && (
                      <span className="rounded-full bg-white/10 px-2 py-[1px] text-[10px] font-medium uppercase tracking-wider text-ink-100">
                        Recommended
                      </span>
                    )}
                  </div>
                  <span className="text-xs tabular-nums text-ink-400">{m.size}</span>
                </div>
                <div className="mt-1 text-[12.5px] leading-snug text-ink-400">
                  {m.description}
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => onStart(selected.name)}
            className="mt-6 w-full rounded-xl bg-white py-3 text-sm font-medium text-ink-900 transition hover:bg-white/90 active:scale-[0.99]"
          >
            Download {selected.name} &nbsp;·&nbsp; {selected.size}
          </button>
          <p className="mt-3 text-center text-[11px] text-ink-400">
            We'll also install the local model runtime (~180 MB) if needed.
          </p>
        </div>
      </div>
    </div>
  )
}

function StageList({ status }: { status: SetupStatus }) {
  const stages: Array<{ key: SetupStatus['stage']; label: string }> = [
    { key: 'installing-ollama', label: 'Install local runtime' },
    { key: 'starting-ollama', label: 'Start runtime' },
    { key: 'downloading-model', label: 'Download model' },
    { key: 'ready', label: 'Ready to chat' }
  ]
  const order: SetupStatus['stage'][] = [
    'checking',
    'installing-ollama',
    'starting-ollama',
    'downloading-model',
    'ready'
  ]
  const currentIdx = order.indexOf(status.stage)

  return (
    <div className="space-y-3">
      {stages.map((s) => {
        const idx = order.indexOf(s.key)
        const state = idx < currentIdx ? 'done' : idx === currentIdx ? 'active' : 'pending'
        return (
          <div key={s.key} className="flex items-center gap-3">
            <StageDot state={state} />
            <div className="flex-1">
              <div
                className={`text-sm transition ${
                  state === 'pending'
                    ? 'text-ink-400'
                    : state === 'active'
                      ? 'text-white'
                      : 'text-ink-200'
                }`}
              >
                {state === 'active' && status.message ? status.message : s.label}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StageDot({ state }: { state: 'pending' | 'active' | 'done' }) {
  if (state === 'done') {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/85 text-ink-900">
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2.5 6.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    )
  }
  if (state === 'active') {
    return (
      <div className="relative flex h-5 w-5 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-white/30" />
        <div className="h-2 w-2 rounded-full bg-white" />
      </div>
    )
  }
  return <div className="h-5 w-5 rounded-full border border-white/15" />
}

function GemmaLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7aa2f7" />
          <stop offset="50%" stopColor="#bb9af7" />
          <stop offset="100%" stopColor="#f7768e" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#g1)" opacity="0.15" />
      <circle cx="32" cy="32" r="30" stroke="url(#g1)" strokeWidth="1.5" />
      <path
        d="M32 14 L46 22 V42 L32 50 L18 42 V22 Z"
        stroke="url(#g1)"
        strokeWidth="1.75"
        strokeLinejoin="round"
        fill="rgba(255,255,255,0.03)"
      />
      <circle cx="32" cy="32" r="5" fill="url(#g1)" />
    </svg>
  )
}
