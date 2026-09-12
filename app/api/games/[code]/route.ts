import { NextResponse } from "next/server"
import { getGame, putGame } from "@/lib/store"
import type { Game, Session } from "@/lib/types"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ code: string }> }

const id = () => Math.random().toString(36).slice(2, 9)

function liveSession(game: Game): Session {
	const live = game.sessions.find((s) => s.status === "live")
	if (live) return live
	const now = new Date()
	const session: Session = {
		id: id(),
		label: now.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
		date: now.toISOString(),
		status: "live",
		entries: [],
	}
	game.sessions.push(session)
	return session
}

function entryFor(game: Game, playerId: string) {
	const session = liveSession(game)
	let entry = session.entries.find((e) => e.playerId === playerId)
	if (!entry) {
		entry = { playerId, buyIns: [], cashOut: null }
		session.entries.push(entry)
	}
	return entry
}

function money(value: unknown) {
	const n = Math.round(Number(value))
	if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return null
	return n
}

export async function GET(_req: Request, ctx: Ctx) {
	const { code } = await ctx.params
	const game = await getGame(code)
	if (!game) return NextResponse.json({ error: "Table not found" }, { status: 404 })
	return NextResponse.json(game)
}

export async function POST(req: Request, ctx: Ctx) {
	const { code } = await ctx.params
	const game = await getGame(code)
	if (!game) return NextResponse.json({ error: "Table not found" }, { status: 404 })

	const body = (await req.json()) as Record<string, unknown>
	const action = String(body.action ?? "")
	const bad = (msg: string) => NextResponse.json({ error: msg }, { status: 400 })

	switch (action) {
		case "join": {
			const name = String(body.name ?? "").trim().slice(0, 24)
			const amount = money(body.buyIn)
			if (!name) return bad("Add your name first.")
			if (amount === null) return bad("Enter a valid buy-in amount.")
			if (game.players.some((p) => p.name.toLowerCase() === name.toLowerCase()))
				return bad("Someone at this table already uses that name.")
			const player = { id: id(), name, joinedAt: new Date().toISOString() }
			game.players.push(player)
			const entry = entryFor(game, player.id)
			if (amount > 0)
				entry.buyIns.push({ id: id(), amount, at: new Date().toISOString() })
			await putGame(game)
			return NextResponse.json({ game, playerId: player.id })
		}

		case "addBuyIn": {
			const playerId = String(body.playerId ?? "")
			const amount = money(body.amount)
			if (!game.players.some((p) => p.id === playerId))
				return bad("That player is not at the table.")
			if (amount === null || amount <= 0) return bad("Enter a valid amount.")
			const entry = entryFor(game, playerId)
			entry.buyIns.push({ id: id(), amount, at: new Date().toISOString() })
			break
		}

		case "undoBuyIn": {
			const playerId = String(body.playerId ?? "")
			const entry = entryFor(game, playerId)
			entry.buyIns.pop()
			break
		}

		case "setCashOut": {
			const playerId = String(body.playerId ?? "")
			if (body.amount === null) {
				entryFor(game, playerId).cashOut = null
				break
			}
			const amount = money(body.amount)
			if (amount === null) return bad("Enter a valid final stack.")
			entryFor(game, playerId).cashOut = amount
			break
		}

		case "closeSession": {
			const session = liveSession(game)
			if (session.entries.some((e) => e.cashOut === null))
				return bad("Every player needs a final stack before you close the night.")
			session.status = "closed"
			break
		}

		case "newSession": {
			for (const s of game.sessions) s.status = "closed"
			liveSession(game)
			break
		}

		case "recordPayment": {
			const fromId = String(body.fromId ?? "")
			const toId = String(body.toId ?? "")
			const amount = money(body.amount)
			if (fromId === toId) return bad("Pick two different players.")
			if (!game.players.some((p) => p.id === fromId) || !game.players.some((p) => p.id === toId))
				return bad("Pick who paid whom.")
			if (amount === null || amount <= 0) return bad("Enter a valid amount.")
			game.payments.push({
				id: id(),
				fromId,
				toId,
				amount,
				note: String(body.note ?? "").slice(0, 40) || undefined,
				at: new Date().toISOString(),
			})
			break
		}

		case "undoPayment": {
			const paymentId = String(body.paymentId ?? "")
			game.payments = game.payments.filter((p) => p.id !== paymentId)
			break
		}

		default:
			return bad("Unknown action.")
	}

	await putGame(game)
	return NextResponse.json({ game })
}
