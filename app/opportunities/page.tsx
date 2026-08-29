import { OpportunityQueue } from '../../src/components/Opportunities/OpportunityQueue'
import RazorRecoverApp from '../RazorRecoverApp'

export default function OpportunitiesPage() {
  return (
    <div className="min-h-screen bg-[#080705]">
      <OpportunityQueue />
      <RazorRecoverApp />
    </div>
  )
}
