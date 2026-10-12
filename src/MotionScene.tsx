import { useEffect, useRef } from 'react'
import { useMotion } from './Motion'

export default function MotionScene({ ambient = false }: { ambient?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const { enabled } = useMotion()
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const mobile = window.matchMedia('(max-width: 760px), (pointer: coarse)').matches
    let width = 0, height = 0, frame = 0, time = 0, last = 0, rendered = 0, visible = true, inView = true
    let bounds = canvas.getBoundingClientRect()
    const pointer = { x: .5, y: .5, targetX: .5, targetY: .5 }
    const particles = Array.from({ length: ambient ? (mobile ? 18 : 55) : (mobile ? 56 : 180) }, (_, index) => ({
      angle: index * 2.399963, radius: .6 + ((index * 17) % 41) / 100,
      size: .6 + (index % 5) * .4, speed: .15 + (index % 7) * .015,
    }))
    const bursts: { x: number, y: number, age: number, seed: number }[] = []
    function resize() {
      bounds = canvas.getBoundingClientRect(); width = bounds.width; height = bounds.height
      const dpr = Math.min(window.devicePixelRatio, mobile ? 1 : 1.5)
      canvas.width = width * dpr; canvas.height = height * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    function move(e: PointerEvent) {
      pointer.targetX = (e.clientX - bounds.left) / width; pointer.targetY = (e.clientY - bounds.top) / height
    }
    function burst(e: PointerEvent) {
      bursts.push({ x: e.clientX - bounds.left, y: e.clientY - bounds.top, age: 0, seed: Math.random() * 6 })
      if (bursts.length > 6) bursts.shift()
    }
    function draw(now: number) {
      if (mobile && now - rendered < 1000 / 30) { frame = requestAnimationFrame(draw); return }
      rendered = now
      const delta = Math.min((now - last) / 1000 || .016, .04); last = now
      if (enabled) time += delta
      pointer.x += (pointer.targetX - pointer.x) * .04; pointer.y += (pointer.targetY - pointer.y) * .04
      ctx!.clearRect(0, 0, width, height)
      const cx = width * (ambient ? .5 : .73) + (pointer.x - .5) * 48
      const cy = height * .48 + (pointer.y - .5) * 38
      const radius = Math.min(width * .33, height * .39)
      ctx!.globalCompositeOperation = 'lighter'
      particles.forEach((p, i) => {
        const angle = p.angle + time * p.speed
        const pulse = Math.sin(time * .5 + i) * 14
        const x = cx + Math.cos(angle) * (radius * p.radius + pulse)
        const y = cy + Math.sin(angle) * (radius * p.radius + pulse) * .72 + Math.sin(angle * 2 + time) * 22
        const alpha = ambient ? .2 : .35 + Math.sin(angle + time) * .2
        ctx!.fillStyle = i % 3 ? `rgba(255,184,104,${alpha})` : `rgba(255,88,152,${alpha})`
        ctx!.beginPath(); ctx!.arc(x, y, p.size, 0, Math.PI * 2); ctx!.fill()
        if (!ambient && i % 9 === 0) {
          ctx!.strokeStyle = `rgba(255,182,111,${alpha * .35})`; ctx!.lineWidth = .5
          ctx!.beginPath(); ctx!.moveTo(x, y); ctx!.lineTo(x - Math.sin(angle) * 27, y + Math.cos(angle) * 19); ctx!.stroke()
        }
      })
      bursts.forEach((b, index) => {
        if (enabled) b.age += delta
        const sparks = mobile ? 12 : 22
        for (let i = 0; i < sparks; i++) {
          const angle = i / sparks * Math.PI * 2 + b.seed
          const distance = b.age * (75 + i % 4 * 25)
          ctx!.fillStyle = `rgba(255,${120 + i % 3 * 45},140,${Math.max(0, 1 - b.age)})`
          ctx!.beginPath(); ctx!.arc(b.x + Math.cos(angle) * distance, b.y + Math.sin(angle) * distance, 2, 0, Math.PI * 2); ctx!.fill()
        }
        if (b.age > 1) bursts.splice(index, 1)
      })
      ctx!.globalCompositeOperation = 'source-over'
      if (enabled && visible && inView) frame = requestAnimationFrame(draw)
    }
    function resume() { cancelAnimationFrame(frame); if (visible && inView && enabled) { last = 0; rendered = 0; frame = requestAnimationFrame(draw) } }
    function visibility() { visible = !document.hidden; resume() }
    const observer = new ResizeObserver(resize); observer.observe(canvas)
    const intersection = new IntersectionObserver(entries => { inView = entries[0].isIntersecting; resume() })
    intersection.observe(canvas)
    if (!mobile) window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', burst, { passive: true })
    document.addEventListener('visibilitychange', visibility)
    resize(); frame = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect(); window.removeEventListener('pointermove', move); window.removeEventListener('pointerdown', burst); document.removeEventListener('visibilitychange', visibility) }
  }, [enabled, ambient])
  return <canvas ref={ref} className={ambient ? 'motion-canvas ambient' : 'motion-canvas'} aria-hidden="true" />
}
