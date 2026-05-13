import { DateRange } from "@/types/WorkerTypes";
import {
	Timestamp,
	collection,
	doc,
	addDoc,
	getDoc,
	updateDoc,
	deleteDoc,
	query,
	where,
	orderBy,
	getDocs,
	limit,
} from "firebase/firestore";
import { db } from "@/firebase-config";

export interface WorkSession {
	userId: string;
	branchId: string;
	timeInAt: Timestamp;
	timeOutAt?: Timestamp;
	clockedInBy: string;
	clockedOutBy?: string;
	duration?: number;
	notes?: string;
	sessionType: "scheduled" | "emergency" | "overtime";
}

export interface WorkSessionService {
	// Core CRUD operations
	createWorkSession: (sessionData: WorkSession) => Promise<string>; // Returns sessionId
	getWorkSession: (sessionId: string) => Promise<WorkSession | null>;
	updateWorkSession: (
		sessionId: string,
		updates: Partial<WorkSession>
	) => Promise<void>;
	deleteWorkSession: (sessionId: string) => Promise<void>;
	listWorkSessions: (
		userId: string,
		dateRange?: DateRange
	) => Promise<WorkSession[]>;

	// Time In/Out Operations
	timeInWorker: (
		userId: string,
		branchId: string,
		notes?: string
	) => Promise<string>; // Returns sessionId
	timeOutWorker: (
		userId: string,
		sessionId: string,
		notes?: string
	) => Promise<void>;

	// Utility methods
	getActiveWorkSession: (
		userId: string
	) => Promise<(WorkSession & { id: string }) | null>;
	getRecentWorkSessions: (
		userId: string,
		days?: number
	) => Promise<(WorkSession & { id: string })[]>;
	getBranchWorkSessions: (
		branchId: string,
		dateRange?: DateRange
	) => Promise<WorkSession[]>;
	calculateSessionDuration: (
		timeInAt: Timestamp,
		timeOutAt?: Timestamp
	) => number;
	getSessionsByDateRange: (
		userId: string,
		startDate: Date,
		endDate: Date
	) => Promise<WorkSession[]>;
}

export const workSessionService: WorkSessionService = {
	createWorkSession: async (sessionData: WorkSession): Promise<string> => {
		try {
			const workSessionsRef = collection(db, "workSessions");

			// Ensure timeInAt is a Timestamp
			const sessionWithTimestamp = {
				...sessionData,
				timeInAt:
					sessionData.timeInAt instanceof Timestamp
						? sessionData.timeInAt
						: Timestamp.fromDate(new Date()),
				timeOutAt: sessionData.timeOutAt || null,
				createdAt: Timestamp.now(),
				updatedAt: Timestamp.now(),
			};

			const docRef = await addDoc(workSessionsRef, sessionWithTimestamp);
			return docRef.id;
		} catch (error) {
			console.error("Error creating work session:", error);
			throw error;
		}
	},

	getWorkSession: async (sessionId: string): Promise<WorkSession | null> => {
		try {
			const sessionDocRef = doc(db, "workSessions", sessionId);
			const sessionSnap = await getDoc(sessionDocRef);

			if (!sessionSnap.exists()) {
				return null;
			}

			const data = sessionSnap.data();
			return {
				userId: data.userId,
				branchId: data.branchId,
				timeInAt: data.timeInAt,
				timeOutAt: data.timeOutAt || undefined,
				clockedInBy: data.clockedInBy,
				clockedOutBy: data.clockedOutBy || undefined,
				duration: data.duration || undefined,
				notes: data.notes || undefined,
				sessionType: data.sessionType,
			} as WorkSession;
		} catch (error) {
			console.error("Error getting work session:", error);
			throw error;
		}
	},

	updateWorkSession: async (
		sessionId: string,
		updates: Partial<WorkSession>
	): Promise<void> => {
		try {
			const sessionDocRef = doc(db, "workSessions", sessionId);

			// Convert any Date objects to Timestamps
			const firestoreUpdates: any = { ...updates };

			if (updates.timeInAt && !(updates.timeInAt instanceof Timestamp)) {
				firestoreUpdates.timeInAt = Timestamp.fromDate(updates.timeInAt as any);
			}

			if (updates.timeOutAt && !(updates.timeOutAt instanceof Timestamp)) {
				firestoreUpdates.timeOutAt = Timestamp.fromDate(
					updates.timeOutAt as any
				);
			}

			// Always update the updatedAt timestamp
			firestoreUpdates.updatedAt = Timestamp.now();

			await updateDoc(sessionDocRef, firestoreUpdates);
		} catch (error) {
			console.error("Error updating work session:", error);
			throw error;
		}
	},

	deleteWorkSession: async (sessionId: string): Promise<void> => {
		try {
			const sessionDocRef = doc(db, "workSessions", sessionId);
			await deleteDoc(sessionDocRef);
		} catch (error) {
			console.error("Error deleting work session:", error);
			throw error;
		}
	},

	listWorkSessions: async (
		userId: string,
		dateRange?: DateRange
	): Promise<WorkSession[]> => {
		try {
			const workSessionsRef = collection(db, "workSessions");

			// Base query: filter by userId and order by timeInAt descending (most recent first)
			let q = query(
				workSessionsRef,
				where("userId", "==", userId),
				orderBy("timeInAt", "desc")
			);

			// Apply date range filter if provided
			if (dateRange) {
				q = query(
					workSessionsRef,
					where("userId", "==", userId),
					where("timeInAt", ">=", dateRange.startDate),
					where("timeInAt", "<=", dateRange.endDate),
					orderBy("timeInAt", "desc")
				);
			}

			const querySnapshot = await getDocs(q);
			const sessions: WorkSession[] = [];

			querySnapshot.forEach((doc) => {
				const data = doc.data();
				sessions.push({
					userId: data.userId,
					branchId: data.branchId,
					timeInAt: data.timeInAt,
					timeOutAt: data.timeOutAt || undefined,
					clockedInBy: data.clockedInBy,
					clockedOutBy: data.clockedOutBy || undefined,
					duration: data.duration || undefined,
					notes: data.notes || undefined,
					sessionType: data.sessionType,
				});
			});

			return sessions;
		} catch (error) {
			console.error("Error listing work sessions:", error);
			throw error;
		}
	},

	// Additional utility methods for common operations
	getActiveWorkSession: async (
		userId: string
	): Promise<(WorkSession & { id: string }) | null> => {
		try {
			const workSessionsRef = collection(db, "workSessions");
			const q = query(
				workSessionsRef,
				where("userId", "==", userId),
				where("timeOutAt", "==", null),
				orderBy("timeInAt", "desc"),
				limit(1)
			);

			const querySnapshot = await getDocs(q);

			if (querySnapshot.empty) {
				return null;
			}

			const docSnapshot = querySnapshot.docs[0];
			const data = docSnapshot.data();

			return {
				id: docSnapshot.id,
				userId: data.userId,
				branchId: data.branchId,
				timeInAt: data.timeInAt,
				timeOutAt: undefined,
				clockedInBy: data.clockedInBy,
				clockedOutBy: undefined,
				duration: undefined,
				notes: data.notes || undefined,
				sessionType: data.sessionType,
			} as WorkSession & { id: string };
		} catch (error) {
			console.error("Error getting active work session:", error);
			throw error;
		}
	},

	getRecentWorkSessions: async (
		userId: string,
		days: number = 7
	): Promise<(WorkSession & { id: string })[]> => {
		try {
			const workSessionsRef = collection(db, "workSessions");

			// Calculate date range for recent sessions
			const endDate = new Date();
			const startDate = new Date();
			startDate.setDate(endDate.getDate() - days);

			const q = query(
				workSessionsRef,
				where("userId", "==", userId),
				where("timeInAt", ">=", Timestamp.fromDate(startDate)),
				where("timeInAt", "<=", Timestamp.fromDate(endDate)),
				orderBy("timeInAt", "desc"),
				limit(20) // Limit to 20 most recent sessions
			);

			const querySnapshot = await getDocs(q);
			const sessions: (WorkSession & { id: string })[] = [];

			querySnapshot.forEach((docSnapshot) => {
				const data = docSnapshot.data();
				sessions.push({
					id: docSnapshot.id,
					userId: data.userId,
					branchId: data.branchId,
					timeInAt: data.timeInAt,
					timeOutAt: data.timeOutAt || undefined,
					clockedInBy: data.clockedInBy,
					clockedOutBy: data.clockedOutBy || undefined,
					duration: data.duration || undefined,
					notes: data.notes || undefined,
					sessionType: data.sessionType,
				});
			});

			return sessions;
		} catch (error) {
			console.error("Error getting recent work sessions:", error);
			throw error;
		}
	},

	getBranchWorkSessions: async (
		branchId: string,
		dateRange?: DateRange
	): Promise<WorkSession[]> => {
		try {
			const workSessionsRef = collection(db, "workSessions");

			// Base query: filter by branchId and order by timeInAt descending
			let q = query(
				workSessionsRef,
				where("branchId", "==", branchId),
				orderBy("timeInAt", "desc")
			);

			// Apply date range filter if provided
			if (dateRange) {
				q = query(
					workSessionsRef,
					where("branchId", "==", branchId),
					where("timeInAt", ">=", dateRange.startDate),
					where("timeInAt", "<=", dateRange.endDate),
					orderBy("timeInAt", "desc")
				);
			}

			const querySnapshot = await getDocs(q);
			const sessions: WorkSession[] = [];

			querySnapshot.forEach((doc) => {
				const data = doc.data();
				sessions.push({
					userId: data.userId,
					branchId: data.branchId,
					timeInAt: data.timeInAt,
					timeOutAt: data.timeOutAt || undefined,
					clockedInBy: data.clockedInBy,
					clockedOutBy: data.clockedOutBy || undefined,
					duration: data.duration || undefined,
					notes: data.notes || undefined,
					sessionType: data.sessionType,
				});
			});

			return sessions;
		} catch (error) {
			console.error("Error getting branch work sessions:", error);
			throw error;
		}
	},

	calculateSessionDuration: (
		timeInAt: Timestamp,
		timeOutAt?: Timestamp
	): number => {
		if (!timeOutAt) {
			// If no timeout, calculate duration from time in to now
			const now = Timestamp.now();
			return Math.floor((now.seconds - timeInAt.seconds) / 60); // Duration in minutes
		}

		return Math.floor((timeOutAt.seconds - timeInAt.seconds) / 60); // Duration in minutes
	},

	getSessionsByDateRange: async (
		userId: string,
		startDate: Date,
		endDate: Date
	): Promise<WorkSession[]> => {
		const dateRange: DateRange = {
			startDate: Timestamp.fromDate(startDate),
			endDate: Timestamp.fromDate(endDate),
		};

		return await workSessionService.listWorkSessions(userId, dateRange);
	},

	// Time In/Out Operations
	timeInWorker: async (
		userId: string,
		branchId: string,
		notes?: string
	): Promise<string> => {
		try {
			// Create new work session
			const sessionData: WorkSession = {
				userId,
				branchId,
				timeInAt: Timestamp.now(),
				clockedInBy: userId, // In a real scenario, this would be the manager's ID
				notes: notes || "",
				sessionType: "scheduled",
			};

			const sessionId = await workSessionService.createWorkSession(sessionData);

			// Update user's current status in users collection
			const userDocRef = doc(db, "users", userId);
			await updateDoc(userDocRef, {
				currentStatus: "clocked_in",
				currentBranchId: branchId,
				lastTimeIn: Timestamp.now(),
				updatedAt: Timestamp.now(),
			});

			return sessionId;
		} catch (error) {
			console.error("Error timing in worker:", error);
			throw error;
		}
	},

	timeOutWorker: async (
		userId: string,
		sessionId: string,
		notes?: string
	): Promise<void> => {
		try {
			const timeOutAt = Timestamp.now();

			// Get the existing session to calculate duration
			const session = await workSessionService.getWorkSession(sessionId);
			if (!session) {
				throw new Error("Work session not found");
			}

			const duration = workSessionService.calculateSessionDuration(
				session.timeInAt,
				timeOutAt
			);

			// Update work session with time out data
			await workSessionService.updateWorkSession(sessionId, {
				timeOutAt,
				clockedOutBy: userId, // In a real scenario, this would be the manager's ID
				duration,
				notes: notes || session.notes || "",
			});

			// Update user's current status in users collection
			const userDocRef = doc(db, "users", userId);
			await updateDoc(userDocRef, {
				currentStatus: "clocked_out",
				currentBranchId: null,
				lastTimeOut: timeOutAt,
				updatedAt: Timestamp.now(),
			});
		} catch (error) {
			console.error("Error timing out worker:", error);
			throw error;
		}
	},
};
