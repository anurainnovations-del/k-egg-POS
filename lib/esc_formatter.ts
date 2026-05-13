// lib/esc_formatter.ts
// Utility for formatting order receipts for ESC/POS printers

import { processLogoForESCPOS } from "./logo_processor";

export interface ReceiptOrderItem {
	name: string;
	qty: number;
	price: number;
	total: number;
}

export interface ReceiptOrderData {
	orderId: string;
	date: Date;
	items: ReceiptOrderItem[];
	subtotal: number;
	discount?: number;
	total: number;
	payment: number;
	change: number;
	cashier?: string;
	cashierEmployeeId?: string;
	storeName?: string;
	branchName?: string;
	appliedDiscountCode?: string;
}

// Helper to pad/align text for ESC/POS
function padRight(str: string, len: number) {
	return str.length >= len
		? str.slice(0, len)
		: str + " ".repeat(len - str.length);
}
function padLeft(str: string, len: number) {
	return str.length >= len
		? str.slice(0, len)
		: " ".repeat(len - str.length) + str;
}

export async function formatReceiptESC(
	order: ReceiptOrderData,
	logoUrl?: string
): Promise<Uint8Array> {
	const encoder = new TextEncoder();
	const esc = (arr: number[]) => new Uint8Array(arr);
	const lines: (string | Uint8Array)[] = [];

	// Header with Logo
	lines.push(esc([0x1b, 0x40])); // Initialize printer

	// Print logo if provided
	if (logoUrl) {
		try {
			const logoBitmap = await processLogoForESCPOS(logoUrl, 384, true); // Use dithering for better quality
			if (logoBitmap.length > 0) {
				lines.push(esc([0x1b, 0x61, 0x01])); // Center alignment
				lines.push(logoBitmap);
				lines.push(encoder.encode("\n"));
			}
		} catch (error) {
			console.error("Failed to process logo image:", error);
		}
	}

	// Store name header
	lines.push(esc([0x1b, 0x61, 0x01])); // Center
	lines.push(esc([0x1d, 0x21, 0x00])); // Normal
	lines.push(encoder.encode("\n"));

	// Order details
	lines.push(esc([0x1b, 0x61, 0x00])); // Left align
	lines.push(encoder.encode(`Order #: ${order.orderId}\n`));
	lines.push(encoder.encode(`Date: ${order.date.toLocaleString()}\n`));
	if (order.branchName) {
		lines.push(encoder.encode(`Branch: ${order.branchName}\n`));
	}
	if (order.cashier) {
		lines.push(encoder.encode(`Cashier: ${order.cashier}\n`));
	}
	lines.push(encoder.encode("\n"));

	// Items section
	lines.push(encoder.encode("QTY  ITEM                AMOUNT\n"));
	lines.push(encoder.encode("-------------------------------\n"));
	for (const item of order.items) {
		const qty = padLeft(item.qty.toString(), 2);
		const name = padRight(item.name, 18);
		const amount = padLeft(item.total.toFixed(2), 8);
		lines.push(encoder.encode(`${qty}  ${name}${amount}\n`));
	}
	lines.push(encoder.encode("-------------------------------\n"));

	// Totals section
	lines.push(
		encoder.encode(
			padLeft("Subtotal:", 22) + padLeft(order.subtotal.toFixed(2), 10) + "\n"
		)
	);
	if (order.discount && order.discount > 0) {
		lines.push(
			encoder.encode(
				padLeft("Discount:", 22) +
					padLeft("-" + order.discount.toFixed(2), 10) +
					"\n"
			)
		);
		if (order.appliedDiscountCode) {
			lines.push(
				encoder.encode(
					padLeft("Code:", 22) + padLeft(order.appliedDiscountCode, 10) + "\n"
				)
			);
		}
	}
	lines.push(esc([0x1b, 0x45, 0x01])); // Bold on
	lines.push(
		encoder.encode(
			padLeft("TOTAL:", 22) + padLeft(order.total.toFixed(2), 10) + "\n"
		)
	);
	lines.push(esc([0x1b, 0x45, 0x00])); // Bold off
	lines.push(
		encoder.encode(
			padLeft("Payment:", 22) + padLeft(order.payment.toFixed(2), 10) + "\n"
		)
	);
	lines.push(
		encoder.encode(
			padLeft("Change:", 22) + padLeft(order.change.toFixed(2), 10) + "\n"
		)
	);
	lines.push(encoder.encode("\n"));

	// Footer
	lines.push(esc([0x1b, 0x61, 0x01])); // Center
	lines.push(encoder.encode("Thank you for your order!\n"));
	lines.push(encoder.encode("Come back soon!\n"));
	lines.push(encoder.encode("\n\n\n"));
	lines.push(esc([0x1d, 0x56, 0x00])); // Cut paper

	// Concatenate all data
	let totalLen = 0;
	for (const l of lines) {
		totalLen +=
			l instanceof Uint8Array ? l.length : encoder.encode(l as string).length;
	}

	const result = new Uint8Array(totalLen);
	let offset = 0;
	for (const l of lines) {
		if (l instanceof Uint8Array) {
			result.set(l, offset);
			offset += l.length;
		} else {
			const encoded = encoder.encode(l);
			result.set(encoded, offset);
			offset += encoded.length;
		}
	}

	return result;
}

// Convenience function to format receipt with FoodMood logo
export async function formatReceiptWithLogo(
	order: ReceiptOrderData
): Promise<Uint8Array> {
	const logoUrl = "/escpos_image.png"; // Your pre-processed logo for ESC/POS
	return await formatReceiptESC(order, logoUrl);
}

// Alternative function for custom logo URL
export async function formatReceiptWithCustomLogo(
	order: ReceiptOrderData,
	logoUrl: string
): Promise<Uint8Array> {
	return await formatReceiptESC(order, logoUrl);
}
