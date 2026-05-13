import React from "react";

interface StatusBadgeProps {
	status?: "clocked_in" | "clocked_out";
	isAdmin?: boolean;
}

export default function StatusBadge({
	status,
	isAdmin = false,
}: StatusBadgeProps) {
	// Admins don't have status tracking
	if (isAdmin) {
		return (
			<span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
				<div className='w-1.5 h-1.5 rounded-full mr-1.5 bg-blue-400' />
				Admin
			</span>
		);
	}

	const getStatusConfig = (status: string) => {
		switch (status) {
			case "clocked_in":
				return {
					label: "Clocked In",
					className: "bg-green-100 text-green-800",
					dotClassName: "bg-green-400",
				};
			case "clocked_out":
				return {
					label: "Clocked Out",
					className: "bg-yellow-100 text-yellow-800",
					dotClassName: "bg-yellow-400",
				};
			default:
				return {
					label: "Clocked Out",
					className: "bg-yellow-100 text-yellow-800",
					dotClassName: "bg-yellow-400",
				};
		}
	};

	const config = getStatusConfig(status || "clocked_out");

	return (
		<span
			className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
			<div
				className={`w-1.5 h-1.5 rounded-full mr-1.5 ${config.dotClassName}`}
			/>
			{config.label}
		</span>
	);
}
