import { MerchantDashboard } from '../../src/components/Dashboard/MerchantDashboard'
import RazorRecoverApp from '../RazorRecoverApp'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-[#080705]">
      <MerchantDashboard />
      <RazorRecoverApp />
    </div>
  )
}
