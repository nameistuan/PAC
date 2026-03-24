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
    const durationMsRaw = e.dataTransfer.getData('eventDurationMs')
    const dragOffsetYRaw = e.dataTransfer.getData('dragOffsetY')
    if (!eventId) return
    
    const durationMs = durationMsRaw ? parseInt(durationMsRaw) : 3600000 // default 1hr fallback
    const dragOffsetY = dragOffsetYRaw ? parseFloat(dragOffsetYRaw) : 0
    
    // Determine accurate drop location visually bound to the exact TOP edge of the element, NOT the cursor!
    const colRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    let y = e.clientY - colRect.top - dragOffsetY
    if (y < 0) y = 0 // Prevent negative top edge mappings
    
    const minutesLayout = (y / 51) * 60
    
    // Mathematically round bounds to nearest 15 mins for intuitive magnetic snapping
    const totalMinutesSnapped = Math.round(minutesLayout / 15) * 15
    const snappedHour = Math.floor(totalMinutesSnapped / 60)
    const snappedMin = totalMinutesSnapped % 60

    const [yyyy, mm, dd] = dateStr.split('-').map(Number)
    const dropStartDate = new Date(yyyy, mm - 1, dd, snappedHour, snappedMin, 0)
    const dropEndDate = new Date(dropStartDate.getTime() + durationMs)

    try {
      await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          startTime: dropStartDate.toISOString(),
          endTime: dropEndDate.toISOString()
        })
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
