export function Logo({ size = 38 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 48 48"
			role="img"
			aria-label="PokerWise logo"
		>
			<rect x="3" y="3" width="42" height="42" rx="12" fill="#2F6B52" />
			<rect
				x="3.75"
				y="3.75"
				width="40.5"
				height="40.5"
				rx="11.25"
				fill="none"
				stroke="#D7A13B"
				strokeWidth="1.5"
			/>
			{/* chip ring */}
			<circle
				cx="24"
				cy="24"
				r="12.5"
				fill="none"
				stroke="rgba(255,255,255,0.35)"
				strokeWidth="2"
				strokeDasharray="4.4 4.4"
			/>
			{/* spade */}
			<path
				d="M24 12.4c3.6 3.4 7.7 6.4 7.7 10.5 0 2.6-2 4.5-4.4 4.5-1.1 0-2-.35-2.6-.95.15 2.1.9 3.6 2.1 4.75h-5.6c1.2-1.15 1.95-2.65 2.1-4.75-.6.6-1.5.95-2.6.95-2.4 0-4.4-1.9-4.4-4.5 0-4.1 4.1-7.1 7.7-10.5z"
				fill="#FBF7F1"
			/>
			<circle cx="31.6" cy="16.4" r="1.7" fill="#D7A13B" />
		</svg>
	)
}

export function BrandBar({ tagline = "Poker ledger · settle later" }) {
	return (
		<div className="brandbar">
			<Logo />
			<div>
				<h1>
					Poker<em style={{ fontStyle: "italic", color: "#2F6B52" }}>Wise</em>
				</h1>
				<span>{tagline}</span>
			</div>
		</div>
	)
}
