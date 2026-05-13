"use client";

import { useState, useEffect } from "react";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
	AppSettings,
	settingsService,
} from "@/services/settingsService";
import SettingsIcon from "@/components/icons/SidebarNav/SettingsIcon";
import { useBluetoothPrinter } from "@/contexts/BluetoothContext";
import ViewOnlyWrapper from "@/components/ViewOnlyWrapper";
import { useBranch } from "@/contexts/BranchContext";
import { branchService } from "@/services/branchService";

export default function SettingsScreen() {
	const { currentBranch } = useBranch();
	const [settings, setSettings] = useState<AppSettings>({
		hideOutOfStock: false,
	});
	const [savedSettings, setSavedSettings] = useState<AppSettings>({
		hideOutOfStock: false,
	});
	const [isLoading, setIsLoading] = useState(true);
	const [isSyncing, setIsSyncing] = useState(false);
	const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">("idle");
	
	const [managerPin, setManagerPin] = useState("");
	const [confirmPin, setConfirmPin] = useState("");
	const [isUpdatingPin, setIsUpdatingPin] = useState(false);
	const [pinMessage, setPinMessage] = useState({ type: "", text: "" });

	const {
		bluetoothDevice,
		bluetoothStatus,
		isConnecting,
		connectToBluetoothPrinter,
		disconnectPrinter,
		testPrint,
	} = useBluetoothPrinter();

	const hasChanges = JSON.stringify(settings) !== JSON.stringify(savedSettings);

	useEffect(() => {
		const loadSettingsData = async () => {
			try {
				const data = await settingsService.loadSettings();
				setSettings(data);
				setSavedSettings(data);
			} catch (error) {
				const local = settingsService.loadSettingsFromLocal();
				setSettings(local);
				setSavedSettings(local);
			} finally {
				setIsLoading(false);
			}
		};
		loadSettingsData();
	}, []);

	const handleSave = () => {
		settingsService.saveSettingsToLocal(settings);
		setSavedSettings(settings);
	};

	const handleSync = async () => {
		setIsSyncing(true);
		try {
			await settingsService.syncSettingsToFirebase(settings);
			setSavedSettings(settings);
			setSyncStatus("success");
			setTimeout(() => setSyncStatus("idle"), 3000);
		} catch (error) {
			setSyncStatus("error");
		} finally {
			setIsSyncing(false);
		}
	};

	const handleUpdatePin = async () => {
		if (!currentBranch) return;
		if (managerPin.length < 4) {
			setPinMessage({ type: "error", text: "PIN must be at least 4 digits." });
			return;
		}
		if (managerPin !== confirmPin) {
			setPinMessage({ type: "error", text: "PINs do not match." });
			return;
		}
		
		setIsUpdatingPin(true);
		try {
			// Using crypto API for hashing PIN
			const encoder = new TextEncoder();
			const data = encoder.encode(managerPin + currentBranch.id);
			const hashBuffer = await crypto.subtle.digest('SHA-256', data);
			const hashArray = Array.from(new Uint8Array(hashBuffer));
			const hashedPin = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

			await branchService.updateBranch(currentBranch.id, { managerPin: hashedPin });
			setPinMessage({ type: "success", text: "PIN updated successfully!" });
			setManagerPin("");
			setConfirmPin("");
			setTimeout(() => setPinMessage({ type: "", text: "" }), 3000);
		} catch (error) {
			setPinMessage({ type: "error", text: "Failed to update PIN." });
		} finally {
			setIsUpdatingPin(false);
		}
	};

	if (isLoading) return <div className="flex h-full items-center justify-center"><LoadingSpinner /></div>;

	return (
		<ViewOnlyWrapper branchId={currentBranch?.id} pageName='settings'>
			<div className='flex flex-col h-full overflow-hidden'>
				<div className='xl:hidden w-full'>
					<MobileTopBar title='Settings' icon={<SettingsIcon className="w-6 h-6" />} />
				</div>
				<div className='hidden xl:block w-full'>
					<TopBar title='Settings' icon={<SettingsIcon className="w-6 h-6" />} />
				</div>

				<div className='flex-1 overflow-y-auto p-6'>
					<div className='max-w-4xl mx-auto space-y-6'>
						{/* Preferences */}
						<div className='bg-white p-6 rounded-2xl shadow-sm border border-[var(--border)]'>
							<h3 className='text-lg font-bold mb-4'>Display Preferences</h3>
							<div className='flex items-center justify-between mb-6'>
								<div>
									<p className='font-bold text-[var(--secondary)]'>Hide Out-of-Stock</p>
									<p className='text-xs text-gray-500'>Don't show items with 0 inventory in the menu.</p>
								</div>
								<button
									onClick={() => setSettings(p => ({ ...p, hideOutOfStock: !p.hideOutOfStock }))}
									className={`w-12 h-6 rounded-full transition-all relative ${settings.hideOutOfStock ? 'bg-[var(--accent)]' : 'bg-gray-200'}`}
								>
									<div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.hideOutOfStock ? 'left-7' : 'left-1'}`} />
								</button>
							</div>
							
							<div className='border-t border-[var(--border)] pt-6 mt-6'>
								<h3 className='text-lg font-bold mb-4'>Security</h3>
								<div>
									<p className='font-bold text-[var(--secondary)] mb-1'>Manager PIN</p>
									<p className='text-xs text-gray-500 mb-4'>Set a PIN to override actions like voiding orders.</p>
									<div className='grid grid-cols-2 gap-4 max-w-sm'>
										<input 
											type="password" 
											maxLength={6}
											placeholder="New PIN (4-6 digits)"
											value={managerPin}
											onChange={(e) => setManagerPin(e.target.value.replace(/\D/g, ''))}
											className="px-4 py-2 text-sm rounded-xl border border-[var(--border)] focus:ring-2 focus:ring-[var(--accent)] outline-none" 
										/>
										<input 
											type="password" 
											maxLength={6}
											placeholder="Confirm PIN"
											value={confirmPin}
											onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
											className="px-4 py-2 text-sm rounded-xl border border-[var(--border)] focus:ring-2 focus:ring-[var(--accent)] outline-none" 
										/>
									</div>
									{pinMessage.text && (
										<p className={`text-xs mt-2 font-bold ${pinMessage.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>{pinMessage.text}</p>
									)}
									<button 
										onClick={handleUpdatePin}
										disabled={isUpdatingPin || !managerPin || !confirmPin}
										className="mt-4 px-6 py-2 bg-[var(--secondary)] text-white text-sm font-bold rounded-xl disabled:opacity-50 hover:bg-gray-800 transition-colors"
									>
										{isUpdatingPin ? 'Updating...' : 'Update PIN'}
									</button>
								</div>
							</div>
						</div>

						{/* Printer */}
						<div className='bg-white p-6 rounded-2xl shadow-sm border border-[var(--border)]'>
							<h3 className='text-lg font-bold mb-4'>Thermal Printer</h3>
							<div className='space-y-4'>
								<div className='flex items-center gap-3 p-3 bg-gray-50 rounded-xl'>
									<div className={`w-3 h-3 rounded-full ${bluetoothDevice ? 'bg-green-500' : 'bg-gray-300'}`} />
									<p className='text-sm font-bold'>{bluetoothDevice ? `Connected: ${bluetoothDevice.name}` : 'No printer connected'}</p>
								</div>
								
								<div className='flex gap-3'>
									{!bluetoothDevice ? (
										<button onClick={connectToBluetoothPrinter} disabled={isConnecting} className='flex-1 bg-[var(--accent)] text-[var(--secondary)] py-2.5 rounded-xl font-black shadow-md'>
											{isConnecting ? 'Connecting...' : 'CONNECT PRINTER'}
										</button>
									) : (
										<>
											<button onClick={testPrint} className='flex-1 bg-green-500 text-white py-2.5 rounded-xl font-black shadow-md'>TEST PRINT</button>
											<button onClick={disconnectPrinter} className='flex-1 bg-red-500 text-white py-2.5 rounded-xl font-black shadow-md'>DISCONNECT</button>
										</>
									)}
								</div>
							</div>
						</div>

						{/* Save Actions */}
						<div className='flex gap-3'>
							<button onClick={handleSave} disabled={!hasChanges} className='flex-1 bg-[var(--secondary)] text-white py-3 rounded-xl font-black shadow-md disabled:opacity-50'>SAVE LOCALLY</button>
							<button onClick={handleSync} disabled={isSyncing} className={`flex-1 py-3 rounded-xl font-black shadow-md border ${syncStatus === 'success' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-gray-200 text-[var(--secondary)]'}`}>
								{isSyncing ? 'SYNCING...' : syncStatus === 'success' ? 'SYNCED!' : 'SYNC TO CLOUD'}
							</button>
						</div>
					</div>
				</div>
			</div>
		</ViewOnlyWrapper>
	);
}
