'use client'

import { useState, useRef, useEffect, startTransition, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, parseISO, startOfWeek } from 'date-fns'
import styles from './AppShell.module.css'
import EventModal from './EventModal'
import ProjectSidebar from './ProjectSidebar'
import MiniCalendar from './MiniCalendar'
import SearchPopover from './SearchPopover'
import { undo, redo } from '@/lib/undoManager'

export default function AppShell({
  children,
  defaultSidebarOpen = true,
  defaultSidebarWidth = 250,
  initialProjects = []
}: {
  children: React.ReactNode,
  defaultSidebarOpen?: boolean,
  defaultSidebarWidth?: number,
  initialProjects?: { id: string; name: string; color: string }[]
}) {
  const [sidebarWidth, setSidebarWidth] = useState(defaultSidebarWidth)
  const [isSidebarOpen, setIsSidebarOpen] = useState(defaultSidebarOpen)
  const [isMounted, setIsMounted] = useState(false)
  const [isEventModalOpen, setIsEventModalOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [gridScale] = useState(1)
  const [toast, setToast] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  
  const editEventId = searchParams.get('editEvent')
  const createParam = searchParams.get('create')
  const dateParam = searchParams.get('date')
  const monthParam = searchParams.get('month') 

  const isModalVisuallyOpen = isEventModalOpen || !!editEventId || createParam === 'true'

  const handleCloseModal = () => {
    setIsEventModalOpen(false)
    if (editEventId || createParam === 'true') {
      const newParams = new URLSearchParams(searchParams.toString())
      newParams.delete('editEvent')
      newParams.delete('create')
      newParams.delete('createDate')
      router.push(`${pathname}?${newParams.toString()}`, { scroll: false })
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

  // Hydration-Stable 'Now' Reference: Stabilize timezone noise by forcing a noon-UTC anchor
  const [nowStable] = useState(() => {
    const d = new Date()
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0))
  })

  const currentDate = useMemo(() => {
    if (dateParam) return parseISO(`${dateParam}T12:00:00Z`)
    if (monthParam) return parseISO(`${monthParam}-01T12:00:00Z`)
    
    // When on an empty path, default logically to the stable 'Now' reference
    if (pathname === '/week') return startOfWeek(nowStable, { weekStartsOn: 0 })
    return nowStable
  }, [dateParam, monthParam, pathname, nowStable])

  const [internalDate, setInternalDate] = useState<Date>(currentDate)
  useEffect(() => { setInternalDate(currentDate) }, [currentDate.getTime()])

  const handlePrev = () => {
    let prev = internalDate
    if (pathname === '/') prev = subMonths(internalDate, 1)
    else if (pathname === '/week') prev = subWeeks(internalDate, 1)
    else if (pathname === '/day') prev = subDays(internalDate, 4)
    else prev = subDays(internalDate, 1)
    setInternalDate(prev)
    router.push(`${pathname}?date=${format(prev, 'yyyy-MM-dd')}`, { scroll: false })
  }

  const handleNext = () => {
    let next = internalDate
    if (pathname === '/') next = addMonths(internalDate, 1)
    else if (pathname === '/week') next = addWeeks(internalDate, 1)
    else if (pathname === '/day') next = addDays(internalDate, 4)
    else next = addDays(internalDate, 1)
    setInternalDate(next)
    router.push(`${pathname}?date=${format(next, 'yyyy-MM-dd')}`, { scroll: false })
  }

  const handleToday = () => {
    const target = new Date()
    setInternalDate(target)
    router.push(`${pathname}?date=${format(target, 'yyyy-MM-dd')}`, { scroll: false })
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

  // Real Webpage Scrolling Engine: High-Performance native overflow tracking
  const scrollRef = useRef<HTMLDivElement>(null)
  const isSettingScrollRef = useRef(false)
  const lastScrollPos = useRef(0)

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    
    const centerView = () => {
      const width = container.offsetWidth
      if (width > 0) {
        if (Math.abs(container.scrollLeft - width) > 5) {
          isSettingScrollRef.current = true
          container.scrollLeft = width
          lastScrollPos.current = width
          // Release the lock after a short frame to let the browser paint the scroll
          requestAnimationFrame(() => {
            isSettingScrollRef.current = false
          })
        }
      } else {
        requestAnimationFrame(centerView)
      }
    }
    centerView()
    
    const onScroll = () => {
      if (isSettingScrollRef.current) return // Filter out programmatic re-centering
      
      const pos = container.scrollLeft
      const width = container.offsetWidth
      if (width <= 0) return 
      
      const posPct = pos / width
      
      // Robust Thresholding: Only trigger if we've scrolled deep into a side buffer
      if (posPct < 0.15) { // User is near the absolute left edge
        isSettingScrollRef.current = true
        handlePrev()
      } 
      else if (posPct > 1.85) { // User is near the absolute right edge
        isSettingScrollRef.current = true
        handleNext()
      }
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [pathname, internalDate.getTime()])

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
        e.preventDefault(); undo().then(l => { if(l) { showToast(l); startTransition(()=>router.refresh()) } })
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); redo().then(l => { if(l) { showToast(l); startTransition(()=>router.refresh()) } })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [internalDate, pathname, isModalVisuallyOpen])

  useEffect(() => {
    document.documentElement.style.setProperty('--hour-height', `${38 * gridScale}px`)
    document.documentElement.style.setProperty('--total-grid-height', `calc(var(--hour-height) * 24)`)
    window.dispatchEvent(new CustomEvent('pac-scale-change', { detail: gridScale }))
  }, [gridScale])

  // Listen for pac-toast events dispatched by drag/resize/edit/delete operations
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
  const startResizing = () => { isResizing.current = true; document.body.style.cursor = 'col-resize'; }
  const stopResizing = () => { isResizing.current = false; document.body.style.cursor = 'default'; }
  const resize = (e: MouseEvent) => {
    if (isResizing.current) {
      let nw = Math.max(200, Math.min(500, e.clientX))
      setSidebarWidth(nw)
    }
  }
  useEffect(() => {
    window.addEventListener('mousemove', resize); window.addEventListener('mouseup', stopResizing)
    return () => { window.removeEventListener('mousemove', resize); window.removeEventListener('mouseup', stopResizing) }
  }, [])

  return (
    <div className={styles.appContainer}>
      <aside className={`${styles.sidebar} ${!isSidebarOpen ? styles.sidebarClosed : ''}`} style={{ width: isSidebarOpen ? `${sidebarWidth}px` : '0px' }}>
        <div className={styles.sidebarHeader}><h2 className={styles.logo}>PAC</h2></div>
        <nav className={styles.sidebarNav}>
          <MiniCalendar
            currentDate={internalDate}
            pathname={pathname}
            onNavigate={(date) => {
              setInternalDate(date)
              router.push(`${pathname}?date=${format(date, 'yyyy-MM-dd')}`, { scroll: false })
            }}
          />
          <ProjectSidebar initialProjects={initialProjects} />
        </nav>
      </aside>
      <div className={`${styles.resizer} ${!isSidebarOpen ? styles.resizerHidden : ''}`} onMouseDown={startResizing} />
      <div className={styles.mainContent}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button className={styles.hamburgerBtn} onClick={() => setIsSidebarOpen(!isSidebarOpen)}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12H21M3 6H21M3 18H21"/></svg></button>
            <div className={styles.monthNavButtons}>
              <button className={styles.iconBtn} onClick={handlePrev}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7" /></svg></button>
              <button className={styles.todayBtn} onClick={handleToday}>Today</button>
              <button className={styles.iconBtn} onClick={handleNext}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5l7 7-7 7" /></svg></button>
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
          </div>
        </header>

        <div className={styles.pageContent}>
          <div ref={scrollRef} className={styles.scrollContainer}>
            <div className={styles.scrollSpacer} /> 
            <div className={styles.scrollPage}> {children} </div>
            <div className={styles.scrollSpacer} />
          </div>
        </div>

        {pathname !== '/' && (
          <>
            <button className={`${styles.floatingArrow} ${styles.floatingArrowLeft}`} onClick={handlePrevDay}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button className={`${styles.floatingArrow} ${styles.floatingArrowRight}`} onClick={handleNextDay}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5l7 7-7 7" /></svg>
            </button>
          </>
        )}
      </div>

      {isModalVisuallyOpen && (
        <EventModal 
          eventId={editEventId || undefined} 
          onClose={handleCloseModal}
          initialDate={searchParams.get('createDate') || undefined}
        />
      )}
      {isSearchOpen && <SearchPopover onClose={() => setIsSearchOpen(false)} />}
      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}
