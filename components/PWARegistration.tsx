"use client";

import { useEffect } from "react";

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
			void navigator.serviceWorker.register("/sw.js");
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
