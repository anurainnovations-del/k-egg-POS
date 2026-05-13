import { NextRequest, NextResponse } from "next/server";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";

// ─── Firebase Admin initialisation (singleton) ───────────────────────────────
function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  // Prefer an env var (serialized JSON string) for production/Vercel;
  // fall back to the local service-account JSON file for development.
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
    credential: cert(serviceAccount),
  });
}

// ─── POST /api/admin/workers ─ Create a new worker auth account ──────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userData } = body;

    if (!userData?.email || !userData?.password) {
      return NextResponse.json(
        { error: "email and password are required" },
        { status: 400 }
      );
    }

    const app = getAdminApp();
    const auth = getAuth(app);

    // Create the Firebase Auth user
    const userRecord = await auth.createUser({
      email: userData.email,
      password: userData.password,
      displayName: userData.name || undefined,
    });

    return NextResponse.json({ userId: userRecord.uid }, { status: 201 });
  } catch (error: any) {
    console.error("❌ Error creating worker auth account:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create worker" },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/admin/workers ─ Delete a worker auth account + Firestore data ─
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const app = getAdminApp();
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Delete from Firebase Auth
    await auth.deleteUser(userId);

    // Delete Firestore user document
    await db.collection("users").doc(userId).delete();

    // Delete all work sessions for this user in a batch
    const sessionsSnap = await db
      .collection("workSessions")
      .where("userId", "==", userId)
      .get();

    const batch = db.batch();
    sessionsSnap.docs.forEach((d) => batch.delete(d.ref));
    if (sessionsSnap.docs.length > 0) await batch.commit();

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("❌ Error deleting worker:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete worker" },
      { status: 500 }
    );
  }
}
