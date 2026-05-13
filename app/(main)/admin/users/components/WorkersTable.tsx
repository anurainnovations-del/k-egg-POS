import React from "react";
import { Worker } from "@/services/workerService";
import { Branch } from "@/services/branchService";
import { User } from "@/contexts/AuthContext";
import WorkerRow from "./WorkerRow";
import TableHeader from "./TableHeader";

interface WorkersTableProps {
	workers: Worker[];
	currentUser: User;
	branches: Branch[];
	loading?: boolean;
	onEdit?: (worker: Worker) => void;
	onDelete?: (worker: Worker) => void;
	onTimeIn?: (worker: Worker) => void;
	onTimeOut?: (worker: Worker) => void;
	onAssignBranch?: (worker: Worker) => void;
	onRowClick?: (worker: Worker) => void;
	sortConfig?: SortConfig;
	onSort?: (column: string) => void;
}

interface SortConfig {
	column: string;
	direction: "asc" | "desc";
}

export default function WorkersTable({
	workers,
	currentUser,
	branches,
	loading = false,
	sortConfig,
	onSort,
	...actions
}: WorkersTableProps) {
	const getBranchName = (branchId: string) => {
		const branch = branches.find((b) => b.id === branchId);
		return branch?.name || branchId;
	};

	if (loading) {
		return (
			<div className='bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden'>
				<div className='animate-pulse'>
					{/* Header */}
					<div className='bg-gray-50 px-6 py-3 border-b border-gray-200'>
						<div className='flex space-x-4'>
							{[1, 2, 3, 4, 5].map((i) => (
								<div key={i} className='h-4 bg-gray-200 rounded flex-1'></div>
							))}
						</div>
					</div>
					{/* Rows */}
					{[1, 2, 3, 4, 5].map((i) => (
						<div key={i} className='px-6 py-4 border-b border-gray-200'>
							<div className='flex space-x-4'>
								{[1, 2, 3, 4, 5].map((j) => (
									<div key={j} className='h-4 bg-gray-200 rounded flex-1'></div>
								))}
							</div>
						</div>
					))}
				</div>
			</div>
		);
	}

	if (workers.length === 0) {
		return (
			<div className='bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center'>
				<div className='text-6xl text-gray-300 mb-4'>👥</div>
				<h3 className='text-lg font-medium text-gray-700 mb-2'>
					No Workers Found
				</h3>
				<p className='text-gray-500'>
					No workers match your current filters. Try adjusting your search featcriteria.
				</p>
			</div>
		);
	}

	return (
		<div className='bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden'>
			<div className='overflow-x-auto'>
				<table className='min-w-full divide-y divide-gray-200'>
					<TableHeader
						sortConfig={sortConfig}
						onSort={onSort}
						columns={[
							{ key: "name", label: "Worker", sortable: true },
							{ key: "email", label: "Email", sortable: true },
							{ key: "role", label: "Role", sortable: true },
							{ key: "branches", label: "Branches", sortable: false },
							{ key: "currentStatus", label: "Status", sortable: true },

							{ key: "actions", label: "Actions", sortable: false },
						]}
					/>
					<tbody className='bg-white divide-y divide-gray-200'>
						{workers.map((worker) => (
							<WorkerRow
								key={worker.id}
								worker={worker}
								currentUser={currentUser}
								getBranchName={getBranchName}
								{...actions}
							/>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
