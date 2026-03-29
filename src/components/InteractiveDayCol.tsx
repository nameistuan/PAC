'use client'

import React, { ReactNode, useState, useEffect, useRef, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { updateEvent } from '@/lib/undoManager'

export default function InteractiveDayCol({ dateStr, className, children }: { dateStr: string, className: string, children: ReactNode }) {
  const router = useRouter()
  const colRef = useRef<HTMLDivElement>(null)
  
  const [previewY, setPreviewY] = useState<number | null>(null)
  const [previewHeight, setPreviewHeight] = useState<number>(51)
  const [isPendingDrop, setIsPendingDrop] = useState(false)

  // Drag-to-create state
  const [isCreating, setIsCreating] = useState(false)
  const [createStartTop, setCreateStartTop] = useState<number | null>(null)
  const [createCurrentTop, setCreateCurrentTop] = useState<number | null>(null)

  const isMoreThanHour = previewHeight > 55
  const is30MinOrLess = previewHeight <= 27
  const is15Min = previewHeight <= 16
  const linkPadding = is15Min ? '0 0.15rem' : '0.25rem 0.5rem'

  const [resizeY, setResizeY] = useState<number | null>(null)
  const [resizeHeight, setResizeHeight] = useState<number | null>(null)
  const [resizeColor, setResizeColor] = useState<string>('var(--primary-color)')
  const [resizeTitle, setResizeTitle] = useState<string>('')
  const [resizeTime, setResizeTime] = useState<string>('')

  const isMoreThanHourResize = resizeHeight !== null && resizeHeight > 55
  const is30MinOrLessResize = resizeHeight !== null && resizeHeight <= 27
  const is15MinResize = resizeHeight !== null && resizeHeight <= 16

  // Wait rigorously for Next.js to fire a fresh layout payload containing the authentic Server Component element before collapsing our client-side snapshot model!
  useEffect(() => {
    if (isPendingDrop) {
      setPreviewY(null)
      setIsPendingDrop(false)
    }
  }, [children])

  // Listen for multi-day resize previews
  useEffect(() => {
    const handleResizePreview = (e: any) => {
      const { startTimeStr, targetEndTimeStr, color, title } = e.detail
      
      const resStart = new Date(startTimeStr)
      const resEnd = new Date(targetEndTimeStr)
      
      const [yyyy, mm, dd] = dateStr.split('-').map(Number)
      const dayStart = new Date(yyyy, mm - 1, dd)
      dayStart.setHours(0,0,0,0)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)

      // Strict boundary check to prevent midnight bleed into next day
      const resStartMs = resStart.getTime()
      const resEndMs = resEnd.getTime()
      const dayStartMs = dayStart.getTime()
      const dayEndMs = dayEnd.getTime()

      // Aggressive guard with 50ms buffer to prevent 'leakage' where midnight-exactly events 
      // appear in the next day column due to precision noise.
      if (resEndMs <= dayStartMs + 50 || resStartMs >= dayEndMs - 50) {
        setResizeY(null)
        setResizeHeight(null)
        return
      }

      const actualStartMs = Math.max(resStartMs, dayStartMs)
      const actualEndMs = Math.min(resEndMs, dayEndMs)

      if (actualStartMs < actualEndMs) {
        const heightPx = ((actualEndMs - actualStartMs) / 3600000) * 51
        // If height is negligible (< 1px), don't render. 
        // This stops sub-millisecond edge cases from showing a phantom block.
        if (heightPx < 1) {
          setResizeY(null)
          setResizeHeight(null)
          return
        }
        setResizeY(((actualStartMs - dayStartMs) / 3600000) * 51)
        setResizeHeight(heightPx)
        setResizeColor(color)
        setResizeTitle(title)
        
        const timeStr = `${format(resStart, 'h:mm a')} - ${format(resEnd, 'h:mm a')}`
        setResizeTime(timeStr)
      } else {
        setResizeY(null)
        setResizeHeight(null)
      }
    }
    const handleResizeEnd = () => {
      // Keep ghost visible for a split second to cover the gap while router.refresh() happens
      setTimeout(() => {
        setResizeY(null)
        setResizeHeight(null)
      }, 200)
    }

    window.addEventListener('pac-resize-preview', handleResizePreview)
    window.addEventListener('pac-resize-end', handleResizeEnd)
    return () => {
      window.removeEventListener('pac-resize-preview', handleResizePreview)
      window.removeEventListener('pac-resize-end', handleResizeEnd)
    }
  }, [dateStr])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    const dragOffsetY = (window as any).__activeDragOffsetY || 0
    const dragDurationMs = (window as any).__activeDragDuration || 3600000
    
    const colRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    let y = e.clientY - colRect.top - dragOffsetY
    if (y < 0) y = 0
    
    const minutesLayout = (y / 51) * 60
    const totalMinutesSnapped = Math.round(minutesLayout / 15) * 15
    const snappedPixelY = Math.min((totalMinutesSnapped / 60) * 51, (24 * 51) - 12.75) // at least one slot
    
    // Ghost block only fills current day column even if it extends further
    const rawHeight = (dragDurationMs / 3600000) * 51
    const snappedHeight = Math.min(rawHeight, (24 * 51) - snappedPixelY)
    
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
    
    setIsPendingDrop(true)
    
    const durationMs = durationMsRaw ? parseInt(durationMsRaw) : 3600000
    const dragOffsetY = dragOffsetYRaw ? parseFloat(dragOffsetYRaw) : 0
    
    const colRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    let y = e.clientY - colRect.top - dragOffsetY
    if (y < 0) y = 0
    
    const minutesLayout = (y / 51) * 60
    const totalMinutesSnapped = Math.round(minutesLayout / 15) * 15
    const snappedHour = Math.floor(totalMinutesSnapped / 60)
    const snappedMin = totalMinutesSnapped % 60

    const [yyyy, mm, dd] = dateStr.split('-').map(Number)
    const dropStartDate = new Date(yyyy, mm - 1, dd, snappedHour, snappedMin, 0)
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
      console.error("Failed to execute DND movement.", err)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't start if clicking on an event block (walk up from target to find data-event-block)
    let el = e.target as HTMLElement | null
    while (el && el !== e.currentTarget) {
      if (el.getAttribute('data-event-block') === 'true') return
      el = el.parentElement
    }
    
    // Prevent text selection and default drag
    e.preventDefault()
    
    if (!colRef.current) return
    const colRect = colRef.current.getBoundingClientRect()
    const y = e.clientY - colRect.top
    
    const minutesLayout = (y / 51) * 60
    const totalMinutesSnapped = Math.floor(minutesLayout / 15) * 15
    const snappedPixelY = (totalMinutesSnapped / 60) * 51
    
    setIsCreating(true)
    setCreateStartTop(snappedPixelY)
    setCreateCurrentTop(snappedPixelY + 51 / 4)
  }

  useEffect(() => {
    if (!isCreating) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!colRef.current) return
      const colRect = colRef.current.getBoundingClientRect()
      const y = e.clientY - colRect.top
      
      const minutesLayout = (y / 51) * 60
      const totalMinutesSnapped = Math.round(minutesLayout / 15) * 15
      const snappedPixelY = Math.max(0, Math.min((totalMinutesSnapped / 60) * 51, (24 * 51)))
      
      setCreateCurrentTop(snappedPixelY)
    }

    const handleMouseUp = () => {
      if (createStartTop !== null && createCurrentTop !== null) {
        const top = Math.min(createStartTop, createCurrentTop)
        const bottom = Math.max(createStartTop, createCurrentTop)
        const durationPx = Math.max(bottom - top, 51 / 4)

        const startMinutes = (top / 51) * 60
        const endMinutes = startMinutes + (durationPx / 51) * 60

        const formatTime = (totalMinutes: number) => {
          const h = Math.floor(totalMinutes / 60)
          const m = totalMinutes % 60
          return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
        }

        const startTime = formatTime(startMinutes)
        const endTime = formatTime(endMinutes)

        const params = new URLSearchParams(window.location.search)
        params.set('createDate', dateStr)
        params.set('startTime', startTime)
        params.set('endTime', endTime)
        params.set('create', 'true')
        
        // Pass anchor coordinates for contextual positioning
        // Calculate coordinate from the draw rect correctly for Next.js routing
        if (colRef.current) {
          const colRect = colRef.current.getBoundingClientRect()
          params.set('ax', Math.round(colRect.left + 2).toString())
          params.set('ay', Math.round(colRect.top + top).toString())
          params.set('aw', Math.round(colRect.width - 8).toString())
          params.set('ah', Math.round(durationPx).toString())
        }
        
        router.push(`${window.location.pathname}?${params.toString()}`, { scroll: false })
      }

      setIsCreating(false)
      setCreateStartTop(null)
      setCreateCurrentTop(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isCreating, createStartTop, createCurrentTop, dateStr, router])

  const drawTop = createStartTop !== null && createCurrentTop !== null ? Math.min(createStartTop, createCurrentTop) : 0
  const drawHeight = createStartTop !== null && createCurrentTop !== null ? Math.max(Math.abs(createCurrentTop - createStartTop), 51 / 4) : 0

  return (
    <div 
      ref={colRef}
      className={className} 
      onDragOver={handleDragOver} 
      onDragLeave={handleDragLeave} 
      onDrop={handleDrop}
      onMouseDown={handleMouseDown}
      data-date={dateStr}
      data-day-col="true"
    >
      {isCreating && createStartTop !== null && (
        <div 
          style={{
            position: 'absolute',
            top: `${drawTop}px`,
            left: '2px',
            width: 'calc(100% - 8px)',
            height: `${drawHeight}px`,
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            border: '2px solid rgb(59, 130, 246)',
            borderRadius: '4px',
            zIndex: 1000,
            pointerEvents: 'none'
          }}
        />
      )}
      {resizeHeight !== null && (
        <div 
          style={{
            position: 'absolute',
            top: `${resizeY}px`,
            left: '2px',
            width: 'calc(100% - 8px)',
            height: `${resizeHeight}px`,
            backgroundColor: `${resizeColor}33`,
            color: resizeColor,
            borderLeft: `4px solid ${resizeColor}`,
            borderRadius: '4px',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)',
            pointerEvents: 'none',
            zIndex: 100,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            padding: is15MinResize ? '0px 4px' : '4px 6px',
            fontSize: is15MinResize ? '0.65rem' : '0.75rem',
            lineHeight: 1.2,
            fontWeight: 500
          }}
        >
          <div style={{ 
            display: 'flex', 
            flexDirection: is30MinOrLessResize ? 'row' : 'column',
            justifyContent: is30MinOrLessResize ? 'space-between' : 'flex-start',
            alignItems: 'flex-start',
            gap: is30MinOrLessResize ? '6px' : '0px',
            height: '100%', 
            width: '100%', 
            padding: 0,
            overflow: 'hidden'
          }}>
            <div style={{ flexShrink: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {resizeTitle || 'Untitled'}
            </div>
            <div style={{ opacity: 0.8, fontSize: '0.7rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
              {resizeTime}
            </div>
          </div>
        </div>
      )}
      {previewY !== null && (
        <div 
          style={{
            position: 'absolute',
            top: `${previewY}px`,
            left: '2px',
            width: 'calc(100% - 8px)',
            height: `${previewHeight}px`,
            backgroundColor: (window as any).__activeDragColor ? `${(window as any).__activeDragColor}33` : 'var(--surface-hover)',
            color: (window as any).__activeDragColor || 'var(--text-primary)',
            borderLeft: `4px solid ${(window as any).__activeDragColor || 'var(--border-color)'}`,
            borderRadius: '4px',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1), 0 10px 15px -3px rgba(0,0,0,0.1)',
            pointerEvents: 'none',
            zIndex: 100,
            overflow: 'hidden',
            fontSize: is15Min ? '0.65rem' : '0.75rem',
            lineHeight: 1.2,
            fontWeight: 500,
            padding: is15Min ? '0px 4px' : '4px 6px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ 
            display: 'flex', 
            flexDirection: is30MinOrLess ? 'row' : 'column',
            justifyContent: is30MinOrLess ? 'space-between' : 'flex-start',
            alignItems: 'flex-start',
            gap: is30MinOrLess ? '6px' : '0px',
            height: '100%', 
            width: '100%', 
            padding: 0,
            overflow: 'hidden'
          }}>
            <div style={{ fontWeight: 500, flexShrink: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
