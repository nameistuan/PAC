'use client'

import { useState, useRef, useEffect, startTransition } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, parseISO, startOfWeek, endOfWeek } from 'date-fns'
import styles from './AppShell.module.css'
import EventModal from './EventModal'
import { undo, redo } from '@/lib/undoManager'

export default function AppShell({ 
  children,
  defaultSidebarOpen = true,
  defaultSidebarWidth = 250
}: { 
  children: React.ReactNode,
  defaultSidebarOpen?: boolean,
  defaultSidebarWidth?: number
}) {
  const [sidebarWidth, setSidebarWidth] = useState(defaultSidebarWidth)
  const [isSidebarOpen, setIsSidebarOpen] = useState(defaultSidebarOpen)
  const [isMounted, setIsMounted] = useState(false)
  const [isEventModalOpen, setIsEventModalOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  
  const editEventId = searchParams.get('editEvent')
  const createParam = searchParams.get('create')
  const createDateParam = searchParams.get('createDate')
  const startTimeParam = searchParams.get('startTime')
  const endTimeParam = searchParams.get('endTime')
  
  const isModalVisuallyOpen = isEventModalOpen || !!editEventId || createParam === 'true'

  const handleCloseModal = () => {
    setIsEventModalOpen(false)
    if (editEventId || createParam === 'true') {
      const newParams = new URLSearchParams(searchParams.toString())
      newParams.delete('editEvent')
      newParams.delete('create')
      newParams.delete('createDate')
      newParams.delete('startTime')
      newParams.delete('endTime')
      const targetQuery = newParams.toString()
      router.push(targetQuery ? `${pathname}?${targetQuery}` : pathname, { scroll: false })
    }
  }
  useEffect(() => {
    if (isMounted) {
      document.cookie = `pac_sidebar_width=${sidebarWidth}; path=/; max-age=31536000`
      document.cookie = `pac_sidebar_open=${isSidebarOpen}; path=/; max-age=31536000`
    } else {
      setIsMounted(true)
    }
  }, [sidebarWidth, isSidebarOpen, isMounted])
  
  const dateParam = searchParams.get('date')
  const monthParam = searchParams.get('month') // Fallback
  
  // Read exactly at noon to avoid timezone shift dropping it to prev day
  let currentDate = new Date()
  if (dateParam) {
    currentDate = parseISO(`${dateParam}T12:00:00Z`)
  } else if (monthParam) {
    currentDate = parseISO(`${monthParam}-01T12:00:00Z`)
  } else if (pathname === '/week') {
    currentDate = startOfWeek(new Date(), { weekStartsOn: 0 })
  }

  let displayDate = format(currentDate, 'MMMM yyyy')
  if (pathname === '/day') {
    const startFourDay = subDays(currentDate, 1)
    const endFourDay = addDays(currentDate, 2)
    if (startFourDay.getMonth() === endFourDay.getMonth()) {
      displayDate = format(startFourDay, 'MMMM yyyy') // Both within same month
    } else if (startFourDay.getFullYear() === endFourDay.getFullYear()) {
      displayDate = `${format(startFourDay, 'MMM')} - ${format(endFourDay, 'MMM yyyy')}`
    } else {
      displayDate = `${format(startFourDay, 'MMM yyyy')} - ${format(endFourDay, 'MMM yyyy')}`
    }
  } else if (pathname === '/week') {
    const weekStart = new Date(currentDate)
    const weekEnd = new Date(currentDate)
    weekEnd.setDate(weekEnd.getDate() + 6)
    if (weekStart.getMonth() === weekEnd.getMonth()) {
      displayDate = format(weekStart, 'MMMM yyyy')
    } else if (weekStart.getFullYear() === weekEnd.getFullYear()) {
      displayDate = `${format(weekStart, 'MMM')} - ${format(weekEnd, 'MMM yyyy')}`
    } else {
      displayDate = `${format(weekStart, 'MMM yyyy')} - ${format(weekEnd, 'MMM yyyy')}`
    }
  }

  // Calculate slide direction iteratively during render
  const prevDateRef = useRef(currentDate)
  const slideDirectionRef = useRef<'forward'|'backward'>('forward')
  
  if (currentDate.getTime() > prevDateRef.current.getTime()) {
    slideDirectionRef.current = 'forward'
    prevDateRef.current = currentDate
  } else if (currentDate.getTime() < prevDateRef.current.getTime()) {
    slideDirectionRef.current = 'backward'
    prevDateRef.current = currentDate
  }

  // Optimistic UI state for fluid rapid-clicking without waiting for Next.js Server Roundtrips!
  const [internalDate, setInternalDate] = useState<Date>(currentDate)
  useEffect(() => { setInternalDate(currentDate) }, [currentDate.getTime()])

  const handlePrev = () => {
    let prev = internalDate
    if (pathname === '/') prev = subMonths(internalDate, 1)
    if (pathname === '/week') prev = subDays(internalDate, 1)
    if (pathname === '/day') prev = subDays(internalDate, 1)
    setInternalDate(prev)
    router.push(`${pathname}?date=${format(prev, 'yyyy-MM-dd')}`, { scroll: false })
  }

  const handleNext = () => {
    let next = internalDate
    if (pathname === '/') next = addMonths(internalDate, 1)
    if (pathname === '/week') next = addDays(internalDate, 1)
    if (pathname === '/day') next = addDays(internalDate, 1)
    setInternalDate(next)
    router.push(`${pathname}?date=${format(next, 'yyyy-MM-dd')}`, { scroll: false })
  }
  
  const handlePrevDay = () => {
    const prev = subDays(internalDate, 1)
    setInternalDate(prev)
    router.push(`${pathname}?date=${format(prev, 'yyyy-MM-dd')}`, { scroll: false })
  }
  const handleNextDay = () => {
    const next = addDays(internalDate, 1)
    setInternalDate(next)
    router.push(`${pathname}?date=${format(next, 'yyyy-MM-dd')}`, { scroll: false })
  }

  const latestRefs = useRef({ internalDate, pathname, isEventModalOpen: isModalVisuallyOpen })
  useEffect(() => {
    latestRefs.current = { internalDate, pathname, isEventModalOpen: isModalVisuallyOpen }
  }, [internalDate, pathname, isModalVisuallyOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { internalDate: cDate, pathname: pName, isEventModalOpen: isModal } = latestRefs.current
      if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return
      if (isModal) return

      if (e.key === 'ArrowLeft') {
        let prev = cDate
        if (pName === '/') prev = subMonths(cDate, 1)
        else prev = subDays(cDate, 1)
        setInternalDate(prev)
        router.push(`${pName}?date=${format(prev, 'yyyy-MM-dd')}`, { scroll: false })
      } else if (e.key === 'ArrowRight') {
        let next = cDate
        if (pName === '/') next = addMonths(cDate, 1)
        else next = addDays(cDate, 1)
        setInternalDate(next)
        router.push(`${pName}?date=${format(next, 'yyyy-MM-dd')}`, { scroll: false })
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo().then(label => {
          if (label) {
            showToast(label)
            startTransition(() => router.refresh())
          }
        })
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo().then(label => {
          if (label) {
            showToast(label)
            startTransition(() => router.refresh())
          }
        })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [router])

  const [gridScale, setGridScale] = useState(1)

  useEffect(() => {
    const cached = localStorage.getItem('pac_grid_scale')
    if (cached) setGridScale(parseFloat(cached))
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--hour-height', `${38 * gridScale}px`)
    document.documentElement.style.setProperty('--total-grid-height', `calc(var(--hour-height) * 24)`)
    localStorage.setItem('pac_grid_scale', gridScale.toString())
    window.dispatchEvent(new CustomEvent('pac-scale-change', { detail: gridScale }))
  }, [gridScale])

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        setGridScale(prev => {
          let newScale = prev - (e.deltaY * 0.005)
          if (newScale < 0.5) newScale = 0.5
          if (newScale > 3) newScale = 3
          return newScale
        })
      }
    }
    const pageContent = document.getElementById('grid-scroll-container')
    if (pageContent) {
      pageContent.addEventListener('wheel', handleWheel, { passive: false })
      return () => pageContent.removeEventListener('wheel', handleWheel)
    }
  }, [])

  const showToast = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail) showToast(detail)
    }
    window.addEventListener('pac-toast', handler)
    return () => window.removeEventListener('pac-toast', handler)
  }, [])
  
  const isResizing = useRef(false)

  const startResizing = () => {
    isResizing.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const stopResizing = () => {
    if (isResizing.current) {
      isResizing.current = false
      document.body.style.cursor = 'default'
      document.body.style.userSelect = 'auto'
    }
  }

  const resize = (e: MouseEvent) => {
    if (isResizing.current) {
      let newWidth = e.clientX
      if (newWidth < 200) newWidth = 200 // Min width
      if (newWidth > 500) newWidth = 500 // Max width
      setSidebarWidth(newWidth)
    }
  }

  useEffect(() => {
    window.addEventListener('mousemove', resize)
    window.addEventListener('mouseup', stopResizing)
    return () => {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
    }
  }, [])

  return (
    <div className={styles.appContainer}>
      {/* Sidebar - Render continuously but compress width to 0px natively for animation */}
      <aside 
        className={`${styles.sidebar} ${!isSidebarOpen ? styles.sidebarClosed : ''}`} 
        style={{ width: isSidebarOpen ? `${sidebarWidth}px` : '0px' }}
      >
        <div className={styles.sidebarHeader}>
          <h1 className={styles.logo}>PAC</h1>
        </div>
        
        <nav className={styles.sidebarNav}>
          {/* Project Boards will be mapped here later */}
          <div className={styles.navSection}>
            <h3 className={styles.sectionTitle}>My Courses</h3>
            <ul className={styles.projectList}>
              <li className={styles.projectItem}>
                <span className={styles.colorDot} style={{backgroundColor: '#8F6B91'}}></span>
                Biology 101
              </li>
              <li className={styles.projectItem}>
                <span className={styles.colorDot} style={{backgroundColor: '#10b981'}}></span>
                Engineering
              </li>
            </ul>
          </div>
        </nav>
      </aside>

      {/* Interactive Resizer Handle */}
      <div 
        className={`${styles.resizer} ${!isSidebarOpen ? styles.resizerHidden : ''}`} 
        onMouseDown={startResizing} 
        style={{ pointerEvents: isSidebarOpen ? 'auto' : 'none' }}
      />

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button className={styles.hamburgerBtn} onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className={styles.monthNavButtons}>
              <button className={styles.iconBtn} onClick={handlePrev}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button 
                className={styles.todayBtn} 
                onClick={() => router.push(pathname)}
              >
                Today
              </button>
              <button className={styles.iconBtn} onClick={handleNext}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            
            <h2 className={styles.displayDate}>{displayDate}</h2>
          </div>
          
          <div className={styles.topbarRight}>
              <div className={styles.viewToggle}>
                <button 
                  className={`${styles.toggleBtn} ${pathname === '/' ? styles.active : ''}`}
                  onClick={() => router.push(`/?date=${format(currentDate, 'yyyy-MM-dd')}`)}
                >
Month</button>
              <button 
                className={`${styles.toggleBtn} ${pathname === '/week' ? styles.active : ''}`}
                onClick={() => router.push(dateParam ? `/week?date=${dateParam}` : '/week')}
              >Week</button>
              <button 
                className={`${styles.toggleBtn} ${pathname === '/day' ? styles.active : ''}`}
                onClick={() => router.push(dateParam ? `/day?date=${dateParam}` : '/day')}
              >4 Day</button>
            </div>
            
            <button className={styles.addButton} onClick={() => setIsEventModalOpen(true)}>+ New Event</button>
          </div>
        </header>
        
        {/* Page Content Viewport */}
        <div id="grid-scroll-container" className={styles.pageContent}>
          {/* Context-aware wrapper for animations depending on date direction */}
          <div 
            key={currentDate.toISOString()} 
            className={slideDirectionRef.current === 'forward' ? styles.slideForward : styles.slideBackward}
            style={{ height: '100%' }}
          >
            {children}
          </div>
        </div>

        {/* Floating Chevrons for 1-day micro-navigation */}
        {pathname !== '/' && (
          <>
            <button 
              className={`${styles.floatingArrow} ${styles.floatingArrowLeft}`}
              onClick={handlePrevDay}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button 
              className={`${styles.floatingArrow} ${styles.floatingArrowRight}`}
              onClick={handleNextDay}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>

      {isModalVisuallyOpen && (
        <EventModal 
          eventId={editEventId || undefined} 
          onClose={handleCloseModal}
          initialDate={createDateParam || undefined}
          initialStartTime={startTimeParam || undefined}
          initialEndTime={endTimeParam || undefined}
        />
      )}

      {toast && (
        <div className={styles.toast}>
          {toast}
        </div>
      )}
    </div>
  )
}
