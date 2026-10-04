import { NextResponse } from "next/server"
import { checkStorageHealth } from "@/lib/store"

export const dynamic = "force-dynamic"

export async function GET() {
	const health = await checkStorageHealth()
	return NextResponse.json(health, { status: health.connected ? 200 : 503 })
}
