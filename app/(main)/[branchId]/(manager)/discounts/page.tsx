"use client";

import React, { useState, useEffect } from "react";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import { Discount, discountService } from "@/services/discountService";
import { subscribeToDiscounts, subscribeToCategories } from "@/stores/dataStore";
import { Category } from "@/services/categoryService";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";
import DiscountModal from "./components/DiscountModal";
import DeleteConfirmationModal from "./components/DeleteConfirmationModal";
import PlusIcon from "@/components/icons/PlusIcon";
import { Timestamp } from "firebase/firestore";
import { formatCurrency } from "@/lib/currency_formatter";
import DiscountsIcon from "@/components/icons/SidebarNav/DiscountsIcon";
import ViewOnlyWrapper from "@/components/ViewOnlyWrapper";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function DiscountsScreen() {
	const { currentBranch } = useBranch();
	const [discounts, setDiscounts] = useState<Discount[]>([]);
	const [categories, setCategories] = useState<Category[]>([]);
	const [loading, setLoading] = useState(true);

	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
	const [deleteConfirmation, setDeleteConfirmation] = useState<{
		isOpen: boolean;
		discount: Discount | null;
	}>({ isOpen: false, discount: null });

	useEffect(() => {
		if (!currentBranch?.id) return;

		const unsubscribeDiscounts = subscribeToDiscounts(
			currentBranch.id,
			(discounts: Discount[]) => {
				setDiscounts(discounts);
				setLoading(false);
			}
		);

		const unsubscribeCategories = subscribeToCategories(
			(categories: Category[]) => {
				setCategories(categories);
			}
		);

		return () => {
			unsubscribeDiscounts();
			unsubscribeCategories();
		};
	}, [currentBranch?.id]);

	const handleCreateDiscount = () => {
		setEditingDiscount(null);
		setIsModalOpen(true);
	};

	const handleEditDiscount = (discount: Discount) => {
		setEditingDiscount(discount);
		setIsModalOpen(true);
	};

	const handleDeleteDiscount = (discount: Discount) => {
		setDeleteConfirmation({ isOpen: true, discount });
	};

	const confirmDelete = async () => {
		if (!deleteConfirmation.discount) return;
		try {
			await discountService.deleteDiscount(deleteConfirmation.discount.id!);
			setDeleteConfirmation({ isOpen: false, discount: null });
		} catch (error) {
			console.error("Error deleting discount:", error);
			alert("Failed to delete discount.");
		}
	};

	const formatValue = (discount: Discount) => {
		return discount.type === "percentage"
			? `${discount.value}% OFF`
			: `-${formatCurrency(discount.value)}`;
	};

	const getAppliesTo = (discount: Discount) => {
		if (!discount.applies_to) return "All Items";
		const category = categories.find((cat) => cat.id === discount.applies_to);
		return category ? category.name : "Unknown Category";
	};

	const formatDate = (timestamp: any) => {
		if (!timestamp) return "N/A";
		try {
			const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
			return date.toLocaleDateString("en-US", {
				month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
			});
		} catch (error) { return "Invalid Date"; }
	};

	if (loading) {
		return (
			<div className='flex h-full overflow-hidden'>
				<div className='flex flex-col flex-1 h-full overflow-hidden'>
					<div className='xl:hidden w-full'>
						<MobileTopBar title='Discounts' icon={<DiscountsIcon className="w-6 h-6" />} />
					</div>
					<div className='hidden xl:block w-full'>
						<TopBar title='Discounts' icon={<DiscountsIcon className="w-6 h-6" />} />
					</div>
					<div className='flex-1 flex items-center justify-center'>
						<LoadingSpinner />
					</div>
				</div>
			</div>
		);
	}

	return (
		<ViewOnlyWrapper branchId={currentBranch?.id} pageName='discounts'>
			<div className='flex h-full overflow-hidden'>
				<div className='flex flex-col flex-1 h-full overflow-hidden'>
					<div className='xl:hidden w-full'>
						<MobileTopBar title='Discounts' icon={<DiscountsIcon className="w-6 h-6" />} />
					</div>
					<div className='hidden xl:block w-full'>
						<TopBar title='Discounts' icon={<DiscountsIcon className="w-6 h-6" />} />
					</div>

					<div className='flex-1 overflow-auto p-6'>
						<div className='max-w-6xl mx-auto space-y-6'>
							<div className='flex items-center justify-between'>
								<h2 className='text-xl font-bold text-[var(--secondary)]'>Discount Codes</h2>
								<button
									onClick={handleCreateDiscount}
									className='bg-[var(--accent)] text-[var(--secondary)] px-5 py-2.5 rounded-xl font-black shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2'
								>
									<PlusIcon className="w-4 h-4" /> ADD DISCOUNT
								</button>
							</div>

							{discounts.length === 0 ? (
								<div className='bg-white rounded-2xl border border-dashed border-gray-300 p-20 text-center'>
									<div className="text-4xl mb-4">🎟️</div>
									<h3 className='text-lg font-bold text-[var(--secondary)]'>No active discounts</h3>
									<p className='text-sm text-gray-500 mb-6'>Create your first discount code to get started.</p>
								</div>
							) : (
								<div className='bg-white rounded-2xl shadow-sm border border-[var(--border)] overflow-hidden'>
									<table className='min-w-full divide-y divide-gray-200'>
										<thead className='bg-gray-50'>
											<tr>
												<th className='px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase'>Code</th>
												<th className='px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase'>Value</th>
												<th className='px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase'>Type</th>
												<th className='px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase'>Applies To</th>
												<th className='px-6 py-4 text-right text-[10px] font-bold text-gray-500 uppercase'>Actions</th>
											</tr>
										</thead>
										<tbody className='divide-y divide-gray-100'>
											{discounts.map((discount) => (
												<tr key={discount.id} className='hover:bg-gray-50 transition-colors'>
													<td className='px-6 py-4 whitespace-nowrap font-bold text-[var(--secondary)]'>{discount.discount_code}</td>
													<td className='px-6 py-4 whitespace-nowrap text-sm font-black text-[var(--secondary)]'>{formatValue(discount)}</td>
													<td className='px-6 py-4 whitespace-nowrap'>
														<span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${discount.type === 'percentage' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
															{discount.type}
														</span>
													</td>
													<td className='px-6 py-4 whitespace-nowrap text-xs text-gray-600'>{getAppliesTo(discount)}</td>
													<td className='px-6 py-4 whitespace-nowrap text-right'>
														<div className='flex items-center justify-end gap-3'>
															<button onClick={() => handleEditDiscount(discount)} className='text-blue-500 hover:text-blue-700 font-bold text-xs'>EDIT</button>
															<button onClick={() => handleDeleteDiscount(discount)} className='text-red-500 hover:text-red-700 font-bold text-xs'>DELETE</button>
														</div>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</div>
					</div>

					<DiscountModal
						isOpen={isModalOpen}
						onClose={() => setIsModalOpen(false)}
						discount={editingDiscount}
						onSuccess={() => setIsModalOpen(false)}
					/>

					<DeleteConfirmationModal
						isOpen={deleteConfirmation.isOpen}
						onClose={() => setDeleteConfirmation({ isOpen: false, discount: null })}
						onConfirm={confirmDelete}
						title='Delete Discount'
						message={`Are you sure you want to delete "${deleteConfirmation.discount?.discount_code}"?`}
					/>
				</div>
			</div>
		</ViewOnlyWrapper>
	);
}
