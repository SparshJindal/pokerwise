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
	try {
		const body = (await req.json()) as { name?: string }
		if (body.name && body.name.trim()) name = body.name.trim().slice(0, 40)
	} catch {}

	let code = randomCode()
	for (let tries = 0; tries < 6; tries++) {
		if (!(await getGame(code))) break
		code = randomCode()
	}

	const now = new Date()
	const game: Game = {
		code,
		name,
		createdAt: now.toISOString(),
		updatedAt: now.toISOString(),
		players: [],
		sessions: [
			{
				id: "s1",
				label: now.toLocaleDateString("en-IN", {
					day: "numeric",
					month: "short",
				}),
				date: now.toISOString(),
				status: "live",
				entries: [],
			},
		],
		payments: [],
	}

	await putGame(game)
	return NextResponse.json(game, { status: 201 })
}
