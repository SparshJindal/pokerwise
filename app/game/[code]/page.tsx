"use client"

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BrandBar } from "@/components/Logo"
import { AuthModal } from "@/components/AuthModal"
import { balances, hasLiveUncounted, rupees, sessionTotals, settlements, tableNets } from "@/lib/settle"
import type { Game, UserProfile } from "@/lib/types"

type Tab = "night" | "tab"

export default function GamePage({
	params,
}: {
	params: Promise<{ code: string }>
}) {
	const { code: rawCode } = use(params)
	const code = rawCode.toUpperCase()

	const [game, setGame] = useState<Game | null>(null)
	const [meId, setMeId] = useState<string | null>(null)
	const [user, setUser] = useState<UserProfile | null>(null)
	const [showAuthModal, setShowAuthModal] = useState(false)
	const [friends, setFriends] = useState<UserProfile[]>([])

	const [tab, setTab] = useState<Tab>("night")
	const [error, setError] = useState("")
	const [loading, setLoading] = useState(true)
	const [copied, setCopied] = useState(false)

	// join form
	const [joinName, setJoinName] = useState("")
	const [joinBuyIn, setJoinBuyIn] = useState("")

	// per-player inputs
	const [topUp, setTopUp] = useState<Record<string, string>>({})
	const [stack, setStack] = useState<Record<string, string>>({})

	// payment form
	const [payFrom, setPayFrom] = useState("")
	const [payTo, setPayTo] = useState("")
	const [payAmount, setPayAmount] = useState("")

	const mounted = useRef(true)

	const load = useCallback(async () => {
		try {
			const res = await fetch(`/api/games/${code}`, { cache: "no-store" })
			if (!res.ok) throw new Error("This table has folded — check the code.")
			const data = (await res.json()) as Game
			if (mounted.current) setGame(data)
		} catch (err) {
			if (mounted.current) setError((err as Error).message)
		} finally {
			if (mounted.current) setLoading(false)
		}
	}, [code])

	useEffect(() => {
		mounted.current = true
		const storedMe = localStorage.getItem(`pokerwise:me:${code}`)
		if (storedMe) setMeId(storedMe)

		// Fetch logged in profile and friends
		fetch("/api/auth")
			.then((res) => res.json())
			.then((data) => {
				if (data.user) {
					setUser(data.user)
					setJoinName(data.user.name)
					fetch("/api/friends")
						.then((r) => r.json())
						.then((fData) => {
							if (Array.isArray(fData.friends)) setFriends(fData.friends)
						})
						.catch(() => {})
				}
			})
			.catch(() => {})

		void load()
		const timer = setInterval(load, 6000)
		return () => {
			mounted.current = false
			clearInterval(timer)
		}
	}, [code, load])

	useEffect(() => {
		if (!game || !user || meId) return
		const found = game.players.find(
			(p) => (p.userId && p.userId === user.id) || p.name.toLowerCase() === user.name.toLowerCase()
		)
		if (found) {
			setMeId(found.id)
			localStorage.setItem(`pokerwise:me:${code}`, found.id)
		}
	}, [game, user, meId, code])

	useEffect(() => {
		if (!game) return
		try {
			const raw = localStorage.getItem("pokerwise:recent")
			const list = (raw ? JSON.parse(raw) : []) as { code: string; name: string }[]
			const next = [
				{ code: game.code, name: game.name },
				...list.filter((r) => r.code !== game.code),
			].slice(0, 6)
			localStorage.setItem("pokerwise:recent", JSON.stringify(next))
		} catch {}
	}, [game])

	async function act(payload: Record<string, unknown>) {
		setError("")
		const res = await fetch(`/api/games/${code}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		})
		const data = await res.json()
		if (!res.ok) {
			setError(data.error ?? "Something went wrong.")
			return null
		}
		setGame(data.game as Game)
		return data as { game: Game; playerId?: string }
	}

	const live = game?.sessions.find((s) => s.status === "live") ?? null
	const nameOf = (id: string) =>
		game?.players.find((p) => p.id === id)?.name ?? "Someone"

	const tab_balances = useMemo(() => (game ? balances(game) : {}), [game])
	const nets = useMemo(() => (game ? tableNets(game) : {}), [game])
	const owes = useMemo(() => (game ? settlements(game) : []), [game])
	const totals = useMemo(
		() => (game && live ? sessionTotals(game, live.id) : { pot: 0, counted: 0, drift: 0 }),
		[game, live],
	)
	const isTabPending = useMemo(() => (game ? hasLiveUncounted(game) : false), [game])

	const unseatedFriends = useMemo(() => {
		if (!friends || friends.length === 0 || !game) return []
		return friends.filter(
			(f) =>
				!game.players.some(
					(p) =>
						(p.userId && p.userId === f.id) ||
						p.name.toLowerCase() === f.name.toLowerCase()
				)
		)
	}, [friends, game])

	async function quickSeatFriend(f: UserProfile) {
		const defaultTableBuyIn =
			game?.sessions[0]?.entries?.find((e) => e.buyIns.length > 0)?.buyIns[0]?.amount ?? 0
		await act({
			action: "quickSeatPlayer",
			name: f.name,
			userId: f.id,
			buyIn: defaultTableBuyIn,
		})
	}

	async function addFriendFromTable(name: string, friendUserId?: string) {
		try {
			const res = await fetch("/api/friends", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ friendName: name, friendUserId }),
			})
			const data = await res.json()
			if (Array.isArray(data.friends)) {
				setFriends(data.friends)
			}
		} catch {}
	}

	if (loading) {
		return (
			<main className="wrap">
				<BrandBar />
				<div className="card">
					<div className="empty">Shuffling…</div>
				</div>
			</main>
		)
	}

	if (!game) {
		return (
			<main className="wrap">
				<BrandBar />
				<div className="card">
					<div className="empty">
						<span className="big">♠</span>
						{error || "Table not found."}
					</div>
					<a href="/">
						<button className="ghost" type="button">
							Back to lobby
						</button>
					</a>
				</div>
			</main>
		)
	}

	const me = game.players.find((p) => p.id === meId) ?? null

	return (
		<main className="wrap">
			<BrandBar
				tagline={game.name}
				user={user}
				onOpenAuth={() => setShowAuthModal(true)}
			/>

			<AuthModal
				isOpen={showAuthModal}
				onClose={() => setShowAuthModal(false)}
				initialName={user?.name || ""}
				onSuccess={(u) => {
					setUser(u)
					setJoinName(u.name)
				}}
			/>

			<section className="card codecard">
				<div>
					<label style={{ marginBottom: 2 }}>Game code</label>
					<div className="value">{game.code}</div>
				</div>
				<button
					className="ghost tiny"
					type="button"
					onClick={async () => {
						try {
							await navigator.clipboard.writeText(
								`${location.origin}/game/${game.code}`,
							)
							setCopied(true)
							setTimeout(() => setCopied(false), 1800)
						} catch {}
					}}
				>
					{copied ? "Copied" : "Share link"}
				</button>
			</section>

			<div className="tabs" role="tablist">
				<button
					role="tab"
					aria-selected={tab === "night"}
					onClick={() => setTab("night")}
				>
					Tonight
				</button>
				<button
					role="tab"
					aria-selected={tab === "tab"}
					onClick={() => setTab("tab")}
				>
					The tab
				</button>
			</div>

			{error ? <div className="err">{error}</div> : null}

			{tab === "night" ? (
				<>
					{!me ? (
						<section className="card">
							<h2>Sit down</h2>
							<p className="sub">
								{user
									? `Join as ${user.name}, or change your name below.`
									: "Your name and your first buy-in."}
							</p>
							<form
								onSubmit={async (e) => {
									e.preventDefault()
									const res = await act({
										action: "join",
										name: joinName || user?.name || "Player",
										buyIn: Number(joinBuyIn || 0),
										userId: user?.id,
									})
									if (res?.playerId) {
										localStorage.setItem(`pokerwise:me:${code}`, res.playerId)
										setMeId(res.playerId)
										setJoinName("")
									}
								}}
							>
								<div className="field">
									<label htmlFor="me">Your name</label>
									<input
										id="me"
										value={joinName}
										onChange={(e) => setJoinName(e.target.value)}
										placeholder="Sparsh"
										maxLength={24}
									/>
								</div>
								<div className="field">
									<label htmlFor="bi">
										Buy-in (₹) <span style={{ fontWeight: "normal", color: "var(--ink-soft)" }}>(optional, can be 0)</span>
									</label>
									<input
										id="bi"
										value={joinBuyIn}
										onChange={(e) => setJoinBuyIn(e.target.value)}
										inputMode="numeric"
										placeholder="0"
									/>
								</div>
								<button className="primary" type="submit">
									Deal me in
								</button>
							</form>
						</section>
					) : null}

					<section className="card">
						<h2>At the table</h2>
						<p className="sub">
							Pot on the table {rupees(totals.pot)} · counted{" "}
							{rupees(totals.counted)}
							{totals.pot > 0 && totals.counted > 0 && totals.drift !== 0
								? ` · off by ${rupees(totals.drift)}`
								: ""}
						</p>

						{/* Quick-seat crew members */}
						{unseatedFriends.length > 0 ? (
							<div
								style={{
									marginBottom: 16,
									padding: "10px 12px",
									background: "var(--cream)",
									borderRadius: "var(--radius)",
									border: "1px solid var(--line)",
								}}
							>
								<label
									style={{
										fontSize: 13,
										fontWeight: 600,
										color: "var(--ink-soft)",
										display: "block",
										marginBottom: 6,
									}}
								>
									Quick-seat your poker crew:
								</label>
								<div className="chips-row">
									{unseatedFriends.map((f) => {
										const defaultTableBuyIn =
											game?.sessions[0]?.entries?.find((e) => e.buyIns.length > 0)?.buyIns[0]?.amount ?? 0
										return (
											<button
												key={f.id}
												type="button"
												className="chip-btn"
												onClick={() => quickSeatFriend(f)}
											>
												+ Seat {f.name} {defaultTableBuyIn > 0 ? `(₹${defaultTableBuyIn})` : `(₹0)`}
											</button>
										)
									})}
								</div>
							</div>
						) : null}

						{game.players.length === 0 ? (
							<div className="empty">
								<span className="big">♣</span>
								Nobody has sat down yet. Share the code {game.code}.
							</div>
						) : null}

						{game.players.map((p) => {
							const entry = live?.entries.find((e) => e.playerId === p.id)
							const spent = entry?.buyIns.reduce((a, b) => a + b.amount, 0) ?? 0
							const cashOut = entry?.cashOut ?? null
							const net = cashOut === null ? null : cashOut - spent
							const isAlreadyFriend =
								friends.some(
									(f) =>
										(p.userId && f.id === p.userId) ||
										f.name.toLowerCase() === p.name.toLowerCase()
								) || (user && user.name.toLowerCase() === p.name.toLowerCase())

							return (
								<div
									key={p.id}
									className={p.id === meId ? "player you" : "player"}
								>
									<div className="player-top">
										<div className="avatar" aria-hidden="true">
											{p.name.slice(0, 1).toUpperCase()}
										</div>
										<div className="pname">{p.name}</div>
										{p.id === meId ? <span className="chip">You</span> : null}
										{user && p.id !== meId && !isAlreadyFriend ? (
											<button
												type="button"
												className="add-friend-btn"
												onClick={() => addFriendFromTable(p.name, p.userId)}
												title="Add to your Poker Crew"
											>
												+ Add to crew
											</button>
										) : null}
									</div>

									<div className="meta">
										<span>
											Buy-ins <b className="num">{rupees(spent)}</b>{" "}
											{entry && entry.buyIns.length > 1
												? `(${entry.buyIns.length}×)`
												: ""}
										</span>
										<span>
											Final stack{" "}
											<b className="num">
												{cashOut === null ? "—" : rupees(cashOut)}
											</b>
										</span>
										{net !== null ? (
											<span className={net >= 0 ? "up num" : "down num"}>
												{net >= 0 ? "+" : "−"}
												{rupees(net)}
											</span>
										) : null}
									</div>

									<div className="actions">
										<div className="stack" style={{ flex: 1 }}>
											<div className="field">
												<label htmlFor={`t-${p.id}`}>Another buy-in</label>
												<input
													id={`t-${p.id}`}
													value={topUp[p.id] ?? ""}
													onChange={(e) =>
														setTopUp({ ...topUp, [p.id]: e.target.value })
													}
													inputMode="numeric"
													placeholder="500"
												/>
											</div>
											<button
												className="primary tiny"
												type="button"
												onClick={async () => {
													const amount = Number(topUp[p.id] ?? 0)
													if (!amount) {
														setError("Type how much they bought in for.")
														return
													}
													await act({ action: "addBuyIn", playerId: p.id, amount })
													setTopUp({ ...topUp, [p.id]: "" })
												}}
											>
												+ Add
											</button>
										</div>
									</div>

									{/* Quick-add chips */}
									<div className="chips-row" style={{ marginTop: 2, marginBottom: 10 }}>
										{[100, 200, 500, 1000, 2000].map((amt) => (
											<button
												key={amt}
												type="button"
												className="chip-btn"
												onClick={async () => {
													await act({ action: "addBuyIn", playerId: p.id, amount: amt })
												}}
												title={`Quick add ₹${amt}`}
											>
												+₹{amt.toLocaleString("en-IN")}
											</button>
										))}
									</div>

									<div className="actions">
										<div className="stack" style={{ flex: 1 }}>
											<div className="field">
												<label htmlFor={`c-${p.id}`}>Cash out at</label>
												<input
													id={`c-${p.id}`}
													value={stack[p.id] ?? (cashOut === null ? "" : String(cashOut))}
													onChange={(e) =>
														setStack({ ...stack, [p.id]: e.target.value })
													}
													inputMode="numeric"
													placeholder="0"
												/>
											</div>
											<button
												className="ghost tiny"
												type="button"
												onClick={async () => {
													const raw = stack[p.id] ?? (cashOut === null ? "" : String(cashOut))
													if (raw === "") {
														setError("Enter the chips they walked away with.")
														return
													}
													await act({
														action: "setCashOut",
														playerId: p.id,
														amount: Number(raw),
													})
												}}
											>
												Save
											</button>
										</div>
									</div>
								</div>
							)
						})}

						{game.players.length > 0 ? (
							<p className="note">
								Nobody pays tonight. Everything lands on the tab and you settle
								it whenever — end of the month works.
							</p>
						) : null}
					</section>

					{live && live.entries.length > 0 ? (
						<section className="card">
							<h2>Wrap the night</h2>
							<p className="sub">
								Close this session once every stack is in, then start a fresh
								one next time — the tab keeps adding up.
							</p>
							<div className="row">
								<button
									className="ghost"
									type="button"
									onClick={() => act({ action: "closeSession" })}
								>
									Close session
								</button>
								<button
									className="ghost"
									type="button"
									onClick={() => act({ action: "newSession" })}
								>
									New session
								</button>
							</div>
						</section>
					) : null}
				</>
			) : (
				<>
					<section className="card">
						<h2>Who owes who</h2>
						<p className="sub">
							Fewest possible transfers across every session on this table.
						</p>
						{isTabPending ? (
							<div
								className="note"
								style={{
									background: "var(--gold-soft)",
									borderColor: "var(--gold)",
									color: "#7a540b",
									marginBottom: 14,
								}}
							>
								Tonight’s game is currently live. Once final stacks are saved under “Tonight”, the tab settles automatically.
							</div>
						) : null}
						{owes.length === 0 ? (
							<div className="empty">
								<span className="big">♥</span>
								All square. Nobody owes anybody.
							</div>
						) : (
							owes.map((t, i) => (
								<div className="settle" key={i}>
									<div className="avatar" aria-hidden="true">
										{nameOf(t.fromId).slice(0, 1).toUpperCase()}
									</div>
									<div className="who">
										<b>{nameOf(t.fromId)}</b> pays <b>{nameOf(t.toId)}</b>
									</div>
									<div className="amt num down">{rupees(t.amount)}</div>
									<button
										className="ghost tiny"
										type="button"
										onClick={() =>
											act({
												action: "recordPayment",
												fromId: t.fromId,
												toId: t.toId,
												amount: t.amount,
												note: "settled in full",
											})
										}
									>
										Paid
									</button>
								</div>
							))
						)}
					</section>

					<section className="card">
						<h2>Standings</h2>
						<p className="sub">Lifetime result, then what is still unpaid.</p>
						{game.players.map((p) => {
							const net = nets[p.id] ?? 0
							const open = tab_balances[p.id] ?? 0
							return (
								<div className="settle" key={p.id}>
									<div className="avatar" aria-hidden="true">
										{p.name.slice(0, 1).toUpperCase()}
									</div>
									<div className="who">
										<b>{p.name}</b>
										<div style={{ color: "var(--ink-soft)", fontSize: 13 }}>
											{Math.round(open) === 0
												? "settled up"
												: open > 0
													? `to collect ${rupees(open)}`
													: `still owes ${rupees(open)}`}
										</div>
									</div>
									<div className={net >= 0 ? "amt num up" : "amt num down"}>
										{net >= 0 ? "+" : "−"}
										{rupees(net)}
									</div>
								</div>
							)
						})}
					</section>

					<section className="card">
						<h2>Record a part payment</h2>
						<p className="sub">
							Paid ₹200 of a ₹900 debt? Log it and the rest stays on the tab.
						</p>
						<form
							onSubmit={async (e) => {
								e.preventDefault()
								const res = await act({
									action: "recordPayment",
									fromId: payFrom,
									toId: payTo,
									amount: Number(payAmount || 0),
								})
								if (res) setPayAmount("")
							}}
						>
							<div className="field">
								<label htmlFor="from">Who paid</label>
								<select
									id="from"
									value={payFrom}
									onChange={(e) => setPayFrom(e.target.value)}
								>
									<option value="">Pick a player</option>
									{game.players.map((p) => (
										<option key={p.id} value={p.id}>
											{p.name}
										</option>
									))}
								</select>
							</div>
							<div className="field">
								<label htmlFor="to">Paid to</label>
								<select
									id="to"
									value={payTo}
									onChange={(e) => setPayTo(e.target.value)}
								>
									<option value="">Pick a player</option>
									{game.players.map((p) => (
										<option key={p.id} value={p.id}>
											{p.name}
										</option>
									))}
								</select>
							</div>
							<div className="field">
								<label htmlFor="amt">Amount (₹)</label>
								<input
									id="amt"
									value={payAmount}
									onChange={(e) => setPayAmount(e.target.value)}
									inputMode="numeric"
									placeholder="200"
								/>
							</div>
							<button className="primary" type="submit">
								Log payment
							</button>
						</form>

						{game.payments.length > 0 ? (
							<>
								<div className="divider">Paid so far</div>
								<ul className="history">
									{[...game.payments].reverse().map((pay) => (
										<li key={pay.id}>
											<span>
												{nameOf(pay.fromId)} → {nameOf(pay.toId)}
											</span>
											<span className="num">
												{rupees(pay.amount)}{" "}
												<button
													className="ghost tiny"
													type="button"
													style={{ minHeight: 28, marginLeft: 8, padding: "0 8px" }}
													onClick={() =>
														act({ action: "undoPayment", paymentId: pay.id })
													}
												>
													Undo
												</button>
											</span>
										</li>
									))}
								</ul>
							</>
						) : null}
					</section>

					<section className="card">
						<h2>Sessions</h2>
						<ul className="history">
							{game.sessions.map((s) => {
								const t = sessionTotals(game, s.id)
								return (
									<li key={s.id}>
										<span>
											{s.label} · {s.entries.length} players{" "}
											{s.status === "live" ? "· live" : ""}
										</span>
										<span className="num">{rupees(t.pot)} pot</span>
									</li>
								)
							})}
						</ul>
					</section>
				</>
			)}

			<footer className="foot">
				<a href="/">← All tables</a>
			</footer>
		</main>
	)
}
