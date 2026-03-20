'use client'

import { useState, useRef, useEffect } from 'react'
import styles from './AppShell.module.css'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(250)
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
            <div className={styles.dateSelector}>March 2026</div>
            
            <div className={styles.viewToggle}>
              <button className={`${styles.toggleBtn} ${styles.active}`}>Month</button>
              <button className={styles.toggleBtn}>Week</button>
              <button className={styles.toggleBtn}>Day</button>
            </div>
          </div>
          <button className={styles.addButton}>+ New Event</button>
        </header>
        
        <div className={styles.pageContent}>
          {children}
        </div>
      </div>
    </div>
  )
}
