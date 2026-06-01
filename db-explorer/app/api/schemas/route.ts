import { querySnowflake } from "@/lib/snowflake"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const db = searchParams.get("db")
  if (!db) {
    return Response.json({ error: "Missing required query param: db" }, { status: 400 })
  }

  try {
    const rows = await querySnowflake(
      `SHOW SCHEMAS IN DATABASE "${db.replace(/"/g, '""')}"`,
    )
    const schemas = rows
      .map((r) => ({
        name: r.name as string,
        database_name: (r.database_name as string) || db,
        owner: (r.owner as string) || "",
        comment: (r.comment as string) || "",
        created_on: r.created_on ? String(r.created_on) : "",
        is_default: r.is_default === "Y",
        is_current: r.is_current === "Y",
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return Response.json(schemas)
  } catch (e) {
    console.error(new Date().toISOString(), "[api/schemas]", e)
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed to list schemas" },
      { status: 500 }
    )
  }
}
