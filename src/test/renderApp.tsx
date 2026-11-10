import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import { createDemoAuth } from '@/services/auth/demoAuth'

export function renderApp(path = '/') {
  const service = createDemoAuth()
  const utils = render(
    <AuthProvider service={service}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </ToastProvider>
    </AuthProvider>,
  )
  return { ...utils, service }
}
