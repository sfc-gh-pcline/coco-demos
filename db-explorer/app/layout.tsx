import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Database Explorer",
  description: "Browse the databases, schemas, tables, and columns you are permitted to see in Snowflake",
  icons: { icon: "/icon.svg" },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
