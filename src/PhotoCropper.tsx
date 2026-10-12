import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { clampCropOffset, cropGeometry, CROP_HEIGHT, CROP_WIDTH } from './photoCrop'

type Props = { file: File, number: number, onCancel: () => void, onDone: (file: File) => void }

export default function PhotoCropper({ file, number, onCancel, onDone }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number, y: number, offsetX: number, offsetY: number } | null>(null)
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    canvas.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus()
    }
  }, [])

  useEffect(() => {
    let active = true
    let loaded: ImageBitmap | undefined
    createImageBitmap(file).then(image => {
      loaded = image
      if (active) setBitmap(image)
      else image.close()
    }).catch(() => { if (active) setError('This image could not be opened. Try a JPG or PNG photo.') })
    return () => { active = false; loaded?.close() }
  }, [file])

  useEffect(() => {
    if (!bitmap || !canvas.current) return
    const context = canvas.current.getContext('2d')
    if (!context) return
    const { scale, maxX, maxY } = cropGeometry(bitmap.width, bitmap.height, rotation, zoom)
    const position = clampCropOffset(offset, maxX, maxY)
    context.fillStyle = '#24152b'
    context.fillRect(0, 0, CROP_WIDTH, CROP_HEIGHT)
    context.save()
    context.translate(CROP_WIDTH / 2 + position.x, CROP_HEIGHT / 2 + position.y)
    context.rotate(rotation * Math.PI / 180)
    context.scale(scale, scale)
    context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
    context.restore()
  }, [bitmap, zoom, rotation, offset])

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drag.current || !bitmap) return
    const rect = event.currentTarget.getBoundingClientRect()
    const { maxX, maxY } = cropGeometry(bitmap.width, bitmap.height, rotation, zoom)
    setOffset(clampCropOffset({
      x: drag.current.offsetX + (event.clientX - drag.current.x) * CROP_WIDTH / rect.width,
      y: drag.current.offsetY + (event.clientY - drag.current.y) * CROP_HEIGHT / rect.height,
    }, maxX, maxY))
  }

  function turn(direction: number) {
    setRotation(value => (value + direction + 360) % 360)
    setOffset({ x: 0, y: 0 })
  }

  async function usePhoto() {
    if (!canvas.current || !bitmap) return
    setWorking(true)
    setError('')
    try {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.current!.toBlob(result => result ? resolve(result) : reject(new Error('Could not crop this photo.')), 'image/jpeg', 0.9))
      onDone(new File([blob], `profile-${number}.jpg`, { type: 'image/jpeg' }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not crop this photo.')
      setWorking(false)
    }
  }

  return createPortal(<div className="crop-backdrop" role="presentation">
    <div className="crop-dialog" role="dialog" aria-modal="true" aria-labelledby="crop-title">
      <div className="crop-heading"><div><span className="eyebrow">PHOTO {String(number).padStart(2, '0')} / 03</span><h2 id="crop-title">Make it your moment.</h2><p>Drag to frame it. Zoom in or turn it until it feels right.</p></div><button type="button" className="crop-close" onClick={onCancel} aria-label="Cancel crop">×</button></div>
      <div className="crop-stage"><canvas ref={canvas} width={CROP_WIDTH} height={CROP_HEIGHT} aria-label="Drag to reposition photo" tabIndex={0} onPointerDown={event => {
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y }
      }} onPointerMove={move} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} onKeyDown={event => {
        if (!bitmap || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
        event.preventDefault()
        const { maxX, maxY } = cropGeometry(bitmap.width, bitmap.height, rotation, zoom)
        const movement = event.shiftKey ? 20 : 5
        setOffset(current => clampCropOffset({
          x: current.x + (event.key === 'ArrowLeft' ? -movement : event.key === 'ArrowRight' ? movement : 0),
          y: current.y + (event.key === 'ArrowUp' ? -movement : event.key === 'ArrowDown' ? movement : 0),
        }, maxX, maxY))
      }} />{!bitmap && <div className="crop-loading">Opening your photo…</div>}<div className="crop-frame" aria-hidden="true" /></div>
      <div className="crop-controls"><label htmlFor="crop-zoom">Zoom <strong>{Math.round(zoom * 100)}%</strong></label><input id="crop-zoom" type="range" min="1" max="3" step="0.01" value={zoom} onChange={event => {
        const value = Number(event.target.value)
        setZoom(value)
        if (bitmap) {
          const { maxX, maxY } = cropGeometry(bitmap.width, bitmap.height, rotation, value)
          setOffset(current => clampCropOffset(current, maxX, maxY))
        }
      }} disabled={!bitmap} /><div className="crop-rotation"><span>Rotation</span><div><button type="button" onClick={() => turn(-90)} disabled={!bitmap} aria-label="Rotate left 90 degrees">↶ <span>Left</span></button><button type="button" onClick={() => turn(90)} disabled={!bitmap} aria-label="Rotate right 90 degrees"><span>Right</span> ↷</button></div></div></div>
      {error && <p className="crop-error" role="alert">{error}</p>}
      <div className="crop-actions"><button type="button" className="crop-cancel" onClick={onCancel}>Cancel</button><button type="button" className="primary-btn" disabled={!bitmap || working} onClick={() => { void usePhoto() }}>{working ? 'Saving crop…' : 'Use this photo ↗'}</button></div>
    </div>
  </div>, document.body)
}
