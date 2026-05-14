const CACHE_NAME = "k-egg-pos-v1";
const APP_SHELL_ASSETS = [
	"/",
	"/manifest.json",
	"/192x192.png",
	"/512x512.png",
	"/cover.png",
];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_ASSETS)),
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
						.filter((key) => key !== CACHE_NAME)
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

	if (request.mode === "navigate") {
		event.respondWith(
			fetch(request)
				.then((response) => {
					const responseClone = response.clone();
					void caches
						.open(CACHE_NAME)
						.then((cache) => cache.put(request, responseClone));
					return response;
				})
				.catch(async () => {
					const cache = await caches.open(CACHE_NAME);
					return (
						(await cache.match(request)) ||
						(await cache.match("/")) ||
						Response.error()
					);
				}),
		);
		return;
	}

	if (new URL(request.url).origin !== self.location.origin) {
		return;
	}

	event.respondWith(
		caches.match(request).then((cachedResponse) => {
			if (cachedResponse) {
				return cachedResponse;
			}

			return fetch(request).then((response) => {
				const responseClone = response.clone();
				void caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
				return response;
			});
		}),
	);
});
