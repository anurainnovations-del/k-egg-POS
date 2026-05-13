'use client';

import {
	useState,
	useEffect,
	createContext,
	useContext,
	useCallback,
	useMemo,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import HorizontalLogo from "@/components/icons/SidebarNav/HorizontalLogo";
import LogoIcon from "@/app/(main)/[branchId]/(worker)/store/icons/LogoIcon";
import LogoutIcon from "@/components/icons/SidebarNav/LogoutIcon";
import BranchesIcon from "@/components/icons/SidebarNav/BranchesIcon";
import { useAuth } from "@/contexts/AuthContext";
import UserIcon from "@/components/icons/UserIcon";

// Custom hook to detect if screen is below sm breakpoint (640px)
function useIsSmallScreen() {
	const [isSmallScreen, setIsSmallScreen] = useState(false);

	useEffect(() => {
		const checkScreenSize = () => {
			setIsSmallScreen(window.innerWidth < 1024);
		};
		checkScreenSize();
		window.addEventListener('resize', checkScreenSize);
		return () => window.removeEventListener('resize', checkScreenSize);
	}, []);

	return isSmallScreen;
}

interface AdminDrawerContextType {
	isOpen: boolean;
	toggle: () => void;
}

const AdminDrawerContext = createContext<AdminDrawerContextType | undefined>(undefined);

export const useAdminDrawer = () => {
	const context = useContext(AdminDrawerContext);
	if (context === undefined) {
		throw new Error("useAdminDrawer must be used within an AdminDrawer component");
	}
	return context;
};

function AdminSidebarContent() {
	const pathname = usePathname();
	const { logout } = useAuth();
	const router = useRouter();
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const { isOpen } = useAdminDrawer();
	const isSmallScreen = useIsSmallScreen();
	
	const isBranches = pathname === "/admin/branches" || pathname.startsWith("/admin/branches");
	const isUsers = pathname === "/admin/users" || pathname.startsWith("/admin/users");

	// Force closed appearance on small screens
	const effectiveIsOpen = isSmallScreen ? false : isOpen;
	const asideWidthClass = effectiveIsOpen ? "max-w-[80px] lg:max-w-[260px]" : "max-w-0";
	
	const handleLogout = async () => {
		if (isLoggingOut) return;
		
		setIsLoggingOut(true);
		try {
			await logout();
			router.push('/login');
		} catch (error) {
			console.error('Logout error:', error);
		} finally {
			setIsLoggingOut(false);
		}
	};

	return (
		<aside
			className={`h-full w-full ${asideWidthClass} bg-[var(--primary)] border-r border-gray-200 transition-[max-width] duration-300 ease-in-out overflow-hidden`}>
			<div className='flex flex-col h-full'>
				
				{/* Logo */}
				<div className="flex items-center border-b border-gray-200 bg-[var(--accent)] h-[90px] px-6">
					<HorizontalLogo className="invisible w-0 lg:visible lg:w-auto opacity-0 lg:opacity-100 transition-all"/>
					<LogoIcon className="visible w-auto lg:invisible lg:w-0 opacity-100 lg:opacity-0 transition-all" />
				</div>

				{/* Navigation */}
				<nav className="flex-1 py-[8px]">
					<ul className="space-y-[8px]">
						<li>
							<Link 
								href="/admin/branches"
								className={`flex h-10 items-center text-[14px] font-semibold ${
									isBranches 
										? 'bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-[var(--primary)] text-shadow-lg'
										: 'bg-[var(--primary)] hover:bg-[var(--accent)]/50 text-[var(--secondary)]'
								}`}
							>
								<div className="w-full flex items-center justify-center lg:justify-start">
									<BranchesIcon className={`w-8 h-8 mx-3 gap-3 ${isBranches ? "text-[var(--primary)] drop-shadow-lg" : "text-[var(--secondary)]"} transition-all duration-300`} />
									<span className={`${effectiveIsOpen ? "invisible w-0 lg:visible lg:w-auto opacity-0 lg:opacity-100" : "invisible w-0 opacity-0"} transition-all duration-300`}>Branches</span>
								</div>
							</Link>
						</li>
						<li>
							<Link 
								href="/admin/users"
								className={`flex h-10 items-center text-[14px] font-semibold ${
									isUsers 
										? 'bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-[var(--primary)] text-shadow-lg'
										: 'bg-[var(--primary)] hover:bg-[var(--accent)]/50 text-[var(--secondary)]'
								}`}
							>
								<div className="w-full flex items-center justify-center lg:justify-start">
									<UserIcon className={`w-8 h-8 mx-3 gap-3 ${isUsers ? "text-[var(--primary)] drop-shadow-lg" : "text-[var(--secondary)]"} transition-all duration-300`} />
									<span className={`${effectiveIsOpen ? "invisible w-0 lg:visible lg:w-auto opacity-0 lg:opacity-100" : "invisible w-0 opacity-0"} transition-all duration-300`}>Users</span>
								</div>
							</Link>
						</li>
						<li>
							<button
								onClick={handleLogout}
								disabled={isLoggingOut}
								className="group flex w-full h-10 items-center text-[14px] text-[var(--error)] hover:text-[var(--primary)] font-semibold bg-[var(--primary)] hover:bg-[var(--error)] cursor-pointer"
							>
								<div className="w-full flex items-center justify-center lg:justify-start transition-all duration-300">
									<span className="size-8 mx-3">
										<LogoutIcon className="gap-3 text-[var(--error)] group-hover:text-[var(--primary)] transition-colors duration-300" />
									</span>
									<span className={`${effectiveIsOpen ? "invisible w-0 lg:visible lg:w-auto opacity-0 lg:opacity-100" : "invisible w-0 opacity-0"} transition-all duration-300`}>
										Logout
									</span>
								</div>
							</button>
						</li>
					</ul>
				</nav>
			</div>
		</aside>
	);
}

interface AdminDrawerProps {
	isOpen?: boolean;
	onToggle?: (isOpen: boolean) => void;
	children?: React.ReactNode;
}

function AdminDrawer({
	isOpen: externalIsOpen,
	onToggle,
	children,
}: AdminDrawerProps) {
	const [internalIsOpen, setInternalIsOpen] = useState(true);
	const isSmallScreen = useIsSmallScreen();

	// Use external state if provided, otherwise use internal state
	const isDrawerOpen =
		externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

	// Auto-close drawer on small screens
	useEffect(() => {
		if (isSmallScreen && isDrawerOpen) {
			if (onToggle) {
				onToggle(false);
			} else {
				setInternalIsOpen(false);
			}
		}
	}, [isSmallScreen, isDrawerOpen, onToggle]);

	const toggleDrawer = useCallback(() => {
		// Prevent opening drawer on small screens
		if (isSmallScreen) {
			return;
		}
		
		const newState = !isDrawerOpen;
		if (onToggle) {
			onToggle(newState);
		} else {
			setInternalIsOpen(newState);
		}
	}, [isDrawerOpen, onToggle, isSmallScreen]);

	// Handle ESC key to close drawer
	useEffect(() => {
		const handleEscKey = (event: KeyboardEvent) => {
			if (event.key === "Escape" && isDrawerOpen) {
				toggleDrawer();
			}
		};

		document.addEventListener("keydown", handleEscKey);
		return () => document.removeEventListener("keydown", handleEscKey);
	}, [isDrawerOpen, toggleDrawer]);

	const contextValue = useMemo(
		() => ({
			isOpen: isSmallScreen ? false : isDrawerOpen, // Force closed on small screens
			toggle: toggleDrawer,
		}),
		[isDrawerOpen, toggleDrawer, isSmallScreen]
	);

	return (
		<AdminDrawerContext.Provider value={contextValue}>
			<div className='flex h-full w-full'>
				{/* Left Sidebar/Drawer - Takes up space in layout */}
				<div
					className={`
					${isSmallScreen ? "w-0" : (isDrawerOpen ? "w-[80px] lg:w-[271px]" : "w-0")} 
					transition-all duration-300 ease-in-out overflow-hidden
					`}>
					<AdminSidebarContent />
				</div>

				{/* Main Content - Adjusts based on sidebar width */}
				<div className='flex-1 flex flex-col h-full overflow-hidden'>
					{/* Content Area */}
					{children}
				</div>
			</div>
		</AdminDrawerContext.Provider>
	);
}

interface AdminDrawerProviderProps {
  children: React.ReactNode;
}

export default function AdminDrawerProvider({ children }: AdminDrawerProviderProps) {
  return (
    <div className="flex h-screen bg-[var(--background)] overflow-hidden fixed inset-0">
      <AdminDrawer>
        {children}
      </AdminDrawer>
    </div>
  );
}