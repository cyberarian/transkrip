import { describe, expect, it } from 'vitest'
import { alignSpeakers, renameSpeaker } from './speaker-document'

const segments = [
  { id: 'a', start: 0, end: 2, text: 'Selamat pagi.', language: 'id' as const },
  { id: 'b', start: 2, end: 5, text: 'Good morning juga.', language: 'en' as const },
  { id: 'c', start: 5, end: 7, text: 'Mari kita mulai.', language: 'id' as const },
]

describe('speaker document', () => {
  it('aligns by greatest overlap and merges adjacent turns from one speaker', () => {
    const document = alignSpeakers(segments, [
      { start: 0, end: 2.8, speaker: 'SPEAKER_00' },
      { start: 2.8, end: 7, speaker: 'SPEAKER_01' },
    ], 'id')

    expect(document.speakers).toEqual([
      { id: 'SPEAKER_00', label: 'Pembicara 1' },
      { id: 'SPEAKER_01', label: 'Pembicara 2' },
    ])
    expect(document.blocks).toHaveLength(2)
    expect(document.blocks[1]).toMatchObject({ speakerId: 'SPEAKER_01', start: 2, end: 7, text: 'Good morning juga.\n\nMari kita mulai.' })
  })

  it('falls back to a language-appropriate single speaker', () => {
    expect(alignSpeakers(segments, [], 'en').speakers).toEqual([{ id: 'SPEAKER_00', label: 'Speaker 1' }])
  })

  it('renames one stable speaker everywhere without changing dialogue', () => {
    const source = alignSpeakers(segments, [], 'id')
    const renamed = renameSpeaker(source, 'SPEAKER_00', 'Adnuri')

    expect(renamed.speakers[0].label).toBe('Adnuri')
    expect(renamed.blocks.every(block => block.speakerLabel === 'Adnuri')).toBe(true)
    expect(renamed.blocks.map(block => block.text)).toEqual(source.blocks.map(block => block.text))
  })

  it('preserves spaces while a speaker name is being typed', () => {
    const source = alignSpeakers(segments, [], 'id')
    expect(renameSpeaker(source, 'SPEAKER_00', 'Budi ').speakers[0].label).toBe('Budi ')
    expect(renameSpeaker(source, 'SPEAKER_00', 'Budi Santoso').blocks[0].speakerLabel).toBe('Budi Santoso')
  })
})
