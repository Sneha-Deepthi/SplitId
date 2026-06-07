import { Profile, Expense, Settlement, DebtTransfer } from '../types'

export function cn(...inputs: (string | boolean | undefined)[]) {
  return inputs.filter(Boolean).join(' ')
}

export function formatCurrency(amount: number, currency: string = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount)
  } catch (e) {
    // Fallback if browser doesn't support the currency code
    return `${currency} ${amount.toFixed(2)}`
  }
}

export function formatRelativeTime(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// Available currencies list
export const SUPPORTED_CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
]

export function getCurrencySymbol(code: string): string {
  return SUPPORTED_CURRENCIES.find(c => c.code === code)?.symbol || code
}

// Greedy Debt Simplification Engine (Multiple Currencies Supported)
export function calculateBalances(
  members: Profile[],
  expenses: Expense[],
  settlements: Settlement[]
): DebtTransfer[] {
  const transfers: DebtTransfer[] = []
  
  // Find all unique currencies present
  const currencies = new Set<string>()
  expenses.forEach(e => currencies.add(e.currency))
  settlements.forEach(s => currencies.add(s.currency))
  
  if (currencies.size === 0) {
    currencies.add('USD')
  }

  const memberMap = new Map<string, Profile>(members.map(m => [m.id, m]))

  for (const currency of currencies) {
    const netBalances: Record<string, number> = {}
    members.forEach(m => {
      netBalances[m.id] = 0
    })

    // Add expenses
    expenses.forEach(exp => {
      if (exp.currency !== currency) return
      
      // Payer paid the total amount
      netBalances[exp.paid_by] = (netBalances[exp.paid_by] || 0) + exp.amount
      
      // Each participant owes their split amount
      if (exp.splits) {
        exp.splits.forEach(split => {
          netBalances[split.profile_id] = (netBalances[split.profile_id] || 0) - split.amount
        })
      }
    })

    // Adjust settlements
    settlements.forEach(settle => {
      if (settle.currency !== currency) return
      
      // Payer sent cash -> gets closer to zero (adds to negative balance)
      netBalances[settle.payer_id] = (netBalances[settle.payer_id] || 0) + settle.amount
      
      // Payee received cash -> gets closer to zero (deducts from positive balance)
      netBalances[settle.payee_id] = (netBalances[settle.payee_id] || 0) - settle.amount
    })

    // Clean up floats
    members.forEach(m => {
      netBalances[m.id] = Math.round(netBalances[m.id] * 100) / 100
    })

    // Match creditors and debtors for this currency
    const creditors = members
      .map(m => ({ id: m.id, balance: netBalances[m.id] }))
      .filter(x => x.balance > 0.005)
      .sort((a, b) => b.balance - a.balance)

    const debtors = members
      .map(m => ({ id: m.id, balance: netBalances[m.id] }))
      .filter(x => x.balance < -0.005)
      .sort((a, b) => a.balance - b.balance) // e.g. -100, -50

    let cIdx = 0
    let dIdx = 0

    while (cIdx < creditors.length && dIdx < debtors.length) {
      const creditor = creditors[cIdx]
      const debtor = debtors[dIdx]

      const oweAmount = Math.min(creditor.balance, Math.abs(debtor.balance))
      const roundedAmount = Math.round(oweAmount * 100) / 100

      if (roundedAmount > 0.005) {
        const fromMember = memberMap.get(debtor.id)
        const toMember = memberMap.get(creditor.id)

        if (fromMember && toMember) {
          transfers.push({
            fromId: debtor.id,
            fromName: fromMember.name,
            fromUsername: fromMember.username,
            toId: creditor.id,
            toName: toMember.name,
            toUsername: toMember.username,
            amount: roundedAmount,
            currency: currency
          })
        }
      }

      creditor.balance -= roundedAmount
      debtor.balance += roundedAmount

      if (Math.abs(creditor.balance) < 0.005) cIdx++
      if (Math.abs(debtor.balance) < 0.005) dIdx++
    }
  }

  return transfers
}
