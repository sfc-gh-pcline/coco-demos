import type { SemanticViewDetail, Dimension, Fact, Metric } from '../types'
import { useState, useMemo, Fragment } from 'react'

interface Props {
  detail: SemanticViewDetail
  fqn: string
}

type Tab = 'tables' | 'dimensions' | 'facts' | 'metrics' | 'relationships' | 'queries'
type SortDir = 'asc' | 'desc'
type SortConfig<K extends string> = { key: K; dir: SortDir } | null

const TABS: { key: Tab; label: string }[] = [
  { key: 'tables', label: 'Tables' },
  { key: 'dimensions', label: 'Dimensions' },
  { key: 'facts', label: 'Facts' },
  { key: 'metrics', label: 'Metrics' },
  { key: 'relationships', label: 'Relationships' },
  { key: 'queries', label: 'Verified Queries' },
]

function Badge({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    purple: 'bg-purple-100 text-purple-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${colors[color] || colors.gray}`}>
      {children}
    </span>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{title}</h3>
        <Badge>{count}</Badge>
      </div>
      {children}
    </div>
  )
}

function SortHeader<K extends string>({
  label, sortKey, sort, onSort,
}: { label: string; sortKey: K; sort: SortConfig<K>; onSort: (key: K) => void }) {
  const active = sort?.key === sortKey
  return (
    <th
      className="text-left px-4 py-2.5 font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900 group"
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <svg className={`w-3.5 h-3.5 transition-transform ${active ? 'text-blue-500' : 'text-gray-300 group-hover:text-gray-400'} ${active && sort.dir === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      </span>
    </th>
  )
}

function ExpandIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
      fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

function DetailPanel({ comment, synonyms, badgeColor = 'blue' }: { comment: string; synonyms: string[]; badgeColor?: string }) {
  return (
    <div className="px-4 py-3 bg-gray-50 space-y-2">
      {comment && (
        <div>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Description</span>
          <p className="mt-0.5 text-sm text-gray-700">{comment}</p>
        </div>
      )}
      {synonyms.length > 0 && (
        <div>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Synonyms</span>
          <div className="mt-1 flex gap-1 flex-wrap">
            {synonyms.map(s => <Badge key={s} color={badgeColor}>{s}</Badge>)}
          </div>
        </div>
      )}
    </div>
  )
}

function useSortable<T, K extends string>(items: T[], sort: SortConfig<K>, accessor: (item: T, key: K) => string) {
  return useMemo(() => {
    if (!sort) return items
    const sorted = [...items].sort((a, b) => {
      const aVal = accessor(a, sort.key).toLowerCase()
      const bVal = accessor(b, sort.key).toLowerCase()
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
    })
    return sort.dir === 'desc' ? sorted.reverse() : sorted
  }, [items, sort, accessor])
}

function toggleSort<K extends string>(sort: SortConfig<K>, key: K): SortConfig<K> {
  if (sort?.key === key) {
    return sort.dir === 'asc' ? { key, dir: 'desc' } : null
  }
  return { key, dir: 'asc' }
}

type DimKey = 'name' | 'table' | 'expression' | 'dataType'
type MetricKey = 'name' | 'table' | 'expression' | 'dataType'

function dimAccessor(d: Dimension | Fact, key: DimKey) {
  return d[key] ?? ''
}

function metricAccessor(m: Metric, key: MetricKey) {
  return m[key] ?? ''
}

export default function DetailView({ detail, fqn }: Props) {
  const [tab, setTab] = useState<Tab>('tables')
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null)
  const [expandedTable, setExpandedTable] = useState<string | null>(null)
  const [dimSort, setDimSort] = useState<SortConfig<DimKey>>(null)
  const [factSort, setFactSort] = useState<SortConfig<DimKey>>(null)
  const [metricSort, setMetricSort] = useState<SortConfig<MetricKey>>(null)
  const [expandedDim, setExpandedDim] = useState<string | null>(null)
  const [expandedFact, setExpandedFact] = useState<string | null>(null)
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null)

  const sortedDims = useSortable(detail.dimensions, dimSort, dimAccessor)
  const sortedFacts = useSortable(detail.facts, factSort, dimAccessor)
  const sortedMetrics = useSortable(detail.metrics, metricSort, metricAccessor)

  const counts: Record<Tab, number> = {
    tables: detail.tables.length,
    dimensions: detail.dimensions.length,
    facts: detail.facts.length,
    metrics: detail.metrics.length,
    relationships: detail.relationships.length,
    queries: detail.verifiedQueries.length,
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 font-mono">{fqn}</h2>
        {detail.comment && (
          <p className="mt-2 text-gray-600">{detail.comment}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          {detail.tables.length > 0 && <Badge color="blue">{detail.tables.length} tables</Badge>}
          {detail.dimensions.length > 0 && <Badge color="green">{detail.dimensions.length} dimensions</Badge>}
          {detail.facts.length > 0 && <Badge color="amber">{detail.facts.length} facts</Badge>}
          {detail.metrics.length > 0 && <Badge color="purple">{detail.metrics.length} metrics</Badge>}
          {detail.relationships.length > 0 && <Badge color="red">{detail.relationships.length} relationships</Badge>}
          {detail.verifiedQueries.length > 0 && <Badge>{detail.verifiedQueries.length} verified queries</Badge>}
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.label}
              {counts[t.key] > 0 && (
                <span className="ml-1.5 text-xs text-gray-400">({counts[t.key]})</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'tables' && (
        <Section title="Logical Tables" count={detail.tables.length}>
          <div className="space-y-3">
            {detail.tables.map(t => {
              const isExpanded = expandedTable === t.name
              const hasDetails = t.comment || t.synonyms.length > 0 || t.primaryKey.length > 0
              return (
                <div key={t.name} className="bg-white rounded-lg border border-gray-200">
                  <button
                    onClick={() => hasDetails && setExpandedTable(isExpanded ? null : t.name)}
                    className={`w-full text-left p-4 ${hasDetails ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">{t.name}</h4>
                        {hasDetails && (
                          <svg
                            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                          </svg>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 font-mono">{t.database}.{t.schema}.{t.baseTable}</p>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t border-gray-100 space-y-3">
                      {t.primaryKey.length > 0 && (
                        <div>
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Primary Key</span>
                          <div className="mt-1 flex gap-1">
                            {t.primaryKey.map(k => <Badge key={k} color="blue">{k}</Badge>)}
                          </div>
                        </div>
                      )}
                      {t.comment && (
                        <div>
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Description</span>
                          <p className="mt-1 text-sm text-gray-700">{t.comment}</p>
                        </div>
                      )}
                      {t.synonyms.length > 0 && (
                        <div>
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Synonyms</span>
                          <div className="mt-1 flex gap-1 flex-wrap">
                            {t.synonyms.map(s => <Badge key={s}>{s}</Badge>)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {tab === 'dimensions' && (
        <Section title="Dimensions" count={detail.dimensions.length}>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <SortHeader label="Name" sortKey="name" sort={dimSort} onSort={k => setDimSort(toggleSort(dimSort, k))} />
                  <SortHeader label="Table" sortKey="table" sort={dimSort} onSort={k => setDimSort(toggleSort(dimSort, k))} />
                  <SortHeader label="Expression" sortKey="expression" sort={dimSort} onSort={k => setDimSort(toggleSort(dimSort, k))} />
                  <SortHeader label="Type" sortKey="dataType" sort={dimSort} onSort={k => setDimSort(toggleSort(dimSort, k))} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedDims.map((d, i) => {
                  const rowKey = `${d.table}-${d.name}-${i}`
                  const isExpanded = expandedDim === rowKey
                  const hasDetails = d.comment || d.synonyms.length > 0
                  return (
                    <Fragment key={rowKey}>
                      <tr
                        className={`${hasDetails ? 'cursor-pointer' : ''} hover:bg-gray-50`}
                        onClick={() => hasDetails && setExpandedDim(isExpanded ? null : rowKey)}
                      >
                        <td className="px-4 py-2 font-medium text-gray-900">
                          <span className="inline-flex items-center gap-1.5">
                            {d.name}
                            {hasDetails && <ExpandIcon expanded={isExpanded} />}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-500 font-mono text-xs">{d.table}</td>
                        <td className="px-4 py-2 font-mono text-xs text-gray-600">{d.expression}</td>
                        <td className="px-4 py-2"><Badge>{d.dataType}</Badge></td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={4}>
                            <DetailPanel comment={d.comment} synonyms={d.synonyms} badgeColor="green" />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tab === 'facts' && (
        <Section title="Facts" count={detail.facts.length}>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <SortHeader label="Name" sortKey="name" sort={factSort} onSort={k => setFactSort(toggleSort(factSort, k))} />
                  <SortHeader label="Table" sortKey="table" sort={factSort} onSort={k => setFactSort(toggleSort(factSort, k))} />
                  <SortHeader label="Expression" sortKey="expression" sort={factSort} onSort={k => setFactSort(toggleSort(factSort, k))} />
                  <SortHeader label="Type" sortKey="dataType" sort={factSort} onSort={k => setFactSort(toggleSort(factSort, k))} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedFacts.map((f, i) => {
                  const rowKey = `${f.table}-${f.name}-${i}`
                  const isExpanded = expandedFact === rowKey
                  const hasDetails = f.comment || f.synonyms.length > 0
                  return (
                    <Fragment key={rowKey}>
                      <tr
                        className={`${hasDetails ? 'cursor-pointer' : ''} hover:bg-gray-50`}
                        onClick={() => hasDetails && setExpandedFact(isExpanded ? null : rowKey)}
                      >
                        <td className="px-4 py-2 font-medium text-gray-900">
                          <span className="inline-flex items-center gap-1.5">
                            {f.name}
                            {hasDetails && <ExpandIcon expanded={isExpanded} />}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-500 font-mono text-xs">{f.table}</td>
                        <td className="px-4 py-2 font-mono text-xs text-gray-600">{f.expression}</td>
                        <td className="px-4 py-2"><Badge color="amber">{f.dataType}</Badge></td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={4}>
                            <DetailPanel comment={f.comment} synonyms={f.synonyms} badgeColor="amber" />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tab === 'metrics' && (
        <Section title="Metrics" count={detail.metrics.length}>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <SortHeader label="Name" sortKey="name" sort={metricSort} onSort={k => setMetricSort(toggleSort(metricSort, k))} />
                  <SortHeader label="Table" sortKey="table" sort={metricSort} onSort={k => setMetricSort(toggleSort(metricSort, k))} />
                  <SortHeader label="Expression" sortKey="expression" sort={metricSort} onSort={k => setMetricSort(toggleSort(metricSort, k))} />
                  <SortHeader label="Type" sortKey="dataType" sort={metricSort} onSort={k => setMetricSort(toggleSort(metricSort, k))} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedMetrics.map((m, i) => {
                  const rowKey = `${m.table}-${m.name}-${i}`
                  const isExpanded = expandedMetric === rowKey
                  const hasDetails = m.comment || m.synonyms.length > 0
                  return (
                    <Fragment key={rowKey}>
                      <tr
                        className={`${hasDetails ? 'cursor-pointer' : ''} hover:bg-gray-50`}
                        onClick={() => hasDetails && setExpandedMetric(isExpanded ? null : rowKey)}
                      >
                        <td className="px-4 py-2 font-medium text-gray-900">
                          <span className="inline-flex items-center gap-1.5">
                            {m.name}
                            {hasDetails && <ExpandIcon expanded={isExpanded} />}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-500 font-mono text-xs">{m.table}</td>
                        <td className="px-4 py-2 font-mono text-xs text-gray-600">{m.expression}</td>
                        <td className="px-4 py-2"><Badge color="purple">{m.dataType}</Badge></td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={4}>
                            <DetailPanel comment={m.comment} synonyms={m.synonyms} badgeColor="purple" />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tab === 'relationships' && (
        <Section title="Relationships" count={detail.relationships.length}>
          <div className="space-y-3">
            {detail.relationships.map(r => (
              <div key={r.name} className="bg-white rounded-lg border border-gray-200 p-4">
                <h4 className="font-semibold text-gray-900 text-sm mb-2">{r.name}</h4>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded">{r.table}</span>
                  <div className="flex flex-col items-center text-xs text-gray-400">
                    <span>{r.foreignKey.join(', ')}</span>
                    <span>→</span>
                    <span>{r.refKey.join(', ')}</span>
                  </div>
                  <span className="font-mono text-green-600 bg-green-50 px-2 py-1 rounded">{r.refTable}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {tab === 'queries' && (
        <Section title="Verified Queries" count={detail.verifiedQueries.length}>
          <div className="space-y-3">
            {detail.verifiedQueries.map(q => (
              <div key={q.name} className="bg-white rounded-lg border border-gray-200 p-4">
                <button
                  onClick={() => setExpandedQuery(expandedQuery === q.name ? null : q.name)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm">{q.name}</h4>
                      <p className="text-sm text-gray-600 mt-1">{q.question}</p>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform shrink-0 ${expandedQuery === q.name ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </button>
                {expandedQuery === q.name && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <pre className="bg-gray-900 text-green-300 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap">{q.sql}</pre>
                    <div className="mt-2 flex gap-4 text-xs text-gray-400">
                      {q.verifiedBy && <span>Verified by: {q.verifiedBy}</span>}
                      {q.verifiedAt && <span>At: {new Date(parseInt(q.verifiedAt) * 1000).toLocaleDateString()}</span>}
                      {q.onboardingQuestion && <Badge color="blue">Onboarding</Badge>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
