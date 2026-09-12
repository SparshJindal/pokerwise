"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { BrandBar } from "@/components/Logo"

type Recent = { code: string; name: string }

export default function Home() {
	const router = useRouter()
	const [tableName, setTableName] = useState("")
	const [joinCode, setJoinCode] = useState("")
	const [busy, setBusy] = useState<"create" | "join" | null>(null)
	const [error, setError] = useState("")
	const [recent, setRecent] = useState<Recent[]>([])

	useEffect(() => {
		try {
			const raw = localStorage.getItem("pokerwise:recent")
			if (raw) setRecent(JSON.parse(raw) as Recent[])
		} catch {}
	}, [])

	async function createTable(e: React.FormEvent) {
		e.preventDefault()
		setError("")
		setBusy("create")
		try {
			const res = await fetch("/api/games", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: tableName.trim() || "Home game" }),
			})
			const data = await res.json()
			if (!res.ok) throw new Error(data.error ?? "Could not create the table")
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
			<BrandBar />

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

				<form onSubmit={createTable}>
					<div className="field">
						<label htmlFor="tname">Table name</label>
						<input
							id="tname"
							value={tableName}
							onChange={(e) => setTableName(e.target.value)}
							placeholder="Friday night at Sparsh's"
							maxLength={40}
						/>
					</div>
					<button className="ghost" type="submit" disabled={busy !== null}>
						{busy === "create" ? "Dealing…" : "Start a new table"}
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
