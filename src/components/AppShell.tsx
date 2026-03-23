'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { format, addMonths, subMonths, parseISO } from 'date-fns'
import styles from './AppShell.module.css'
import EventModal from './EventModal'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(250)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isEventModalOpen, setIsEventModalOpen] = useState(false)
  
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  
  const monthParam = searchParams.get('month')
  // Read exactly at noon to avoid timezone shift dropping it to prev day
  const currentDate = monthParam ? parseISO(`${monthParam}-01T12:00:00Z`) : new Date()
  const displayDate = format(currentDate, 'MMMM yyyy')

  const handlePrevMonth = () => {
    const prev = subMonths(currentDate, 1)
    router.push(`${pathname}?month=${format(prev, 'yyyy-MM')}`)
  }

  const handleNextMonth = () => {
    const next = addMonths(currentDate, 1)
    router.push(`${pathname}?month=${format(next, 'yyyy-MM')}`)
  }
  
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
      {/* Sidebar - Conditional Rendering */}
      {isSidebarOpen && (
        <>
          <aside className={styles.sidebar} style={{ width: `${sidebarWidth}px` }}>
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
          <div className={styles.resizer} onMouseDown={startResizing} />
        </>
      )}

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
            <button 
              className={styles.todayBtn} 
              onClick={() => router.push(pathname)}
            >
              Today
            </button>
            <div className={styles.monthNavButtons}>
              <button className={styles.iconBtn} onClick={handlePrevMonth}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button className={styles.iconBtn} onClick={handleNextMonth}>
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
                onClick={() => router.push('/')}
              >Month</button>
              <button 
                className={`${styles.toggleBtn} ${pathname === '/week' ? styles.active : ''}`}
                onClick={() => router.push('/week')}
              >Week</button>
              <button 
                className={`${styles.toggleBtn} ${pathname === '/day' ? styles.active : ''}`}
                onClick={() => router.push('/day')}
              >Day</button>
            </div>
            
            <button className={styles.addButton} onClick={() => setIsEventModalOpen(true)}>+ New Event</button>
          </div>
        </header>
        
        <div className={styles.pageContent}>
          {children}
        </div>
      </div>

      {isEventModalOpen && <EventModal onClose={() => setIsEventModalOpen(false)} />}
    </div>
  )
}
