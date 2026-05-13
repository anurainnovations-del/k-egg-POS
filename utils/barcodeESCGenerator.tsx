/**
 * ESC/POS Barcode Generator for Next.js/TypeScript
 * Generates ESC/POS commands for printing barcodes
 */

export interface BarcodeOptions {
  /** Barcode type - defaults to CODE128 */
  type?: 'CODE39' | 'CODE128' | 'EAN13' | 'EAN8' | 'UPC_A' | 'ITF';
  /** Height of barcode in dots (1-255) - defaults to 162 */
  height?: number;
  /** Width of barcode module (2-6) - defaults to 3 */
  width?: number;
  /** Position of HRI text - defaults to 'below' */
  hriPosition?: 'none' | 'above' | 'below' | 'both';
  /** Font for HRI text - defaults to 'A' */
  hriFont?: 'A' | 'B';
  /** Add line feeds after barcode - defaults to 2 */
  lineFeeds?: number;
}

export class ESCPOSBarcodeGenerator {
  private static readonly ESC = 0x1B; // ESC character
  private static readonly GS = 0x1D;  // GS character

  /**
   * Generate ESC/POS commands for printing a barcode
   * @param data - The string data to encode in the barcode
   * @param options - Barcode configuration options
   * @returns Uint8Array containing ESC/POS commands
   */
  static generateBarcode(data: string, options: BarcodeOptions = {}): Uint8Array {
    const {
      type = 'CODE128',
      height = 162,
      width = 3,
      hriPosition = 'below',
      hriFont = 'A',
      lineFeeds = 2
    } = options;

    const commands: number[] = [];

    // Initialize printer
    commands.push(this.ESC, 0x40); // ESC @ - Initialize printer

    // Set barcode height
    commands.push(this.GS, 0x68, Math.max(1, Math.min(255, height))); // GS h n

    // Set barcode width
    commands.push(this.GS, 0x77, Math.max(2, Math.min(6, width))); // GS w n

    // Set HRI character position
    const hriPositions = {
      'none': 0,
      'above': 1,
      'below': 2,
      'both': 3
    };
    commands.push(this.GS, 0x48, hriPositions[hriPosition]); // GS H n

    // Set HRI character font
    const hriFonts = { 'A': 0, 'B': 1 };
    commands.push(this.GS, 0x66, hriFonts[hriFont]); // GS f n

    // Get barcode type command
    const barcodeTypeCmd = this.getBarcodeTypeCommand(type);
    commands.push(this.GS, 0x6B, barcodeTypeCmd); // GS k m

    // Add data length (for types that require it)
    if (['CODE39', 'CODE128', 'ITF'].includes(type)) {
      commands.push(data.length);
    }

    // Add barcode data
    for (let i = 0; i < data.length; i++) {
      commands.push(data.charCodeAt(i));
    }

    // Add null terminator for certain barcode types
    if (['EAN13', 'EAN8', 'UPC_A'].includes(type)) {
      commands.push(0x00);
    }

    // Add line feeds
    for (let i = 0; i < lineFeeds; i++) {
      commands.push(0x0A); // LF
    }

    return new Uint8Array(commands);
  }

  /**
   * Get the ESC/POS command code for barcode type
   */
  private static getBarcodeTypeCommand(type: string): number {
    const typeCodes = {
      'UPC_A': 0,
      'EAN13': 2,
      'EAN8': 3,
      'CODE39': 4,
      'ITF': 5,
      'CODE128': 73 // or use 6 for older printers
    };
    return typeCodes[type as keyof typeof typeCodes] || 73;
  }

  /**
   * Convert Uint8Array to hex string for debugging
   */
  static toHexString(commands: Uint8Array): string {
    return Array.from(commands)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join(' ')
      .toUpperCase();
  }

  /**
   * Validate barcode data based on type
   */
  static validateBarcodeData(data: string, type: string): { valid: boolean; error?: string } {
    switch (type) {
      case 'CODE39':
        if (!/^[0-9A-Z\-. $/+%]*$/.test(data)) {
          return { valid: false, error: 'CODE39 only supports 0-9, A-Z, and special characters (-.$/+%)' };
        }
        break;
      
      case 'CODE128':
        // CODE128 can encode all ASCII characters
        if (data.length === 0) {
          return { valid: false, error: 'CODE128 requires non-empty data' };
        }
        break;
      
      case 'EAN13':
        if (!/^\d{12,13}$/.test(data)) {
          return { valid: false, error: 'EAN13 requires 12 or 13 digits' };
        }
        break;
      
      case 'EAN8':
        if (!/^\d{7,8}$/.test(data)) {
          return { valid: false, error: 'EAN8 requires 7 or 8 digits' };
        }
        break;
      
      case 'UPC_A':
        if (!/^\d{11,12}$/.test(data)) {
          return { valid: false, error: 'UPC-A requires 11 or 12 digits' };
        }
        break;
      
      case 'ITF':
        if (!/^\d*$/.test(data) || data.length % 2 !== 0) {
          return { valid: false, error: 'ITF requires an even number of digits' };
        }
        break;
    }
    
    return { valid: true };
  }
}

/**
 * Simple function wrapper for easy usage
 * @param data - The string to encode as barcode
 * @param options - Barcode options
 * @returns ESC/POS command bytes as Uint8Array
 */
export function generateBarcodeESCPOS(data: string, options: BarcodeOptions = {}): Uint8Array {
  // Validate data
  const validation = ESCPOSBarcodeGenerator.validateBarcodeData(data, options.type || 'CODE128');
  if (!validation.valid) {
    throw new Error(`Invalid barcode data: ${validation.error}`);
  }

  return ESCPOSBarcodeGenerator.generateBarcode(data, options);
}

/**
 * Generate barcode and return as hex string (useful for debugging)
 */
export function generateBarcodeHex(data: string, options: BarcodeOptions = {}): string {
  const commands = generateBarcodeESCPOS(data, options);
  return ESCPOSBarcodeGenerator.toHexString(commands);
}