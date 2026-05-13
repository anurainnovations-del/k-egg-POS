'use client';

import { useState } from 'react';
import Image from "next/image";

interface SafeImageProps {
    src: string; 
    alt: string;
    className?: string
}

export default function SafeImage({ src, alt, className }: SafeImageProps) {
    const [hasError, setHasError] = useState(false);
    
    if (hasError || !src) {
        return null;
    }
    
    return (
        <Image
            src={src}
            alt={alt}
            fill
            className={`object-cover ${className || ''}`}
            sizes="102px"
            unoptimized
            onError={() => {
                console.error('Image failed to load:', src);
                setHasError(true);
            }}
        />
    );
};