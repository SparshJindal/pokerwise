import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getUser, getUserByName, putUser } from "@/lib/store"
import type { UserProfile } from "@/lib/types"

export const dynamic = "force-dynamic"

const id = () => Math.random().toString(36).slice(2, 9)

const COLORS = ["#2F6B52", "#D7A13B", "#C85F6A", "#3B6978", "#845EC2", "#D65DB1", "#4B778D"]

export async function GET() {
	const cookieStore = await cookies()
	const uid = cookieStore.get("pokerwise_uid")?.value
	if (!uid) {
		return NextResponse.json({ user: null })
	}
	const user = await getUser(uid)
	return NextResponse.json({ user: user ?? null })
}

export async function POST(req: Request) {
	try {
		const body = (await req.json()) as { name?: string; pin?: string }
		const rawName = String(body.name ?? "").trim()
		if (!rawName || rawName.length < 2) {
			return NextResponse.json({ error: "Please enter a valid name (at least 2 letters)." }, { status: 400 })
		}
		const name = rawName.slice(0, 24)
		const pin = body.pin ? String(body.pin).trim() : undefined

		const existing = await getUserByName(name)
		if (existing) {
			if (existing.pin && existing.pin !== pin) {
				return NextResponse.json({ error: "Incorrect 4-digit PIN for this profile." }, { status: 401 })
			}
			const res = NextResponse.json({ user: existing, created: false })
			res.cookies.set("pokerwise_uid", existing.id, {
				path: "/",
				maxAge: 60 * 60 * 24 * 365,
				sameSite: "lax",
				httpOnly: false, // allow client-side hydration check
			})
			return res
		}

		// Create new profile
		const newUser: UserProfile = {
			id: id(),
			name,
			pin: pin || undefined,
			avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)],
			friends: [],
			createdAt: new Date().toISOString(),
		}

		await putUser(newUser)

		const res = NextResponse.json({ user: newUser, created: true })
		res.cookies.set("pokerwise_uid", newUser.id, {
			path: "/",
			maxAge: 60 * 60 * 24 * 365,
			sameSite: "lax",
			httpOnly: false,
		})
		return res
	} catch (err) {
		return NextResponse.json({ error: (err as Error).message }, { status: 500 })
	}
}

export async function DELETE() {
	const res = NextResponse.json({ success: true })
	res.cookies.set("pokerwise_uid", "", {
		path: "/",
		maxAge: 0,
	})
	return res
}
