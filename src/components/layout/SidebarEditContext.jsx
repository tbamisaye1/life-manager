import { createContext, useContext, useState } from 'react'

const SidebarEditContext = createContext(null)

/** One sidebar row may edit at a time — avoids duplicate-route focus/scroll bugs. */
export function SidebarEditProvider({ children }) {
  const [editingKey, setEditingKey] = useState(null)
  return (
    <SidebarEditContext.Provider value={{ editingKey, setEditingKey }}>
      {children}
    </SidebarEditContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook paired with provider
export function useSidebarEdit() {
  const ctx = useContext(SidebarEditContext)
  if (!ctx) throw new Error('useSidebarEdit must be used within SidebarEditProvider')
  return ctx
}
