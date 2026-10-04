"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { BrandBar } from "@/components/Logo"
import { AuthModal } from "@/components/AuthModal"
import type { UserProfile } from "@/lib/types"

type Recent = { code: string; name: string }

export default function Home() {
	const router = useRouter()
	const [user, setUser] = useState<UserProfile | null>(null)
	const [showAuthModal, setShowAuthModal] = useState(false)
	const [friends, setFriends] = useState<UserProfile[]>([])
	const [selectedFriends, setSelectedFriends] = useState<string[]>([])
	const [newFriendName, setNewFriendName] = useState("")

	const [tableName, setTableName] = useState("")
	const [joinCode, setJoinCode] = useState("")
	const [busy, setBusy] = useState<"create" | "join" | "friend" | null>(null)
	const [error, setError] = useState("")
	const [recent, setRecent] = useState<Recent[]>([])

	const loadUserAndFriends = useCallback(async () => {
		try {
			const res = await fetch("/api/auth")
			const data = await res.json()
			if (data.user) {
				setUser(data.user)
				const fRes = await fetch("/api/friends")
				const fData = await fRes.json()
				if (Array.isArray(fData.friends)) {
					setFriends(fData.friends)
				}
			}
		} catch {}
	}, [])

	useEffect(() => {
		loadUserAndFriends()
		try {
			const raw = localStorage.getItem("pokerwise:recent")
			if (raw) setRecent(JSON.parse(raw) as Recent[])
		} catch {}
	}, [loadUserAndFriends])

	async function handleAddFriend(e: React.FormEvent) {
		e.preventDefault()
		if (!newFriendName.trim()) return
		if (!user) {
			setShowAuthModal(true)
			return
		}
		setBusy("friend")
		setError("")
		try {
			const res = await fetch("/api/friends", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ friendName: newFriendName.trim() }),
			})
			const data = await res.json()
			if (!res.ok) throw new Error(data.error ?? "Could not add friend")
			setFriends(data.friends ?? [])
			setNewFriendName("")
		} catch (err) {
			setError((err as Error).message)
		} finally {
			setBusy(null)
		}
	}

	async function handleRemoveFriend(friendUserId: string) {
		try {
			await fetch("/api/friends", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ friendUserId }),
			})
			setFriends((prev) => prev.filter((f) => f.id !== friendUserId))
			setSelectedFriends((prev) => prev.filter((id) => id !== friendUserId))
		} catch {}
	}

	function toggleFriendSelection(friendId: string) {
		setSelectedFriends((prev) =>
			prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
		)
	}

	async function createTable(e: React.FormEvent) {
		e.preventDefault()
		setError("")
		setBusy("create")
		try {
			const initialPlayers: { name: string; userId?: string; buyIn: number }[] = []

			// If user is logged in, seat them automatically
			if (user) {
				initialPlayers.push({
					name: user.name,
					userId: user.id,
					buyIn: 500,
				})
			}

			// Include selected friends
			for (const fId of selectedFriends) {
				const friend = friends.find((f) => f.id === fId)
				if (friend) {
					initialPlayers.push({
						name: friend.name,
						userId: friend.id,
						buyIn: 500,
					})
				}
			}

			const res = await fetch("/api/games", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: tableName.trim() || (user ? `${user.name}’s game` : "Home game"),
					initialPlayers,
				}),
			})
			const data = await res.json()
			if (!res.ok) throw new Error(data.error ?? "Could not create the table")

			// If creator was seated, link meId in localStorage
			if (user && data.players?.length > 0) {
				const mePlayer = data.players.find((p: { userId?: string }) => p.userId === user.id)
				if (mePlayer) {
					localStorage.setItem(`pokerwise:me:${data.code}`, mePlayer.id)
				}
			}

			router.push(`/game/${data.code}`)
		} catch (err) {
			setError((err as Error).message)
			setBusy(null)
		}
	}

	async function joinTable(e: React.FormEvent) {
		e.preventDefault()
		setError("")
		const code = joinCode.trim().toUpperCase()
		if (code.length < 4) {
			setError("Game codes are 5 characters, like 4K9QP.")
			return
		}
		setBusy("join")
		try {
			const res = await fetch(`/api/games/${code}`, { cache: "no-store" })
			if (res.status === 404) throw new Error("No table with that code.")
			if (!res.ok) throw new Error("Could not reach that table.")
			router.push(`/game/${code}`)
		} catch (err) {
			setError((err as Error).message)
			setBusy(null)
		}
	}

	return (
		<main className="wrap">
			<BrandBar
				user={user}
				onOpenAuth={() => setShowAuthModal(true)}
			/>

			<AuthModal
				isOpen={showAuthModal}
				onClose={() => setShowAuthModal(false)}
				initialName={user?.name || ""}
				onSuccess={(u) => {
					setUser(u)
					loadUserAndFriends()
				}}
			/>

			<section className="card hero">
				<span className="suit" aria-hidden="true">
					♠
				</span>
				<h2 className="serif">Split the night, settle at the end of the month.</h2>
				<p>
					Log every buy-in as it happens, punch in final stacks, and PokerWise
					keeps a running tab in rupees until everyone pays up.
				</p>
			</section>

			{error ? <div className="err">{error}</div> : null}

			{/* Join a table */}
			<section className="card">
				<h2>Join a table</h2>
				<p className="sub">Got a code from the host? Drop it in.</p>
				<form onSubmit={joinTable}>
					<div className="field">
						<label htmlFor="code">Game code</label>
						<input
							id="code"
							className="code"
							value={joinCode}
							onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
							placeholder="4K9QP"
							maxLength={5}
							autoCapitalize="characters"
							autoComplete="off"
							inputMode="text"
						/>
					</div>
					<button className="primary" type="submit" disabled={busy !== null}>
						{busy === "join" ? "Taking a seat…" : "Take a seat"}
					</button>
				</form>

				<div className="divider">or host it</div>

				{/* Start a new table */}
				<form onSubmit={createTable}>
					<div className="field">
						<label htmlFor="tname">Table name</label>
						<input
							id="tname"
							value={tableName}
							onChange={(e) => setTableName(e.target.value)}
							placeholder={user ? `${user.name}’s game` : "Friday night game"}
							maxLength={40}
						/>
					</div>

					{/* Quick seat friends if available */}
					{friends.length > 0 ? (
						<div style={{ marginBottom: 14 }}>
							<label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)" }}>
								Quick seat friends (optional)
							</label>
							<div className="chips-row">
								{friends.map((f) => {
									const isSelected = selectedFriends.includes(f.id)
									return (
										<button
											key={f.id}
											type="button"
											className="chip-btn"
											onClick={() => toggleFriendSelection(f.id)}
											style={{
												background: isSelected ? "var(--felt)" : "var(--card)",
												color: isSelected ? "#ffffff" : "var(--ink)",
												borderColor: isSelected ? "var(--felt)" : "var(--line)",
											}}
										>
											{isSelected ? "✓ " : "+ "}
											{f.name}
										</button>
									)
								})}
							</div>
						</div>
					) : null}

					<button className="ghost" type="submit" disabled={busy !== null}>
						{busy === "create" ? "Dealing…" : "Start a new table"}
					</button>
				</form>
			</section>

			{/* Poker Crew (Friends) Management Card */}
			<section className="card">
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
					<h2>Your Poker Crew</h2>
					{!user ? (
						<button
							type="button"
							className="ghost tiny"
							onClick={() => setShowAuthModal(true)}
						>
							Set your name
						</button>
					) : null}
				</div>
				<p className="sub">
					Friends you play with regularly. Add them once and quick-seat them at any table.
				</p>

				{friends.length === 0 ? (
					<div style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 12 }}>
						{user
							? "No friends added yet. Type a friend's name below to save them to your crew."
							: "Log in above to save and manage your poker crew across tables."}
					</div>
				) : (
					<div style={{ marginBottom: 12 }}>
						{friends.map((f) => (
							<div key={f.id} className="friend-item">
								<span className="friend-tag">
									<span
										className="user-avatar"
										style={{ backgroundColor: f.avatarColor || "var(--felt)" }}
									>
										{f.name.slice(0, 1).toUpperCase()}
									</span>
									{f.name}
								</span>
								<button
									type="button"
									className="add-friend-btn"
									onClick={() => handleRemoveFriend(f.id)}
									style={{ color: "var(--rose)", fontSize: 12 }}
									title="Remove from crew"
								>
									Remove
								</button>
							</div>
						))}
					</div>
				)}

				<form onSubmit={handleAddFriend} style={{ display: "flex", gap: 8 }}>
					<input
						value={newFriendName}
						onChange={(e) => setNewFriendName(e.target.value)}
						placeholder="Friend's name (e.g. Rahul)"
						maxLength={24}
						style={{ flex: 1 }}
					/>
					<button
						type="submit"
						className="ghost"
						disabled={busy === "friend" || !newFriendName.trim()}
						style={{ whiteSpace: "nowrap" }}
					>
						+ Add to crew
					</button>
				</form>
			</section>

			{recent.length > 0 ? (
				<section className="card">
					<h2>Your tables</h2>
					<p className="sub">Back to a game you were already in.</p>
					<ul className="history">
						{recent.map((r) => (
							<li key={r.code}>
								<a href={`/game/${r.code}`}>{r.name}</a>
								<span className="num">{r.code}</span>
							</li>
						))}
					</ul>
				</section>
			) : null}

			<footer className="foot">Play nice. Pay up. ♥ ♦ ♣ ♠</footer>
		</main>
	)
}
