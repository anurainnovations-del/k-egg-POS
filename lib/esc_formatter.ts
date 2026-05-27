// lib/esc_formatter.ts
// Utility for formatting order receipts for 58mm ESC/POS printers

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

// Calculate the visual width of a string, taking into account full-width CJK characters
function getVisualLength(str: string): number {
	let len = 0;
	for (let i = 0; i < str.length; i++) {
		const code = str.charCodeAt(i);
		// Check if it's CJK/full-width character (Korean Hangul, Chinese, Japanese)
		if (
			(code >= 0x1100 && code <= 0x11FF) || // Hangul Jamo
			(code >= 0x3000 && code <= 0x303F) || // CJK Symbols and Punctuation
			(code >= 0x3040 && code <= 0x309F) || // Hiragana
			(code >= 0x30A0 && code <= 0x30FF) || // Katakana
			(code >= 0x3130 && code <= 0x318F) || // Hangul Compatibility Jamo
			(code >= 0xAC00 && code <= 0xD7A3) || // Hangul Syllables
			(code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified Ideographs
			(code >= 0xF900 && code <= 0xFAFF) || // CJK Compatibility Ideographs
			(code >= 0xFF01 && code <= 0xFF60)    // Fullwidth ASCII variants
		) {
			len += 2;
		} else {
			len += 1;
		}
	}
	return len;
}

// Slices a string so that its visual length does not exceed maxLen
function sliceVisual(str: string, maxLen: number): string {
	let visualLen = 0;
	let result = "";
	for (let i = 0; i < str.length; i++) {
		const char = str[i];
		const charLen = getVisualLength(char);
		if (visualLen + charLen > maxLen) {
			break;
		}
		result += char;
		visualLen += charLen;
	}
	return result;
}

// Pad right matching visual length
function padRight(str: string, len: number) {
	const visualLen = getVisualLength(str);
	if (visualLen >= len) {
		return sliceVisual(str, len);
	}
	return str + " ".repeat(len - visualLen);
}

// Pad left matching visual length
function padLeft(str: string, len: number) {
	const visualLen = getVisualLength(str);
	if (visualLen >= len) {
		return sliceVisual(str, len);
	}
	return " ".repeat(len - visualLen) + str;
}

// Formats an item row with quantity, item name (with word-wrap), and total amount
function formatItemRow(qtyStr: string, name: string, amountStr: string, lineLength: number = 32): string[] {
	const qtyWidth = 2;
	const qtySpacer = "  "; // 2 spaces
	const amountWidth = 8;
	const nameWidth = lineLength - qtyWidth - qtySpacer.length - amountWidth; // 32 - 2 - 2 - 8 = 20

	const qtyPad = padLeft(qtyStr, qtyWidth);
	const amountPad = padLeft(amountStr, amountWidth);

	const visualLen = getVisualLength(name);
	if (visualLen <= nameWidth) {
		const namePad = padRight(name, nameWidth);
		return [`${qtyPad}${qtySpacer}${namePad}${amountPad}\n`];
	} else {
		const lines: string[] = [];
		// First line has the qty, first part of the name, and the amount
		const firstPart = sliceVisual(name, nameWidth);
		const namePad = padRight(firstPart, nameWidth);
		lines.push(`${qtyPad}${qtySpacer}${namePad}${amountPad}\n`);
		
		// Remaining lines just have the rest of the name, padded/indented
		let remaining = name.slice(firstPart.length);
		const indent = " ".repeat(qtyWidth + qtySpacer.length); // 4 spaces
		while (getVisualLength(remaining) > 0) {
			const part = sliceVisual(remaining, nameWidth);
			const partPad = padRight(part, nameWidth);
			lines.push(`${indent}${partPad}${" ".repeat(amountWidth)}\n`);
			remaining = remaining.slice(part.length);
		}
		return lines;
	}
}

export async function formatReceiptESC(
	order: ReceiptOrderData,
	logoUrl?: string,
	kickDrawer: boolean = true
): Promise<Uint8Array> {
	const encoder = new TextEncoder();
	const esc = (arr: number[]) => new Uint8Array(arr);
	const lines: (string | Uint8Array)[] = [];

	// Header & Initialization
	lines.push(esc([0x1b, 0x40])); // Initialize printer
	
	// Cash Drawer Kick Command: ESC p m t1 t2
	// m = 0 (Pin 2), t1 = 40 (80ms pulse), t2 = 80 (160ms delay)
	if (kickDrawer) {
		lines.push(esc([0x1b, 0x70, 0x00, 0x28, 0x50]));
	}

	// Print logo if provided
	if (logoUrl) {
		try {
			const logoBitmap = await processLogoForESCPOS(logoUrl, 256, true); // 256px wide - fast enough, clear on 58mm paper
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
	lines.push(esc([0x1b, 0x21, 0x30])); // Double width + double height (ESC ! 48)
	if (order.storeName) {
		lines.push(encoder.encode(`${order.storeName}\n`));
	}
	lines.push(esc([0x1b, 0x21, 0x00])); // Reset to normal size (ESC ! 0)
	if (order.branchName) {
		lines.push(encoder.encode(`${order.branchName}\n`));
	}
	lines.push(encoder.encode("\n"));

	// Order details
	lines.push(esc([0x1b, 0x61, 0x00])); // Left align
	lines.push(encoder.encode(`Order #: ${order.orderId.slice(-8).toUpperCase()}\n`));
	lines.push(encoder.encode(`Date: ${order.date.toLocaleString()}\n`));
	if (order.cashier) {
		lines.push(encoder.encode(`Cashier: ${order.cashier}\n`));
	}
	lines.push(encoder.encode("\n"));

	// Items section (Exactly 32-character columns)
	lines.push(encoder.encode("QTY  ITEM                 AMOUNT\n"));
	lines.push(encoder.encode("--------------------------------\n"));
	for (const item of order.items) {
		const itemRows = formatItemRow(item.qty.toString(), item.name, item.total.toFixed(2), 32);
		for (const row of itemRows) {
			lines.push(encoder.encode(row));
		}
	}
	lines.push(encoder.encode("--------------------------------\n"));

	// Totals section (32-character layout: label width 22, value width 10)
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

// Convenience function to format receipt with K-Egg logo
export async function formatReceiptWithLogo(
	order: ReceiptOrderData,
	kickDrawer: boolean = true
): Promise<Uint8Array> {
	const logoUrl = "/K%20Egg%20Logo_Korean.png";
	return await formatReceiptESC(order, logoUrl, kickDrawer);
}

// Alternative function for custom logo URL
export async function formatReceiptWithCustomLogo(
	order: ReceiptOrderData,
	logoUrl: string,
	kickDrawer: boolean = true
): Promise<Uint8Array> {
	return await formatReceiptESC(order, logoUrl, kickDrawer);
}

