const buildId = new URL(self.location.href).searchParams.get("buildId") || "dev";
const CACHE_VERSION = `v3-${buildId}`;
const CACHE_PREFIX = "k-egg-pos-";
const SHELL_CACHE = `${CACHE_PREFIX}shell-${CACHE_VERSION}`;
const ASSET_CACHE = `${CACHE_PREFIX}assets-${CACHE_VERSION}`;
const DATA_CACHE = `${CACHE_PREFIX}data-${CACHE_VERSION}`;
const CURRENT_CACHES = new Set([SHELL_CACHE, ASSET_CACHE, DATA_CACHE]);
const APP_SHELL_ASSETS = [
	"/",
	"/manifest.json",
	"/192x192.png?v=2",
	"/512x512.png?v=2",
	"/cover.png",
];

const STATIC_ASSET_EXTENSIONS = [
	".js",
	".css",
	".html",
	".svg",
	".png",
	".jpg",
	".jpeg",
	".webp",
	".gif",
	".ico",
	".woff",
	".woff2",
	".ttf",
	".otf",
];

const isSameOrigin = (url) => url.origin === self.location.origin;

const isStaticAssetRequest = (request) => {
	const url = new URL(request.url);
	if (!isSameOrigin(url)) return false;

	if (
		request.destination === "script" ||
		request.destination === "style" ||
		request.destination === "font"
	) {
		return true;
	}

	const pathname = url.pathname.toLowerCase();
	if (pathname.startsWith("/_next/static/")) return true;
	if (pathname.startsWith("/_next/image")) return true;

	return STATIC_ASSET_EXTENSIONS.some((ext) => pathname.endsWith(ext));
};

const isNextDataRequest = (request) => {
	const url = new URL(request.url);
	if (!isSameOrigin(url)) return false;

	if (url.pathname.startsWith("/_next/data/")) return true;
	if (url.pathname.startsWith("/_next/flight")) return true;

	const isRsc = request.headers.get("RSC") === "1";
	const isPrefetch = request.headers.get("Next-Router-Prefetch") === "1";
	const hasStateTree = request.headers.has("Next-Router-State-Tree");
	return isRsc || isPrefetch || hasStateTree;
};

const staleWhileRevalidate = (request, cacheName) => {
	return caches.open(cacheName).then((cache) => {
		return cache.match(request).then((cachedResponse) => {
			const fetchPromise = fetch(request)
				.then((response) => {
					if (response && response.ok) {
						cache.put(request, response.clone());
					}
					return response;
				})
				.catch(() => cachedResponse);

			return cachedResponse || fetchPromise;
		});
	});
};

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_ASSETS)),
	);
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
				.then((keys) =>
					Promise.all(
						keys
							.filter(
								(key) =>
									key.startsWith(CACHE_PREFIX) && !CURRENT_CACHES.has(key),
							)
							.map((key) => caches.delete(key)),
					),
				)
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("fetch", (event) => {
	const { request } = event;

	if (request.method !== "GET") {
		return;
	}

	const url = new URL(request.url);
	if (!isSameOrigin(url)) {
		return;
	}

	if (url.pathname.startsWith("/api/")) {
		event.respondWith(fetch(request));
		return;
	}

	if (request.mode === "navigate") {
		event.respondWith(
			staleWhileRevalidate(request, SHELL_CACHE).then((response) => {
				if (response) return response;
				return caches
					.match("/")
					.then((fallback) => fallback || Response.error());
			}),
		);
		return;
	}

	if (isNextDataRequest(request)) {
		event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
		return;
	}

	if (isStaticAssetRequest(request)) {
		event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
		return;
	}

	event.respondWith(fetch(request).catch(() => caches.match(request)));
});
