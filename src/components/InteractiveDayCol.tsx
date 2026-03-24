'use client'

import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'

export default function InteractiveDayCol({ dateStr, className, children }: { dateStr: string, className: string, children: ReactNode }) {
  const router = useRouter()

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const eventId = e.dataTransfer.getData('eventId')
    if (!eventId) return
    
    // Determine accurate drop location within column
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - rect.top
    
    const minutesLayout = (y / 51) * 60
    const hour = Math.floor(minutesLayout / 60)
    const min = Math.floor((minutesLayout % 60) / 15) * 15 // Snap seamlessly to 15 min blocks

    const [yyyy, mm, dd] = dateStr.split('-').map(Number)
    const dropDate = new Date(yyyy, mm - 1, dd, hour, min, 0)

    try {
      await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime: dropDate.toISOString() })
      })
      // Server-bound data has shifted! Trigger silent Next.js soft refresh to immediately morph grid visually!
      router.refresh()
    } catch (err) {
      console.error("Failed to execute DND movement mathematically.", err)
    }
  }

  return (
    <div className={className} onDragOver={handleDragOver} onDrop={handleDrop}>
      {children}
    </div>
  )
}
