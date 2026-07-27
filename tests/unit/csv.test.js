import { describe, it, expect } from 'vitest'
import { toCsv } from '../../src/utils/csv.js'

describe('utils/csv.js', () => {
  const columns = [
    { label: 'Name', value: (r) => r.name },
    { label: 'Note', value: (r) => r.note },
  ]

  it('renders a header row plus one row per record', () => {
    const csv = toCsv([{ name: 'Asha Rao', note: 'ok' }], columns)
    expect(csv).toBe('Name,Note\r\nAsha Rao,ok')
  })

  it('quotes and escapes values containing commas, quotes or newlines', () => {
    const csv = toCsv([{ name: 'Rao, Asha', note: 'Said "hello"\nagain' }], columns)
    expect(csv).toBe('Name,Note\r\n"Rao, Asha","Said ""hello""\nagain"')
  })

  it('renders null/undefined values as empty cells', () => {
    const csv = toCsv([{ name: undefined, note: null }], columns)
    expect(csv).toBe('Name,Note\r\n,')
  })
})
