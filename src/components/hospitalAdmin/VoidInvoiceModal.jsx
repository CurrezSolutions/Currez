import { useState } from 'react'
import { reauthenticate } from '../../firebase/auth'
import Modal from '../common/Modal'
import NavIcon from '../common/NavIcon'

function formatMoney(n) {
  return `₹${(Number(n) || 0).toFixed(2)}`
}

// Voiding an invoice needs more friction than a typical confirm dialog — of
// every billing action, it's the one that can make a real charge disappear
// from collections. Requires re-typing the signed-in Hospital Admin's own
// password (proves it's really them at the keyboard, not just an unlocked
// or shared browser session) and a reason, both of which reach
// voidInvoice/activityLog — closing the gap where the reason was
// previously hardcoded to "Voided from Billing" regardless of why. See
// UAT_SECURITY_REPORT.md's void-invoice section.
function VoidInvoiceModal({ invoice, onConfirm, onCancel }) {
  const [password, setPassword] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!password) {
      setError('Enter your password to confirm.')
      return
    }
    if (!reason.trim()) {
      setError('Enter a reason for voiding this invoice.')
      return
    }
    setSubmitting(true)
    try {
      await reauthenticate(password)
    } catch {
      setError('That password is incorrect.')
      setSubmitting(false)
      return
    }
    try {
      await onConfirm(reason.trim())
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <Modal onClose={onCancel} className="max-w-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 ring-1 ring-inset ring-red-500/20">
          <NavIcon name="close" className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-base font-semibold text-heading">Void this invoice?</h2>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        This marks the {formatMoney(invoice.total)} invoice for {invoice.patientName || 'this patient'} as void. It
        stays on record but no longer counts toward collections or dues. Confirm your password and a reason to
        continue — both are recorded in the Activity Log.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-body">Your password</label>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-heading focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-body">Reason</label>
          <input
            type="text"
            placeholder="e.g. Wrong amount, duplicate, refund"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-heading placeholder:text-faint focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="cursor-pointer rounded-xl border border-line px-4 py-2 text-sm font-medium text-body transition-colors hover:bg-card-strong hover:text-heading disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="cursor-pointer rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-red-500/25 transition-all hover:bg-red-500 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Voiding…' : 'Void invoice'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default VoidInvoiceModal
