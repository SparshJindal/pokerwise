import type { Metadata, Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = {
	title: "PokerWise — split the night, settle later",
	description:
		"Track poker buy-ins and cash-outs in rupees, then settle up the whole month with the fewest transfers.",
	manifest: "/manifest.webmanifest",
	icons: { icon: "/icon.svg", apple: "/icon.svg" },
}

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 5,
	themeColor: "#2F6B52",
}

export default function RootLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	)
}
