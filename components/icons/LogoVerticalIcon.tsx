import Image from "next/image";

export default function LogoVerticalIcon({ className }: { className?: string }) {
	return (
		<div className={`relative h-full w-full flex items-center justify-center ${className}`}>
			<Image
				src="/K Egg Logo_Korean.png"
				alt="K-egg Logo"
				width={166}
				height={101}
				className="object-contain"
				priority
			/>
		</div>
	);
}
