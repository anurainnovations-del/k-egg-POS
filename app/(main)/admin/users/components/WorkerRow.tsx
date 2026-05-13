import React from "react";
import { Worker } from "@/services/workerService";
import { User } from "@/contexts/AuthContext";
import StatusBadge from "./StatusBadge";

interface WorkerRowProps {
	worker: Worker;
	currentUser: User;
	getBranchName: (branchId: string) => string;
	onEdit?: (worker: Worker) => void;
	onDelete?: (worker: Worker) => void;
	onTimeIn?: (worker: Worker) => void;
	onTimeOut?: (worker: Worker) => void;
	onAssignBranch?: (worker: Worker) => void;
	onRowClick?: (worker: Worker) => void;
}

// Action icons
function TimeInIcon() {
	return (
		<svg
			className='w-4 h-4'
			fill='none'
			stroke='currentColor'
			viewBox='0 0 24 24'>
			<path
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={2}
				d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
			/>
		</svg>
	);
}

function TimeOutIcon() {
	return (
		<svg
			className='w-4 h-4'
			fill='none'
			stroke='currentColor'
			viewBox='0 0 24 24'>
			<path
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={2}
				d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
			/>
		</svg>
	);
}

function EditIcon() {
	return (
		<svg
			className='w-4 h-4'
			fill='none'
			stroke='currentColor'
			viewBox='0 0 24 24'>
			<path
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={2}
				d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
			/>
		</svg>
	);
}

function DeleteIcon() {
	return (
		<svg
			className='w-4 h-4'
			fill='none'
			stroke='currentColor'
			viewBox='0 0 24 24'>
			<path
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={2}
				d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
			/>
		</svg>
	);
}

function BranchIcon({ className }: { className?: string }) {
	return (
		<svg
			className={`w-4 h-4 ${className}`}
			fill='none'
			stroke='currentColor'
			viewBox='0 0 24 24'>
			<path
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={2}
				d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
			/>
		</svg>
	);
}

export default function WorkerRow({
	worker,
	currentUser,
	getBranchName,
	onEdit,
	onDelete,
	onTimeIn,
	onTimeOut,
	onAssignBranch,
	onRowClick,
}: WorkerRowProps) {
	// Permission checks
	const canEdit =
		currentUser.isAdmin ||
		(currentUser.roleAssignments.some(
			(assignment) => assignment.role === "manager"
		) &&
			worker.roleAssignments.some((workerAssignment) =>
				currentUser.roleAssignments.some(
					(userAssignment) =>
						userAssignment.branchId === workerAssignment.branchId
				)
			));

	const canDelete = currentUser.isAdmin;

	const canTimeInOut = canEdit && !worker.isAdmin;

	const formatDate = (date?: Date) => {
		if (!date) return "Never";
		return new Intl.DateTimeFormat("en-US", {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		}).format(date);
	};

	return (
		<tr
			onClick={() => onRowClick?.(worker)}
			className={`hover:bg-gray-50 cursor-pointer ${
				!worker.isAdmin && worker.currentStatus === "clocked_in"
					? "bg-green-50"
					: ""
			}`}>
			{/* Worker Info */}
			<td className='px-6 py-4 whitespace-nowrap'>
				<div className='flex items-center'>
					{worker.profilePicture ? (
						<img
							src={worker.profilePicture}
							alt={`${worker.name} profile`}
							className='w-10 h-10 rounded-full mr-4'
						/>
					) : (
						<div className='w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center mr-4'>
							<span className='text-sm font-medium text-gray-700'>
								{worker.name.charAt(0).toUpperCase()}
							</span>
						</div>
					)}
					<div>
						<div className='text-sm font-medium text-gray-900'>
							{worker.name}
						</div>
						{worker.employeeId && (
							<div className='text-sm text-gray-500'>
								ID: {worker.employeeId}
							</div>
						)}
					</div>
				</div>
			</td>

			{/* Email */}
			<td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
				{worker.email}
			</td>

			{/* Roles */}
			<td className='px-6 py-4'>
				<div className='flex gap-1'>
					{worker.isAdmin && (
						<span className='inline-flex justify-center items-center text-xs px-2 py-1 font-semibold bg-[var(--accent)] text-[var(--primary)] min-w-[100px] text-shadow-md'>
							Admin
						</span>
					)}
					{worker.roleAssignments
						.filter((assignment) => assignment.isActive)
						.map((assignment) => (
							<span
								key={assignment.branchId}
								className={`inline-flex justify-center items-center px-3 py-1 text-xs font-semibold min-w-[100px] text-center ${
									assignment.role === "manager"
										? "bg-[var(--accent)] text-[var(--primary)] text-shadow-md"
										: "bg-[var(--accent)] text-[var(--primary)] text-shadow-md rounded-full"
								}`}>
								{String(assignment.role).charAt(0).toUpperCase() + String(assignment.role).slice(1)}
							</span>
						))}
				</div>
			</td>

			{/* Branches */}
			<td className='px-6 py-4'>
				<div className='flex flex-wrap gap-1'>
					{worker.roleAssignments
						.filter((assignment) => assignment.isActive)
						.map((assignment) => (
							<span
								key={assignment.branchId}
								className='inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-800'>
								{getBranchName(assignment.branchId)}
							</span>
						))}
				</div>
			</td>

			{/* Status */}
			<td className='px-6 py-4 whitespace-nowrap'>
				<StatusBadge status={worker.currentStatus} isAdmin={worker.isAdmin} />
			</td>

			{/* Last Active */}
			{/* <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
				{formatDate(worker.lastLoginAt)}
			</td> */}

			{/* Actions */}
			<td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium'>
				<div className='flex items-center gap-2'>
					{/* Time In/Out buttons */}
					{canTimeInOut &&
						worker.currentStatus === "clocked_out" &&
						onTimeIn && (
							<button
								onClick={(e) => {
									e.stopPropagation();
									onTimeIn(worker);
								}}
								className='text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50'
								title='Time In'>
								<TimeInIcon />
							</button>
						)}
					{canTimeInOut &&
						worker.currentStatus === "clocked_in" &&
						onTimeOut && (
							<button
								onClick={(e) => {
									e.stopPropagation();
									onTimeOut(worker);
								}}
								className='text-orange-600 hover:text-orange-800 p-1 rounded hover:bg-orange-50'
								title='Time Out'>
								<TimeOutIcon />
							</button>
						)}

					{/* Edit button */}
					{canEdit && onEdit && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								onEdit(worker);
							}}
							className='text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50'
							title='Edit Worker'>
							<EditIcon />
						</button>
					)}

					{/* Branch management button */}
					{canEdit && onAssignBranch && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								onAssignBranch(worker);
							}}
							className='text-[var(--accent)] hover:text-[var(--accent)] p-1 rounded hover:bg-[var(--accent)]/10'
							title='Manage Branches'>
							<BranchIcon className='drop-shadow-md' />
						</button>
					)}

					{/* Delete button */}
					{canDelete && onDelete && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								onDelete(worker);
							}}
							className='text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50'
							title='Delete Worker'>
							<DeleteIcon />
						</button>
					)}
				</div>
			</td>
		</tr>
	);
}
