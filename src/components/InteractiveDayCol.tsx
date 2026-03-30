'use client'

import React, { ReactNode, useState, useEffect, useRef, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { updateEvent } from '@/lib/undoManager'

export default function InteractiveDayCol({ dateStr, className, children }: { dateStr: string, className: string, children: ReactNode }) {
  const router = useRouter()
  const colRef = useRef<HTMLDivElement>(null)
  
  const [isPendingDrop, setIsPendingDrop] = useState(false)

  // Drag-to-create state
  const [isCreating, setIsCreating] = useState(false)
  const [createStartTop, setCreateStartTop] = useState<number | null>(null)
  const [createCurrentTop, setCreateCurrentTop] = useState<number | null>(null)

  const [resizeY, setResizeY] = useState<number | null>(null)
  const [resizeHeight, setResizeHeight] = useState<number | null>(null)
  const [resizeColor, setResizeColor] = useState<string | null>(null)
  const [resizeTitle, setResizeTitle] = useState<string>('')
  const [resizeTime, setResizeTime] = useState<string>('')

  const isMoreThanHourResize = resizeHeight !== null && resizeHeight > 55
  const is30MinOrLessResize = resizeHeight !== null && resizeHeight <= 27
  const is15MinResize = resizeHeight !== null && resizeHeight <= 16

  // Wait rigorously for Next.js to fire a fresh layout payload containing the authentic Server Component element before collapsing our client-side snapshot model!
  useEffect(() => {
    // The exact millisecond fresh DB data hits the screen, obliterate any placeholder ghosts 
    // to prevent visual stacking (which previously caused colors to temporarily darken)
    setResizeY(null)
    setResizeHeight(null)
    
    if (isPendingDrop) {
      setIsPendingDrop(false)
    }
    
    // Globally safely obliterate the pending ID after the React tree has finished propagating the data
    setTimeout(() => {
      ;(window as any).__pendingEventId = null
    }, 50)
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
        
        const isMultiday = format(resStart, 'yyyy-MM-dd') !== format(resEnd, 'yyyy-MM-dd')
        const endTimeStr = isMultiday ? format(resEnd, 'EEE, h:mm a') : format(resEnd, 'h:mm a')
        const timeStr = `${format(resStart, 'h:mm a')} - ${endTimeStr}`
        setResizeTime(timeStr)
      } else {
        setResizeY(null)
        setResizeHeight(null)
      }
    }
    const handleResizeEnd = () => {
      // The primary 'clean up' happens automatically the millisecond [children] updates via network completion.
      // However, we maintain a robust fail-safe here to clear the ghost after 1500ms in the sheer case a network error swallows the refresh.
      setTimeout(() => {
        setResizeY(null)
        setResizeHeight(null)
      }, 1500)
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
    
    const cursorOffsetFromStartMs = (window as any).__activeDragCursorOffsetMs
    if (cursorOffsetFromStartMs === undefined || cursorOffsetFromStartMs === null) return
    
    const durationMs = (window as any).__activeDragDuration || 3600000
    
    const colRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    let cursorYInCol = e.clientY - colRect.top
    if (cursorYInCol < 0) cursorYInCol = 0
    
    const cursorDayOffsetMs = (cursorYInCol / 51) * 3600000
    const [yyyy, mm, dd] = dateStr.split('-').map(Number)
    const currentDayStart = new Date(yyyy, mm - 1, dd)
    const dragCursorTimeMs = currentDayStart.getTime() + cursorDayOffsetMs
    
    const rawNewStartMs = dragCursorTimeMs - cursorOffsetFromStartMs
    
    const rawNewStartDate = new Date(rawNewStartMs)
    let minutesOnTargetDay = rawNewStartDate.getHours() * 60 + rawNewStartDate.getMinutes()
    minutesOnTargetDay = Math.round(minutesOnTargetDay / 15) * 15
    
    const snappedNewStartDate = new Date(rawNewStartDate.getFullYear(), rawNewStartDate.getMonth(), rawNewStartDate.getDate(), 0, minutesOnTargetDay, 0)
    
    // Tap directly into the established robust resizing engine for ghost-block multi-day consistency
    window.dispatchEvent(new CustomEvent('pac-resize-preview', { 
      detail: { 
        id: (window as any).__activeDragId, // Matches InteractiveEvent's own ID, causing it to hide!
        title: (window as any).__activeDragTitle || '',
        startTimeStr: snappedNewStartDate.toISOString(),
        targetEndTimeStr: new Date(snappedNewStartDate.getTime() + durationMs).toISOString(),
        color: (window as any).__activeDragColor || null
      } 
    }))
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // No-op. User prefers no ghost preview tracking during drag-and-drop.
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    
    const eventId = e.dataTransfer.getData('eventId')
    if (!eventId) return
    
    const cursorOffsetFromStartMs = (window as any).__activeDragCursorOffsetMs
    if (cursorOffsetFromStartMs === undefined || cursorOffsetFromStartMs === null) return
    
    const durationMs = (window as any).__activeDragDuration || 3600000
    
    const colRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    let cursorYInCol = e.clientY - colRect.top
    if (cursorYInCol < 0) cursorYInCol = 0
    
    const cursorDayOffsetMs = (cursorYInCol / 51) * 3600000
    const [yyyy, mm, dd] = dateStr.split('-').map(Number)
    const currentDayStart = new Date(yyyy, mm - 1, dd)
    const dragCursorTimeMs = currentDayStart.getTime() + cursorDayOffsetMs
    
    const rawNewStartMs = dragCursorTimeMs - cursorOffsetFromStartMs
    const rawNewStartDate = new Date(rawNewStartMs)
    let minutesOnTargetDay = rawNewStartDate.getHours() * 60 + rawNewStartDate.getMinutes()
    minutesOnTargetDay = Math.round(minutesOnTargetDay / 15) * 15
    const snappedNewStartDate = new Date(rawNewStartDate.getFullYear(), rawNewStartDate.getMonth(), rawNewStartDate.getDate(), 0, minutesOnTargetDay, 0)
    const snappedNewEndDate = new Date(snappedNewStartDate.getTime() + durationMs)

    setIsPendingDrop(true)
    
    // Crucial: Register pending ID BEFORE terminating ghost so original event stays 100% hidden while waiting for refreshed DB data
    ;(window as any).__pendingEventId = eventId
    window.dispatchEvent(new CustomEvent('pac-resize-end')) // Terminate ghost block

    try {
      const label = await updateEvent(eventId, {
        startTime: snappedNewStartDate.toISOString(),
        endTime: snappedNewEndDate.toISOString()
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
            backgroundColor: resizeColor ? `${resizeColor}33` : 'var(--surface-hover)',
            color: resizeColor || 'var(--text-primary)',
            borderLeft: `4px solid ${resizeColor || 'var(--border-color)'}`,
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
      {children}
    </div>
  )
}
