# Gemma Chat

A local AI assistant for Apple Silicon Macs — powered by Google's Gemma 4, running entirely on your machine. No account, no cloud calls during inference.

Chat with it, or switch into **Build mode** and have it write code for you with a live preview canvas.

## Features

- 🧠 **Local Gemma 4** via [Ollama](https://ollama.com) — e2b / e4b / 26b / 31b variants
- 🛠 **Build mode** — coding agent that writes multi-file projects into a workspace and renders a live preview
- 🪄 **Live code view** — watch Gemma type the file character-by-character
- 🌐 **Tool use** — web search (DuckDuckGo), fetch URL, calculator, filesystem, bash
- 🎤 **Local speech-to-text** via in-browser Whisper ([transformers.js](https://github.com/huggingface/transformers.js))
- 💾 **Zero-install first run** — Ollama runtime auto-downloads into the app's user-data folder if not already present

## Tech Stack

- **Electron** + **Vite** + **React 19** + **TypeScript** + **Tailwind**
- **Ollama** as the model runtime (bundled on first launch)
- **transformers.js** (`onnx-community/whisper-base.en`) for STT, WebGPU with WASM fallback
- Per-conversation workspaces served by a local HTTP server; previewed in an `<iframe>`

## Getting Started

Prerequisites: macOS (Apple Silicon), Node 20+.

```bash
npm install
npm run dev
```

On first launch the app will:
1. Detect whether the `ollama` CLI is on your system. If not, it downloads the standalone runtime into `~/Library/Application Support/gemma-chat/bin/`.
2. Start the local Ollama server on `127.0.0.1:11434`.
3. Pull the model you picked (default: `gemma4:e4b`, ~9.6 GB).
4. Drop you straight into the chat.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Run the Electron app with Vite HMR. |
| `npm run build` | Type-check + build main/preload/renderer bundles. |
| `npm run dist` | Build a signed `.dmg` via electron-builder. |
| `npm run typecheck` | Run TypeScript across main and web projects. |

## Architecture

```
src/
├── main/              Electron main process
│   ├── index.ts       Window + IPC handlers + agent loop
│   ├── ollama.ts      Ollama install/start/pull/chat
│   ├── workspace.ts   Per-conversation workspace + static file server
│   └── tools.ts       Tool definitions + system prompts + XML action parser
├── preload/           contextBridge API surface
├── renderer/src/
│   ├── components/
│   │   ├── Setup.tsx      First-run onboarding + model picker
│   │   ├── Chat.tsx       Main chat layout
│   │   ├── Sidebar.tsx    Conversation list
│   │   ├── Message.tsx    Assistant / user bubbles + tool cards + activity bar
│   │   ├── Composer.tsx   Input + mic button
│   │   └── Canvas.tsx     Preview / Code / Files tabs for Build mode
│   └── lib/whisper.ts     Browser Whisper pipeline
└── shared/types.ts    IPC + message types
```

### Agent loop

In Build mode, each assistant turn streams from Ollama; any `<action name="…">…</action>` blocks are parsed out of the stream, executed, and their results are threaded back into the next turn. The loop runs up to 40 rounds per user message.

### Tool protocol

Small models struggle with nested JSON escaping, so tools are invoked via an XML-ish block:

```
<action name="write_file">
<path>index.html</path>
<content>
<!doctype html>
…
</content>
</action>
```

`<content>` is parsed greedily to the **last** `</content>` so file bodies can contain nearly anything. Defensive post-processing strips stray ``` fences the model sometimes emits.

### Live code streaming

As Gemma streams into a `<content>` block, the main process throttle-writes partial file content to disk every ~450ms. The Canvas's **Code** tab renders that content with line numbers and a blinking cursor; the **Preview** tab's iframe reloads every ~350ms (debounced) so pages build in front of you.

## Credits

- [Gemma](https://ai.google.dev/gemma) by Google DeepMind
- [Ollama](https://ollama.com) runtime
- [Hugging Face transformers.js](https://github.com/huggingface/transformers.js) + [onnx-community](https://huggingface.co/onnx-community) for local Whisper
- Agent-harness patterns adapted from [google-ai-edge/gallery](https://github.com/google-ai-edge/gallery) and Anthropic's Claude Code
