'use client'

import React, { ReactNode, useState, useEffect, useRef, startTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { format, isToday, parseISO } from 'date-fns'
import { updateEvent } from '@/lib/undoManager'

const getCurrentHourHeight = () => {
  if (typeof window === 'undefined') return 38;
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hour-height')) || 38;
};

export default function InteractiveDayCol({ dateStr, className, children, style }: { dateStr: string, className: string, children: ReactNode, style?: React.CSSProperties }) {
  const router = useRouter()
  const pathname = usePathname()
  const colRef = useRef<HTMLDivElement>(null)
  
  const [isPendingDrop, setIsPendingDrop] = useState(false)
  const [nowFraction, setNowFraction] = useState<number | null>(null)

  // Current time indicator — only for today's column
  useEffect(() => {
    const [yyyy, mm, dd] = dateStr.split('-').map(Number)
    const colDate = new Date(yyyy, mm - 1, dd)
    if (!isToday(colDate)) return

    const update = () => {
      const now = new Date()
      setNowFraction(now.getHours() + now.getMinutes() / 60)
    }
    update()
    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [dateStr])

  // Drag-to-create state
  const [isCreating, setIsCreating] = useState(false)
  const [createStartFraction, setCreateStartFraction] = useState<number | null>(null)
  const [createCurrentFraction, setCreateCurrentFraction] = useState<number | null>(null)

  const [resizeYFraction, setResizeYFraction] = useState<number | null>(null)
  const [resizeHeightFraction, setResizeHeightFraction] = useState<number | null>(null)
  const [resizeColor, setResizeColor] = useState<string | null>(null)
  const [resizeTitle, setResizeTitle] = useState<string>('')
  const [resizeTime, setResizeTime] = useState<string>('')

  const isMoreThanHourResize = resizeHeightFraction !== null && resizeHeightFraction >= 1
  const is30MinOrLessResize = resizeHeightFraction !== null && resizeHeightFraction <= 0.5
  const is15MinResize = resizeHeightFraction !== null && resizeHeightFraction <= 0.25

  // Wait rigorously for Next.js to fire a fresh layout payload containing the authentic Server Component element before collapsing our client-side snapshot model!
  useEffect(() => {
    // The exact millisecond fresh DB data hits the screen, obliterate any placeholder ghosts 
    // to prevent visual stacking (which previously caused colors to temporarily darken)
    // Globally safely obliterate the pending ID after the React tree has finished propagating the data
    const timer = setTimeout(() => {
      setResizeYFraction(null)
      setResizeHeightFraction(null)
      ;(window as any).__pendingEventId = null
    }, 50) // Micro-delay to ensure browser has painted the new Server Component before ghost vanishes
    return () => clearTimeout(timer)
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
        setResizeYFraction(null)
        setResizeHeightFraction(null)
        return
      }

      const actualStartMs = Math.max(resStartMs, dayStartMs)
      const actualEndMs = Math.min(resEndMs, dayEndMs)

      if (actualStartMs < actualEndMs) {
        const heightFrac = (actualEndMs - actualStartMs) / 3600000
        // If height is negligible don't render. 
        if (heightFrac < 0.01) {
          setResizeYFraction(null)
          setResizeHeightFraction(null)
          return
        }
        setResizeYFraction((actualStartMs - dayStartMs) / 3600000)
        setResizeHeightFraction(heightFrac)
        setResizeColor(color)
        setResizeTitle(title)
        
        const isMultiday = format(resStart, 'yyyy-MM-dd') !== format(resEnd, 'yyyy-MM-dd')
        const startStr = isMultiday ? format(resStart, 'EEE, h:mm a') : format(resStart, 'h:mm a')
        const endTimeStr = isMultiday ? format(resEnd, 'EEE, h:mm a') : format(resEnd, 'h:mm a')
        const timeStr = `${startStr} → ${endTimeStr}`
        setResizeTime(timeStr)
      } else {
        setResizeYFraction(null)
        setResizeHeightFraction(null)
      }
    }
    const handleResizeEnd = () => {
      // Handled primarily by the [children] effect, but this fail-safe clears stale ghosts if the network fails.
      setTimeout(() => {
        setResizeYFraction(null)
        setResizeHeightFraction(null)
      }, 2000)
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
    
    const hScale = getCurrentHourHeight()
    const cursorDayOffsetMs = (cursorYInCol / hScale) * 3600000
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
    
    const hScale = getCurrentHourHeight()
    const cursorDayOffsetMs = (cursorYInCol / hScale) * 3600000
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
    
    const hScale = getCurrentHourHeight()
    const minutesLayout = (y / hScale) * 60
    const totalMinutesSnapped = Math.floor(minutesLayout / 15) * 15
    const snappedFrac = (totalMinutesSnapped / 60)
    
    setIsCreating(true)
    setCreateStartFraction(snappedFrac)
    setCreateCurrentFraction(snappedFrac + 0.25)
  }

  useEffect(() => {
    if (!isCreating) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!colRef.current) return
      const colRect = colRef.current.getBoundingClientRect()
      const y = e.clientY - colRect.top
      
      const hScale = getCurrentHourHeight()
      const minutesLayout = (y / hScale) * 60
      const totalMinutesSnapped = Math.round(minutesLayout / 15) * 15
      const snappedFrac = Math.max(0, Math.min((totalMinutesSnapped / 60), 24))
      
      setCreateCurrentFraction(snappedFrac)
    }

    const handleMouseUp = () => {
      if (createStartFraction !== null && createCurrentFraction !== null) {
        let fTop = createStartFraction
        let fEnd = createCurrentFraction
        if (fEnd < fTop) {
          fTop = createCurrentFraction
          fEnd = createStartFraction
        }
        
        const params = new URLSearchParams()
        params.set('create', 'true')
        params.set('createDate', dateStr)
        
        let startHour = Math.floor(fTop)
        let startMin = Math.round((fTop - startHour) * 60)
        let endHour = Math.floor(fEnd)
        let endMin = Math.round((fEnd - endHour) * 60)
        
        if (endMin >= 60) {
           endMin -= 60;
           endHour += 1;
        }
        if (startMin >= 60) {
           startMin -= 60;
           startHour += 1;
        }
        
        if (endHour === startHour && endMin === startMin) {
           endHour += 1; // 1 hr default fallback
        }

        const toIsoTime = (h: number, m: number) => {
          let useD = dateStr
          let useH = h
          if (useH >= 24) {
             const dt = new Date(dateStr)
             dt.setDate(dt.getDate() + 1)
             useD = format(dt, 'yyyy-MM-dd')
             useH -= 24
          }
          return `${useD}T${useH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`
        }

        params.set('startTime', toIsoTime(startHour, startMin))
        params.set('endTime', toIsoTime(endHour, endMin))
        
        const rect = colRef.current?.getBoundingClientRect()
        if (rect) {
          const pxY = fTop * getCurrentHourHeight()
          const pxH = (fEnd - fTop) * getCurrentHourHeight()
          params.set('ax', Math.round(rect.left).toString())
          params.set('ay', Math.round(pxY).toString())
          params.set('aw', Math.round(rect.width).toString())
          params.set('ah', Math.round(pxH).toString())
        }

        const urlParamsStr = window.location.search
        const existingParams = new URLSearchParams(urlParamsStr)
        if (existingParams.has('date')) params.set('date', existingParams.get('date')!)
        if (existingParams.has('month')) params.set('month', existingParams.get('month')!)

        router.push(`${pathname}?${params.toString()}`, { scroll: false })
      }
      setIsCreating(false)
      setCreateStartFraction(null)
      setCreateCurrentFraction(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isCreating, createStartFraction, createCurrentFraction, dateStr, router])

  let ghostTop = 0
  let ghostHeight = 0
  if (isCreating && createStartFraction !== null && createCurrentFraction !== null) {
    ghostTop = Math.min(createStartFraction, createCurrentFraction)
    ghostHeight = Math.abs(createCurrentFraction - createStartFraction)
    if (ghostHeight === 0) ghostHeight = 0.5 // Default 30 min visual if start=end during drag
  }

  return (
    <div 
      ref={colRef}
      className={className}
      style={style}
      onDragOver={handleDragOver} 
      onDragLeave={handleDragLeave} 
      onDrop={handleDrop}
      onMouseDown={handleMouseDown}
      data-date={dateStr}
      data-day-col="true"
    >
      {isPendingDrop && (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.05)', zIndex: 10, pointerEvents: 'none' }} />
      )}
      {/* Current time indicator */}
      {nowFraction !== null && (
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `calc(var(--hour-height) * ${nowFraction})`,
          height: '2px',
          backgroundColor: '#ea4335',
          zIndex: 60,
          pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute',
            left: '-4px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: '#ea4335',
          }} />
        </div>
      )}

      {children}

      {/* Creation Preview Ghost Block */}
      {isCreating && ghostHeight > 0 && (
        <div 
          style={{
            position: 'absolute',
            top: `calc(var(--hour-height) * ${ghostTop})`,
            height: `calc(var(--hour-height) * ${ghostHeight})`,
            left: '2px',
            right: '6px',
            backgroundColor: 'var(--primary-color)',
            border: '1px solid rgba(0,0,0,0.1)',
            borderLeft: '4px solid #fff',
            borderRadius: '4px',
            zIndex: 500,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'flex-start',
            padding: '4px 6px',
            color: '#fff',
            fontSize: '0.75rem',
            fontWeight: 500,
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}
        >
          {(() => {
             const startF = ghostTop
             const endF = ghostTop + ghostHeight
             const sH = Math.floor(startF)
             const sM = Math.round((startF - sH) * 60)
             const tempDS = new Date()
             tempDS.setHours(sH, sM, 0, 0)
             const eH = Math.floor(endF)
             const eM = Math.round((endF - eH) * 60)
             const tempDE = new Date()
             tempDE.setHours(eH, eM, 0, 0)
             return `${format(tempDS, 'h:mm a')} → ${format(tempDE, 'h:mm a')}`
          })()}
        </div>
      )}

      {/* Resize/Move Ghost Block - Powered by Centralized Engine Data */}
      {resizeYFraction !== null && resizeHeightFraction !== null && (
        <div 
          style={{
            position: 'absolute',
            top: `calc(var(--hour-height) * ${resizeYFraction})`,
            height: `max(16px, calc(var(--hour-height) * ${resizeHeightFraction}))`,
            left: '2px',
            right: '6px',
            backgroundColor: resizeColor ? `${resizeColor}33` : 'var(--surface-hover)', // Match real event 20% opacity
            border: `1px solid ${resizeColor || 'var(--border-color)'}`,
            borderLeft: `4px solid ${resizeColor || 'var(--border-color)'}`, // Solid for 'preview' feel
            borderRadius: '4px',
            zIndex: 45, 
            pointerEvents: 'none',
            boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
            padding: '4px 6px',
            color: resizeColor || 'var(--text-primary)',
            fontSize: '0.75rem',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', flexDirection: is30MinOrLessResize ? 'row' : 'column', justifyContent: is30MinOrLessResize ? 'space-between' : 'flex-start', alignItems: 'flex-start', gap: is30MinOrLessResize ? '6px' : '0px', height: '100%', width: '100%' }}>
            <div style={{ fontWeight: 600, flexShrink: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {resizeTitle || 'Moving Event'}
            </div>
            {!is15MinResize && (
              <div style={{ opacity: 0.9, fontSize: '0.7rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
                {resizeTime || 'Pending...'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
