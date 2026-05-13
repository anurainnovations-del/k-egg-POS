"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import LogoVerticalIcon from "@/components/icons/LogoVerticalIcon";
import { FirebaseError } from "@firebase/util";

import Link from "next/link";

export default function LoginPage() {
	const [credentials, setCredentials] = useState({
		email: "",
		password: "",
	});
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const router = useRouter();
	const { user, login, isUserAdmin } = useAuth();

	useEffect(() => {
		// If user is already logged in, redirect based on their role
		if (user) {
			console.log("🔑 [LoginPage] User authenticated, checking redirect:", {
				isAdmin: isUserAdmin(),
				roleAssignmentsCount: user.roleAssignments?.length,
				roleAssignments: user.roleAssignments
			});

			if (isUserAdmin()) {
				// Admin redirects to branch management
				console.log("🚀 [LoginPage] Redirecting to /admin/branches (Admin)");
				setIsLoading(false);
				router.push("/admin/branches");
			} else if (user.roleAssignments && user.roleAssignments.length > 0) {
				// Check if user has valid branch assignments
				const branchId = user?.roleAssignments?.[0]?.branchId;
				if (branchId) {
					// Check if user is a manager for any branch
					const isManager = user.roleAssignments.some(
						(assignment) =>
							assignment.role === "manager" && assignment.isActive !== false
					);

					if (isManager) {
						// Manager redirects to management (worker view for their branch)
						console.log(`🚀 [LoginPage] Redirecting to /${branchId}/management (Manager)`);
						router.push(`/${branchId}/management`);
					} else {
						// Worker redirects to store
						console.log(`🚀 [LoginPage] Redirecting to /${branchId}/store (Worker)`);
						router.push(`/${branchId}/store`);
					}
					setIsLoading(false);
				}
			} else {
				// User has no role assignments, send to waiting room
				console.log("⏳ [LoginPage] No roles found, redirecting to waiting-room");
				setIsLoading(false);
				router.push('/waiting-room');
			}
		}
	}, [user, router, isUserAdmin]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError("");

		// Simple validation
		if (!credentials.email || !credentials.password) {
			setError("Please enter both email and password");
			setIsLoading(false);
			return;
		}

		try {
			await login(credentials.email, credentials.password);
			// After successful login, redirect based on user role
			// Note: The user state will be updated, and the useEffect will handle the redirect
		} catch (error) {
			console.error("Login error:", error);

			// Handle specific Firebase auth errors
			let errorMessage = "Login failed. Please try again.";
			if (error instanceof FirebaseError && error.code) {
				switch (error.code) {
					case "auth/user-not-found":
						errorMessage = "No account found with this email address.";
						break;
					case "auth/wrong-password":
						errorMessage = "Incorrect password.";
						break;
					case "auth/invalid-email":
						errorMessage = "Invalid email address.";
						break;
					case "auth/user-disabled":
						errorMessage = "This account has been disabled.";
						break;
					case "auth/too-many-requests":
						errorMessage = "Too many failed attempts. Please try again later.";
						break;
					case "auth/invalid-credential":
						errorMessage = "Invalid email or password.";
						break;
					default:
						errorMessage = error.message || "Login failed. Please try again.";
				}
			}

			setError(errorMessage);
		} finally {
			setIsLoading(false);
		}
	};

	const handleInputChange =
		(field: "email" | "password") =>
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setCredentials((prev) => ({
				...prev,
				[field]: e.target.value,
			}));
			// Clear error when user starts typing
			if (error) setError("");
		};

	return (
		<div
			className='min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8'
			style={{
				backgroundImage: "url('/cover.png')",
				backgroundSize: "cover",
				backgroundPosition: "center",
				backgroundRepeat: "no-repeat",
			}}>
			<div className='w-full max-w-md'>
				{/* Login Form */}
				<div className='bg-white rounded-[12px] shadow-xl'>
					{/* Logo/Header */}
					<div className='text-center mb-8'>
						<div className='w-full h-full mx-auto mb-4 flex items-center justify-center bg-[var(--accent)] py-6 shadow-md rounded-t-[12px]'>
							<div className='w-[165px] h-[100px]'>
								<LogoVerticalIcon />
							</div>
						</div>
					</div>
					<p className='text-center text-[16px] font-medium text-[var(--secondary)]'>
						Sign in to your account
					</p>
					<div className='p-8'>
						<form onSubmit={handleSubmit} className='space-y-6'>
							{/* Email Field */}
							<div>
								<label className='block text-sm font-medium text-[var(--secondary)] mb-2'>
									Email
								</label>
								<input
									type='email'
									value={credentials.email}
									onChange={handleInputChange("email")}
									className='w-full px-4 py-3 border-2 border-gray-200 rounded-[6px] text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all'
									placeholder='Enter your email'
									disabled={isLoading}
									autoComplete='email'
								/>
							</div>

							{/* Password Field */}
							<div>
								<label className='block text-sm font-medium text-[var(--secondary)] mb-2'>
									Password
								</label>
								<input
									type='password'
									value={credentials.password}
									onChange={handleInputChange("password")}
									className='w-full px-4 py-3 border-2 border-gray-200 rounded-[6px] text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all'
									placeholder='Enter your password'
									disabled={isLoading}
									autoComplete='current-password'
								/>
							</div>

							{/* Error Message */}
							{error && (
								<div className='bg-red-50 border border-red-200 rounded-xl p-3'>
									<div className='flex items-center gap-2'>
										<svg
											className='w-5 h-5 text-red-600'
											fill='currentColor'
											viewBox='0 0 20 20'>
											<path
												fillRule='evenodd'
												d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
												clipRule='evenodd'
											/>
										</svg>
										<span className='text-sm text-red-700'>{error}</span>
									</div>
								</div>
							)}

							{/* Submit Button */}
							<button
								type='submit'
								disabled={isLoading}
								className={`w-full py-3 rounded-[6px] font-semibold transition-all shadow-lg ${
									isLoading
										? "bg-gray-300 text-gray-500 cursor-not-allowed"
										: "bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white hover:scale-105 active:scale-95"
								}`}>
								{isLoading ? (
									<div className='flex items-center justify-center gap-2'>
										<div className='w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin'></div>
										Signing in...
									</div>
								) : (
									"SIGN IN"
								)}
							</button>
						</form>

						{/* Sign Up Link */}
						<div className='mt-6 text-center'>
							<p className='text-sm text-[var(--secondary)]'>
								Do not have an account?{' '}
								<Link
									href='/signup'
									className='font-medium text-[var(--accent)] hover:text-[var(--accent)]/80 transition-colors'>
									Create account
								</Link>
							</p>
						</div>

						{/* Footer */}
						<div className='mt-6 text-center'>
							<p className='text-xs text-[var(--secondary)] opacity-50'>
								K-egg Point-of-Sales System v1.0
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
