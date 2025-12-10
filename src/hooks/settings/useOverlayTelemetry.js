import { useEffect, useState } from 'react';
import { listOverlayTelemetry } from '@/lib/messaging/storage';

/**
 * Hook to fetch and process overlay telemetry data for diagnostics
 * 
 * @returns {object} Telemetry summary with connection stats
 */
export function useOverlayTelemetry() {
  const [telemetry, setTelemetry] = useState({
    lastConnected: null,
    lastDisconnected: null,
    reconnectCount: 0,
    lastPing: null,
    avgRtt: null,
    recentEvents: [],
  });

  useEffect(() => {
    let mounted = true;

    const loadTelemetry = async () => {
      try {
        const events = await listOverlayTelemetry(50);
        
        if (!mounted) return;

        // Process events to extract useful metrics
        let lastConnected = null;
        let lastDisconnected = null;
        let reconnectCount = 0;
        let lastPing = null;
        const rttValues = [];

        // Iterate in reverse to get most recent events first
        for (let i = events.length - 1; i >= 0; i--) {
          const event = events[i];
          
          if (event.kind === 'status' && event.status === 'online' && !lastConnected) {
            lastConnected = event.timestamp;
          }
          
          if (event.kind === 'status' && 
              (event.status === 'disconnected' || event.status === 'closed') && 
              !lastDisconnected) {
            lastDisconnected = event.timestamp;
          }
          
          if (event.kind === 'reconnect') {
            reconnectCount = Math.max(reconnectCount, event.attempts || 0);
          }
          
          if (event.kind === 'heartbeat' && !lastPing) {
            lastPing = event.timestamp;
            if (event.rttMs != null) {
              rttValues.push(event.rttMs);
            }
          } else if (event.kind === 'heartbeat' && event.rttMs != null) {
            rttValues.push(event.rttMs);
          }
        }

        const avgRtt = rttValues.length > 0
          ? Math.round(rttValues.reduce((sum, val) => sum + val, 0) / rttValues.length)
          : null;

        setTelemetry({
          lastConnected,
          lastDisconnected,
          reconnectCount,
          lastPing,
          avgRtt,
          recentEvents: events.slice(-10).reverse(), // Last 10 events, most recent first
        });
      } catch (error) {
        console.error('[useOverlayTelemetry] Failed to load telemetry:', error);
      }
    };

    // Load immediately
    loadTelemetry();

    // Refresh every 10 seconds
    const interval = setInterval(loadTelemetry, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return telemetry;
}
