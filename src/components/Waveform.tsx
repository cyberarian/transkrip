import { useEffect, useRef } from 'react'
import { formatTime } from '../audio'

type Props = { hasPcm: boolean; readPcm: () => Float32Array | null; duration: number; current: number; onSeek: (time: number) => void }

export function Waveform({ hasPcm, readPcm, duration, current, onSeek }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const draw = () => {
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
      ctx.strokeStyle = '#3b638a'
      ctx.lineWidth = 1
      for (let i = 0; i <= 6; i++) {
        const x = Math.round((i / 6) * w) + .5
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
      }
      ctx.strokeStyle = '#5a9ee0'
      ctx.fillStyle = '#5a9ee0'
      ctx.lineWidth = 1
      const middle = h / 2
      const pcm = readPcm()
      if (pcm?.length) {
        const bars = Math.max(120, Math.floor(w / 3))
        const step = Math.max(1, Math.floor(pcm.length / bars))
        for (let i = 0; i < bars; i++) {
          let peak = 0
          const start = i * step
          for (let j = 0; j < step; j += Math.max(1, Math.floor(step / 16))) peak = Math.max(peak, Math.abs(pcm[start + j] || 0))
          const bh = Math.max(2, peak * (h - 28))
          ctx.fillRect((i / bars) * w, middle - bh / 2, 2, bh)
        }
      } else {
        ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(0, middle); ctx.lineTo(w, middle); ctx.stroke(); ctx.setLineDash([])
      }

    }
    draw()
    const observer = new ResizeObserver(draw)
    const container = canvas.parentElement
    if (container) observer.observe(container)
    return () => observer.disconnect()
  }, [hasPcm, readPcm])

  return <div className="waveform-wrap">
    <canvas
      ref={canvasRef}
      role="slider"
      tabIndex={duration > 0 ? 0 : -1}
      aria-label="Posisi audio"
      aria-disabled={duration <= 0}
      aria-valuemin={0}
      aria-valuemax={Math.max(0, Math.round(duration))}
      aria-valuenow={Math.max(0, Math.round(current))}
      aria-valuetext={`${formatTime(current)} dari ${formatTime(duration)}`}
      onKeyDown={(event) => {
        if (duration <= 0) return
        if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') onSeek(current - 5)
        else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') onSeek(current + 5)
        else if (event.key === 'Home') onSeek(0)
        else if (event.key === 'End') onSeek(duration)
        else return
        event.preventDefault()
      }}
      onClick={(event) => {
      const rect = event.currentTarget.getBoundingClientRect()
      if (duration > 0 && rect.width > 0) onSeek(((event.clientX - rect.left) / rect.width) * duration)
    }} />
    {duration > 0 && <svg className="waveform-playhead" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><line x1={Math.max(0, Math.min(1000, current / duration * 1000))} x2={Math.max(0, Math.min(1000, current / duration * 1000))} y1="0" y2="100"/></svg>}
    <div className="timeline-labels"><span>00:00</span><span>{formatTime(duration / 2)}</span><span>{formatTime(duration)}</span></div>
  </div>
}
