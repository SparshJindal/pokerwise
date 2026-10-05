"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { BrandBar, Logo } from "@/components/Logo"
import { AuthModal } from "@/components/AuthModal"
import { SignUpScreen } from "@/components/SignUpScreen"
import type { UserProfile } from "@/lib/types"

type Recent = { code: string; name: string }

const BUYIN_PRESETS = [0, 100, 200, 500, 1000]

export default function Home() {
	const router = useRouter()
	const [loadingAuth, setLoadingAuth] = useState(true)
	const [user, setUser] = useState<UserProfile | null>(null)
	const [showAuthModal, setShowAuthModal] = useState(false)
	const [friends, setFriends] = useState<UserProfile[]>([])
	const [selectedFriends, setSelectedFriends] = useState<string[]>([])
	const [newFriendName, setNewFriendName] = useState("")

	const [activeAction, setActiveAction] = useState<"host" | "join" | null>("host")
	const [tableName, setTableName] = useState("")
	const [buyIn, setBuyIn] = useState<number>(500)
	const [customBuyIn, setCustomBuyIn] = useState<string>("")
	const [isCustomBuyIn, setIsCustomBuyIn] = useState(false)

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
			} else {
				setUser(null)
			}
		} catch {
			setUser(null)
		} finally {
			setLoadingAuth(false)
		}
	}, [])

	useEffect(() => {
		loadUserAndFriends()
		try {
			const raw = localStorage.getItem("pokerwise:recent")
			if (raw) setRecent(JSON.parse(raw) as Recent[])
		} catch {}
	}, [loadUserAndFriends])

	async function handleSignOut() {
		try {
			await fetch("/api/auth", { method: "DELETE" })
			setUser(null)
			setFriends([])
			setSelectedFriends([])
		} catch {}
	}

	async function handleAddFriend(e: React.FormEvent) {
		e.preventDefault()
		const name = newFriendName.trim()
		if (!name) return
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
				body: JSON.stringify({ friendName: name }),
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

	function handleBuyInPreset(amt: number) {
		setIsCustomBuyIn(false)
		setCustomBuyIn("")
		setBuyIn(amt)
	}

	function handleCustomBuyInChange(val: string) {
		setCustomBuyIn(val)
		const cleaned = val.replace(/\D/g, "")
		if (cleaned === "") {
			setBuyIn(0)
		} else {
			const parsed = parseInt(cleaned, 10)
			if (!isNaN(parsed) && parsed >= 0) {
				setBuyIn(parsed)
			}
		}
	}

	const effectiveBuyIn = isCustomBuyIn
		? (customBuyIn.trim() === "" ? 0 : Math.max(0, parseInt(customBuyIn, 10) || 0))
		: Math.max(0, buyIn)

	async function createTable(e: React.FormEvent) {
		e.preventDefault()
		setError("")
		setBusy("create")
		try {
			const initialPlayers: { name: string; userId?: string; buyIn: number }[] = []

			if (user) {
				initialPlayers.push({
					name: user.name,
					userId: user.id,
					buyIn: effectiveBuyIn,
				})
			}

			// Include selected friends with same default buyIn
			for (const fId of selectedFriends) {
				const friend = friends.find((f) => f.id === fId)
				if (friend) {
					initialPlayers.push({
						name: friend.name,
						userId: friend.id,
						buyIn: effectiveBuyIn,
					})
				}
			}

			const defaultName = user ? `${user.name}’s Poker Night` : "Home Game"
			const res = await fetch("/api/games", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: tableName.trim() || defaultName,
					initialPlayers,
				}),
			})
			const data = await res.json()
			if (!res.ok) throw new Error(data.error ?? "Could not create the table")

			// Seat creator in localStorage
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
			if (res.status === 404) throw new Error("No table found with code " + code)
			if (!res.ok) throw new Error("Could not reach that table.")
			router.push(`/game/${code}`)
		} catch (err) {
			setError((err as Error).message)
			setBusy(null)
		}
	}

	// 1. Initial Auth Loading State
	if (loadingAuth) {
		return (
			<div className="auth-loading-screen">
				<Logo size={52} />
				<div className="auth-loading-spinner" />
				<p style={{ fontSize: 15, fontWeight: 500 }}>Dealing your hand…</p>
			</div>
		)
	}

	// 2. Strict Sign-Up Gate: If not logged in, show ONLY the Sign-Up screen
	if (!user) {
		return (
			<SignUpScreen
				onSuccess={(newUser) => {
					setUser(newUser)
					loadUserAndFriends()
				}}
			/>
		)
	}

	// 3. Authenticated Dashboard: Clear UX with prominent Action Cards
	return (
		<main className="wrap">
			<BrandBar
				user={user}
				onOpenAuth={() => setShowAuthModal(true)}
			/>

			<AuthModal
				isOpen={showAuthModal}
				onClose={() => setShowAuthModal(false)}
				initialName={user.name}
				onSuccess={(u) => {
					setUser(u)
					loadUserAndFriends()
				}}
				onSignOut={handleSignOut}
			/>

			{/* Welcome Greeting */}
			<section className="user-greeting">
				<h1 className="serif">
					Hey, {user.name} <span style={{ color: "var(--felt)" }}>♠</span>
				</h1>
				<p>Ready to play? Choose to host a new game or join a friend&apos;s table.</p>
			</section>

			{error ? <div className="err">{error}</div> : null}

			{/* Primary Action Cards: Host vs Join */}
			<section className="action-grid" aria-label="Game Actions">
				{/* Host Card */}
				<button
					type="button"
					className={`action-card host ${activeAction === "host" ? "active" : ""}`}
					onClick={() => setActiveAction(activeAction === "host" ? null : "host")}
				>
					<div>
						<div className="action-card-header">
							<span className="action-icon">♠</span>
							<h2 className="action-title" style={{ color: "#ffffff" }}>
								Host a Table
							</h2>
						</div>
						<p className="action-desc" style={{ color: "rgba(255, 255, 255, 0.85)" }}>
							Start a fresh game night, set any buy-in (or ₹0), and auto-seat your crew.
						</p>
					</div>
					<div className="action-btn-pill">
						{activeAction === "host" ? "▲ Close Setup" : "+ Host Table"}
					</div>
				</button>

				{/* Join Card */}
				<button
					type="button"
					className={`action-card join ${activeAction === "join" ? "active" : ""}`}
					onClick={() => setActiveAction(activeAction === "join" ? null : "join")}
				>
					<div>
						<div className="action-card-header">
							<span className="action-icon">🎟</span>
							<h2 className="action-title">Join with Code</h2>
						</div>
						<p className="action-desc">
							Have a 5-letter code from your host? Enter it here to take your seat immediately.
						</p>
					</div>
					<div className="action-btn-pill">
						{activeAction === "join" ? "▲ Close Input" : "Enter Code →"}
					</div>
				</button>
			</section>

			{/* Expandable Setup Drawer: Host Form */}
			{activeAction === "host" ? (
				<section className="action-drawer">
					<div className="action-drawer-header">
						<h3>
							<span style={{ color: "var(--felt)" }}>♠</span>
							Host a New Table
						</h3>
						<button
							type="button"
							className="ghost tiny"
							onClick={() => setActiveAction(null)}
						>
							✕
						</button>
					</div>

					<form onSubmit={createTable}>
						<div className="field">
							<label htmlFor="tname">Table Name</label>
							<input
								id="tname"
								value={tableName}
								onChange={(e) => setTableName(e.target.value)}
								placeholder={`${user.name}’s Poker Night`}
								maxLength={40}
								autoFocus
							/>
						</div>

						<div className="field">
							<label>Starting Buy-In per Player</label>
							<div className="preset-group">
								{BUYIN_PRESETS.map((amt) => (
									<button
										key={amt}
										type="button"
										className={`preset-btn ${!isCustomBuyIn && buyIn === amt ? "selected" : ""}`}
										onClick={() => handleBuyInPreset(amt)}
									>
										{amt === 0 ? "₹0 (Free / Open)" : `₹${amt.toLocaleString("en-IN")}`}
									</button>
								))}
								<button
									type="button"
									className={`preset-btn ${isCustomBuyIn ? "selected" : ""}`}
									onClick={() => setIsCustomBuyIn(true)}
								>
									Custom
								</button>
							</div>

							{isCustomBuyIn ? (
								<div style={{ marginTop: 8 }}>
									<input
										type="number"
										value={customBuyIn}
										onChange={(e) => handleCustomBuyInChange(e.target.value)}
										placeholder="e.g. 0, 50, 300"
										min={0}
										autoFocus
										style={{ maxWidth: 160 }}
									/>
									<span style={{ fontSize: 12, color: "var(--ink-soft)", marginLeft: 8 }}>
										₹ per player {effectiveBuyIn === 0 ? "(Free / ₹0)" : ""}
									</span>
								</div>
							) : null}
						</div>

						{/* Quick Seat Friends */}
						{friends.length > 0 ? (
							<div style={{ marginBottom: 18 }}>
								<label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: 6 }}>
									Quick-Seat Friends from Crew <span style={{ fontWeight: 400 }}>(Optional)</span>
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
								<span style={{ fontSize: 12, color: "var(--ink-soft)", display: "block", marginTop: 4 }}>
									{effectiveBuyIn > 0
										? `Selected friends will be seated with ₹${effectiveBuyIn.toLocaleString("en-IN")} initial buy-in.`
										: "Selected friends will be seated with ₹0 buy-in (free / open tab)."}
								</span>
							</div>
						) : null}

						<button
							className="primary"
							type="submit"
							disabled={busy !== null}
							style={{ width: "100%", height: 48, fontSize: 16, fontWeight: 700 }}
						>
							{busy === "create" ? "Dealing Cards…" : "Deal the Table ♠"}
						</button>
					</form>
				</section>
			) : null}

			{/* Expandable Setup Drawer: Join Form */}
			{activeAction === "join" ? (
				<section className="action-drawer">
					<div className="action-drawer-header">
						<h3>
							<span>🎟</span>
							Enter Table Code
						</h3>
						<button
							type="button"
							className="ghost tiny"
							onClick={() => setActiveAction(null)}
						>
							✕
						</button>
					</div>

					<form onSubmit={joinTable}>
						<div className="field">
							<label htmlFor="join-code">5-Character Game Code</label>
							<input
								id="join-code"
								className="code"
								value={joinCode}
								onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
								placeholder="4K9QP"
								maxLength={5}
								autoCapitalize="characters"
								autoComplete="off"
								inputMode="text"
								autoFocus
								style={{ fontSize: 24, textAlign: "center", letterSpacing: "0.2em", height: 54 }}
							/>
						</div>
						<button
							className="primary"
							type="submit"
							disabled={busy !== null || joinCode.trim().length < 4}
							style={{ width: "100%", height: 48, fontSize: 16, fontWeight: 700 }}
						>
							{busy === "join" ? "Taking Seat…" : "Take My Seat →"}
						</button>
					</form>
				</section>
			) : null}

			{/* Recent Tables */}
			{recent.length > 0 ? (
				<section className="card" style={{ marginBottom: 18 }}>
					<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
						<h2 style={{ fontSize: 18, margin: 0 }}>Your Tables</h2>
						<span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{recent.length} recent</span>
					</div>
					<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
						{recent.map((r) => (
							<a
								key={r.code}
								href={`/game/${r.code}`}
								className="table-item"
							>
								<div>
									<div style={{ fontWeight: 600, fontSize: 15 }}>{r.name}</div>
									<div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>Tap to rejoin table</div>
								</div>
								<span className="table-code-tag">{r.code}</span>
							</a>
						))}
					</div>
				</section>
			) : null}

			{/* Poker Crew Section */}
			<section className="card" style={{ marginBottom: 18 }}>
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
					<h2 style={{ fontSize: 18, margin: 0 }}>
						Your Poker Crew
						{friends.length > 0 ? (
							<span style={{ fontSize: 13, fontWeight: "normal", color: "var(--ink-soft)", marginLeft: 6 }}>
								({friends.length})
							</span>
						) : null}
					</h2>
				</div>
				<p className="sub" style={{ marginBottom: 14 }}>
					Save friends you play with regularly. You can seat them at any table in 1 tap without asking for their codes.
				</p>

				{friends.length === 0 ? (
					<div style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 16, padding: "12px 14px", background: "var(--bg)", borderRadius: 10 }}>
						No crew members added yet. Type a friend’s name below to save them.
					</div>
				) : (
					<div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
						{friends.map((f) => (
							<div key={f.id} className="friend-item">
								<span className="friend-tag">
									<span
										className="user-avatar"
										style={{ backgroundColor: f.avatarColor || "var(--felt)" }}
									>
										{f.name.slice(0, 1).toUpperCase()}
									</span>
									<span style={{ fontWeight: 600 }}>{f.name}</span>
								</span>
								<button
									type="button"
									className="add-friend-btn"
									onClick={() => handleRemoveFriend(f.id)}
									style={{ color: "var(--rose)", fontSize: 12 }}
									title="Remove from crew"
								>
									✕ Remove
								</button>
							</div>
						))}
					</div>
				)}

				<form onSubmit={handleAddFriend} style={{ display: "flex", gap: 8 }}>
					<input
						value={newFriendName}
						onChange={(e) => setNewFriendName(e.target.value)}
						placeholder="Add friend's name (e.g. Rahul)"
						maxLength={24}
						style={{ flex: 1 }}
					/>
					<button
						type="submit"
						className="ghost"
						disabled={busy === "friend" || !newFriendName.trim()}
						style={{ whiteSpace: "nowrap" }}
					>
						+ Add to Crew
					</button>
				</form>
			</section>

			{/* How PokerWise Works Guide */}
			<section className="how-it-works-box">
				<h3>How PokerWise Works</h3>
				<div className="steps-grid">
					<div className="step-card">
						<span className="step-number">STEP 1</span>
						<h4>Seat & Buy In</h4>
						<p>Host deals the table with a starting buy-in. Share the 5-letter code or seat friends with 1 tap.</p>
					</div>
					<div className="step-card">
						<span className="step-number">STEP 2</span>
						<h4>Live Re-Buys</h4>
						<p>Whenever anyone busts or reloads, tap a quick chip or enter custom amount. The pot updates instantly.</p>
					</div>
					<div className="step-card">
						<span className="step-number">STEP 3</span>
						<h4>Settle The Tab</h4>
						<p>Count chips at the end of the night. PokerWise computes the fewest UPI payments to settle up.</p>
					</div>
				</div>
			</section>

			<footer className="foot" style={{ marginTop: 28 }}>
				Play nice. Pay up. ♥ ♦ ♣ ♠
			</footer>
		</main>
	)
}
