import { TransactionExplorer } from '../../src/components/Transactions/TransactionExplorer'
import RazorRecoverApp from '../RazorRecoverApp'

export default function TransactionsPage() {
  return (
    <div className="min-h-screen bg-[#080705]">
      <TransactionExplorer />
      <RazorRecoverApp />
    </div>
  )
}
