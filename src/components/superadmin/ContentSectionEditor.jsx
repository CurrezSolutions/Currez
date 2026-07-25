import { useState } from 'react'
import { updateHospital } from '../../firebase/hospitals'
import NavIcon from '../common/NavIcon'

function emptyItem(fields) {
  return Object.fromEntries(fields.map((f) => [f.name, '']))
}

const inputClass =
  'mt-0.5 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-heading focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/10'

// Generic list editor for one hospital content section (services,
// departments, testimonials) — shape driven entirely by the `fields`
// schema so those three share this one implementation. Doctors passes
// `noItems`: it's populated from real staff accounts, so only the
// visibility/order controls apply, not the item list.
function ContentSectionEditor({ slug, sectionKey, label, fields, section, noItems = false }) {
  const [enabled, setEnabled] = useState(section.enabled === 'on')
  const [orderNumber, setOrderNumber] = useState(section.orderNumber ?? 1)
  const [items, setItems] = useState(section.items?.length ? section.items : [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function markDirty() {
    setSaved(false)
  }

  function updateItem(index, field, value) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
    markDirty()
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem(fields)])
    markDirty()
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index))
    markDirty()
  }

  function moveItem(index, direction) {
    setItems((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    markDirty()
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await updateHospital(slug, {
        [`optionals.${sectionKey}`]: {
          enabled: enabled ? 'on' : 'off',
          orderNumber: Number(orderNumber) || 1,
          items: noItems
            ? []
            : items.map((item) =>
                fields.reduce((acc, f) => {
                  if (f.type !== 'number') {
                    acc[f.name] = item[f.name] || ''
                    return acc
                  }
                  let n = Number(item[f.name]) || 0
                  if (f.min != null) n = Math.max(f.min, n)
                  if (f.max != null) n = Math.min(f.max, n)
                  acc[f.name] = n
                  return acc
                }, {})
              ),
        },
      })
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-heading">{label}</h3>
        <div className="flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-body">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                setEnabled(e.target.checked)
                markDirty()
              }}
              className="h-4 w-4 cursor-pointer rounded border-line-strong bg-card accent-indigo-600"
            />
            Visible on landing page
          </label>
          <label className="flex items-center gap-2 text-sm text-body">
            Order
            <input
              type="number"
              min={1}
              value={orderNumber}
              onChange={(e) => {
                setOrderNumber(e.target.value)
                markDirty()
              }}
              className="w-16 rounded-lg border border-line bg-card px-2 py-1 text-sm text-heading focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
            />
          </label>
        </div>
      </div>

      {noItems ? (
        <p className="mt-4 text-sm text-faint">
          Doctors shown here come from this hospital's Staff page (real accounts with real schedules) —
          nothing to edit besides visibility and order above.
        </p>
      ) : (
        <>
          <div className="mt-4 space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="flex items-start gap-3 rounded-xl border border-line bg-card-strong/50 p-3"
              >
                <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                  {fields.map((f) => (
                    <div key={f.name}>
                      <label className="block text-xs font-medium text-muted">{f.label}</label>
                      <input
                        type={f.type === 'number' ? 'number' : f.type === 'url' ? 'url' : 'text'}
                        min={f.min}
                        max={f.max}
                        value={item[f.name] ?? ''}
                        onChange={(e) => updateItem(index, f.name, e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex shrink-0 flex-col items-center gap-0.5 pt-4">
                  <button
                    type="button"
                    onClick={() => moveItem(index, -1)}
                    disabled={index === 0}
                    title="Move up"
                    className="cursor-pointer rounded p-1 text-faint transition-colors hover:bg-card-strong hover:text-heading disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <NavIcon name="chevronDown" className="h-3.5 w-3.5 rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(index, 1)}
                    disabled={index === items.length - 1}
                    title="Move down"
                    className="cursor-pointer rounded p-1 text-faint transition-colors hover:bg-card-strong hover:text-heading disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <NavIcon name="chevronDown" className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    title="Remove"
                    className="cursor-pointer rounded p-1 text-faint transition-colors hover:bg-red-500/10 hover:text-red-500"
                  >
                    <NavIcon name="close" className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {items.length === 0 && <p className="text-sm text-faint">No items yet.</p>}
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={addItem}
              className="cursor-pointer rounded-xl border border-line px-3.5 py-2 text-sm font-medium text-body transition-colors hover:bg-card-strong hover:text-heading"
            >
              + Add item
            </button>
          </div>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-indigo-500/25 transition-all hover:bg-indigo-500 hover:shadow-md hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm"
        >
          {saving ? 'Saving…' : 'Save section'}
        </button>
        {saved && <span className="text-sm font-medium text-emerald-500">Saved.</span>}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </div>
  )
}

export default ContentSectionEditor
