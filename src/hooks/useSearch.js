import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

/** Debounce a value by `delay` ms. */
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

/**
 * Search hook — debounces the query by 200 ms, then hits GET /api/search?q=.
 * Returns { results, isFetching }.
 */
export function useSearch(query) {
  const debouncedQuery = useDebounce(query, 200)
  const enabled = debouncedQuery.trim().length >= 1

  const { data, isFetching } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => api.get(`/search?q=${encodeURIComponent(debouncedQuery.trim())}`),
    enabled,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  })

  return {
    results: data?.results ?? [],
    isFetching: enabled && isFetching,
  }
}
