// lib/logo_processor.ts
// Utility to process and optimize logos for ESC/POS printing

export class LogoProcessor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Process an image for ESC/POS printing
   * Converts to monochrome bitmap and applies dithering for better quality
   * @param imageUrl - URL or path to the image
   * @param maxWidth - Maximum width in pixels (default: 384px for 48mm paper)
   * @param threshold - Threshold for black/white conversion (0-255, default: 128)
   * @returns Promise<Uint8Array> - ESC/POS bitmap command
   */
  async processImage(
    imageUrl: string, 
    maxWidth: number = 384, 
    threshold: number = 128
  ): Promise<Uint8Array> {
    const img = await this.loadImage(imageUrl);
    
    // Calculate dimensions maintaining aspect ratio
    const aspectRatio = img.height / img.width;
    const width = Math.min(img.width, maxWidth);
    const height = Math.floor(width * aspectRatio);
    
    this.canvas.width = width;
    this.canvas.height = height;
    
    // Draw image with white background
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.drawImage(img, 0, 0, width, height);
    
    const imageData = this.ctx.getImageData(0, 0, width, height);
    return this.convertToBitmap(imageData, threshold);
  }

  /**
   * Process image with error diffusion dithering for better quality
   */
  async processImageWithDithering(
    imageUrl: string, 
    maxWidth: number = 384
  ): Promise<Uint8Array> {
    const img = await this.loadImage(imageUrl);
    
    const aspectRatio = img.height / img.width;
    const width = Math.min(img.width, maxWidth);
    const height = Math.floor(width * aspectRatio);
    
    this.canvas.width = width;
    this.canvas.height = height;
    
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.drawImage(img, 0, 0, width, height);
    
    const imageData = this.ctx.getImageData(0, 0, width, height);
    this.applyFloydSteinbergDithering(imageData);
    
    return this.convertToBitmap(imageData, 128);
  }

  /**
   * Fast processing for quick printing - reduces resolution and skips fine details
   * @param imageUrl - URL or path to the image
   * @param maxWidth - Maximum width in pixels (default: 192px for faster printing)
   * @param lineSkip - Skip every Nth line for faster printing (default: 2 = skip every other line)
   * @param threshold - Threshold for black/white conversion
   */
  async processImageFast(
    imageUrl: string, 
    maxWidth: number = 192, // Reduced default width for speed
    lineSkip: number = 2,   // Skip every 2nd line
    threshold: number = 128
  ): Promise<Uint8Array> {
    const img = await this.loadImage(imageUrl);
    
    // Calculate smaller dimensions for faster processing
    const aspectRatio = img.height / img.width;
    const width = Math.min(img.width, maxWidth);
    const height = Math.floor(width * aspectRatio);
    
    // Reduce height further by line skipping
    const optimizedHeight = Math.floor(height / lineSkip);
    
    this.canvas.width = width;
    this.canvas.height = optimizedHeight;
    
    // Draw image with white background
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, width, optimizedHeight);
    
    // Use faster nearest-neighbor scaling
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(img, 0, 0, width, optimizedHeight);
    
    const imageData = this.ctx.getImageData(0, 0, width, optimizedHeight);
    return this.convertToBitmapFast(imageData, threshold);
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.crossOrigin = 'anonymous';
      img.src = url;
    });
  }

  private convertToBitmap(imageData: ImageData, threshold: number): Uint8Array {
    const { width, height, data } = imageData;
    const bitmapWidth = Math.ceil(width / 8) * 8;
    const bitmapData: number[] = [];
    
    for (let y = 0; y < height; y++) {
      let currentByte = 0;
      let bitCount = 0;
      
      for (let x = 0; x < bitmapWidth; x++) {
        let pixel = 0; // Default to white (0) - ESC/POS: 0 = white/no print, 1 = black/print
        
        if (x < width) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const alpha = data[idx + 3];
          
          // If pixel is transparent, treat as non-printable (white)
          if (alpha < 128) {
            pixel = 0; // Transparent → White (no print)
          } else {
            // Convert to grayscale for opaque pixels
            const gray = (r * 0.299 + g * 0.587 + b * 0.114);
            
            // Check if pixel is black or very dark
            const isBlack = gray < 32; // Very dark threshold (0-31 considered black)
            const isWhite = gray > 223; // Very light threshold (224-255 considered white)
            
            if (isBlack) {
              pixel = 0; // Black pixels become non-printable (white)
            } else if (isWhite) {
              pixel = 1; // White pixels become printable (black)
            } else {
              // Colored pixels (gray range) - process normally
              pixel = gray < threshold ? 1 : 0; // Dark colors = 1 (print), light colors = 0 (no print)
            }
          }
        }
        // If x >= width, pixel stays 0 (white) for padding
        
        currentByte = (currentByte << 1) | pixel;
        bitCount++;
        
        if (bitCount === 8) {
          bitmapData.push(currentByte);
          currentByte = 0;
          bitCount = 0;
        }
      }
    }
    
    // Create ESC/POS bitmap command: GS v 0
    const xL = (bitmapWidth / 8) & 0xFF;
    const xH = ((bitmapWidth / 8) >> 8) & 0xFF;
    const yL = height & 0xFF;
    const yH = (height >> 8) & 0xFF;
    
    return new Uint8Array([
      0x1D, 0x76, 0x30, 0x00, // GS v 0 (print bitmap)
      xL, xH,                   // Width in bytes
      yL, yH,                   // Height
      ...bitmapData
    ]);
  }

  private convertToBitmapFast(imageData: ImageData, threshold: number): Uint8Array {
    const { width, height, data } = imageData;
    const bitmapWidth = Math.ceil(width / 8) * 8;
    const bitmapData: number[] = [];
    
    // Process with simplified logic for speed
    for (let y = 0; y < height; y++) {
      let currentByte = 0;
      let bitCount = 0;
      
      for (let x = 0; x < bitmapWidth; x++) {
        let pixel = 0; // Default to white (0)
        
        if (x < width) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const alpha = data[idx + 3];
          
          // Fast processing - skip detailed analysis
          if (alpha < 128) {
            pixel = 0; // Transparent → White
          } else {
            // Quick grayscale conversion (faster than precise formula)
            const gray = (r + g + b) / 3;
            
            // Simplified thresholding
            if (gray < 32) {
              pixel = 0; // Black → White (no print)
            } else if (gray > 223) {
              pixel = 1; // White → Black (print)
            } else {
              // Simplified threshold for colors
              pixel = gray < threshold ? 1 : 0;
            }
          }
        }
        
        currentByte = (currentByte << 1) | pixel;
        bitCount++;
        
        if (bitCount === 8) {
          bitmapData.push(currentByte);
          currentByte = 0;
          bitCount = 0;
        }
      }
    }
    
    // Create ESC/POS bitmap command with optimized height
    const xL = (bitmapWidth / 8) & 0xFF;
    const xH = ((bitmapWidth / 8) >> 8) & 0xFF;
    const yL = height & 0xFF;
    const yH = (height >> 8) & 0xFF;
    
    return new Uint8Array([
      0x1D, 0x76, 0x30, 0x00, // GS v 0 (print bitmap)
      xL, xH,                   // Width in bytes
      yL, yH,                   // Height
      ...bitmapData
    ]);
  }

  private applyFloydSteinbergDithering(imageData: ImageData): void {
    const { width, height, data } = imageData;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const alpha = data[idx + 3];
        
        // Skip transparent pixels - keep them white
        if (alpha < 128) {
          data[idx] = data[idx + 1] = data[idx + 2] = 255; // Set to white
          continue;
        }
        
        // Convert to grayscale for opaque pixels
        const oldPixel = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
        
        // Check for special cases
        const isBlack = oldPixel < 32; // Very dark threshold (0-31 considered black)
        const isWhite = oldPixel > 223; // Very light threshold (224-255 considered white)
        
        if (isBlack) {
          // Black pixels become white (non-printable)
          data[idx] = data[idx + 1] = data[idx + 2] = 255;
          continue; // Skip dithering for black pixels
        }
        
        if (isWhite) {
          // White pixels become black (printable) - no dithering needed
          data[idx] = data[idx + 1] = data[idx + 2] = 0;
          continue; // Skip dithering for white pixels
        }
        
        // Apply dithering to colored pixels (gray range)
        const newPixel = oldPixel > 128 ? 255 : 0;
        const error = oldPixel - newPixel;
        
        // Set the new pixel value
        data[idx] = data[idx + 1] = data[idx + 2] = newPixel;
        
        // Distribute error to neighboring pixels
        this.distributeError(data, width, height, x + 1, y, error * 7 / 16);
        this.distributeError(data, width, height, x - 1, y + 1, error * 3 / 16);
        this.distributeError(data, width, height, x, y + 1, error * 5 / 16);
        this.distributeError(data, width, height, x + 1, y + 1, error * 1 / 16);
      }
    }
  }

  private distributeError(
    data: Uint8ClampedArray, 
    width: number, 
    height: number, 
    x: number, 
    y: number, 
    error: number
  ): void {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];
      
      // Don't distribute error to transparent pixels
      if (alpha < 128) {
        return;
      }
      
      // Don't distribute error to black or white pixels (special cases)
      const currentGray = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
      if (currentGray < 32 || currentGray > 223) {
        return; // Skip black and white pixels
      }
      
      const newValue = currentGray + error;
      const clampedValue = Math.max(0, Math.min(255, newValue));
      data[idx] = data[idx + 1] = data[idx + 2] = clampedValue;
    }
  }
}

// Convenience function for quick logo processing
export async function processLogoForESCPOS(
  logoUrl: string, 
  maxWidth?: number, 
  useDithering: boolean = true
): Promise<Uint8Array> {
  const processor = new LogoProcessor();
  
  if (useDithering) {
    return await processor.processImageWithDithering(logoUrl, maxWidth);
  } else {
    return await processor.processImage(logoUrl, maxWidth);
  }
}
