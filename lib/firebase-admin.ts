import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";

// Safe singleton initializer — mirrors the pattern in app/api/admin/workers/route.ts.
// Tries FIREBASE_SERVICE_ACCOUNT_KEY (JSON string) first so it works on Vercel/prod,
// then falls back to the local service-account JSON file for development.
function getAdminApp() {
	if (getApps().length > 0) return getApps()[0];

	let serviceAccount: object;
	if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
		serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
	} else {
		const keyPath = path.join(
			process.cwd(),
			"k-egg-89f8f-firebase-adminsdk-fbsvc-7af804a0f6.json"
		);
		serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
	}

	return initializeApp({
		credential: cert(serviceAccount as Parameters<typeof cert>[0]),
		projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
	});
}

// Initialize Firebase Admin (only once)
const app = getAdminApp();

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
