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

		const registerServiceWorker = async () => {
			try {
				const buildId = getBuildId();
				const swUrl = `/sw.js?buildId=${encodeURIComponent(buildId)}`;
				const reg = await navigator.serviceWorker.register(swUrl, {
					updateViaCache: "none",
				});

				// Handle updates to the service worker
				reg.addEventListener("updatefound", () => {
					const newWorker = reg.installing;
					if (newWorker) {
						newWorker.addEventListener("statechange", () => {
							if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
								console.log("New POS version found and loaded. Refreshing...");
								window.location.reload();
							}
						});
					}
				});
			} catch (error) {
				console.error("Service worker registration failed:", error);
			}
		};

		if (document.readyState === "complete") {
			void registerServiceWorker();
			return;
		}

		const handleLoad = () => {
			void registerServiceWorker();
		};

		window.addEventListener("load", handleLoad);

		return () => {
			window.removeEventListener("load", handleLoad);
		};
	}, []);

	return null;
}
