"use client"

import { useState } from "react"
import type { UserProfile } from "@/lib/types"

export function AuthModal({
	isOpen,
	onClose,
	onSuccess,
	initialName = "",
}: {
	isOpen: boolean
	onClose?: () => void
	onSuccess: (user: UserProfile) => void
	initialName?: string
}) {
	const [name, setName] = useState(initialName)
	const [pin, setPin] = useState("")
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState("")

	if (!isOpen) return null

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
			if (onClose) onClose()
		} catch (err) {
			setError((err as Error).message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="modal-backdrop">
			<div className="card modal-content" role="dialog" aria-modal="true">
				<div style={{ textAlign: "center", marginBottom: 16 }}>
					<span style={{ fontSize: 32 }} aria-hidden="true">♠</span>
					<h2 style={{ fontSize: 22, marginTop: 4 }}>Welcome to PokerWise</h2>
					<p className="sub" style={{ marginBottom: 0 }}>
						Set your player name once. PokerWise will remember you across all tables and devices.
					</p>
				</div>

				{error ? <div className="err" style={{ marginBottom: 14 }}>{error}</div> : null}

				<form onSubmit={handleSubmit}>
					<div className="field">
						<label htmlFor="auth-name">Your Player Name</label>
						<input
							id="auth-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g. Sparsh"
							maxLength={24}
							autoFocus
							autoCapitalize="words"
							autoComplete="name"
						/>
					</div>

					<div className="field">
						<label htmlFor="auth-pin">4-Digit PIN <span style={{ color: "var(--ink-soft)", fontWeight: "normal" }}>(Optional lock)</span></label>
						<input
							id="auth-pin"
							type="password"
							inputMode="numeric"
							value={pin}
							onChange={(e) => setPin(e.target.value.slice(0, 6))}
							placeholder="e.g. 1234"
							maxLength={6}
						/>
						<span style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 4, display: "block" }}>
							If you set a PIN, you’ll be asked for it when logging in on new devices.
						</span>
					</div>

					<div style={{ display: "flex", gap: 8, marginTop: 18 }}>
						{onClose ? (
							<button type="button" className="ghost" onClick={onClose} style={{ flex: 1 }}>
								Cancel
							</button>
						) : null}
						<button type="submit" className="primary" disabled={busy} style={{ flex: 2 }}>
							{busy ? "Saving…" : "Save & Continue"}
						</button>
					</div>
				</form>
			</div>
		</div>
	)
}
