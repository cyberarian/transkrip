import type { Segment } from './types'

export type PersistenceRun = {
  taskId: number
  failed: boolean
  segmentQueue: Promise<void>
  audioUpload: Promise<void>
  segments: Segment[]
}

export function createPersistenceRun(taskId: number, audioUpload: Promise<void>): PersistenceRun {
  return { taskId, failed: false, segmentQueue: Promise.resolve(), audioUpload, segments: [] }
}

export function enqueueSegment(run: PersistenceRun, segment: Segment, append: (taskId: number, text: string) => Promise<unknown>) {
  run.segments.push(segment)
  run.segmentQueue = run.segmentQueue.catch(() => undefined).then(() => append(run.taskId, segment.text)).then(() => undefined)
  return run.segmentQueue
}

export async function awaitPersistence(run: PersistenceRun) {
  await Promise.all([run.segmentQueue, run.audioUpload])
}
