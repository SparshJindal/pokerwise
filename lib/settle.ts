import type { Game, Transfer } from "./types"

export const rupees = (n: number) =>
	"\u20B9" +
	Math.round(Math.abs(n)).toLocaleString("en-IN") +
	""

export const signedRupees = (n: number) =>
	(n < 0 ? "-" : "+") + rupees(n)

export function sessionTotals(game: Game, sessionId: string) {
	const session = game.sessions.find((s) => s.id === sessionId)
	if (!session) return { pot: 0, counted: 0, drift: 0 }
	let pot = 0
	let counted = 0
	for (const entry of session.entries) {
		pot += entry.buyIns.reduce((a, b) => a + b.amount, 0)
		counted += entry.cashOut ?? 0
	}
	return { pot, counted, drift: counted - pot }
}

/** Net poker result per player across every closed + live session (cash-outs only). */
export function tableNets(game: Game): Record<string, number> {
	const nets: Record<string, number> = {}
	for (const p of game.players) nets[p.id] = 0
	for (const session of game.sessions) {
		for (const entry of session.entries) {
			if (entry.cashOut === null) continue
			const spent = entry.buyIns.reduce((a, b) => a + b.amount, 0)
			nets[entry.playerId] = (nets[entry.playerId] ?? 0) + entry.cashOut - spent
		}
	}
	return nets
}

/** Nets after applying every payment already made. This is the live "tab". */
export function balances(game: Game): Record<string, number> {
	const nets = tableNets(game)
	for (const pay of game.payments) {
		// Payer hands over cash: their deficit shrinks (moves up toward zero).
		nets[pay.fromId] = (nets[pay.fromId] ?? 0) + pay.amount
		nets[pay.toId] = (nets[pay.toId] ?? 0) - pay.amount
	}
	return nets
}

/** Greedy minimum-transfer settle up: fewest possible UPI transfers. */
export function settlements(game: Game): Transfer[] {
	const bal = balances(game)
	const debtors = Object.entries(bal)
		.filter(([, v]) => v < -0.5)
		.map(([id, v]) => ({ id, amount: -v }))
		.sort((a, b) => b.amount - a.amount)
	const creditors = Object.entries(bal)
		.filter(([, v]) => v > 0.5)
		.map(([id, v]) => ({ id, amount: v }))
		.sort((a, b) => b.amount - a.amount)

	const out: Transfer[] = []
	let i = 0
	let j = 0
	while (i < debtors.length && j < creditors.length) {
		const give = Math.min(debtors[i].amount, creditors[j].amount)
		if (give > 0.5) {
			out.push({
				fromId: debtors[i].id,
				toId: creditors[j].id,
				amount: Math.round(give),
			})
		}
		debtors[i].amount -= give
		creditors[j].amount -= give
		if (debtors[i].amount <= 0.5) i++
		if (creditors[j].amount <= 0.5) j++
	}
	return out
}
