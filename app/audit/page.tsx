import { AuditComplianceCenter } from '../../src/components/Audit/AuditComplianceCenter'
import RazorRecoverApp from '../RazorRecoverApp'

export default function AuditPage() {
  return (
    <div className="min-h-screen bg-[#080705]">
      <AuditComplianceCenter />
      <RazorRecoverApp />
    </div>
  )
}
