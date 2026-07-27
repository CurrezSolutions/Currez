import { useCallback, useEffect, useState } from 'react'
import { fetchActivityLogPage } from '../firebase/activityLog'

// Shared, paginated activity-log data source for both the Hospital Admin's
// own ActivityLogPage and Super Admin's HospitalActivityLogPanel — one
// screenful (fetchActivityLogPage's PAGE_SIZE) at a time via `loadMore`,
// never the whole collection, and never a live listener (see
// fetchActivityLogPage's comment for why). `reload` re-fetches from the top,
// standing in for the "live" refresh a listener would have given for free.
export function useActivityLog(hospitalId) {
  const [entries, setEntries] = useState(undefined)
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  const reload = useCallback(() => {
    if (!hospitalId) return
    setEntries(undefined)
    setError('')
    fetchActivityLogPage(hospitalId)
      .then((page) => {
        setEntries(page.entries)
        setCursor(page.cursor)
        setHasMore(page.hasMore)
      })
      .catch((err) => {
        setEntries([])
        setError(err.message)
      })
  }, [hospitalId])

  useEffect(() => {
    reload()
  }, [reload])

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return
    setLoadingMore(true)
    setError('')
    try {
      const page = await fetchActivityLogPage(hospitalId, { cursor })
      setEntries((prev) => [...(prev || []), ...page.entries])
      setCursor(page.cursor)
      setHasMore(page.hasMore)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingMore(false)
    }
  }, [hospitalId, cursor, hasMore, loadingMore])

  return { entries, hasMore, loadingMore, error, loadMore, reload }
}
