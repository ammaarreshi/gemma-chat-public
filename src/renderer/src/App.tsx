import { useEffect, useState } from 'react'
import { DEFAULT_MODEL, type SetupStatus } from '@shared/types'
import Setup from './components/Setup'
import Chat from './components/Chat'

type AppState =
  | { phase: 'boot' }
  | { phase: 'setup'; status: SetupStatus; model: string }
  | { phase: 'ready'; model: string }

export default function App() {
  const [state, setState] = useState<AppState>({ phase: 'boot' })

  useEffect(() => {
    // Forward raw Gemma output to devtools console for debugging
    const rawUnsub = window.api.onRawChunk((ev) => {
      // eslint-disable-next-line no-console
      console.log('[gemma]', ev.chunk)
    })
    let unsub: (() => void) | undefined
    ;(async () => {
      unsub = window.api.onSetupStatus((status) => {
        setState((prev) => {
          if (status.stage === 'ready') {
            return { phase: 'ready', model: prev.phase === 'setup' ? prev.model : DEFAULT_MODEL }
          }
          const model = prev.phase === 'setup' ? prev.model : DEFAULT_MODEL
          return { phase: 'setup', status, model }
        })
      })

      const local = await window.api.listLocalModels()
      const hasDefault = local.some(
        (m) => m === DEFAULT_MODEL || m.startsWith(DEFAULT_MODEL + ':')
      )
      if (hasDefault) {
        const { hasOllama } = await window.api.checkOllama()
        if (hasOllama) {
          setState({
            phase: 'setup',
            status: { stage: 'starting-ollama', message: 'Starting model runtime…' },
            model: DEFAULT_MODEL
          })
          window.api.startSetup(DEFAULT_MODEL)
          return
        }
      }
      setState({
        phase: 'setup',
        status: { stage: 'checking', message: 'Welcome' },
        model: DEFAULT_MODEL
      })
    })()
    return () => {
      unsub?.()
      rawUnsub?.()
    }
  }, [])

  if (state.phase === 'boot') {
    return <BootSplash />
  }

  if (state.phase === 'setup') {
    return (
      <Setup
        status={state.status}
        model={state.model}
        onModelChange={(m) =>
          setState((s) => (s.phase === 'setup' ? { ...s, model: m } : s))
        }
        onStart={(model) => {
          setState({
            phase: 'setup',
            status: { stage: 'checking', message: 'Checking system…' },
            model
          })
          window.api.startSetup(model)
        }}
      />
    )
  }

  return <Chat model={state.model} />
}

function BootSplash() {
  return (
    <div className="drag flex h-full w-full items-center justify-center">
      <div className="shimmer h-1 w-40 rounded-full" />
    </div>
  )
}
