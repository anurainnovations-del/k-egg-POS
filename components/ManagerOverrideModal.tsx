"use client";

import { useState } from "react";
import { useBranch } from "@/contexts/BranchContext";
import { AnimatePresence, motion } from "motion/react";

interface ManagerOverrideModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	actionName: string;
	description?: string;
}

export default function ManagerOverrideModal({
	isOpen,
	onClose,
	onSuccess,
	actionName,
	description,
}: ManagerOverrideModalProps) {
	const { currentBranch } = useBranch();
	const [pinInput, setPinInput] = useState("");
	const [error, setError] = useState("");
	const [isVerifying, setIsVerifying] = useState(false);

	const handleVerify = async () => {
		if (!currentBranch) return;

		setIsVerifying(true);
		setError("");

		try {
			if (currentBranch.managerPin) {
				const encoder = new TextEncoder();
				const data = encoder.encode(pinInput + currentBranch.id);
				const hashBuffer = await crypto.subtle.digest("SHA-256", data);
				const hashArray = Array.from(new Uint8Array(hashBuffer));
				const hashedInput = hashArray
					.map((b) => b.toString(16).padStart(2, "0"))
					.join("");

				if (hashedInput !== currentBranch.managerPin) {
					throw new Error("Invalid Manager PIN");
				}
			} else {
				// If no PIN is configured, allow action but warn (or block depending on policy)
				// For now, we allow it if there's no PIN set.
			}

			// Success
			setPinInput("");
			onSuccess();
		} catch (err: unknown) {
			const error = err as Error;
			setError(error.message || "Verification failed");
		} finally {
			setIsVerifying(false);
		}
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4'
					onClick={() => !isVerifying && onClose()}>
					<motion.div
						initial={{ opacity: 0, y: 14, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 10, scale: 0.98 }}
						className='bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm'
						onClick={(e) => e.stopPropagation()}>
						<h3 className='text-xl font-bold text-[var(--secondary)] mb-2'>
							Manager Override
						</h3>
						<p className='text-sm text-gray-500 mb-6'>
							{description ||
								`Please enter the Manager PIN to authorize: ${actionName}`}
						</p>

						<div className='mb-6'>
							<input
								type='password'
								maxLength={6}
								placeholder='Enter PIN'
								value={pinInput}
								onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
								onKeyDown={(e) => {
									if (e.key === "Enter" && pinInput.length >= 4) {
										handleVerify();
									}
								}}
								className='w-full px-4 py-3 text-center tracking-[0.5em] text-lg font-bold rounded-xl border-2 border-[var(--border)] focus:border-[var(--accent)] outline-none'
							/>
							{error && (
								<p className='text-xs text-red-500 font-bold mt-2 text-center'>
									{error}
								</p>
							)}
						</div>

						<div className='flex gap-3'>
							<button
								onClick={onClose}
								disabled={isVerifying}
								className='flex-1 py-3 rounded-xl border border-[var(--border)] font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50'>
								Cancel
							</button>
							<button
								onClick={handleVerify}
								disabled={
									isVerifying || (!!currentBranch?.managerPin && pinInput.length < 4)
								}
								className='flex-1 py-3 rounded-xl bg-[var(--accent)] text-[var(--secondary)] font-bold shadow-md hover:brightness-110 transition-colors disabled:opacity-50'>
								{isVerifying ? "Verifying..." : "Authorize"}
							</button>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
