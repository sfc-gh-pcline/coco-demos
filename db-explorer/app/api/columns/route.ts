import { querySnowflake } from "@/lib/snowflake"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const db = searchParams.get("db")
  const schema = searchParams.get("schema")
  const table = searchParams.get("table")
  if (!db || !schema || !table) {
    return Response.json({ error: "Missing required query params: db, schema, table" }, { status: 400 })
  }

  const safeDb = db.replace(/"/g, '""')
  const safeSchema = schema.replace(/"/g, '""')
  const safeTable = table.replace(/"/g, '""')

  try {
    const rows = await querySnowflake(
      `SHOW COLUMNS IN TABLE "${safeDb}"."${safeSchema}"."${safeTable}"`,
    )
    const columns = rows.map((r, idx) => ({
      column_name: (r.column_name as string) || "",
      data_type: r.data_type ? (typeof r.data_type === "string" ? r.data_type : JSON.stringify(r.data_type)) : "",
      nullable: r["null?"] === "Y",
      default: (r.default as string) || null,
      primary_key: r["primary key"] === "Y" || r.primary_key === "Y",
      unique_key: r["unique key"] === "Y" || r.unique_key === "Y",
      comment: (r.comment as string) || "",
      ordinal: idx,
    }))
    return Response.json(columns)
  } catch (e) {
    console.error(new Date().toISOString(), "[api/columns]", e)
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed to list columns" },
      { status: 500 }
    )
  }
}
