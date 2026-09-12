// Tiny storage layer.
// - On Vercel: set KV_REST_API_URL + KV_REST_API_TOKEN (Upstash Redis) and data persists.
// - Locally / without env vars: falls back to an in-memory map (resets on restart).

import type { Game } from "./types"

const REST_URL =
	process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? ""
const REST_TOKEN =
	process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? ""

export const usingRedis = Boolean(REST_URL && REST_TOKEN)

const memory: Map<string, Game> = (() => {
	const g = globalThis as unknown as { __pokerwise?: Map<string, Game> }
	if (!g.__pokerwise) g.__pokerwise = new Map<string, Game>()
	return g.__pokerwise
})()

async function redis(command: (string | number)[]) {
	const res = await fetch(REST_URL, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${REST_TOKEN}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(command),
		cache: "no-store",
	})
	if (!res.ok) throw new Error(`Storage error (${res.status})`)
	const json = (await res.json()) as { result: unknown }
	return json.result
}

const key = (code: string) => `pokerwise:game:${code.toUpperCase()}`

export async function getGame(code: string): Promise<Game | null> {
	if (!usingRedis) return memory.get(code.toUpperCase()) ?? null
	const raw = (await redis(["GET", key(code)])) as string | null
	if (!raw) return null
	return JSON.parse(raw) as Game
}

export async function putGame(game: Game): Promise<void> {
	game.updatedAt = new Date().toISOString()
	if (!usingRedis) {
		memory.set(game.code, game)
		return
	}
	// Keep a table alive for a year of monthly settle-ups.
	await redis(["SET", key(game.code), JSON.stringify(game), "EX", 60 * 60 * 24 * 365])
}

export async function gameExists(code: string): Promise<boolean> {
	return (await getGame(code)) !== null
}
