"use client";

import DrawerProvider from "@/components/DrawerProvider";
import AuthGuard from "@/components/AuthGuard";
import { BluetoothProvider } from "@/contexts/BluetoothContext";
import { BranchProvider } from "@/contexts/BranchContext";
import { useParams } from "next/navigation";

interface MainLayoutProps {
	children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
	const params = useParams();
	const branchId = typeof params.branchId === "string" ? params.branchId : "";

	return (
		<AuthGuard>
			<BluetoothProvider>
				<BranchProvider initialBranchId={branchId}>
					<DrawerProvider>
						<div className='flex flex-col h-full overflow-hidden'>
							<main className='flex-1 overflow-auto bg-[var(--background)]'>
								{children}
							</main>
						</div>
					</DrawerProvider>
				</BranchProvider>
			</BluetoothProvider>
		</AuthGuard>
	);
}
