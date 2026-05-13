"use client";

import React, { useState, useEffect } from 'react';
import SafeImage from './SafeImage';

interface LogoPreviewProps {
  logoUrl: string;
  maxWidth?: number;
  className?: string;
}

export const LogoPreview: React.FC<LogoPreviewProps> = ({ 
  logoUrl, 
  maxWidth = 384, 
  className = "" 
}) => {
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const generatePreview = async () => {
      if (!logoUrl) return;
      
      setLoading(true);
      setError('');
      
      try {      
        // Create a temporary canvas to show how the logo will look after processing
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = async () => {
          // Calculate dimensions maintaining aspect ratio
          const aspectRatio = img.height / img.width;
          const width = Math.min(img.width, maxWidth);
          const height = Math.floor(width * aspectRatio);
          
          canvas.width = width;
          canvas.height = height;
          
          // Draw with white background (like thermal paper)
          ctx!.fillStyle = 'white';
          ctx!.fillRect(0, 0, width, height);
          ctx!.drawImage(img, 0, 0, width, height);
          
          // Apply ESC/POS processing preview
          const imageData = ctx!.getImageData(0, 0, width, height);
          const data = imageData.data;
          
          // Convert to monochrome preview
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const alpha = data[i + 3];
            
            // Convert to grayscale
            const gray = (r * 0.299 + g * 0.587 + b * 0.114) * (alpha / 255);
            const bw = gray > 128 ? 255 : 0;
            
            data[i] = data[i + 1] = data[i + 2] = bw;
          }
          
          ctx!.putImageData(imageData, 0, 0);
          setPreviewUrl(canvas.toDataURL());
          setLoading(false);
        };
        
        img.onerror = () => {
          setError('Failed to load image');
          setLoading(false);
        };
        
        img.crossOrigin = 'anonymous';
        img.src = logoUrl;
        
      } catch (err) {
        setError('Error processing logo: ' + (err as Error).message);
        setLoading(false);
      }
    };
    generatePreview();
  }, [logoUrl, maxWidth]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-4 bg-gray-100 rounded ${className}`}>
        <div className="text-sm text-gray-600">Processing logo...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center p-4 bg-red-100 text-red-600 rounded ${className}`}>
        <div className="text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className={`bg-white border rounded p-4 ${className}`}>
      <div className="text-sm text-gray-600 mb-2">Receipt Logo Preview:</div>
      {previewUrl && (
        <div className="bg-white border rounded p-2" style={{ maxWidth: maxWidth + 'px' }}>
          <SafeImage 
            src={previewUrl} 
            alt="Logo preview" 
            className="max-w-full h-auto"
          />
        </div>
      )}
      <div className="text-xs text-gray-500 mt-2">
        This preview shows how your logo will appear on thermal printer receipts.
      </div>
    </div>
  );
};

export default LogoPreview;
