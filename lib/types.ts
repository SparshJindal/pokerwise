export type BuyIn = {
	id: string
	amount: number
	at: string
}

export type Player = {
	id: string
	name: string
	joinedAt: string
}

export type SessionEntry = {
	playerId: string
	buyIns: BuyIn[]
	/** Chips on the table when they walked away, in rupees. null until entered. */
	cashOut: number | null
}

export type Session = {
	id: string
	label: string
	date: string
	status: "live" | "closed"
	entries: SessionEntry[]
}

export type Payment = {
	id: string
	fromId: string
	toId: string
	amount: number
	note?: string
	at: string
}

export type Game = {
	code: string
	name: string
	createdAt: string
	updatedAt: string
	players: Player[]
	sessions: Session[]
	payments: Payment[]
}

export type Transfer = { fromId: string; toId: string; amount: number }
