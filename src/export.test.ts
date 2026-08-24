import { describe, expect, it } from 'vitest'
import { formatCleanTxt } from './export'

describe('formatCleanTxt', () => {
  it('places every sentence on its own clean line and preserves paragraph spacing', () => {
    expect(formatCleanTxt([
      { text: '  Ini  kalimat pertama.   Ini kalimat kedua!  ' },
      { text: 'Can we review this?  Ya, bisa.' },
    ])).toBe('Ini kalimat pertama.\nIni kalimat kedua!\n\nCan we review this?\nYa, bisa.')
  })

  it('normalizes line breaks and omits empty transcript paragraphs', () => {
    expect(formatCleanTxt([
      { text: 'Satu baris\nmasih satu kalimat.' },
      { text: '   ' },
      { text: 'Kalimat terakhir tanpa tanda baca' },
    ])).toBe('Satu baris masih satu kalimat.\n\nKalimat terakhir tanpa tanda baca')
  })
})
