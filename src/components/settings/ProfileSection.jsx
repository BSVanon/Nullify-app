import React from 'react'
import { useNavigate } from 'react-router-dom'
import { User, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

/**
 * Profile Section for Settings Page
 * 
 * Links to profile settings for holders or guest profile for guests
 */
export default function ProfileSection({ walletConnected, hasGuestThreads = false }) {
  const navigate = useNavigate()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Profile
        </CardTitle>
        <CardDescription>
          Manage your identity and how others see you
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {walletConnected ? (
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={() => navigate('/settings/profile')}
          >
            <span>Edit display name</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : hasGuestThreads ? (
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={() => navigate('/settings/guest-profile')}
          >
            <span>Edit Display Name (Guest)</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <div className="rounded-lg border border-muted-foreground/20 bg-muted/10 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Connect your wallet or join a thread to set up your profile
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
