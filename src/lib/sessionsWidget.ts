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
    await SessionsWidget.updateSessions({ sessions })
  } catch {
    // Plugin may not be installed yet on older builds — ignore
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
