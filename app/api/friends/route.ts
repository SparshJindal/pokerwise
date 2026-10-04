import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { addFriend, getUser, getUserByName, putUser, removeFriend } from "@/lib/store"
import type { UserProfile } from "@/lib/types"

export const dynamic = "force-dynamic"

async function getAuthUser(): Promise<UserProfile | null> {
	const cookieStore = await cookies()
	const uid = cookieStore.get("pokerwise_uid")?.value
	if (!uid) return null
	return getUser(uid)
}

export async function GET() {
	const me = await getAuthUser()
	if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

	const friends: UserProfile[] = []
	for (const fId of me.friends) {
		const f = await getUser(fId)
		if (f) friends.push(f)
	}

	return NextResponse.json({ friends })
}

export async function POST(req: Request) {
	const me = await getAuthUser()
	if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

	try {
		const body = (await req.json()) as { friendUserId?: string; friendName?: string }
		let friend: UserProfile | null = null

		if (body.friendUserId) {
			friend = await getUser(body.friendUserId)
		} else if (body.friendName) {
			friend = await getUserByName(body.friendName)
			if (!friend) {
				// If user doesn't exist yet, create a stub profile so friends can be tracked before they log in!
				const newFriend: UserProfile = {
					id: Math.random().toString(36).slice(2, 9),
					name: body.friendName.trim().slice(0, 24),
					friends: [me.id],
					createdAt: new Date().toISOString(),
				}
				await putUser(newFriend)
				friend = newFriend
			}
		}

		if (!friend) {
			return NextResponse.json({ error: "Could not find that player" }, { status: 404 })
		}

		if (friend.id === me.id) {
			return NextResponse.json({ error: "You cannot add yourself as a friend." }, { status: 400 })
		}

		await addFriend(me.id, friend.id)
		// Two-way friend relationship
		await addFriend(friend.id, me.id)

		const updatedMe = await getUser(me.id)
		const friends: UserProfile[] = []
		for (const fId of updatedMe?.friends ?? []) {
			const f = await getUser(fId)
			if (f) friends.push(f)
		}

		return NextResponse.json({ friends, added: friend })
	} catch (err) {
		return NextResponse.json({ error: (err as Error).message }, { status: 500 })
	}
}

export async function DELETE(req: Request) {
	const me = await getAuthUser()
	if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

	try {
		const body = (await req.json()) as { friendUserId?: string }
		if (!body.friendUserId) {
			return NextResponse.json({ error: "friendUserId is required" }, { status: 400 })
		}

		await removeFriend(me.id, body.friendUserId)
		return NextResponse.json({ success: true })
	} catch (err) {
		return NextResponse.json({ error: (err as Error).message }, { status: 500 })
	}
}
