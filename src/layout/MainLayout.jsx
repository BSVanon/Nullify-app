import React, { useCallback, useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Bell, Menu, MessageCircle, Settings, Wallet2, Users, X } from 'lucide-react'
import { RailContext } from '@/contexts/RailContext'

import WalletStatusCard from '@/components/workflow/WalletStatusCard.jsx'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { useWallet } from '@/contexts/WalletContext.jsx'
import { useNotification } from '@/contexts/NotificationContext.jsx'
import { cn } from '@/lib/utils'

function MobileHeader({ onOpenWallet }) {
  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] sm:w-[320px]">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
              <SheetDescription>Select a destination</SheetDescription>
            </SheetHeader>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold">Nullify</span>
            </div>
            <Separator className="my-4" />
            <div className="space-y-4">
              <Button variant="outline" className="w-full" onClick={onOpenWallet}>
                Manage wallet
              </Button>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition',
                    isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )
                }
                onClick={() => {
                  // close sheet handled by radix when NavLink changes route via trigger closing
                }}
              >
                <Settings className="h-4 w-4" />
                Settings
              </NavLink>
            </div>
          </SheetContent>
        </Sheet>
        <span className="text-lg font-semibold">Nullify</span>
      </div>
      <Button variant="ghost" size="icon" onClick={onOpenWallet}>
        <Wallet2 className="h-5 w-5" />
      </Button>
    </header>
  )
}

export default function MainLayout() {
  const [walletOpen, setWalletOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [railCollapsed, setRailCollapsed] = useState(false)
  const location = useLocation()
  const { connectWallet, disconnectWallet, isConnected, isLoading } = useWallet()
  const { notifications, removeNotification, clearNotifications } = useNotification()
  
  // Auto-collapse rail when navigating to a new page
  useEffect(() => {
    setRailCollapsed(false)
  }, [location.pathname])
  
  const toggleRail = useCallback(() => {
    setRailCollapsed(prev => !prev)
  }, [])

  const openWallet = useCallback(() => setWalletOpen(true), [])
  const handleConnect = useCallback(async () => {
    try {
      await connectWallet()
    } catch (error) {
      console.error('[MainLayout] connect failed', error)
    }
  }, [connectWallet])
  const handleDisconnect = useCallback(async () => {
    try {
      await disconnectWallet()
    } catch (error) {
      console.error('[MainLayout] disconnect failed', error)
    }
  }, [disconnectWallet])

  return (
    <RailContext.Provider value={{ railCollapsed, toggleRail }}>
      <div className="relative flex h-screen bg-background text-foreground">
        {/* Hamburger button - always visible, positioned absolutely */}
        <button
          type="button"
          onClick={toggleRail}
          aria-label={railCollapsed ? 'Show navigation' : 'Hide navigation'}
          className="absolute left-4 top-4 z-50 hidden h-10 w-10 items-center justify-center rounded-md text-foreground transition hover:bg-muted md:flex"
        >
          <Menu className="h-5 w-5" />
        </button>

        <aside
          className={cn(
            'hidden overflow-hidden border-border bg-muted/10 transition-all duration-300 md:flex md:flex-col md:items-center',
            railCollapsed ? 'w-0 border-r-0' : 'w-[72px] border-r'
          )}
        >
          <TooltipProvider delayDuration={200}>
            <div
              className={cn(
                'flex h-full flex-col items-center justify-start gap-3 pt-16 pb-4 transition-opacity duration-200',
                railCollapsed && 'pointer-events-none opacity-0'
              )}
            >
              <NavLink
                to="/messages"
                className={({ isActive }) =>
                  cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )
                }
                aria-label="Messages"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <MessageCircle className="h-5 w-5 shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="right">Messages</TooltipContent>
                </Tooltip>
              </NavLink>

              <NavLink
                to="/contacts"
                className={({ isActive }) =>
                  cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )
                }
                aria-label="Contacts"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Users className="h-5 w-5 shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="right">Contacts</TooltipContent>
                </Tooltip>
              </NavLink>

              <div className="mt-auto flex flex-col items-center gap-2">
                {/* Wallet status indicator */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={openWallet}
                      className={cn(
                        'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition hover:bg-muted/50',
                        isConnected ? 'text-emerald-500' : 'text-red-500'
                      )}
                      aria-label="Wallet status"
                    >
                      <Wallet2 className="h-5 w-5 shrink-0" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {isConnected ? 'Wallet connected' : 'Wallet disconnected'}
                  </TooltipContent>
                </Tooltip>
                
                {/* Notifications */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setNotificationsOpen(true)}
                      className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
                      aria-label="Notifications"
                    >
                      <Bell className="h-5 w-5 shrink-0" />
                      {notifications.length > 0 && (
                        <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
                          {notifications.length}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Notifications {notifications.length > 0 && `(${notifications.length})`}
                  </TooltipContent>
                </Tooltip>
                
                {/* Settings */}
                <NavLink
                  to="/settings"
                  className={({ isActive }) =>
                    cn(
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    )
                  }
                  aria-label="Settings"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Settings className="h-5 w-5 shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent side="right">Settings</TooltipContent>
                  </Tooltip>
                </NavLink>
              </div>
            </div>
          </TooltipProvider>
        </aside>
        <div className="flex flex-1 flex-col min-h-0">
          <MobileHeader onOpenWallet={openWallet} />
          <main className="flex flex-1 overflow-hidden">
            <Outlet context={{ railCollapsed, toggleRail }} />
          </main>
        </div>
      </div>

      <Dialog open={walletOpen} onOpenChange={setWalletOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Wallet connection</DialogTitle>
            <DialogDescription>Check status or switch wallets.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <WalletStatusCard />
            <div className="flex items-center gap-2">
              <Button onClick={handleConnect} disabled={isConnected || isLoading} className="flex-1">
                {isLoading ? 'Connecting…' : 'Connect'}
              </Button>
              <Button onClick={handleDisconnect} variant="outline" disabled={!isConnected} className="flex-1">
                Disconnect
              </Button>
            </div>
          </div>
          <DialogFooter className="mt-4 text-xs text-muted-foreground">
            Wallet actions require Metanet Desktop or another compatible substrate running locally.
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Notifications</DialogTitle>
                <DialogDescription>Recent activity and payment updates</DialogDescription>
              </div>
              {notifications.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearNotifications}
                  className="text-xs"
                >
                  Clear all
                </Button>
              )}
            </div>
          </DialogHeader>
          <div className="max-h-[400px] space-y-3 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Bell className="mb-2 h-8 w-8 opacity-30" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'rounded-lg border p-3 text-sm',
                    notification.type === 'success' && 'border-emerald-500/20 bg-emerald-500/5',
                    notification.type === 'error' && 'border-red-500/20 bg-red-500/5',
                    notification.type === 'warning' && 'border-amber-500/20 bg-amber-500/5',
                    notification.type === 'info' && 'border-blue-500/20 bg-blue-500/5'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <p className="text-foreground">{notification.message}</p>
                      {notification.timestamp && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(notification.timestamp).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => removeNotification(notification.id)}
                      className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition"
                      aria-label="Dismiss notification"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </RailContext.Provider>
  )
}
