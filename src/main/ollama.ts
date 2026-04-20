import { app } from 'electron'
import { spawn, ChildProcess, spawnSync } from 'child_process'
import { createWriteStream } from 'fs'
import { mkdir, chmod, copyFile, access, readdir, stat } from 'fs/promises'
import { join, dirname } from 'path'

const OLLAMA_HOST = '127.0.0.1:11434'
const OLLAMA_URL = `http://${OLLAMA_HOST}`
const DARWIN_ZIP = 'https://github.com/ollama/ollama/releases/latest/download/Ollama-darwin.zip'

let serverProc: ChildProcess | null = null

function exists(p: string): Promise<boolean> {
  return access(p)
    .then(() => true)
    .catch(() => false)
}

function userDataBinDir(): string {
  return join(app.getPath('userData'), 'bin')
}

function bundledOllamaPath(): string {
  return join(userDataBinDir(), 'ollama')
}

function modelsDir(): string {
  return join(app.getPath('userData'), 'models')
}

function findSystemOllama(): string | null {
  const candidates = [
    '/usr/local/bin/ollama',
    '/opt/homebrew/bin/ollama',
    '/Applications/Ollama.app/Contents/Resources/ollama'
  ]
  for (const c of candidates) {
    try {
      const s = spawnSync(c, ['--version'], { timeout: 3000 })
      if (s.status === 0) return c
    } catch {
      // ignore
    }
  }
  const which = spawnSync('which', ['ollama'])
  if (which.status === 0) {
    const p = which.stdout.toString().trim()
    if (p) return p
  }
  return null
}

export async function locateOllama(): Promise<string | null> {
  const bundled = bundledOllamaPath()
  if (await exists(bundled)) return bundled
  return findSystemOllama()
}

export type InstallProgress = {
  stage: 'download' | 'extract' | 'install'
  bytesDone?: number
  bytesTotal?: number
  message: string
}

export async function installOllama(onProgress: (p: InstallProgress) => void): Promise<string> {
  const destBin = bundledOllamaPath()
  if (await exists(destBin)) return destBin

  const tmpDir = join(app.getPath('userData'), 'tmp')
  await mkdir(tmpDir, { recursive: true })
  await mkdir(userDataBinDir(), { recursive: true })

  const zipPath = join(tmpDir, 'Ollama-darwin.zip')
  const extractDir = join(tmpDir, 'ollama-extracted')

  onProgress({ stage: 'download', message: 'Downloading Ollama runtime…' })
  await downloadFile(DARWIN_ZIP, zipPath, (done, total) => {
    onProgress({
      stage: 'download',
      message: 'Downloading Ollama runtime…',
      bytesDone: done,
      bytesTotal: total
    })
  })

  onProgress({ stage: 'extract', message: 'Extracting…' })
  await mkdir(extractDir, { recursive: true })
  await runCmd('ditto', ['-xk', zipPath, extractDir])

  onProgress({ stage: 'install', message: 'Installing…' })
  const binary = await findBinaryIn(extractDir)
  if (!binary) {
    throw new Error('Could not find ollama binary inside downloaded archive')
  }
  await copyFile(binary, destBin)
  await chmod(destBin, 0o755)

  return destBin
}

async function findBinaryIn(dir: string): Promise<string | null> {
  const queue: string[] = [dir]
  while (queue.length) {
    const cur = queue.shift()!
    let entries: string[] = []
    try {
      entries = await readdir(cur)
    } catch {
      continue
    }
    for (const name of entries) {
      const full = join(cur, name)
      let s
      try {
        s = await stat(full)
      } catch {
        continue
      }
      if (s.isDirectory()) {
        queue.push(full)
        continue
      }
      if (name === 'ollama' && s.isFile() && (s.mode & 0o111) !== 0) {
        return full
      }
      if (name === 'ollama' && s.isFile()) {
        return full
      }
    }
  }
  return null
}

function runCmd(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let err = ''
    p.stderr?.on('data', (d) => (err += d.toString()))
    p.on('error', reject)
    p.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} ${args.join(' ')} failed: ${err || 'exit ' + code}`))
    })
  })
}

async function downloadFile(
  url: string,
  dest: string,
  onProgress: (done: number, total: number) => void
): Promise<void> {
  let current = url
  for (let redirects = 0; redirects < 5; redirects++) {
    const res = await fetch(current, { redirect: 'manual' })
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get('location')
      if (!next) throw new Error(`Redirect without location from ${current}`)
      current = new URL(next, current).toString()
      continue
    }
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`)
    const total = Number(res.headers.get('content-length') || '0')
    let done = 0
    await mkdir(dirname(dest), { recursive: true })
    const file = createWriteStream(dest)
    const reader = res.body!.getReader()
    while (true) {
      const { done: finished, value } = await reader.read()
      if (finished) break
      if (value) {
        file.write(value)
        done += value.byteLength
        onProgress(done, total)
      }
    }
    await new Promise<void>((resolve, reject) => {
      file.end(() => resolve())
      file.on('error', reject)
    })
    return
  }
  throw new Error('Too many redirects')
}

export async function startServer(ollamaBin: string): Promise<void> {
  if (serverProc && !serverProc.killed) return
  await mkdir(modelsDir(), { recursive: true })
  const env = {
    ...process.env,
    OLLAMA_HOST,
    OLLAMA_MODELS: modelsDir(),
    OLLAMA_KEEP_ALIVE: '30m'
  }
  serverProc = spawn(ollamaBin, ['serve'], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  })
  serverProc.stdout?.on('data', (d) => console.log('[ollama]', d.toString().trim()))
  serverProc.stderr?.on('data', (d) => console.log('[ollama]', d.toString().trim()))
  serverProc.on('exit', (code) => {
    console.log('[ollama] exited', code)
    serverProc = null
  })
  await waitForHealth(30000)
}

export function stopServer(): void {
  if (serverProc && !serverProc.killed) {
    serverProc.kill('SIGTERM')
    serverProc = null
  }
}

async function waitForHealth(timeoutMs: number): Promise<void> {
  const start = Date.now()
  let lastError: unknown = null
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${OLLAMA_URL}/api/version`)
      if (res.ok) return
    } catch (e) {
      lastError = e
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`Ollama server did not become healthy: ${String(lastError)}`)
}

export async function listLocalModels(): Promise<string[]> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`)
    if (!res.ok) return []
    const data = (await res.json()) as { models?: Array<{ name: string }> }
    return (data.models ?? []).map((m) => m.name)
  } catch {
    return []
  }
}

export async function hasModel(name: string): Promise<boolean> {
  const list = await listLocalModels()
  return list.some((n) => n === name || n.startsWith(name + ':'))
}

export type PullProgress = {
  status: string
  completed?: number
  total?: number
  digest?: string
}

export async function* pullModel(model: string, signal?: AbortSignal): AsyncGenerator<PullProgress> {
  const res = await fetch(`${OLLAMA_URL}/api/pull`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, stream: true }),
    signal
  })
  if (!res.ok || !res.body) {
    throw new Error(`Pull failed: ${res.status} ${res.statusText}`)
  }
  yield* readJsonLines<PullProgress>(res.body as unknown as ReadableStream<Uint8Array>)
}

export interface OllamaChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  images?: string[]
}

export interface OllamaChatOptions {
  model: string
  messages: OllamaChatMessage[]
  signal?: AbortSignal
  temperature?: number
}

export async function* chatStream(
  opts: OllamaChatOptions
): AsyncGenerator<{ content?: string; done?: boolean }> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      stream: true,
      options: opts.temperature != null ? { temperature: opts.temperature } : undefined
    }),
    signal: opts.signal
  })
  if (!res.ok || !res.body) {
    throw new Error(`Chat failed: ${res.status} ${res.statusText}`)
  }
  const stream = res.body as unknown as ReadableStream<Uint8Array>
  for await (const obj of readJsonLines<{ message?: { content?: string }; done?: boolean }>(
    stream
  )) {
    yield { content: obj.message?.content, done: obj.done }
  }
}

async function* readJsonLines<T>(stream: ReadableStream<Uint8Array>): AsyncGenerator<T> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim()
      buf = buf.slice(idx + 1)
      if (!line) continue
      try {
        yield JSON.parse(line) as T
      } catch {
        // skip malformed line
      }
    }
  }
  if (buf.trim()) {
    try {
      yield JSON.parse(buf) as T
    } catch {
      // ignore
    }
  }
}

export { OLLAMA_URL }
