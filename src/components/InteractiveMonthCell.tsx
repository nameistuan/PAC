'use client'

import { ReactNode, startTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { updateEvent } from '@/lib/undoManager'

export default function InteractiveMonthCell({ 
  dateStr, 
  className, 
  children 
}: { 
  dateStr: string, 
  className: string, 
  children: ReactNode 
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleClick = (e: React.MouseEvent) => {
    // Don't open create modal if clicking on an event badge
    let el = e.target as HTMLElement | null
    while (el && el !== e.currentTarget) {
      if (el.tagName === 'A' || el.getAttribute('data-event-block') === 'true') return
      el = el.parentElement
    }
    const params = new URLSearchParams(searchParams.toString())
    params.set('create', 'true')
    params.set('createDate', dateStr)
    router.push(`/?${params.toString()}`, { scroll: false })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.remove('drag-hover') // Clean up visual state natively if added
    
    const eventId = e.dataTransfer.getData('eventId')
    const eventStartTime = e.dataTransfer.getData('eventStartTime')
    const eventDurationMsRaw = e.dataTransfer.getData('eventDurationMs') // Also bind duration natively for integrity
    if (!eventId || !eventStartTime) return
    
    const durationMs = eventDurationMsRaw ? parseInt(eventDurationMsRaw) : 3600000

    // Extract original time components to preserve intra-day fidelity when dragging across months
    const originalDate = new Date(eventStartTime)
    const [yyyy, mm, dd] = dateStr.split('-').map(Number)
    
    const dropStartDate = new Date(yyyy, mm - 1, dd, originalDate.getHours(), originalDate.getMinutes(), 0)
    const dropEndDate = new Date(dropStartDate.getTime() + durationMs)

    try {
      const label = await updateEvent(eventId, {
        startTime: dropStartDate.toISOString(),
        endTime: dropEndDate.toISOString()
      })
      if (label) {
        window.dispatchEvent(new CustomEvent('pac-toast', { detail: `Moved "${label}" — Press ⌘Z to undo` }))
      }
      startTransition(() => {
        router.refresh()
      })
    } catch (err) {
      console.error("Failed to execute Month DND swap", err)
    }
  }

  // Add subtle native hover feedback
  const handleDragEnter = (e: React.DragEvent) => {
    e.currentTarget.classList.add('drag-hover')
  }
  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('drag-hover')
  }

  return (
    <div
      className={className}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      style={{ cursor: 'default' }}
    >
      {children}
    </div>
  )
}
