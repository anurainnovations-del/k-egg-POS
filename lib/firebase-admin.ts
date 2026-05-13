import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const firebaseAdminConfig = {
	credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS!),
	projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
};

// Initialize Firebase Admin (only once)
const app =
	getApps().length === 0 ? initializeApp(firebaseAdminConfig) : getApps()[0];

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
