export const MIN_WAVEFORM_ZOOM = 1
export const MAX_WAVEFORM_ZOOM = 16

export function clampZoom(zoom: number) {
  return Math.max(MIN_WAVEFORM_ZOOM, Math.min(MAX_WAVEFORM_ZOOM, zoom))
}

export function scrollLeftForZoom(
  oldScrollLeft: number,
  viewportWidth: number,
  oldContentWidth: number,
  newContentWidth: number,
  anchorRatio = 0.5,
) {
  if (oldContentWidth <= 0 || newContentWidth <= 0 || viewportWidth <= 0) return 0
  const anchor = Math.max(0, Math.min(1, anchorRatio)) * viewportWidth
  const sourceRatio = (oldScrollLeft + anchor) / oldContentWidth
  const next = sourceRatio * newContentWidth - anchor
  return Math.max(0, Math.min(Math.max(0, newContentWidth - viewportWidth), next))
}

export function playbackFollowScrollLeft(scrollLeft: number, playheadX: number, viewportWidth: number, contentWidth: number) {
  if (viewportWidth <= 0 || contentWidth <= viewportWidth) return null
  const visibleX = playheadX - scrollLeft
  if (visibleX >= viewportWidth * .2 && visibleX <= viewportWidth * .8) return null
  return Math.max(0, Math.min(contentWidth - viewportWidth, playheadX - viewportWidth * .72))
}
