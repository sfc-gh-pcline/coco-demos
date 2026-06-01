import { querySnowflake } from "@/lib/snowflake"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const rows = await querySnowflake("SHOW DATABASES")
    const databases = rows
      .map((r) => ({
        name: r.name as string,
        owner: (r.owner as string) || "",
        comment: (r.comment as string) || "",
        created_on: r.created_on ? String(r.created_on) : "",
        is_default: r.is_default === "Y",
        is_current: r.is_current === "Y",
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return Response.json(databases)
  } catch (e) {
    console.error(new Date().toISOString(), "[api/databases]", e)
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed to list databases" },
      { status: 500 }
    )
  }
}
