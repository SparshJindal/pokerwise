"use client"

import { useState } from "react"
import { Logo } from "@/components/Logo"
import type { UserProfile } from "@/lib/types"

export function SignUpScreen({
	onSuccess,
}: {
	onSuccess: (user: UserProfile) => void
}) {
	const [name, setName] = useState("")
	const [pin, setPin] = useState("")
	const [showPin, setShowPin] = useState(false)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState("")

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		const cleanName = name.trim()
		if (cleanName.length < 2) {
			setError("Please enter your name (at least 2 letters).")
			return
		}
		setError("")
		setBusy(true)
		try {
			const res = await fetch("/api/auth", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: cleanName, pin: pin.trim() || undefined }),
			})
			const data = await res.json()
			if (!res.ok) throw new Error(data.error ?? "Failed to sign in")
			onSuccess(data.user)
		} catch (err) {
			setError((err as Error).message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="signup-wrapper">
			<div className="card signup-card">
				<div className="signup-header">
					<div className="signup-logo-badge">
						<Logo size={46} />
					</div>
					<h1 className="serif signup-title">
						Poker<em style={{ fontStyle: "italic", color: "var(--felt)" }}>Wise</em>
					</h1>
					<p className="signup-tagline">
						Split the night. Settle up at the end of the month.
					</p>
				</div>

				<div className="signup-body">
					<div className="signup-intro">
						<h2>What should we call you?</h2>
						<p>Enter your player name once. You will be automatically seated at all your poker tables.</p>
					</div>

					{error ? <div className="err">{error}</div> : null}

					<form onSubmit={handleSubmit}>
						<div className="field">
							<label htmlFor="poker-name">Your Player Name</label>
							<input
								id="poker-name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="e.g. Sparsh"
								maxLength={24}
								autoFocus
								autoCapitalize="words"
								autoComplete="name"
								style={{ fontSize: 18, padding: "12px 14px", height: 48 }}
							/>
						</div>

						{!showPin ? (
							<button
								type="button"
								className="ghost tiny"
								style={{ marginBottom: 16, color: "var(--ink-soft)" }}
								onClick={() => setShowPin(true)}
							>
								+ Add optional 4-digit PIN lock
							</button>
						) : (
							<div className="field" style={{ animation: "popIn 0.15s ease" }}>
								<label htmlFor="poker-pin">
									4-Digit PIN <span style={{ fontWeight: "normal", color: "var(--ink-soft)" }}>(optional)</span>
								</label>
								<input
									id="poker-pin"
									type="password"
									inputMode="numeric"
									value={pin}
									onChange={(e) => setPin(e.target.value.slice(0, 6))}
									placeholder="e.g. 1234"
									maxLength={6}
									style={{ fontSize: 16, padding: "10px 14px" }}
								/>
								<span style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 4, display: "block" }}>
									Locks your profile so only you can use this name on new devices.
								</span>
							</div>
						)}

						<button
							type="submit"
							className="primary"
							disabled={busy || !name.trim()}
							style={{
								width: "100%",
								height: 50,
								fontSize: 17,
								fontWeight: 700,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								gap: 8,
							}}
						>
							{busy ? "Dealing you in…" : "Enter PokerWise ♠"}
						</button>
					</form>
				</div>

				<div className="signup-features">
					<div className="feature-item">
						<span className="feature-icon">⚡</span>
						<span>Instant 1-Tap Re-Buys</span>
					</div>
					<div className="feature-item">
						<span className="feature-icon">👥</span>
						<span>Saved Poker Crew</span>
					</div>
					<div className="feature-item">
						<span className="feature-icon">💸</span>
						<span>Fewest UPI Transfers</span>
					</div>
				</div>
			</div>
		</div>
	)
}
