type TranscriptText = { text: string }

const sentenceSegmenter = new Intl.Segmenter(['id', 'en'], { granularity: 'sentence' })

function cleanWhitespace(text: string) {
  return text.replace(/\s+/gu, ' ').trim()
}

export function formatCleanTxt(segments: TranscriptText[]) {
  return segments
    .map(({ text }) => Array.from(sentenceSegmenter.segment(cleanWhitespace(text)), ({ segment }) => cleanWhitespace(segment))
      .filter(Boolean)
      .join('\n'))
    .filter(Boolean)
    .join('\n\n')
}
