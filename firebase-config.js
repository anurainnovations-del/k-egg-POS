import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
	apiKey: process.env.NEXT_PUBLIC_API_KEY,
	authDomain: process.env.NEXT_PUBLIC_AUTH_DOMAIN,
	databaseURL: process.env.NEXT_PUBLIC_DATABASE_URL,
	projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
	storageBucket: process.env.NEXT_PUBLIC_STORAGE_BUCKET,
	messagingSenderId: process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID,
	appId: process.env.NEXT_PUBLIC_APP_ID,
	measurementId: process.env.NEXT_PUBLIC_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app);

// Initialize Cloud Firestore with persistent multi-tab caching.
const globalScope = globalThis;
const FIRESTORE_KEY = "__kegg_firestore__";

const db = (() => {
  const existing = globalScope[FIRESTORE_KEY];
  if (existing) {
    return existing;
  }

  const isBrowser = typeof window !== "undefined";
  const settings = isBrowser
    ? {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      }
    : {};

  const firestore = initializeFirestore(app, settings);
  globalScope[FIRESTORE_KEY] = firestore;
  return firestore;
})();
const storage = getStorage(app);

export { auth, db, storage };
export default app;
