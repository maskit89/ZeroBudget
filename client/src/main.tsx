import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext'
import { FeatureProvider } from './features/FeatureContext'
import { OnboardingProvider } from './onboarding/OnboardingContext'
import { AnalyticsProvider } from './analytics/AnalyticsProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <FeatureProvider>
          <AnalyticsProvider>
            <OnboardingProvider>
              <App />
            </OnboardingProvider>
          </AnalyticsProvider>
        </FeatureProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
