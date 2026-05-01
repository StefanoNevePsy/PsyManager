import { Capacitor, registerPlugin } from '@capacitor/core'

export interface WidgetSessionData {
  id: string
  scheduledAt: string
  durationMinutes: number
  patientName: string
  serviceName: string
  balance: number
}

interface SessionsWidgetPluginShape {
  updateSessions(options: { sessions: WidgetSessionData[] }): Promise<void>
  clearSessions(): Promise<void>
  isAvailable(): Promise<{ available: boolean }>
}

const SessionsWidget = registerPlugin<SessionsWidgetPluginShape>('SessionsWidget')

const isSupported = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

export const updateWidgetSessions = async (sessions: WidgetSessionData[]) => {
  if (!isSupported()) return
  try {
    console.log(`[Widget] Updating ${sessions.length} sessions`)
    await SessionsWidget.updateSessions({ sessions })
    console.log('[Widget] Update successful')
  } catch (err) {
    console.error('[Widget] Failed to update sessions:', err)
  }
}

export const clearWidgetSessions = async () => {
  if (!isSupported()) return
  try {
    await SessionsWidget.clearSessions()
  } catch {
    // ignore
  }
}
