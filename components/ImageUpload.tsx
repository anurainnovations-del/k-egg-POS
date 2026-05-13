'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { uploadToFirebaseStorage, MediaBucket } from '@/lib/firebaseStorage';

interface ImageUploadProps {
  currentImageUrl?: string;
  onImageUpload: (imageUrl: string) => void;
  onImageRemove?: () => void;
  className?: string;
  label?: string;
  bucket?: MediaBucket;
}

export default function ImageUpload({ 
  currentImageUrl, 
  onImageUpload, 
  onImageRemove,
  className = '',
  label = 'Item Image',
  bucket
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/^image\/(jpeg|jpg|png)$/)) {
      setUploadError('Please select a JPG or PNG image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image file size must be less than 5MB');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const result = await uploadToFirebaseStorage(file, { bucket });
      onImageUpload(result.url);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = () => {
    if (onImageRemove) {
      onImageRemove();
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
        {label} <span className="text-xs text-[var(--secondary)]/50 ml-1">(Optional)</span>
      </label>
      
      {/* Image Preview or Upload Area */}
      <div className="relative">
        {currentImageUrl ? (
          // Image Preview
          <div className="relative group">
            <div className="w-full h-[300px] bg-[var(--secondary)]/5 rounded-xl overflow-hidden border-2 border-[var(--secondary)]/20 relative">
              <Image
                src={currentImageUrl}
                alt="Item preview"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </div>
            
            {/* Overlay with actions */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={triggerFileInput}
                disabled={uploading}
                className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary)]/50 text-[var(--secondary)] rounded-lg font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Change'}
              </button>
              <button
                type="button"
                onClick={handleRemoveImage}
                className="px-4 py-2 bg-[var(--error)] hover:bg-[var(--error)]/50 text-white rounded-lg font-medium transition-all hover:scale-105 active:scale-95"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          // Upload Area
          <div 
            onClick={triggerFileInput}
            className="group w-full h-48 border-2 border-dashed border-[var(--secondary)]/50 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all"
          >
            {uploading ? (
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-dashed border-[var(--accent)] mb-3"></div>
                <span className="text-sm text-[var(--secondary)]/50">Uploading image...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <svg className="w-12 h-12 text-[var(--secondary)]/50 mb-3 group-hover:text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-sm font-medium text-[var(--secondary)]/50 mb-1 group-hover:text-[var(--accent)]">Click to upload image</span>
                <span className="text-xs text-[var(--secondary)]/50 group-hover:text-[var(--accent)]">JPG or PNG, max 10MB</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {uploadError && (
        <div className="p-3 bg-[var(--error)]/10 border border-[var(--error)]/20 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--error)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-[var(--error)]">{uploadError}</span>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
