"use client";

import {
	useState,
	useEffect,
	createContext,
	useContext,
	useCallback,
	useMemo,
} from "react";
import SidebarNav from "./SidebarNav";

interface DrawerContextType {
	isOpen: boolean;
	toggle: () => void;
	isAdminPage?: boolean;
}

const DrawerContext = createContext<DrawerContextType | undefined>(undefined);

export const useDrawer = () => {
	const context = useContext(DrawerContext);
	if (context === undefined) {
		throw new Error("useDrawer must be used within a Drawer component");
	}
	return context;
};

interface DrawerProps {
	isOpen?: boolean;
	onToggle?: (isOpen: boolean) => void;
	isAdminPage?: boolean;
	children?: React.ReactNode;
}

export default function Drawer({
	isOpen: externalIsOpen,
	onToggle,
	isAdminPage,
	children,
}: DrawerProps) {
	const [internalIsOpen, setInternalIsOpen] = useState(true);

	// Use external state if provided, otherwise use internal state
	const isDrawerOpen =
		externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

	const toggleDrawer = useCallback(() => {
		const newState = !isDrawerOpen;
		if (onToggle) {
			onToggle(newState);
		} else {
			setInternalIsOpen(newState);
		}
	}, [isDrawerOpen, onToggle]);

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
			isOpen: isDrawerOpen,
			toggle: toggleDrawer,
		}),
		[isDrawerOpen, toggleDrawer]
	);

	return (
		<DrawerContext.Provider value={contextValue}>
			<div className='relative flex h-full w-full'>
				{/* Overlay backdrop for mobile/tablet - only visible when drawer is open on small screens */}
				{!isAdminPage && isDrawerOpen && (
					<div
						className='fixed inset-0 z-40 xl:hidden'
						onClick={toggleDrawer}
						aria-hidden='true'
					/>
				)}

				{/* Left Sidebar/Drawer */}
				<div
					className={`
						${isAdminPage ? "hidden" : ""} 
						${
							isDrawerOpen
								? "translate-x-0 w-[271px] xl:w-[271px]"
								: "-translate-x-full xl:translate-x-0 w-[271px] xl:w-0"
						}
						fixed xl:relative z-50 xl:z-auto h-full
						transition-all duration-300 ease-in-out
						overflow-hidden
					`}>
					{!isAdminPage && <SidebarNav />}
				</div>

				{/* Main Content - Full width on mobile/tablet, adjusts on desktop */}
				<div className='flex-1 flex flex-col h-full overflow-hidden w-full'>
					{/* Content Area */}
					{children}
				</div>
			</div>
		</DrawerContext.Provider>
	);
}
