import { useEffect, useId, useRef, useState } from 'react'
import { Info } from 'lucide-react'

export default function InfoTip({ text, label = 'Más información' }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: Event) => { if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', close)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close) }
  }, [open])
  return <span className={`info-tip ${open ? 'open' : ''}`} ref={ref}>
    <button type="button" className="info-tip-btn" aria-label={label} aria-describedby={id} aria-expanded={open} onClick={() => setOpen((v) => !v)}><Info size={20}/></button>
    <span role="tooltip" id={id} className="info-tip-bubble">{text}</span>
  </span>
}
