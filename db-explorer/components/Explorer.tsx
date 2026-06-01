"use client"

import { useState, useEffect, useCallback } from "react"
import { Database, Layers, Table2, Search, LayoutGrid, ChevronRight } from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────

interface DbRow {
  name: string
  owner: string
  comment: string
  created_on: string
  is_current: boolean
  is_default: boolean
}

interface SchemaRow {
  name: string
  database_name: string
  owner: string
  comment: string
  created_on: string
  is_current: boolean
}

interface TableRow {
  name: string
  database_name: string
  schema_name: string
  kind: string
  rows: number | null
  bytes: number | null
  owner: string
  comment: string
  created_on: string
}

interface ColumnRow {
  column_name: string
  data_type: string
  nullable: boolean
  default: string | null
  primary_key: boolean
  unique_key: boolean
  comment: string
  ordinal: number
}

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtRows(n: number | null): string {
  if (n == null) return ""
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M rows`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K rows`
  return `${n} rows`
}

function parseDataType(raw: string): string {
  try {
    const parsed = JSON.parse(raw)
    return (parsed.type as string) || raw
  } catch {
    return raw
  }
}

function useDebounce<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ── Sub-components ────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="state-loading">
      <div className="spinner" />
      Loading…
    </div>
  )
}

function EmptyState({ title, sub, icon }: { title: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="state-empty">
      {icon}
      <span className="state-empty-title">{title}</span>
      {sub && <span className="state-empty-sub">{sub}</span>}
    </div>
  )
}

// ── Columns sub-table ─────────────────────────────────────────────────────

function ColumnsTable({ db, schema, table }: { db: string; schema: string; table: string }) {
  const [columns, setColumns] = useState<ColumnRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ db, schema, table })
    fetch(`/api/columns?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setColumns(data as ColumnRow[])
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [db, schema, table])

  if (loading) return <div className="state-loading" style={{ padding: "0.75rem 1.125rem" }}><div className="spinner" /> Loading columns…</div>
  if (error) return <div className="error-banner">{error}</div>
  if (columns.length === 0) return <div className="state-empty" style={{ padding: "0.75rem" }}><span className="state-empty-title">No columns found</span></div>

  return (
    <div className="columns-container">
      <table className="columns-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Column</th>
            <th>Type</th>
            <th>Nullable</th>
            <th>Comment</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((col) => (
            <tr key={col.column_name}>
              <td style={{ color: "var(--text-muted)", width: 36 }}>{col.ordinal + 1}</td>
              <td>
                <span className="col-name">{col.column_name}</span>
                {col.primary_key && <span className="col-pk-badge">PK</span>}
              </td>
              <td><span className="col-type">{parseDataType(col.data_type)}</span></td>
              <td className="col-nullable">{col.nullable ? "YES" : "NO"}</td>
              <td className="col-comment">{col.comment || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Table list with expandable columns ───────────────────────────────────

function TableList({
  db,
  schema,
  tables,
  loading,
  error,
}: {
  db: string
  schema: string
  tables: TableRow[]
  loading: boolean
  error: string | null
}) {
  const [expandedTable, setExpandedTable] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const dSearch = useDebounce(search)

  // Reset when schema changes
  useEffect(() => setExpandedTable(null), [db, schema])

  const filtered = tables.filter((t) =>
    t.name.toLowerCase().includes(dSearch.toLowerCase())
  )

  const toggleTable = (name: string) =>
    setExpandedTable((prev) => (prev === name ? null : name))

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div className="detail-header-top">
          <Table2 size={15} color="var(--accent)" />
          <span className="detail-title">{schema}</span>
        </div>
        <span className="detail-breadcrumb">{db} › {schema}</span>
        {!loading && !error && (
          <div className="detail-meta">
            <span className="detail-tag">{tables.length} tables</span>
          </div>
        )}
      </div>

      {!loading && !error && tables.length > 0 && (
        <div className="detail-search-row">
          <div className="detail-search">
            <Search size={13} />
            <input
              placeholder="Filter tables…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : error ? (
        <div className="error-banner">{error}</div>
      ) : tables.length === 0 ? (
        <EmptyState
          title="No tables found"
          sub="This schema may be empty or you may not have access"
          icon={<Table2 size={28} />}
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matches" sub={`No tables matching "${dSearch}"`} />
      ) : (
        <div className="table-list">
          {filtered.map((tbl) => (
            <div key={tbl.name}>
              <div
                className={`table-item ${expandedTable === tbl.name ? "expanded" : ""}`}
                onClick={() => toggleTable(tbl.name)}
              >
                <Table2 size={14} className="table-item-icon" />
                <span className="table-item-name">{tbl.name}</span>
                <div className="table-item-meta">
                  {tbl.rows != null && (
                    <span className="table-item-rows">{fmtRows(tbl.rows)}</span>
                  )}
                  {tbl.kind && tbl.kind !== "TABLE" && (
                    <span className="table-item-kind">{tbl.kind}</span>
                  )}
                  <ChevronRight size={13} className="table-item-chevron" />
                </div>
              </div>
              {expandedTable === tbl.name && (
                <ColumnsTable db={db} schema={schema} table={tbl.name} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Explorer ─────────────────────────────────────────────────────────

export function Explorer() {
  // Databases
  const [databases, setDatabases] = useState<DbRow[]>([])
  const [dbLoading, setDbLoading] = useState(true)
  const [dbError, setDbError] = useState<string | null>(null)
  const [dbSearch, setDbSearch] = useState("")
  const [selectedDb, setSelectedDb] = useState<string | null>(null)

  // Schemas
  const [schemas, setSchemas] = useState<SchemaRow[]>([])
  const [schemaLoading, setSchemaLoading] = useState(false)
  const [schemaError, setSchemaError] = useState<string | null>(null)
  const [schemaSearch, setSchemaSearch] = useState("")
  const [selectedSchema, setSelectedSchema] = useState<string | null>(null)

  // Tables
  const [tables, setTables] = useState<TableRow[]>([])
  const [tableLoading, setTableLoading] = useState(false)
  const [tableError, setTableError] = useState<string | null>(null)

  const dDbSearch = useDebounce(dbSearch)
  const dSchemaSearch = useDebounce(schemaSearch)

  // Load databases on mount
  useEffect(() => {
    fetch("/api/databases")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setDatabases(data as DbRow[])
      })
      .catch((e: Error) => setDbError(e.message))
      .finally(() => setDbLoading(false))
  }, [])

  // Load schemas when a database is selected
  const selectDatabase = useCallback((dbName: string) => {
    setSelectedDb(dbName)
    setSelectedSchema(null)
    setSchemas([])
    setTables([])
    setSchemaSearch("")
    setSchemaLoading(true)
    setSchemaError(null)

    fetch(`/api/schemas?db=${encodeURIComponent(dbName)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setSchemas(data as SchemaRow[])
      })
      .catch((e: Error) => setSchemaError(e.message))
      .finally(() => setSchemaLoading(false))
  }, [])

  // Load tables when a schema is selected
  const selectSchema = useCallback(
    (schemaName: string) => {
      if (!selectedDb) return
      setSelectedSchema(schemaName)
      setTables([])
      setTableLoading(true)
      setTableError(null)

      const params = new URLSearchParams({ db: selectedDb, schema: schemaName })
      fetch(`/api/tables?${params}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.error) throw new Error(data.error)
          setTables(data as TableRow[])
        })
        .catch((e: Error) => setTableError(e.message))
        .finally(() => setTableLoading(false))
    },
    [selectedDb]
  )

  const filteredDbs = databases.filter((d) =>
    d.name.toLowerCase().includes(dDbSearch.toLowerCase())
  )
  const filteredSchemas = schemas.filter((s) =>
    s.name.toLowerCase().includes(dSchemaSearch.toLowerCase())
  )

  return (
    <div className="app-shell">
      {/* Top bar */}
      <header className="topbar">
        <span className="topbar-logo">
          <LayoutGrid size={18} />
          Database Explorer
        </span>
        <span className="topbar-spacer" />
        {selectedDb && (
          <span className="topbar-meta">
            {selectedDb}
            {selectedSchema ? ` › ${selectedSchema}` : ""}
          </span>
        )}
      </header>

      {/* Three-panel explorer */}
      <div className="explorer">
        {/* ── Panel 1: Databases ── */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-header-row">
              <Database size={13} color="var(--text-secondary)" />
              <span className="panel-title">Databases</span>
              {!dbLoading && !dbError && (
                <span className="panel-count">{databases.length}</span>
              )}
            </div>
            <div className="panel-search">
              <Search size={12} />
              <input
                placeholder="Filter…"
                value={dbSearch}
                onChange={(e) => setDbSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="panel-body">
            {dbLoading ? (
              <LoadingState />
            ) : dbError ? (
              <div className="error-banner">{dbError}</div>
            ) : filteredDbs.length === 0 ? (
              <EmptyState
                title={dDbSearch ? "No matches" : "No databases found"}
                icon={<Database size={28} />}
              />
            ) : (
              filteredDbs.map((db) => (
                <div
                  key={db.name}
                  className={`list-item ${selectedDb === db.name ? "selected" : ""}`}
                  onClick={() => selectDatabase(db.name)}
                >
                  <Database size={13} className="list-item-icon" />
                  <span className="list-item-name" title={db.name}>{db.name}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Panel 2: Schemas ── */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-header-row">
              <Layers size={13} color="var(--text-secondary)" />
              <span className="panel-title">Schemas</span>
              {selectedDb && !schemaLoading && !schemaError && (
                <span className="panel-count">{schemas.length}</span>
              )}
            </div>
            <div className="panel-search">
              <Search size={12} />
              <input
                placeholder="Filter…"
                value={schemaSearch}
                onChange={(e) => setSchemaSearch(e.target.value)}
                disabled={!selectedDb}
              />
            </div>
          </div>
          <div className="panel-body">
            {!selectedDb ? (
              <EmptyState
                title="Select a database"
                sub="Choose a database to see its schemas"
                icon={<Layers size={28} />}
              />
            ) : schemaLoading ? (
              <LoadingState />
            ) : schemaError ? (
              <div className="error-banner">{schemaError}</div>
            ) : filteredSchemas.length === 0 ? (
              <EmptyState
                title={dSchemaSearch ? "No matches" : "No schemas found"}
                icon={<Layers size={28} />}
              />
            ) : (
              filteredSchemas.map((s) => (
                <div
                  key={s.name}
                  className={`list-item ${selectedSchema === s.name ? "selected" : ""}`}
                  onClick={() => selectSchema(s.name)}
                >
                  <Layers size={13} className="list-item-icon" />
                  <span className="list-item-name" title={s.name}>{s.name}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Panel 3: Tables + Columns ── */}
        {!selectedSchema ? (
          <div className="detail-panel" style={{ alignItems: "center", justifyContent: "center" }}>
            <EmptyState
              title={selectedDb ? "Select a schema" : "Select a database and schema"}
              sub="Tables and columns will appear here"
              icon={<Table2 size={32} />}
            />
          </div>
        ) : (
          <TableList
            db={selectedDb!}
            schema={selectedSchema}
            tables={tables}
            loading={tableLoading}
            error={tableError}
          />
        )}
      </div>
    </div>
  )
}
