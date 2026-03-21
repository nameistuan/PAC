'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { format, addMonths, subMonths, parseISO } from 'date-fns'
import styles from './AppShell.module.css'
import EventModal from './EventModal'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(250)
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
    <div 
      className={styles.appContainer} 
      style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
    >
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>PAC.</h2>
        </div>
        <nav className={styles.sidebarNav}>
          <div className={styles.navSection}>
            <h3>Project Boards</h3>
            <ul className={styles.projectList}>
              <li>
                <span className={styles.projectDot} style={{backgroundColor: 'var(--primary-color)'}}></span> 
                General
              </li>
              <li>
                <span className={styles.projectDot} style={{backgroundColor: 'var(--secondary-color)'}}></span> 
                Engineering
              </li>
            </ul>
          </div>
        </nav>
      </aside>

      {/* Invisible Interactive Resizer Handle */}
      <div 
        className={styles.resizer} 
        onMouseDown={startResizing}
        title="Drag to resize sidebar"
      />

      {/* Main Application Area */}
      <div className={styles.mainContent}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <div className={styles.dateSelector}>
              <button className={styles.iconBtn} onClick={handlePrevMonth}>&lt;</button>
              <h2>{displayDate}</h2>
              <button className={styles.iconBtn} onClick={handleNextMonth}>&gt;</button>
            </div>
            <button 
              className={styles.todayBtn} 
              onClick={() => router.push(pathname)}
            >
              Today
            </button>
            
            <div className={styles.viewToggle}>
              <button className={`${styles.toggleBtn} ${styles.active}`}>Month</button>
              <button className={styles.toggleBtn}>Week</button>
              <button className={styles.toggleBtn}>Day</button>
            </div>
          </div>
          <button className={styles.addButton} onClick={() => setIsEventModalOpen(true)}>+ New Event</button>
        </header>
        
        <div className={styles.pageContent}>
          {children}
        </div>
      </div>

      {isEventModalOpen && <EventModal onClose={() => setIsEventModalOpen(false)} />}
    </div>
  )
}
