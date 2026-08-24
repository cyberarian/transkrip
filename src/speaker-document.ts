import type { Segment } from './types'

export type Speaker = { id: string; label: string }
export type SpeakerTurn = { start: number; end: number; speaker: string }
export type SpeakerBlock = { id: string; speakerId: string; speakerLabel: string; start: number; end: number; text: string }
export type SpeakerDocument = { speakers: Speaker[]; blocks: SpeakerBlock[] }

function overlap(segment: Pick<Segment, 'start' | 'end'>, turn: SpeakerTurn) {
  return Math.max(0, Math.min(segment.end, turn.end) - Math.max(segment.start, turn.start))
}

function defaultLabel(index: number, language: string) {
  return language === 'en' ? `Speaker ${index + 1}` : `Pembicara ${index + 1}`
}

export function alignSpeakers(segments: Segment[], turns: SpeakerTurn[], language: string): SpeakerDocument {
  const fallback = 'SPEAKER_00'
  const speakerIds: string[] = []
  const assigned = segments.map(segment => {
    let speakerId = fallback
    let bestOverlap = 0
    for (const turn of turns) {
      const duration = overlap(segment, turn)
      if (duration > bestOverlap) { speakerId = turn.speaker; bestOverlap = duration }
    }
    if (!speakerIds.includes(speakerId)) speakerIds.push(speakerId)
    return { segment, speakerId }
  })
  if (!speakerIds.length) speakerIds.push(fallback)
  const speakers = speakerIds.map((id, index) => ({ id, label: defaultLabel(index, language) }))
  const labels = new Map(speakers.map(speaker => [speaker.id, speaker.label]))
  const blocks: SpeakerBlock[] = []
  for (const { segment, speakerId } of assigned) {
    const previous = blocks.at(-1)
    if (previous?.speakerId === speakerId) {
      previous.end = segment.end
      previous.text = `${previous.text}\n\n${segment.text.trim()}`
    } else {
      blocks.push({ id: segment.id, speakerId, speakerLabel: labels.get(speakerId)!, start: segment.start, end: segment.end, text: segment.text.trim() })
    }
  }
  return { speakers, blocks }
}

export function renameSpeaker(document: SpeakerDocument, speakerId: string, label: string): SpeakerDocument {
  if (label.length > 100) throw new Error('Nama pembicara harus berisi maksimal 100 karakter.')
  return {
    speakers: document.speakers.map(speaker => speaker.id === speakerId ? { ...speaker, label } : speaker),
    blocks: document.blocks.map(block => block.speakerId === speakerId ? { ...block, speakerLabel: label } : block),
  }
}
