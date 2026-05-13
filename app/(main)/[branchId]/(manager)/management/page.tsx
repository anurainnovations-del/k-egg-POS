"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { workerService, Worker } from "@/services/workerService";
import { branchService, Branch } from "@/services/branchService";
import {
	collection,
	query,
	orderBy,
	onSnapshot,
	where,
} from "firebase/firestore";
import { db } from "@/firebase-config";
import { WorkerFilters as WorkerFiltersType } from "@/types/WorkerTypes";
import WorkersTable from "@/app/(main)/admin/users/components/WorkersTable";
import WorkerFiltersComponent from "@/app/(main)/admin/users/components/WorkerFilters";
import CreateWorkerModal from "@/app/(main)/admin/users/components/CreateWorkerModal";
import EditWorkerModal from "@/app/(main)/admin/users/components/EditWorkerModal";
import DeleteWorkerModal from "@/app/(main)/admin/users/components/DeleteWorkerModal";
import TimeInOutModal from "@/app/(main)/admin/users/components/TimeInOutModal";
import AssignBranchModal from "@/app/(main)/admin/users/components/AssignBranchModal";
import WorkerDetailModal from "@/components/WorkerDetailModal";
import PlusIcon from "@/components/icons/PlusIcon";
import { useParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import ManagementIcon from "@/components/icons/SidebarNav/ManagementIcon";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function ManagementPage() {
	const {
		user,
		getUserRoleForBranch,
		canAccessBranch,
		loading: authLoading,
	} = useAuth();
	const { branchId } = useParams();
	const [workers, setWorkers] = useState<Worker[]>([]);
	const [branches, setBranches] = useState<Branch[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const workerSubscriptions = useRef<Map<string, () => void>>(new Map());

	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
	const [isTimeInOutModalOpen, setIsTimeInOutModalOpen] = useState(false);
	const [isAssignBranchModalOpen, setIsAssignBranchModalOpen] = useState(false);
	const [isWorkerDetailModalOpen, setIsWorkerDetailModalOpen] = useState(false);
	const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
	const [timeInOutAction, setTimeInOutAction] = useState<"time_in" | "time_out">("time_in");

	const [viewMode, setViewMode] = useState<"workers" | "attendance">("workers");

	const [filters, setFilters] = useState<WorkerFiltersType>({
		branchId: branchId as string,
		excludeAdmins: true,
	});
	const [sortConfig, setSortConfig] = useState({
		column: "name",
		direction: "asc" as "asc" | "desc",
	});

	useEffect(() => {
		if (!authLoading && user && branchId) {
			const hasAccess = canAccessBranch(branchId as string);
			if (!hasAccess) {
				setError("Access denied. You don't have access to this branch.");
				setLoading(false);
				return;
			}
			setError(null);
		}
	}, [user, branchId, canAccessBranch, authLoading]);

	const setupWorkerSubscriptions = useCallback(() => {
		if (!branchId || !user) return;
		try {
			workerSubscriptions.current.forEach((u) => u());
			workerSubscriptions.current.clear();

			const workersRef = collection(db, "users");
			const workersQuery = query(workersRef, where("isAdmin", "==", false), orderBy("name", "asc"));

			const unsubscribe = onSnapshot(workersQuery, (snapshot) => {
				const branchWorkers: Worker[] = [];
				snapshot.forEach((doc) => {
					const data = doc.data();
					const hasBranchAccess = data.roleAssignments?.some((a: any) => a.branchId === branchId && a.isActive);
					if (!hasBranchAccess) return;

					branchWorkers.push({
						id: doc.id,
						...data,
						createdAt: data.createdAt?.toDate() || new Date(),
						updatedAt: data.updatedAt?.toDate() || new Date(),
						lastTimeIn: data.lastTimeIn?.toDate(),
						lastTimeOut: data.lastTimeOut?.toDate(),
					} as Worker);
				});
				setWorkers(branchWorkers);
			}, (err) => {
				console.error("Worker subscription error:", err);
				setError("Failed to load workers in real-time");
			});
			workerSubscriptions.current.set("branch-workers", unsubscribe);
		} catch (error) { console.error("Subscription setup error:", error); }
	}, [branchId, user]);

	useEffect(() => {
		if (user && branchId) {
			loadWorkers();
			loadBranches();
		}
	}, [user, branchId]);

	useEffect(() => {
		return () => {
			workerSubscriptions.current.forEach((u) => u());
			workerSubscriptions.current.clear();
		};
	}, []);

	const loadWorkers = async () => {
		if (!branchId) return;
		try {
			setLoading(true);
			const workersData = await workerService.listWorkers({ branchId: branchId as string, excludeAdmins: true });
			setWorkers(workersData);
			setupWorkerSubscriptions();
		} catch (err) { setError("Failed to load workers"); } finally { setLoading(false); }
	};

	const loadBranches = async () => {
		try { setBranches(await branchService.getAllBranches()); } catch (err) { console.error(err); }
	};

	const handleModalClose = () => {
		setIsCreateModalOpen(false); setIsEditModalOpen(false); setIsDeleteModalOpen(false);
		setIsTimeInOutModalOpen(false); setIsAssignBranchModalOpen(false); setIsWorkerDetailModalOpen(false);
		setSelectedWorker(null);
	};

	const sortedWorkers = React.useMemo(() => {
		let filtered = [...workers];
		if (filters.searchQuery) {
			const s = filters.searchQuery.toLowerCase();
			filtered = filtered.filter(w => w.name.toLowerCase().includes(s) || w.email.toLowerCase().includes(s));
		}
		return filtered.sort((a, b) => {
			const aV = a[sortConfig.column as keyof Worker] as any;
			const bV = b[sortConfig.column as keyof Worker] as any;
			if (aV < bV) return sortConfig.direction === "asc" ? -1 : 1;
			if (aV > bV) return sortConfig.direction === "asc" ? 1 : -1;
			return 0;
		});
	}, [workers, sortConfig, filters]);

	if (authLoading || loading) return <div className="flex h-full items-center justify-center"><LoadingSpinner /></div>;
	if (error) return <div className="p-6 text-red-500">{error}</div>;

	return (
		<div className='flex flex-col h-full overflow-hidden'>
			<div className='xl:hidden w-full'>
				<MobileTopBar title="Staff Management" icon={<ManagementIcon className="w-6 h-6" />} />
			</div>
			<div className='hidden xl:block w-full'>
				<TopBar title="Staff Management" icon={<ManagementIcon className="w-6 h-6" />} />
			</div>

			<div className='flex-1 p-6 overflow-y-auto space-y-6'>
				<div className='flex items-center justify-between'>
					<div className='flex gap-2 p-1 bg-gray-100 rounded-xl'>
						<button onClick={() => setViewMode("workers")} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === "workers" ? "bg-white shadow-sm text-[var(--secondary)]" : "text-gray-500"}`}>Staff List</button>
						<button onClick={() => setViewMode("attendance")} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === "attendance" ? "bg-white shadow-sm text-[var(--secondary)]" : "text-gray-500"}`}>Attendance</button>
					</div>

					{viewMode === "workers" && (
						<button onClick={() => setIsCreateModalOpen(true)} className='bg-[var(--accent)] text-[var(--secondary)] px-5 py-2.5 rounded-xl font-black shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2'>
							<PlusIcon className="w-4 h-4" /> ADD STAFF
						</button>
					)}
				</div>

				{viewMode === "workers" ? (
					<>
						<WorkerFiltersComponent
							filters={filters}
							branches={[]}
							onFiltersChange={setFilters}
							userAccessibleBranches={[branchId as string]}
							isAdmin={false}
							hideBranchFilter={true}
							hideAdminRole={true}
						/>
						<WorkersTable
							workers={sortedWorkers}
							currentUser={user}
							branches={branches}
							loading={loading}
							sortConfig={sortConfig}
							onSort={(c) => setSortConfig(p => ({ column: c, direction: p.column === c && p.direction === "asc" ? "desc" : "asc" }))}
							onEdit={(w) => { setSelectedWorker(w); setIsEditModalOpen(true); }}
							onDelete={(w) => { setSelectedWorker(w); setIsDeleteModalOpen(true); }}
							onTimeIn={(w) => { setSelectedWorker(w); setTimeInOutAction("time_in"); setIsTimeInOutModalOpen(true); }}
							onTimeOut={(w) => { setSelectedWorker(w); setTimeInOutAction("time_out"); setIsTimeInOutModalOpen(true); }}
							onAssignBranch={(w) => { setSelectedWorker(w); setIsAssignBranchModalOpen(true); }}
							onRowClick={(w) => { setSelectedWorker(w); setIsWorkerDetailModalOpen(true); }}
						/>
					</>
				) : (
					<div className="bg-white p-20 rounded-2xl border border-dashed border-gray-300 text-center">
						<div className="text-4xl mb-4">🕒</div>
						<h3 className="text-lg font-bold">Attendance tracking coming soon</h3>
					</div>
				)}
			</div>

			<CreateWorkerModal isOpen={isCreateModalOpen} onClose={handleModalClose} onSuccess={loadWorkers} branches={branches.filter(b => b.id === branchId)} userAccessibleBranches={[branchId as string]} isAdmin={false} defaultBranchId={branchId as string} />
			<EditWorkerModal isOpen={isEditModalOpen} worker={selectedWorker} onClose={handleModalClose} onSuccess={loadWorkers} branches={branches.filter(b => b.id === branchId)} userAccessibleBranches={[branchId as string]} isAdmin={false} currentUserId={user?.uid} />
			<DeleteWorkerModal isOpen={isDeleteModalOpen} worker={selectedWorker} onClose={handleModalClose} onSuccess={loadWorkers} />
			<TimeInOutModal isOpen={isTimeInOutModalOpen} worker={selectedWorker} action={timeInOutAction} branches={branches.filter(b => b.id === branchId)} onClose={handleModalClose} onSuccess={loadWorkers} />
			<AssignBranchModal isOpen={isAssignBranchModalOpen} worker={selectedWorker} branches={branches.filter(b => b.id === branchId)} userAccessibleBranches={[branchId as string]} isAdmin={false} onClose={handleModalClose} onSuccess={loadWorkers} />
			<WorkerDetailModal isOpen={isWorkerDetailModalOpen} worker={selectedWorker} onClose={handleModalClose} />
		</div>
	);
}
