import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext'
import { FeatureProvider } from './features/FeatureContext'
import { OnboardingProvider } from './onboarding/OnboardingContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <FeatureProvider>
          <OnboardingProvider>
            <App />
          </OnboardingProvider>
        </FeatureProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
