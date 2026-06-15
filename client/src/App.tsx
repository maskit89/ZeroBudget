import { Navigate, Route, Routes } from 'react-router-dom'
import type { JSX } from 'react'
import { useAuth } from './auth/AuthContext'
import { useFeatures } from './features/FeatureContext'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { TransactionsPage } from './pages/TransactionsPage'
import { AccountsPage } from './pages/AccountsPage'
import { ReportsPage } from './pages/ReportsPage'
import { HelpPage } from './pages/HelpPage'

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { isAuthenticated } = useAuth()
  const features = useFeatures()

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/transactions"
        element={
          <RequireAuth>
            <TransactionsPage />
          </RequireAuth>
        }
      />
      {features.accounts && (
        <Route
          path="/accounts"
          element={
            <RequireAuth>
              <AccountsPage />
            </RequireAuth>
          }
        />
      )}
      {features.reports && (
        <Route
          path="/reports"
          element={
            <RequireAuth>
              <ReportsPage />
            </RequireAuth>
          }
        />
      )}
      <Route
        path="/help"
        element={
          <RequireAuth>
            <HelpPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
