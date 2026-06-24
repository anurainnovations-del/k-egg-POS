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
		printerType,
		setPrinterType,
		paperWidth,
		setPaperWidth,
		printStoreCopy,
		setPrintStoreCopy,
		isBluetoothSupported
	} = useBluetoothPrinter();

	const hasChanges = JSON.stringify(settings) !== JSON.stringify(savedSettings);

	useEffect(() => {
		const loadSettingsData = async () => {
			try {
				const data = await settingsService.loadSettings();
				setSettings(data);
				setSavedSettings(data);
			} catch {
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
		} catch {
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
		} catch {
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
									<p className='text-xs text-gray-500'>Don&apos;t show items with 0 inventory in the menu.</p>
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
							<h3 className='text-lg font-bold mb-4'>Thermal Printer Setup</h3>
							
							{/* Connection Type Tabs */}
							<div className="flex rounded-xl bg-gray-100 p-1 mb-5">
								<button
									onClick={() => setPrinterType('bluetooth')}
									className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
										printerType === 'bluetooth'
											? 'bg-white text-[var(--secondary)] shadow-sm'
											: 'text-gray-500 hover:text-[var(--secondary)]'
									}`}
								>
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
									Bluetooth Printer
								</button>
								<button
									onClick={() => setPrinterType('web_print')}
									className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
										printerType === 'web_print'
											? 'bg-white text-[var(--secondary)] shadow-sm'
											: 'text-gray-500 hover:text-[var(--secondary)]'
									}`}
								>
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
									</svg>
									Web Print / AirPrint
								</button>
							</div>

							{printerType === 'bluetooth' ? (
								<div className='space-y-4'>
									{/* iOS Warning Banner */}
									{!isBluetoothSupported && (
										<div className="mb-4 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-xl text-amber-800 text-xs">
											<div className="flex gap-2.5 items-start">
												<svg className="w-5 h-5 flex-shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
												</svg>
												<div>
													<p className="font-bold mb-1">iOS/iPadOS Browser Limitation</p>
													<p className="leading-relaxed">Apple Safari and iOS PWAs do not support Web Bluetooth. Please switch to the <strong>Web Print / AirPrint</strong> connection type above for iPad printing support!</p>
												</div>
											</div>
										</div>
									)}

									<div className='flex items-center gap-3 p-3 bg-gray-50 rounded-xl'>
										<div className={`w-3 h-3 rounded-full ${bluetoothDevice ? 'bg-green-500' : 'bg-gray-300'}`} />
										<p className='text-sm font-bold'>{bluetoothDevice ? `Connected: ${bluetoothDevice.name}` : (bluetoothStatus || 'No printer connected')}</p>
									</div>
									
									<div className='flex gap-3'>
										{!bluetoothDevice ? (
											<button 
												onClick={connectToBluetoothPrinter} 
												disabled={isConnecting || !isBluetoothSupported} 
												className='flex-1 bg-[var(--accent)] text-[var(--secondary)] py-2.5 rounded-xl font-black shadow-md disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-105 transition-all'
											>
												{isConnecting ? 'Connecting...' : 'CONNECT PRINTER'}
											</button>
										) : (
											<>
												<button onClick={testPrint} className='flex-1 bg-green-500 text-white py-2.5 rounded-xl font-black shadow-md hover:brightness-105 transition-all'>TEST PRINT</button>
												<button onClick={disconnectPrinter} className='flex-1 bg-red-500 text-white py-2.5 rounded-xl font-black shadow-md hover:brightness-105 transition-all'>DISCONNECT</button>
											</>
										)}
									</div>
								</div>
							) : (
								<div className="space-y-4">
									{/* Paper Size selector */}
									<div>
										<p className="text-xs font-bold text-gray-500 mb-2">Thermal Paper Width</p>
										<div className="flex gap-2">
											{(['58mm', '80mm'] as const).map((width) => (
												<button
													key={width}
													onClick={() => setPaperWidth(width)}
													className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all border ${
														paperWidth === width
															? 'bg-[var(--secondary)] text-white border-[var(--secondary)] shadow-sm'
															: 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
													}`}
												>
													{width} Roll
												</button>
											))}
										</div>
									</div>

									{/* Print guides */}
									<div className="p-4 bg-blue-50/50 rounded-xl text-blue-900 text-xs space-y-3 border border-blue-100/50">
										<div className="flex gap-2.5 items-start">
											<svg className="w-4.5 h-4.5 flex-shrink-0 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
											</svg>
											<div>
												<p className="font-bold mb-0.5">AirPrint / System Print</p>
												<p className="leading-relaxed text-blue-800/90">This mode triggers the native iPad print preview sheet. Connect your thermal printer to Wi-Fi/LAN and select it directly in the dialog.</p>
											</div>
										</div>
										<div className="flex gap-2.5 items-start">
											<svg className="w-4.5 h-4.5 flex-shrink-0 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
											</svg>
											<div>
												<p className="font-bold mb-0.5">Automatic Cash Drawer Kick</p>
												<p className="leading-relaxed text-blue-800/90">To open your cash drawer automatically in Web Print mode, configure your printer&apos;s internal settings (DIP switches or IP configuration page) to kick the drawer when printing.</p>
											</div>
										</div>
									</div>

									<div className='flex items-center gap-3 p-3 bg-gray-50 rounded-xl'>
										<div className="w-3 h-3 rounded-full bg-green-500" />
										<p className='text-sm font-bold'>{bluetoothStatus || 'System Print driver active - Ready'}</p>
									</div>

									<button 
										onClick={testPrint} 
										className="w-full bg-[var(--accent)] text-[var(--secondary)] py-2.5 rounded-xl font-black shadow-md hover:brightness-105 transition-all"
									>
										TEST PRINT
									</button>
								</div>
							)}

							{/* Store copy toggle (applies to both printer types) */}
							<div className='mt-5 pt-5 border-t border-[var(--border)] flex items-center justify-between gap-4'>
								<div>
									<p className='text-sm font-bold text-[var(--secondary)]'>Print store copy</p>
									<p className='text-xs text-gray-500 mt-0.5 leading-relaxed'>Print a second receipt labelled <strong>STORE COPY</strong> for your records after the customer copy.</p>
								</div>
								<button
									type='button'
									role='switch'
									aria-checked={printStoreCopy}
									onClick={() => setPrintStoreCopy(!printStoreCopy)}
									className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
										printStoreCopy ? 'bg-[var(--accent)]' : 'bg-gray-300'
									}`}
								>
									<span
										className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
											printStoreCopy ? 'translate-x-5' : 'translate-x-0.5'
										}`}
									/>
								</button>
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
