import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { WalletProvider } from './contexts/WalletContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { AuthFetchProvider } from './providers/AuthFetchProvider'
import MainLayout from '@/layout/MainLayout.jsx'
import LandingRouter from '@/pages/LandingRouter.jsx'
import WelcomePage from '@/pages/WelcomePage.jsx'
import WorkflowPage from '@/pages/WorkflowPage.jsx'
import MessagesPage from '@/pages/MessagesPage.jsx'
import InvitePage from '@/pages/InvitePage.jsx'
import OverlayPage from '@/pages/OverlayPage.jsx'
import SettingsPage from '@/pages/SettingsPage.jsx'
import ProfileSettingsPage from '@/pages/ProfileSettingsPage.jsx'
import GuestProfilePage from '@/pages/GuestProfilePage.jsx'
import ContactsPage from '@/pages/ContactsPage.jsx'
import { ThemeProvider } from '@/contexts/ThemeContext.jsx'
import NotificationToast from '@/components/ui/NotificationToast.jsx'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<LandingRouter />} />
        <Route path="welcome" element={<WelcomePage />} />
        <Route path="workflow" element={<WorkflowPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="invite/:blob" element={<InvitePage />} />
        <Route path="overlay" element={<OverlayPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/profile" element={<ProfileSettingsPage />} />
        <Route path="settings/guest-profile" element={<GuestProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <NotificationProvider>
      <WalletProvider>
        <AuthFetchProvider>
          <ThemeProvider>
            <AppRoutes />
            <NotificationToast />
          </ThemeProvider>
        </AuthFetchProvider>
      </WalletProvider>
    </NotificationProvider>
  )
}
