/** Permission is requested only from an explicit user gesture. */
export function canRequestNotifications(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext &&
    'Notification' in window && 'serviceWorker' in navigator &&
    'PushManager' in window
}

export async function requestReminderPermission(): Promise<NotificationPermission> {
  if (!canRequestNotifications()) throw new Error('هذا المتصفح ما يدعم إشعارات الويب. على الآيفون ثبّت دبّر على الشاشة الرئيسية أولًا.')
  return Notification.requestPermission()
}
