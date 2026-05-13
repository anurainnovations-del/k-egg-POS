import React from "react";

interface BranchStatusIconProps {
	isActive: boolean;
}

const BranchStatusIcon: React.FC<BranchStatusIconProps> = ({ isActive }) => {
	return isActive ? (
		<span className='inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--success)]/30 text-[var(--success)] text-xs font-semibold shadow border border-[var(--success)]'>
			<svg
				className='w-4 h-4 text-[var(--success)]'
				fill='currentColor'
				viewBox='0 0 20 20'>
				<path
					fillRule='evenodd'
					d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
					clipRule='evenodd'
				/>
			</svg>{" "}
			Active
		</span>
	) : (
		<span className='inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--error)]/30 text-[var(--error)] text-xs font-semibold shadow border border-[var(--error)]'>
			<svg
				className='w-4 h-4 text-[var(--error)]'
				fill='currentColor'
				viewBox='0 0 20 20'>
				<path
					fillRule='evenodd'
					d='M10 18a8 8 0 100-16 8 8 0 000 16zm-2.293-9.707a1 1 0 011.414 0L10 8.586l.879-.879a1 1 0 111.414 1.414L11.414 10l.879.879a1 1 0 01-1.414 1.414L10 11.414l-.879.879a1 1 0 01-1.414-1.414L8.586 10l-.879-.879a1 1 0 010-1.414z'
					clipRule='evenodd'
				/>
			</svg>{" "}
			Inactive
		</span>
	);
};

export default BranchStatusIcon;
