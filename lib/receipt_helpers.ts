// lib/receipt_helpers.ts
// Helpers for turning persisted orders back into printable receipt data, so a
// receipt can be reprinted from anywhere (e.g. the orders page) without the
// original cart/payment state.

import { Timestamp } from "firebase/firestore";
import { Order } from "@/services/orderService";
import { ReceiptOrderData } from "@/lib/esc_formatter";

// Normalises the various shapes a Firestore date can arrive in (Timestamp,
// serialized {seconds}, plain Date/string) into a Date.
function toDate(value: unknown): Date {
	if (!value) return new Date();
	if (value instanceof Timestamp) return value.toDate();
	if (
		typeof value === "object" &&
		value !== null &&
		"toDate" in value &&
		typeof (value as { toDate: unknown }).toDate === "function"
	) {
		return (value as { toDate: () => Date }).toDate();
	}
	if (typeof value === "object" && value !== null && "seconds" in value) {
		const raw = value as { seconds: number; nanoseconds?: number };
		return new Timestamp(raw.seconds, raw.nanoseconds ?? 0).toDate();
	}
	return new Date(value as string | number | Date);
}

// Builds receipt data from a stored order for reprinting. The cash tendered and
// change aren't persisted on the order, so a reprint shows the order total as
// the amount paid with no change due.
export function orderToReceiptData(order: Order, branchName?: string): ReceiptOrderData {
	return {
		orderId: order.id,
		date: toDate(order.createdAt),
		items: (order.items || []).map((it) => ({
			name: it.name,
			qty: it.quantity,
			price: it.price,
			total: it.subtotal ?? it.price * it.quantity,
		})),
		subtotal: order.subtotal,
		discount: order.discountAmount,
		appliedDiscountCode: order.discountCode,
		total: order.total,
		payment: order.total,
		change: 0,
		cashier: order.workerName,
		storeName: "K-egg POS",
		branchName,
	};
}
