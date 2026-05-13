"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function AdminPage() {
	const router = useRouter();

	useEffect(() => {
		// Redirect to branches page as default admin view
		router.replace("/admin/branches");
	}, [router]);

	return (
		<div className='flex items-center justify-center h-full'>
			<LoadingSpinner size='md' />
			<span className='ml-3 text-[var(--secondary)]'>Loading admin...</span>
		</div>
	);
}
