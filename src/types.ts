export type Segment = {
  id: string
  start: number
  end: number
  text: string
  language: 'id' | 'en' | 'auto'
  confidence?: number
}

export type EngineState = 'missing' | 'loading' | 'ready' | 'transcribing' | 'error'

export type WorkerMessage =
  | { type: 'ready' }
  | { type: 'model-ready'; name: string }
  | { type: 'segment'; segment: Segment }
  | { type: 'done' }
  | { type: 'log'; message: string }
  | { type: 'error'; message: string }
