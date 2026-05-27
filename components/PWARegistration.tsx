"use client";

import { useEffect } from "react";

type NextData = {
	buildId?: string;
};

const getBuildId = (): string => {
	if (typeof window === "undefined") return "dev";
	const nextData = (window as Window & { __NEXT_DATA__?: NextData })
		.__NEXT_DATA__;
	return typeof nextData?.buildId === "string" && nextData.buildId.length > 0
		? nextData.buildId
		: "dev";
};

export default function PWARegistration() {
	useEffect(() => {
		if (
			process.env.NODE_ENV !== "production" ||
			typeof window === "undefined" ||
			!("serviceWorker" in navigator)
		) {
			return;
		}

		const registerServiceWorker = () => {
			const buildId = getBuildId();
			const swUrl = `/sw.js?buildId=${encodeURIComponent(buildId)}`;
			void navigator.serviceWorker.register(swUrl, {
				updateViaCache: "none",
			});
		};

		if (document.readyState === "complete") {
			registerServiceWorker();
			return;
		}

		window.addEventListener("load", registerServiceWorker);

		return () => {
			window.removeEventListener("load", registerServiceWorker);
		};
	}, []);

	return null;
}
