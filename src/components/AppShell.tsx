'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from 'date-fns'
import { getTodayISO, parseISOString } from '@/lib/dateUtils'
import styles from './AppShell.module.css'
import EventModal from './EventModal'
import ProjectSidebar from './ProjectSidebar'
import MiniCalendar from './MiniCalendar'
import SearchPopover from './SearchPopover'
import KanbanSidebar from './KanbanSidebar'
import { undo, redo } from '@/lib/undoManager'

export default function AppShell({
  children,
  defaultSidebarOpen = true,
  defaultSidebarWidth = 250,
  defaultKanbanOpen = false,
  defaultKanbanWidth = 320,
  defaultGridScale = 1,
  initialProjects = []
}: {
  children: React.ReactNode,
  defaultSidebarOpen?: boolean,
  defaultSidebarWidth?: number,
  defaultKanbanOpen?: boolean,
  defaultKanbanWidth?: number,
  defaultGridScale?: number,
  initialProjects?: { id: string; name: string; color: string }[]
}) {
  const [sidebarWidth, setSidebarWidth] = useState(defaultSidebarWidth)
  const [isSidebarOpen, setIsSidebarOpen] = useState(defaultSidebarOpen)
  
  // Kanban pane state
  const [kanbanWidth, setKanbanWidth] = useState(defaultKanbanWidth)
  const [isKanbanOpen, setIsKanbanOpen] = useState(defaultKanbanOpen)

  const [isMounted, setIsMounted] = useState(false)
  const [isEventModalOpen, setIsEventModalOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [gridScale, setGridScale] = useState(defaultGridScale)
  const [toast, setToast] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  
  const editEventId = searchParams.get('editEvent')
  const editTaskId = searchParams.get('editTask')
  const createParam = searchParams.get('create')

  useEffect(() => {
    if (!editEventId && !editTaskId && createParam !== 'true') {
      setIsClosing(false)
    }
  }, [editEventId, editTaskId, createParam])

  const isModalVisuallyOpen = (isEventModalOpen || !!editEventId || !!editTaskId || createParam === 'true') && !isClosing

  const handleCloseModal = () => {
    setIsEventModalOpen(false)
    if (editEventId || editTaskId || createParam === 'true') {
      setIsClosing(true)
      const newParams = new URLSearchParams(searchParams.toString())
      newParams.delete('editEvent')
      newParams.delete('editTask')
      newParams.delete('create')
      newParams.delete('createDate')
      newParams.delete('startTime')
      newParams.delete('endTime')
      newParams.delete('ax')
      newParams.delete('ay')
      newParams.delete('aw')
      newParams.delete('ah')
      newParams.delete('modalType')
      newParams.delete('status')
      router.push(`${pathname}?${newParams.toString()}`, { scroll: false })
    }
  }

  useEffect(() => {
    if (isMounted) {
      document.cookie = `pac_sidebar_width=${sidebarWidth}; path=/; max-age=31536000`
      document.cookie = `pac_sidebar_open=${isSidebarOpen}; path=/; max-age=31536000`
      document.cookie = `pac_kanban_width=${kanbanWidth}; path=/; max-age=31536000`
      document.cookie = `pac_kanban_open=${isKanbanOpen}; path=/; max-age=31536000`
      document.cookie = `pac_grid_scale=${gridScale}; path=/; max-age=31536000`
    } else {
      setIsMounted(true)
    }
  }, [sidebarWidth, isSidebarOpen, kanbanWidth, isKanbanOpen, gridScale, isMounted])

  const dateParam = searchParams.get('date')
  const currentDateISO = useMemo(() => dateParam || getTodayISO(), [dateParam])
  const internalDate = useMemo(() => parseISOString(currentDateISO), [currentDateISO])

  useEffect(() => {
    if (isMounted && !dateParam) {
      router.replace(`${pathname}?date=${getTodayISO()}`, { scroll: false })
    }
  }, [isMounted, dateParam, pathname, router])

  const handlePrev = () => {
    let prev: Date
    if (pathname === '/') prev = subMonths(internalDate, 1)
    else if (pathname === '/week') prev = subWeeks(internalDate, 1)
    else if (pathname === '/day') prev = subDays(internalDate, 4)
    else prev = subDays(internalDate, 1)
    router.push(`${pathname}?date=${format(prev, 'yyyy-MM-dd')}`, { scroll: false })
  }

  const handleNext = () => {
    let next: Date
    if (pathname === '/') next = addMonths(internalDate, 1)
    else if (pathname === '/week') next = addWeeks(internalDate, 1)
    else if (pathname === '/day') next = addDays(internalDate, 4)
    else next = addDays(internalDate, 1)
    router.push(`${pathname}?date=${format(next, 'yyyy-MM-dd')}`, { scroll: false })
  }

  const handleToday = () => {
    router.push(`${pathname}?date=${getTodayISO()}`, { scroll: false })
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (isModalVisuallyOpen) return

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); setIsSearchOpen(true); return
      }
      if (e.key === 'ArrowLeft') handlePrev()
      else if (e.key === 'ArrowRight') handleNext()
      else if (e.key === 't' || e.key === 'T') handleToday()
      else if (e.key === '1') router.push(`/?date=${format(internalDate, 'yyyy-MM-dd')}`)
      else if (e.key === '2') router.push(`/week?date=${format(internalDate, 'yyyy-MM-dd')}`)
      else if (e.key === '3') router.push(`/day?date=${format(internalDate, 'yyyy-MM-dd')}`)
      else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); undo().then(async (l) => { if (l) { showToast(l); await router.refresh() } })
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); redo().then(async (l) => { if (l) { showToast(l); await router.refresh() } })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [internalDate, pathname, isModalVisuallyOpen])

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        const sensitivity = 0.001
        const delta = -e.deltaY * sensitivity
        setGridScale(prev => Math.max(0.5, Math.min(3, prev + delta)))
      }
    }
    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [])

  useEffect(() => {
    const handleExternalDelete = (e: Event) => {
      const deletedId = (e as CustomEvent).detail
      if (deletedId === editEventId) {
        handleCloseModal()
      }
    }
    window.addEventListener('pac-event-deleted', handleExternalDelete)
    return () => window.removeEventListener('pac-event-deleted', handleExternalDelete)
  }, [editEventId])

  useEffect(() => {
    document.documentElement.style.setProperty('--hour-height', `${38 * gridScale}px`)
    document.documentElement.style.setProperty('--total-grid-height', `calc(var(--hour-height) * 24)`)
    window.dispatchEvent(new CustomEvent('pac-scale-change', { detail: gridScale }))
  }, [gridScale])

  useEffect(() => {
    const handleToast = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (typeof detail === 'string') showToast(detail)
    }
    window.addEventListener('pac-toast', handleToast)
    return () => window.removeEventListener('pac-toast', handleToast)
  }, [])

  const showToast = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 3500)
  }

  // Sidebar Handle logic
  const isResizing = useRef(false)
  const isKanbanResizing = useRef(false)
  
  const startResizing = () => { isResizing.current = true; document.body.style.cursor = 'col-resize'; }
  const startKanbanResizing = () => { isKanbanResizing.current = true; document.body.style.cursor = 'col-resize'; }
  
  const stopResizing = () => { 
    isResizing.current = false; 
    isKanbanResizing.current = false;
    document.body.style.cursor = 'default'; 
  }
  
  const resize = (e: MouseEvent) => {
    if (isResizing.current) {
      let nw = Math.max(200, Math.min(500, e.clientX))
      setSidebarWidth(nw)
    }
    if (isKanbanResizing.current) {
      // e.clientX distance from left edge minus the project sidebar width
      const kanbanLeftEdge = isSidebarOpen ? sidebarWidth : 0;
      let nw = Math.max(250, Math.min(800, e.clientX - kanbanLeftEdge))
      setKanbanWidth(nw)
    }
  }

  useEffect(() => {
    window.addEventListener('mousemove', resize); window.addEventListener('mouseup', stopResizing)
    return () => { window.removeEventListener('mousemove', resize); window.removeEventListener('mouseup', stopResizing) }
  }, [isSidebarOpen, sidebarWidth])

  return (
    <div className={styles.appContainer}>
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <h2 className={styles.logo}>Juggle</h2>
          <button className={styles.hamburgerBtn} onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12H21M3 6H21M3 18H21"/></svg>
          </button>

          <button 
            className={`${styles.iconBtn} ${isKanbanOpen ? styles.iconBtnActive : ''}`} 
            onClick={() => setIsKanbanOpen(!isKanbanOpen)}
            title="Toggle Kanban Tasks"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3H4v18h5V3zM20 3h-5v18h5V3zM14.5 3h-5v18h5V3z"/></svg>
          </button>

          
          <div className={styles.monthNavButtons}>
            <button className={styles.iconBtn} onClick={handlePrev}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button className={styles.todayBtn} onClick={handleToday}>Today</button>
            <button className={styles.iconBtn} onClick={handleNext}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          <h2 className={styles.displayDate}>{format(internalDate, pathname === '/' ? 'MMMM yyyy' : 'MMM d, yyyy')}</h2>
        </div>
        
        <div className={styles.topbarRight}>
          <div className={styles.viewToggle}>
            <button className={`${styles.toggleBtn} ${pathname === '/' ? styles.active : ''}`} onClick={() => router.push(`/?date=${format(internalDate, 'yyyy-MM-dd')}`)}>Month</button>
            <button className={`${styles.toggleBtn} ${pathname === '/week' ? styles.active : ''}`} onClick={() => router.push(`/week?date=${format(internalDate, 'yyyy-MM-dd')}`)}>Week</button>
            <button className={`${styles.toggleBtn} ${pathname === '/day' ? styles.active : ''}`} onClick={() => router.push(`/day?date=${format(internalDate, 'yyyy-MM-dd')}`)}>4 Day</button>
          </div>
          
          <button className={styles.searchBtn} onClick={() => setIsSearchOpen(true)} title="Search events (⌘K)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </button>
          <button className={styles.addButton} onClick={() => setIsEventModalOpen(true)}>+ New Event</button>
          <button
            className={styles.iconBtn}
            onClick={() => {
              window.location.href = '/api/auth/signout'
            }}
            title="Sign out"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </header>

      <div className={styles.shellBody}>
        <aside className={`${styles.sidebar} ${!isSidebarOpen ? styles.sidebarClosed : ''}`} style={{ width: isSidebarOpen ? `${sidebarWidth}px` : '0px' }}>
          <nav className={styles.sidebarNav}>
            <MiniCalendar
              currentDate={internalDate}
              pathname={pathname}
              onNavigate={(date) => {
                router.push(`${pathname}?date=${format(date, 'yyyy-MM-dd')}`, { scroll: false })
              }}
            />
            <ProjectSidebar initialProjects={initialProjects} />
          </nav>
        </aside>
        {isSidebarOpen && <div className={styles.resizer} onMouseDown={startResizing} />}
        
        <aside className={`${styles.kanbanSidebar} ${!isKanbanOpen ? styles.kanbanClosed : ''}`} style={{ width: isKanbanOpen ? `${kanbanWidth}px` : '0px' }}>
           <KanbanSidebar />
        </aside>
        {isKanbanOpen && <div className={styles.resizer} onMouseDown={startKanbanResizing} />}

        <div className={styles.mainContent}>
          <div className={styles.pageContent}>
            {children}
          </div>

        </div>
      </div>

      {isModalVisuallyOpen && (
        <EventModal 
          eventId={editEventId || undefined} 
          taskId={editTaskId || undefined}
          onClose={handleCloseModal}
          initialDate={searchParams.get('createDate') || undefined}
          initialStartTime={searchParams.get('startTime') || undefined}
          initialEndTime={searchParams.get('endTime') || undefined}
        />
      )}
      {isSearchOpen && <SearchPopover onClose={() => setIsSearchOpen(false)} />}
      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}
