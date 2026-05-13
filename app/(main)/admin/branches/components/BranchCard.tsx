import React from "react";
import BranchStatusIcon from "./icons/BranchStatusIcon";
import HorizontalLogo from "@/components/icons/SidebarNav/HorizontalLogo";
import styles from "../page.module.css";
import ViewBranchIcon from "./icons/ViewBranchIcon";
import DeleteBranchIcon from "./icons/DeleteBranchIcon";
import EditBranchIcon from "./icons/EditBranchIcon";
import Image from "next/image";
interface BranchCardProps {
	branch: {
		branchId: string;
		name: string;
		location: string;
		createdAt: Date;
		updatedAt: Date;
		isActive: boolean;
		imgUrl?: string;
	};
	formatDate: (date: Date) => string;
	onView?: (branchId: string) => void;
	onEdit?: (branchId: string) => void;
	onDelete?: (branchId: string) => void;
	onClick?: (branchId: string) => void;
}

const BranchCard: React.FC<BranchCardProps> = ({
	branch,
	formatDate,
	onView,
	onEdit,
	onDelete,
	onClick,
}) => {
	const handleCardClick = () => {
		if (onClick) {
			onClick(branch.branchId);
		}
	};

	const handleActionClick = (e: React.MouseEvent, action: () => void) => {
		e.stopPropagation(); // Prevent card click
		action();
	};
	return (
		<div
			key={branch.branchId}
			onClick={handleCardClick}
			className={`bg-white rounded-2xl shadow border border-gray-200 flex flex-col overflow-hidden transition-all duration-300 ${
				styles.cartoonCard
			} ${onClick ? "cursor-pointer" : ""}`}>
			<div className='relative h-32 sm:h-40 w-full bg-[var(--accent)] flex items-center justify-center overflow-hidden'>
				{branch.imgUrl ? (
					<Image
						src={branch.imgUrl}
						alt={branch.name + " branch"}
						width={400}
						height={160}
						className='w-full h-full object-cover drop-shadow-lg'
						style={{
							filter: branch.isActive ? "none" : "grayscale(1) opacity(0.5)",
						}}
					/>
				) : (
					<div
						className='w-full h-full flex items-center justify-center p-4'
						style={{
							filter: branch.isActive ? "none" : "grayscale(1) opacity(0.5)",
						}}>
						<HorizontalLogo className='max-w-full max-h-full object-contain drop-shadow-lg' />
					</div>
				)}
				<span className='absolute top-3 right-3'>
					<BranchStatusIcon isActive={branch.isActive} />
				</span>
			</div>
			{/* Content Section */}
			<div className='flex-1 flex flex-col justify-between px-4 sm:px-5 py-3 sm:py-4'>
				<div className='space-y-2 sm:space-y-3'>
					<div className='flex items-center gap-2'>
						<h2 className='text-base sm:text-lg font-bold text-[var(--secondary)]'>
							{branch.name}
						</h2>
					</div>
					<div className='text-sm text-[var(--secondary)] opacity-80'>
						{branch.location}
					</div>
					<div className='flex flex-wrap gap-2 sm:gap-4 text-xs text-[var(--secondary)] opacity-70'>
						<span>Created: {formatDate(branch.createdAt)}</span>
						<span>Updated: {formatDate(branch.updatedAt)}</span>
					</div>
				</div>
			</div>

			{/* Footer Section with Buttons */}
			{(onView || onEdit || onDelete) && (
				<div className='px-3 py-3 bg-gray-50 border-t border-gray-100'>
					<div className='flex flex-row gap-2 justify-end'>
						{onDelete && (
							<button
								onClick={(e) =>
									handleActionClick(e, () => onDelete(branch.branchId))
								}
								className='group flex-1 sm:flex-initial w-10 h-10 rounded-lg bg-[var(--error)]/20 border-[var(--error)] border-1 text-white font-semibold hover:bg-[var(--error)] transition-colors text-xs sm:text-sm flex items-center justify-center'
								title='Delete Branch'>
								<DeleteBranchIcon className='w-7 h-7 text-[var(--error)] group-hover:text-[var(--primary)]' />
							</button>
						)}
						{onEdit && (
							<button
								onClick={(e) =>
									handleActionClick(e, () => onEdit(branch.branchId))
								}
								className='group flex-1 sm:flex-initial w-10 h-10 rounded-lg bg-[var(--secondary)]/20 border-[var(--secondary)] border-1 text-white font-semibold hover:bg-[var(--secondary)] transition-colors text-xs sm:text-sm flex items-center justify-center'
								title='Edit Branch'>
								<EditBranchIcon className='w-7 h-7 text-[var(--secondary)] group-hover:text-[var(--primary)]' />
							</button>
						)}
						{onView && (
							<button
								onClick={(e) =>
									handleActionClick(e, () => onView(branch.branchId))
								}
								className='group flex-1 sm:flex-initial w-10 h-10 rounded-lg bg-[var(--secondary)]/20 border-[var(--secondary)] border-1 text-white font-semibold hover:bg-[var(--secondary)] transition-colors text-xs sm:text-sm flex items-center justify-center gap-1'
								title='View Branch Details'>
								<ViewBranchIcon className='w-7 h-7 text-[var(--secondary)] group-hover:text-[var(--primary)]' />
							</button>
						)}
					</div>
				</div>
			)}
		</div>
	);
};

export default BranchCard;
