import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchViewDetail } from '../api'
import type { SemanticViewDetail } from '../types'
import DetailView from '../components/DetailView'

export default function ViewDetailPage() {
  const { database, schema, name } = useParams<{ database: string; schema: string; name: string }>()
  const [detail, setDetail] = useState<SemanticViewDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!database || !schema || !name) return
    setLoading(true)
    setError(null)
    fetchViewDetail(database, schema, name)
      .then(setDetail)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [database, schema, name])

  const fqn = `${database}.${schema}.${name}`

  return (
    <div>
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link to="/" className="hover:text-blue-600 transition-colors">All Views</Link>
        <span>/</span>
        <span className="text-gray-400">{database}</span>
        <span>/</span>
        <span className="text-gray-400">{schema}</span>
        <span>/</span>
        <span className="text-gray-900 font-medium">{name}</span>
      </nav>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700 font-medium">Failed to load view definition</p>
          <p className="text-red-500 text-sm mt-1">{error}</p>
        </div>
      )}

      {detail && <DetailView detail={detail} fqn={fqn} />}
    </div>
  )
}
