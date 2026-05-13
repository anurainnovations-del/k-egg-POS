import Image from "next/image";

export default function TextLogo({ className }: { className?: string }) {
	return (
		<div className={`relative h-full w-full flex items-center justify-center ${className}`}>
			<Image
				src="/K Egg Logo_Korean.png"
				alt="K-egg Logo"
				width={153}
				height={31}
				className="object-contain"
				priority
			/>
		</div>
	);
}
