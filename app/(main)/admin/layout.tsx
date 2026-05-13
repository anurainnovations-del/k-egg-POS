"use client";
import AuthGuard from "@/components/AuthGuard";
import { BluetoothProvider } from "@/contexts/BluetoothContext";
import { BranchProvider } from "@/contexts/BranchContext";
import DrawerProvider from "@/components/DrawerProvider";

interface AdminLayoutProps {
	children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
	return (
		<AuthGuard adminOnly>
			<BluetoothProvider>
				<BranchProvider>
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
