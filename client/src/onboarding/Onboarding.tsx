import { useOnboarding } from './OnboardingContext'
import { WelcomeDialog } from './WelcomeDialog'
import { SpotlightTour } from './SpotlightTour'
import { GettingStartedChecklist } from './GettingStartedChecklist'

/**
 * The onboarding overlay layer. Mounted once inside the authenticated app, it
 * shows the welcome dialog, then the spotlight tour, and leaves the
 * getting-started checklist in the corner once the modal flow is out of the way.
 */
export function Onboarding() {
  const { phase, checklistVisible } = useOnboarding()
  return (
    <>
      {phase === 'welcome' && <WelcomeDialog />}
      {phase === 'tour' && <SpotlightTour />}
      {checklistVisible && phase === 'idle' && <GettingStartedChecklist />}
    </>
  )
}
