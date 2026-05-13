import Image from "next/image";

export default function HorizontalLogo({ className }: { className?: string }) {
	return (
		<div className={`relative h-full w-full flex items-center justify-center ${className}`}>
			<Image
				src="/K Egg Logo_Korean.png"
				alt="K-egg Logo"
				width={213}
				height={54}
				className="object-contain"
				priority
			/>
		</div>
	);
}
