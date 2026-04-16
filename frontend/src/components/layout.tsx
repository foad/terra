import type { ReactNode } from 'react'
import styles from './layout.module.css'

interface LayoutProps {
  children: ReactNode
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>TERRA</h1>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
