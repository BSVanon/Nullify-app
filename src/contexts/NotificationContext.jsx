import React, { createContext, useContext, useState } from 'react'

const NotificationContext = createContext()

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([])

  const addNotification = (notification) => {
    const id = Date.now() + Math.random()
    const newNotification = {
      id,
      type: 'info', // info, success, warning, error
      timestamp: Date.now(),
      ...notification
    }

    console.log('[NotificationContext] Adding notification:', newNotification)
    setNotifications(prev => {
      const updated = [...prev, newNotification]
      console.log('[NotificationContext] Notifications after add:', updated.length)
      return updated
    })

    return id
  }

  const removeNotification = (id) => {
    console.log('[NotificationContext] Removing notification:', id)
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id)
      console.log('[NotificationContext] Notifications after remove:', updated.length)
      return updated
    })
  }

  const clearNotifications = () => {
    console.log('[NotificationContext] Clearing all notifications')
    setNotifications([])
  }

  const value = {
    notifications,
    addNotification,
    removeNotification,
    clearNotifications
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}
