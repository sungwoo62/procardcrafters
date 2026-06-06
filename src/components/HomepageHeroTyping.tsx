'use client'

import { useState, useEffect } from 'react'

const WORDS = ['Business Cards', 'Stickers', 'Flyers', 'Postcards', 'Posters', 'Brochures']

export default function HomepageHeroTyping() {
  const [idx, setIdx] = useState(0)
  const [displayed, setDisplayed] = useState('')
  const [phase, setPhase] = useState<'typing' | 'pausing' | 'erasing'>('typing')

  useEffect(() => {
    const word = WORDS[idx]

    if (phase === 'typing') {
      if (displayed.length < word.length) {
        const t = setTimeout(() => setDisplayed(word.slice(0, displayed.length + 1)), 75)
        return () => clearTimeout(t)
      }
      const t = setTimeout(() => setPhase('pausing'), 1800)
      return () => clearTimeout(t)
    }

    if (phase === 'pausing') {
      const t = setTimeout(() => setPhase('erasing'), 200)
      return () => clearTimeout(t)
    }

    if (phase === 'erasing') {
      if (displayed.length > 0) {
        const t = setTimeout(() => setDisplayed(d => d.slice(0, -1)), 35)
        return () => clearTimeout(t)
      }
      setIdx(i => (i + 1) % WORDS.length)
      setPhase('typing')
    }
  }, [displayed, phase, idx])

  return (
    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-cyan-300 inline-block min-w-[220px]">
      {displayed}
      <span className="animate-pulse text-blue-300 ml-0.5">|</span>
    </span>
  )
}
