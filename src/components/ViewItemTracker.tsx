'use client'

import { useEffect } from 'react'
import { trackViewItem } from '@/lib/analytics'

interface Props {
  id: string
  name: string
  category?: string
  price?: number
}

export default function ViewItemTracker({ id, name, category, price }: Props) {
  useEffect(() => {
    trackViewItem({ id, name, category, price })
  }, [id, name, category, price])

  return null
}
