import type { SemanticViewSummary } from '../types'

type SortField = 'name' | 'database' | 'createdOn'
type SortDir = 'asc' | 'desc'

interface Props {
  views: SemanticViewSummary[]
  search: string
  onSearchChange: (v: string) => void
  databases: string[]
  selectedDb: string
  onDbChange: (v: string) => void
  schemas: string[]
  selectedSchema: string
  onSchemaChange: (v: string) => void
  sortField: SortField
  sortDir: SortDir
  onSortChange: (field: SortField) => void
  onSelect: (v: SemanticViewSummary) => void
}

function SortButton({ field, label, current, dir, onClick }: {
  field: SortField; label: string; current: SortField; dir: SortDir; onClick: (f: SortField) => void
}) {
  const active = field === current
  return (
    <button
      onClick={() => onClick(field)}
      className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
        active ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {label}
      {active && (
        <span className="ml-1">{dir === 'asc' ? '↑' : '↓'}</span>
      )}
    </button>
  )
}

export default function ViewCatalog({
  views, search, onSearchChange,
  databases, selectedDb, onDbChange,
  schemas, selectedSchema, onSchemaChange,
  sortField, sortDir, onSortChange, onSelect,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Search views..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={selectedDb}
          onChange={e => onDbChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Databases</option>
          {databases.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={selectedSchema}
          onChange={e => onSchemaChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Schemas</option>
          {schemas.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Sort:</span>
        <SortButton field="name" label="Name" current={sortField} dir={sortDir} onClick={onSortChange} />
        <SortButton field="database" label="Database" current={sortField} dir={sortDir} onClick={onSortChange} />
        <SortButton field="createdOn" label="Created" current={sortField} dir={sortDir} onClick={onSortChange} />
        <span className="ml-auto text-xs text-gray-500">{views.length} view{views.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {views.map(v => (
          <button
            key={`${v.database}.${v.schema}.${v.name}`}
            onClick={() => onSelect(v)}
            className="text-left bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                {v.name}
              </h3>
              {v.extension.includes('CA') && (
                <span className="shrink-0 ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 rounded">
                  Analyst
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 font-mono mb-2">
              {v.database}.{v.schema}
            </p>
            {v.comment && (
              <p className="text-sm text-gray-600 line-clamp-2 mb-3">{v.comment}</p>
            )}
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{v.owner}</span>
              <span>{new Date(v.createdOn).toLocaleDateString()}</span>
            </div>
          </button>
        ))}
      </div>

      {views.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">No semantic views found</p>
          <p className="text-sm mt-1">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  )
}
