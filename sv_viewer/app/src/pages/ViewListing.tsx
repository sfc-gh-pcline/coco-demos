import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchViews } from '../api'
import type { SemanticViewSummary } from '../types'
import ViewCatalog from '../components/ViewCatalog'

type SortField = 'name' | 'database' | 'createdOn'
type SortDir = 'asc' | 'desc'

export default function ViewListing() {
  const navigate = useNavigate()
  const [views, setViews] = useState<SemanticViewSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedDb, setSelectedDb] = useState('')
  const [selectedSchema, setSelectedSchema] = useState('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  useEffect(() => {
    fetchViews()
      .then(setViews)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const databases = useMemo(() => [...new Set(views.map(v => v.database))].sort(), [views])
  const schemas = useMemo(() => {
    const filtered = selectedDb ? views.filter(v => v.database === selectedDb) : views
    return [...new Set(filtered.map(v => v.schema))].sort()
  }, [views, selectedDb])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    let result = views.filter(v => {
      if (q && !v.name.toLowerCase().includes(q) && !v.comment.toLowerCase().includes(q)) return false
      if (selectedDb && v.database !== selectedDb) return false
      if (selectedSchema && v.schema !== selectedSchema) return false
      return true
    })
    result.sort((a, b) => {
      let cmp = 0
      if (sortField === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortField === 'database') cmp = `${a.database}.${a.schema}`.localeCompare(`${b.database}.${b.schema}`)
      else cmp = a.createdOn.localeCompare(b.createdOn)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return result
  }, [views, search, selectedDb, selectedSchema, sortField, sortDir])

  function handleSortChange(field: SortField) {
    if (field === sortField) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  function handleSelect(v: SemanticViewSummary) {
    navigate(`/view/${encodeURIComponent(v.database)}/${encodeURIComponent(v.schema)}/${encodeURIComponent(v.name)}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700 font-medium">Failed to load semantic views</p>
        <p className="text-red-500 text-sm mt-1">{error}</p>
      </div>
    )
  }

  return (
    <ViewCatalog
      views={filtered}
      search={search}
      onSearchChange={setSearch}
      databases={databases}
      selectedDb={selectedDb}
      onDbChange={v => { setSelectedDb(v); setSelectedSchema('') }}
      schemas={schemas}
      selectedSchema={selectedSchema}
      onSchemaChange={setSelectedSchema}
      sortField={sortField}
      sortDir={sortDir}
      onSortChange={handleSortChange}
      onSelect={handleSelect}
    />
  )
}
