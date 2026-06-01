import { querySnowflake } from "@/lib/snowflake"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const db = searchParams.get("db")
  const schema = searchParams.get("schema")
  if (!db || !schema) {
    return Response.json({ error: "Missing required query params: db, schema" }, { status: 400 })
  }

  const safeDb = db.replace(/"/g, '""')
  const safeSchema = schema.replace(/"/g, '""')

  try {
    const rows = await querySnowflake(
      `SHOW TABLES IN SCHEMA "${safeDb}"."${safeSchema}"`,
    )
    const tables = rows
      .map((r) => ({
        name: r.name as string,
        database_name: (r.database_name as string) || db,
        schema_name: (r.schema_name as string) || schema,
        kind: (r.kind as string) || "TABLE",
        rows: r.rows != null ? Number(r.rows) : null,
        bytes: r.bytes != null ? Number(r.bytes) : null,
        owner: (r.owner as string) || "",
        comment: (r.comment as string) || "",
        created_on: r.created_on ? String(r.created_on) : "",
        cluster_by: (r.cluster_by as string) || "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return Response.json(tables)
  } catch (e) {
    console.error(new Date().toISOString(), "[api/tables]", e)
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed to list tables" },
      { status: 500 }
    )
  }
}
