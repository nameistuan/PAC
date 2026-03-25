'use client'

import React, { ReactNode, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function InteractiveDayCol({ dateStr, className, children }: { dateStr: string, className: string, children: ReactNode }) {
  const router = useRouter()
  
  const [previewY, setPreviewY] = useState<number | null>(null)
  const [previewHeight, setPreviewHeight] = useState<number>(51)
  const [isPendingDrop, setIsPendingDrop] = useState(false)

  const isMoreThanHour = previewHeight > 55
  const is15Min = previewHeight <= 16
  const linkPadding = is15Min ? '0 0.15rem' : '0.25rem 0.5rem'

  // Wait rigorously for Next.js to fire a fresh layout payload containing the authentic Server Component element before collapsing our client-side snapshot model!
  useEffect(() => {
    if (isPendingDrop) {
      setPreviewY(null)
      setIsPendingDrop(false)
    }
  }, [children])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    // Extrapolate bounding variables structurally from the global bus for active drag-preview projection
    const dragOffsetY = (window as any).__activeDragOffsetY || 0
    const dragDurationMs = (window as any).__activeDragDuration || 3600000
    
    const colRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    let y = e.clientY - colRect.top - dragOffsetY
    if (y < 0) y = 0
    
    const minutesLayout = (y / 51) * 60
    const totalMinutesSnapped = Math.round(minutesLayout / 15) * 15
    const snappedPixelY = (totalMinutesSnapped / 60) * 51
    const snappedHeight = (dragDurationMs / 3600000) * 51
    
    setPreviewY(snappedPixelY)
    setPreviewHeight(snappedHeight)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!isPendingDrop) {
      setPreviewY(null)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    
    const eventId = e.dataTransfer.getData('eventId')
    const durationMsRaw = e.dataTransfer.getData('eventDurationMs')
    const dragOffsetYRaw = e.dataTransfer.getData('dragOffsetY')
    if (!eventId) return
    
    // Freeze the structural preview exactly where it was dropped (Zero-Latency Optimistic UI)
    setIsPendingDrop(true)
    
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
    <div 
      className={className} 
      onDragOver={handleDragOver} 
      onDragLeave={handleDragLeave} 
      onDrop={handleDrop}
    >
      {previewY !== null && (
        <div 
          style={{
            position: 'absolute',
            top: `${previewY}px`,
            left: '2px', // Accurately matched to static .eventBlock
            width: 'calc(100% - 8px)',
            height: `${previewHeight}px`,
            backgroundColor: (window as any).__activeDragColor ? `${(window as any).__activeDragColor}33` : 'var(--surface-hover)',
            color: (window as any).__activeDragColor || 'var(--text-primary)',
            borderLeft: `4px solid ${(window as any).__activeDragColor || 'var(--border-color)'}`,
            borderRadius: '4px',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)', // Replicate the exact border outline natively
            pointerEvents: 'none',
            zIndex: 100,
            overflow: 'hidden',
            fontSize: is15Min ? '0.65rem' : '0.75rem',
            lineHeight: 1.2,
            padding: is15Min ? '0px 4px' : '4px 6px', // Matches .eventBlock CSS exact box-model
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Internal padding node structured exactly to mimic the <Link> bounds on standard blocks */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '6px',
            height: '100%', 
            width: '100%', 
            padding: linkPadding,
            overflow: 'hidden'
          }}>
            <div style={{ fontWeight: 600, flexShrink: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {(window as any).__activeDragTitle}
            </div>
            <div style={{ opacity: 0.8, flexShrink: 0, whiteSpace: 'nowrap' }}>
              {(window as any).__activeDragTime}
            </div>
          </div>
        </div>
      )}
      {children}
    </div>
  )
}
