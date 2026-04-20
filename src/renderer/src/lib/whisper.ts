import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'

// Cache models locally in the browser via IndexedDB
env.allowLocalModels = false
env.useBrowserCache = true

type ProgressCb = (ev: { status: string; file?: string; progress?: number; loaded?: number; total?: number }) => void

let pipelinePromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null
// onnx-community ships the official, ORT-compatible quantizations; Xenova's older
// whisper-tiny.en has a broken int4 quant that fails with "Missing required scale".
let currentModel = 'onnx-community/whisper-base.en'

export async function getTranscriber(
  onProgress?: ProgressCb
): Promise<AutomaticSpeechRecognitionPipeline> {
  if (pipelinePromise) return pipelinePromise
  pipelinePromise = (async () => {
    const pipe = await pipeline('automatic-speech-recognition', currentModel, {
      dtype: {
        encoder_model: 'fp32',
        decoder_model_merged: 'q8'
      },
      device: 'webgpu',
      progress_callback: onProgress as unknown as (...args: unknown[]) => void
    }).catch(async (err: unknown) => {
      console.warn('[whisper] webgpu failed, falling back to wasm', err)
      return pipeline('automatic-speech-recognition', currentModel, {
        dtype: {
          encoder_model: 'fp32',
          decoder_model_merged: 'q8'
        },
        device: 'wasm',
        progress_callback: onProgress as unknown as (...args: unknown[]) => void
      })
    })
    return pipe as AutomaticSpeechRecognitionPipeline
  })()
  return pipelinePromise
}

export function setTranscriberModel(model: string): void {
  if (model === currentModel) return
  currentModel = model
  pipelinePromise = null
}

export async function transcribeAudioBlob(
  blob: Blob,
  onProgress?: ProgressCb
): Promise<string> {
  const transcriber = await getTranscriber(onProgress)
  // Decode the blob using WebAudio and resample to 16 kHz mono Float32
  const arrayBuffer = await blob.arrayBuffer()
  const audioCtx = new AudioContext({ sampleRate: 16000 })
  let buf: AudioBuffer
  try {
    buf = await audioCtx.decodeAudioData(arrayBuffer.slice(0))
  } finally {
    audioCtx.close()
  }
  // Mix down to mono
  const channelData =
    buf.numberOfChannels === 1 ? buf.getChannelData(0) : mixToMono(buf)
  // If sample rate isn't 16kHz (some browsers ignore the target rate), resample manually
  const pcm = buf.sampleRate === 16000 ? channelData : resampleLinear(channelData, buf.sampleRate, 16000)
  const result = await transcriber(pcm, {
    chunk_length_s: 30,
    stride_length_s: 5
  } as unknown as Record<string, unknown>)
  const text = Array.isArray(result)
    ? result.map((r) => (r as { text?: string }).text ?? '').join(' ')
    : ((result as { text?: string }).text ?? '')
  return text.trim()
}

function mixToMono(buf: AudioBuffer): Float32Array {
  const len = buf.length
  const out = new Float32Array(len)
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const data = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) out[i] += data[i]
  }
  for (let i = 0; i < len; i++) out[i] /= buf.numberOfChannels
  return out
}

function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input
  const ratio = fromRate / toRate
  const outLen = Math.floor(input.length / ratio)
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const srcIdx = i * ratio
    const i0 = Math.floor(srcIdx)
    const i1 = Math.min(i0 + 1, input.length - 1)
    const t = srcIdx - i0
    out[i] = input[i0] * (1 - t) + input[i1] * t
  }
  return out
}
