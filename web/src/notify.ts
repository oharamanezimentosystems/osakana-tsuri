import { APP_NAME } from './config'

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

export function notifyFishReady() {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    new Notification(`${APP_NAME}`, {
      body: 'ウキが沈んだよ！お魚を釣り上げよう！🎣',
      icon: '/assets/fish/marukin.png',
      tag: 'fish-ready',
    })
  } catch {
    // ignore
  }
}
