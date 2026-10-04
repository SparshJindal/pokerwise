import { NextResponse } from "next/server"
import { getGame, putGame } from "@/lib/store"
import type { Game } from "@/lib/types"

export const dynamic = "force-dynamic"

const ALPHABET = "23456789ACDEFGHJKMNPQRSTUVWXYZ"

function randomCode() {
	let out = ""
	for (let i = 0; i < 5; i++) {
		out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
	}
	return out
}

export async function POST(req: Request) {
	let name = "Home game"
	let initialPlayers: { name: string; userId?: string; buyIn?: number }[] = []
	try {
		const body = (await req.json()) as {
			name?: string
			initialPlayers?: { name: string; userId?: string; buyIn?: number }[]
		}
		if (body.name && body.name.trim()) name = body.name.trim().slice(0, 40)
		if (Array.isArray(body.initialPlayers)) initialPlayers = body.initialPlayers
	} catch {}

	let code = randomCode()
	for (let tries = 0; tries < 6; tries++) {
		if (!(await getGame(code))) break
		code = randomCode()
	}

	const now = new Date()
	const sessionEntries: Game["sessions"][0]["entries"] = []
	const players: Game["players"] = []

	for (const p of initialPlayers) {
		const cleanName = (p.name || "").trim().slice(0, 24)
		if (!cleanName) continue
		const pId = Math.random().toString(36).slice(2, 9)
		players.push({
			id: pId,
			name: cleanName,
			joinedAt: now.toISOString(),
			userId: p.userId,
		})
		const bAmt = Math.round(Number(p.buyIn || 0))
		sessionEntries.push({
			playerId: pId,
			buyIns: bAmt > 0 ? [{ id: Math.random().toString(36).slice(2, 9), amount: bAmt, at: now.toISOString() }] : [],
			cashOut: null,
		})
	}

	const game: Game = {
		code,
		name,
		createdAt: now.toISOString(),
		updatedAt: now.toISOString(),
		players,
		sessions: [
			{
				id: "s1",
				label: now.toLocaleDateString("en-IN", {
					day: "numeric",
					month: "short",
				}),
				date: now.toISOString(),
				status: "live",
				entries: sessionEntries,
			},
		],
		payments: [],
	}

	await putGame(game)
	return NextResponse.json(game, { status: 201 })
}
