import { useEffect, useRef, type ReactNode } from 'react'

export const useMotion = () => ({ enabled: true })

export function MotionProvider({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const container = root.current!
    function move(e: PointerEvent) {
      if (e.pointerType === 'touch') return
      container.style.setProperty('--mouse-x', `${e.clientX}px`)
      container.style.setProperty('--mouse-y', `${e.clientY}px`)
      container.style.setProperty('--parallax-x', `${(e.clientX / window.innerWidth - .5) * -18}px`)
      container.style.setProperty('--parallax-y', `${(e.clientY / window.innerHeight - .5) * -12}px`)
      const card = (e.target as HTMLElement).closest<HTMLElement>('[data-tilt]')
      if (card) {
        const box = card.getBoundingClientRect()
        card.style.setProperty('--tilt-x', `${(e.clientY - box.top - box.height / 2) / box.height * -8}deg`)
        card.style.setProperty('--tilt-y', `${(e.clientX - box.left - box.width / 2) / box.width * 10}deg`)
      }
    }
    function leave(e: PointerEvent) {
      const card = (e.target as HTMLElement).closest<HTMLElement>('[data-tilt]')
      if (card && !card.contains(e.relatedTarget as Node)) {
        card.style.setProperty('--tilt-x', '0deg'); card.style.setProperty('--tilt-y', '0deg')
      }
    }
    container.addEventListener('pointermove', move)
    container.addEventListener('pointerout', leave)
    return () => { container.removeEventListener('pointermove', move); container.removeEventListener('pointerout', leave) }
  }, [])
  return <div ref={root} className="motion-experience">{children}</div>
}
