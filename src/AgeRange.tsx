import { useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'

type Props = { min: number, max: number, onChange: (min: number, max: number) => void }
const LOWEST = 18
const HIGHEST = 100

export default function AgeRange({ min, max, onChange }: Props) {
  const [activeHandle, setActiveHandle] = useState<'min' | 'max'>('max')
  const start = (min - LOWEST) / (HIGHEST - LOWEST) * 100
  const end = (max - LOWEST) / (HIGHEST - LOWEST) * 100
  const style = { '--age-start': `${start}%`, '--age-end': `${end}%` } as CSSProperties

  function jump(event: MouseEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLInputElement) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const age = Math.round(LOWEST + Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * (HIGHEST - LOWEST))
    if (Math.abs(age - min) <= Math.abs(age - max)) onChange(Math.min(age, max - 1), max)
    else onChange(min, Math.max(age, min + 1))
  }

  function chooseHandle(event: PointerEvent<HTMLDivElement>) {
    if (event.buttons || max - min > 3) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const middle = (start + end) / 200 * bounds.width
    setActiveHandle(event.clientX - bounds.left < middle ? 'min' : 'max')
  }

  return <div className="age-filter">
    <div className="age-filter-title"><span>AGE RANGE</span><span>DRAG TO ADJUST</span></div>
    <div className="age-readouts"><div><small>FROM</small><strong>{min}</strong></div><span>—</span><div><small>TO</small><strong>{max === HIGHEST ? '100+' : max}</strong></div></div>
    <div className={max - min <= 3 ? `age-slider handles-close active-${activeHandle}` : 'age-slider'} style={style} onClick={jump} onPointerMove={chooseHandle}>
      <div className="age-rail" /><div className="age-selection" />
      <input type="range" min={LOWEST} max={HIGHEST} value={min} aria-label="Minimum age" aria-valuetext={`${min} years old`} onPointerDown={() => setActiveHandle('min')} onChange={event => onChange(Math.min(Number(event.target.value), max - 1), max)} />
      <input type="range" min={LOWEST} max={HIGHEST} value={max} aria-label="Maximum age" aria-valuetext={`${max} years old`} onPointerDown={() => setActiveHandle('max')} onChange={event => onChange(min, Math.max(Number(event.target.value), min + 1))} />
    </div>
    <div className="age-limits"><span>18</span><span>100+</span></div>
  </div>
}
