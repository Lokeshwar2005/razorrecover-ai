import { PolicySettingsView } from '../../../src/components/Settings/PolicySettingsView'
import RazorRecoverApp from '../../RazorRecoverApp'

export default function PolicySettingsPage() {
  return (
    <div className="min-h-screen bg-[#080705]">
      <PolicySettingsView />
      <RazorRecoverApp />
    </div>
  )
}
