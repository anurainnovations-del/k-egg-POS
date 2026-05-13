import React from "react";

interface TableHeaderProps {
	columns: Array<{
		key: string;
		label: string;
		sortable: boolean;
	}>;
	sortConfig?: SortConfig;
	onSort?: (column: string) => void;
}

interface SortConfig {
	column: string;
	direction: "asc" | "desc";
}

function SortIcon({ direction }: { direction?: "asc" | "desc" }) {
	return (
		<div className='ml-2 flex flex-col'>
			<svg
				className={`w-3 h-3 ${
					direction === "asc" ? "text-[var(--accent)]" : "text-gray-300"
				}`}
				fill='currentColor'
				viewBox='0 0 20 20'>
				<path d='M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z' />
			</svg>
			<svg
				className={`w-3 h-3 -mt-1 ${
					direction === "desc" ? "text-[var(--accent)]" : "text-gray-300"
				}`}
				fill='currentColor'
				viewBox='0 0 20 20'>
				<path d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' />
			</svg>
		</div>
	);
}

export default function TableHeader({
	columns,
	sortConfig,
	onSort,
}: TableHeaderProps) {
	return (
		<thead className='bg-gray-50'>
			<tr>
				{columns.map((column) => (
					<th
						key={column.key}
						className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
							column.sortable ? "cursor-pointer hover:bg-gray-100" : ""
						}`}
						onClick={() => column.sortable && onSort?.(column.key)}>
						<div className='flex items-center'>
							<span>{column.label}</span>
							{column.sortable && (
								<SortIcon
									direction={
										sortConfig?.column === column.key
											? sortConfig.direction
											: undefined
									}
								/>
							)}
						</div>
					</th>
				))}
			</tr>
		</thead>
	);
}
