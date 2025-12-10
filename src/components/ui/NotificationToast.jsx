import React, { useEffect, useState } from 'react'
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { useNotification } from '@/contexts/NotificationContext'

const iconMap = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const colorMap = {
  success: 'bg-green-500/10 border-green-500/20 text-green-500',
  error: 'bg-red-500/10 border-red-500/20 text-red-500',
  warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500',
  info: 'bg-blue-500/10 border-blue-500/20 text-blue-500',
}

function Toast({ notification, onRemove, onAutoHide }) {
  const Icon = iconMap[notification.type] || Info
  const colorClass = colorMap[notification.type] || colorMap.info

  // Auto-hide only when a duration is explicitly provided.
  // If no duration, the notification persists until manually dismissed.

  useEffect(() => {
    if (!notification.duration || notification.duration <= 0) return

    const timer = setTimeout(() => {
      if (onAutoHide) {
        onAutoHide(notification.id)
      }
    }, notification.duration)

    return () => clearTimeout(timer)
  }, [notification.id, notification.duration, onAutoHide])

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border ${colorClass} shadow-lg animate-in slide-in-from-right-full duration-300`}
      role="alert"
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {notification.title && (
          <div className="font-semibold mb-1">{notification.title}</div>
        )}
        <div className="text-sm opacity-90">{notification.message}</div>
      </div>
      <button
        onClick={() => onRemove(notification.id)}
        className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export default function NotificationToast() {
  const { notifications, removeNotification } = useNotification()
  const [hiddenIds, setHiddenIds] = useState(new Set())

  const visibleNotifications = notifications.filter((notification) =>
    !hiddenIds.has(notification.id),
  )

  if (visibleNotifications.length === 0) return null

  return (
    <div className="fixed bottom-24 left-24 z-50 flex flex-col gap-2 max-w-sm w-auto pointer-events-none">
      <div className="pointer-events-auto space-y-2">
        {visibleNotifications.map((notification) => (
          <Toast
            key={notification.id}
            notification={notification}
            onRemove={removeNotification}
            onAutoHide={(id) =>
              setHiddenIds((prev) => new Set([...prev, id]))
            }
          />
        ))}
      </div>
    </div>
  )
}
