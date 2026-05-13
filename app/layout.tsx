import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "@/app/globals.css";
import { DateTimeProvider } from "@/contexts/DateTimeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { TimeTrackingProvider } from "@/contexts/TimeTrackingContext";
import { BranchProvider } from "@/contexts/BranchContext";
import PWARegistration from "@/components/PWARegistration";

const poppins = Poppins({
	variable: "--font-poppins",
	subsets: ["latin"],
	weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
	title: "K-egg POS",
	description: "Ingredient-based point of sale system for K-egg",
	manifest: "/manifest.json",
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: "K-egg POS",
	},
	icons: {
		apple: "/web-app-manifest-192x192.png",
	},
};

export const viewport: Viewport = {
	themeColor: "#ffffff",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang='en'>
			<body className={`${poppins.variable} antialiased`}>
				<PWARegistration />
				<AuthProvider>
					<TimeTrackingProvider options={{ autoRefresh: true }}>
						<BranchProvider>
							<DateTimeProvider>{children}</DateTimeProvider>
						</BranchProvider>
					</TimeTrackingProvider>
				</AuthProvider>
			</body>
		</html>
	);
}
