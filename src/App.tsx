import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ROUTER_BASENAME } from '@/config/base'
import { UpdateBanner } from '@/components/layout/UpdateBanner'
import { ProtectedRoute, PublicOnlyRoute } from '@/components/routing/Guards'
import { PageLoader } from '@/components/ui'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import DashboardPage from '@/pages/DashboardPage'
import LoginPage from '@/pages/auth/LoginPage'

// الصفحات الأقل استخدامًا تُحمَّل عند الحاجة لتصغير الحزمة الأولى.
const ReportsPage = lazy(() => import('@/pages/ReportsPage'))
const AboutPage = lazy(() => import('@/pages/AboutPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'))
const BudgetPage = lazy(() => import('@/pages/BudgetPage'))
const CommitmentsPage = lazy(() => import('@/pages/CommitmentsPage'))
const GoalsPage = lazy(() => import('@/pages/GoalsPage'))
const ChallengesPage = lazy(() => import('@/pages/ChallengesPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/about" element={<AboutPage />} />
        <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
        <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
        <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPasswordPage /></PublicOnlyRoute>} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="budget" element={<BudgetPage />} />
          <Route path="commitments" element={<CommitmentsPage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="challenges" element={<ChallengesPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        {/* basename يُحدد وقت التشغيل: /dabbir على github.io، والجذر على dabbir.online */}
        <BrowserRouter basename={ROUTER_BASENAME}>
          <AppRoutes />
          <UpdateBanner />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
