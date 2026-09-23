import { useCallback, useEffect, useRef, useState } from 'react'
import { formatTime } from '../audio'
import { clampZoom, MAX_WAVEFORM_ZOOM, playbackFollowScrollLeft, scrollLeftForZoom } from '../waveform-navigation'

type Props = { hasPcm: boolean; readPcm: () => Float32Array | null; duration: number; current: number; playing: boolean; onSeek: (time: number) => void }
type DragState = { pointerId: number; startX: number; startScrollLeft: number; moved: boolean }

export function Waveform({ hasPcm, readPcm, duration, current, playing, onSeek }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const suppressClickRef = useRef(false)
  const [zoom, setZoom] = useState(1)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const contentWidth = Math.max(viewportWidth, viewportWidth * zoom)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const observer = new ResizeObserver(() => setViewportWidth(viewport.clientWidth))
    observer.observe(viewport)
    setViewportWidth(viewport.clientWidth)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || contentWidth <= 0) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(rect.width * dpr)
    canvas.height = Math.floor(rect.height * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    const w = rect.width
    const h = rect.height
    ctx.fillStyle = '#07152b'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#294768'
    ctx.lineWidth = 1
    for (let i = 0; i <= 10; i++) {
      const x = Math.round((i / 10) * w) + .5
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
    }
    ctx.strokeStyle = '#5a9ee0'
    ctx.fillStyle = '#5a9ee0'
    const middle = h / 2
    const pcm = readPcm()
    if (pcm?.length) {
      const bars = Math.max(120, Math.floor(w / 3))
      const step = Math.max(1, Math.floor(pcm.length / bars))
      const sampleStride = Math.max(1, Math.floor(step / 16))
      for (let i = 0; i < bars; i++) {
        let peak = 0
        const start = i * step
        for (let j = 0; j < step; j += sampleStride) peak = Math.max(peak, Math.abs(pcm[start + j] || 0))
        const bh = Math.max(2, peak * (h - 28))
        ctx.fillRect((i / bars) * w, middle - bh / 2, Math.max(1, 2 * zoom ** .25), bh)
      }
    } else {
      ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(0, middle); ctx.lineTo(w, middle); ctx.stroke(); ctx.setLineDash([])
    }
  }, [contentWidth, hasPcm, readPcm, zoom])

  const changeZoom = useCallback((nextZoom: number) => {
    const viewport = viewportRef.current
    if (!viewport || viewportWidth <= 0) return
    const boundedZoom = clampZoom(nextZoom)
    const oldWidth = Math.max(viewportWidth, viewportWidth * zoom)
    const nextWidth = Math.max(viewportWidth, viewportWidth * boundedZoom)
    const nextScroll = scrollLeftForZoom(viewport.scrollLeft, viewportWidth, oldWidth, nextWidth)
    setZoom(boundedZoom)
    requestAnimationFrame(() => {
      if (viewportRef.current) {
        viewportRef.current.scrollLeft = nextScroll
        setScrollLeft(nextScroll)
      }
    })
  }, [viewportWidth, zoom])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!playing || !viewport || duration <= 0 || contentWidth <= viewport.clientWidth) return
    const playheadX = (current / duration) * contentWidth
    const nextLeft = playbackFollowScrollLeft(viewport.scrollLeft, playheadX, viewport.clientWidth, contentWidth)
    if (nextLeft !== null) {
      viewport.scrollLeft = nextLeft
      setScrollLeft(nextLeft)
    }
  }, [playing, current, duration, contentWidth])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return
    const viewport = viewportRef.current
    if (!viewport) return
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: viewport.scrollLeft, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const viewport = viewportRef.current
    if (!drag || drag.pointerId !== event.pointerId || !viewport) return
    const delta = event.clientX - drag.startX
    if (Math.abs(delta) >= 4) drag.moved = true
    if (drag.moved) {
      viewport.scrollLeft = drag.startScrollLeft - delta
      setScrollLeft(viewport.scrollLeft)
    }
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    suppressClickRef.current = drag.moved
    dragRef.current = null
  }

  const visibleStart = duration > 0 && contentWidth > 0 ? (scrollLeft / contentWidth) * duration : 0
  const visibleEnd = duration > 0 && contentWidth > 0 ? Math.min(duration, ((scrollLeft + viewportWidth) / contentWidth) * duration) : duration
  const playheadX = duration > 0 ? Math.max(0, Math.min(contentWidth, (current / duration) * contentWidth)) : 0

  return <div className="waveform-wrap">
    <div
      ref={viewportRef}
      className="waveform-viewport"
      onScroll={event => setScrollLeft(event.currentTarget.scrollLeft)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClick={event => {
        if (suppressClickRef.current) { suppressClickRef.current = false; event.preventDefault(); return }
        const canvas = canvasRef.current
        const rect = canvas?.getBoundingClientRect()
        if (duration > 0 && rect && rect.width > 0) onSeek(((event.clientX - rect.left) / rect.width) * duration)
      }}
      aria-label="Gelombang audio. Seret untuk menggeser waktu."
    >
      <canvas
        ref={canvasRef}
        style={{ width: contentWidth ? `${contentWidth}px` : '100%' }}
        role="slider"
        tabIndex={duration > 0 ? 0 : -1}
        aria-label="Posisi audio"
        aria-disabled={duration <= 0}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, Math.round(duration))}
        aria-valuenow={Math.max(0, Math.round(current))}
        aria-valuetext={`${formatTime(current)} dari ${formatTime(duration)}`}
        onKeyDown={event => {
          if (duration <= 0) return
          const step = Math.max(1, ((visibleEnd - visibleStart) / 100))
          if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') onSeek(current - step)
          else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') onSeek(current + step)
          else if (event.key === 'Home') onSeek(0)
          else if (event.key === 'End') onSeek(duration)
          else return
          event.preventDefault()
        }}
      />
      {duration > 0 && <div className="waveform-playhead" style={{ left: `${playheadX}px` }} aria-hidden="true"><span/></div>}
    </div>
    <div className="waveform-tools" aria-label="Kontrol tampilan gelombang">
      <button type="button" aria-label="Perkecil gelombang" title="Perkecil" disabled={zoom <= 1} onClick={() => changeZoom(zoom / 1.5)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button>
      <span aria-live="polite">{zoom.toFixed(1)}×</span>
      <button type="button" aria-label="Perbesar gelombang" title="Perbesar" disabled={zoom >= MAX_WAVEFORM_ZOOM} onClick={() => changeZoom(zoom * 1.5)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg></button>
      <button type="button" className="waveform-fit" aria-label="Tampilkan seluruh rekaman" onClick={() => changeZoom(1)}>Seluruh audio</button>
    </div>
    <div className="timeline-labels" aria-hidden="true"><span>{formatTime(visibleStart)}</span><span>{formatTime((visibleStart + visibleEnd) / 2)}</span><span>{formatTime(visibleEnd)}</span></div>
  </div>
}
