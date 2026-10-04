// Tiny storage layer.
// - On Vercel: set KV_REST_API_URL + KV_REST_API_TOKEN (Upstash Redis) and data persists.
// - Locally / without env vars: falls back to an in-memory map (resets on restart).

import type { Game, UserProfile } from "./types"

const REST_URL =
	process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? ""
const REST_TOKEN =
	process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? ""

export const usingRedis = Boolean(REST_URL && REST_TOKEN)

const memory: {
	games: Map<string, Game>
	users: Map<string, UserProfile>
	usernames: Map<string, string> // lowercase name -> userId
} = (() => {
	const g = globalThis as unknown as {
		__pokerwise_store?: {
			games: Map<string, Game>
			users: Map<string, UserProfile>
			usernames: Map<string, string>
		}
	}
	if (!g.__pokerwise_store) {
		g.__pokerwise_store = {
			games: new Map<string, Game>(),
			users: new Map<string, UserProfile>(),
			usernames: new Map<string, string>(),
		}
	}
	return g.__pokerwise_store
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
const userKey = (id: string) => `pokerwise:user:${id}`
const nameKey = (name: string) => `pokerwise:uname:${name.trim().toLowerCase()}`

export async function checkStorageHealth(): Promise<{
	usingRedis: boolean
	connected: boolean
	latencyMs?: number
	message: string
}> {
	if (!usingRedis) {
		return {
			usingRedis: false,
			connected: true,
			message: "In-memory mode (tables and profiles reset on server restart). Connect Upstash Redis in Vercel Storage for permanent persistence.",
		}
	}
	try {
		const start = Date.now()
		const res = await redis(["PING"])
		const latencyMs = Date.now() - start
		if (res === "PONG" || res === "OK") {
			return {
				usingRedis: true,
				connected: true,
				latencyMs,
				message: `Connected to Upstash Redis (${latencyMs}ms response)`,
			}
		}
		return {
			usingRedis: true,
			connected: true,
			latencyMs,
			message: "Connected to Upstash Redis",
		}
	} catch (err) {
		return {
			usingRedis: true,
			connected: false,
			message: `Redis connection error: ${(err as Error).message}`,
		}
	}
}

export async function getGame(code: string): Promise<Game | null> {
	if (!usingRedis) return memory.games.get(code.toUpperCase()) ?? null
	const raw = (await redis(["GET", key(code)])) as string | null
	if (!raw) return null
	return JSON.parse(raw) as Game
}

export async function putGame(game: Game): Promise<void> {
	game.updatedAt = new Date().toISOString()
	if (!usingRedis) {
		memory.games.set(game.code, game)
		return
	}
	// Keep a table alive for a year of monthly settle-ups.
	await redis(["SET", key(game.code), JSON.stringify(game), "EX", 60 * 60 * 24 * 365])
}

export async function gameExists(code: string): Promise<boolean> {
	return (await getGame(code)) !== null
}

export async function getUser(id: string): Promise<UserProfile | null> {
	if (!usingRedis) return memory.users.get(id) ?? null
	const raw = (await redis(["GET", userKey(id)])) as string | null
	if (!raw) return null
	return JSON.parse(raw) as UserProfile
}

export async function getUserByName(name: string): Promise<UserProfile | null> {
	const cleanName = name.trim().toLowerCase()
	if (!usingRedis) {
		const id = memory.usernames.get(cleanName)
		if (!id) return null
		return memory.users.get(id) ?? null
	}
	const userId = (await redis(["GET", nameKey(cleanName)])) as string | null
	if (!userId) return null
	return getUser(userId)
}

export async function putUser(user: UserProfile): Promise<void> {
	const cleanName = user.name.trim().toLowerCase()
	if (!usingRedis) {
		memory.users.set(user.id, user)
		memory.usernames.set(cleanName, user.id)
		return
	}
	await Promise.all([
		redis(["SET", userKey(user.id), JSON.stringify(user), "EX", 60 * 60 * 24 * 365 * 2]),
		redis(["SET", nameKey(cleanName), user.id, "EX", 60 * 60 * 24 * 365 * 2]),
	])
}

export async function addFriend(userId: string, friendUserId: string): Promise<UserProfile | null> {
	if (userId === friendUserId) return null
	const user = await getUser(userId)
	if (!user) return null
	if (!user.friends.includes(friendUserId)) {
		user.friends.push(friendUserId)
		await putUser(user)
	}
	return user
}

export async function removeFriend(userId: string, friendUserId: string): Promise<UserProfile | null> {
	const user = await getUser(userId)
	if (!user) return null
	user.friends = user.friends.filter((f) => f !== friendUserId)
	await putUser(user)
	return user
}
