import {
	CreateWorkerRequest,
	WorkerFilters,
	UserRole,
	WorkSession,
	WorkerStats,
} from "@/types/WorkerTypes";
import { authService } from "./authService";
import { workSessionService } from "./workSessionService";
import {
	collection,
	doc,
	getDoc,
	getDocs,
	updateDoc,
	query,
	where,
	orderBy,
	limit,
	Timestamp,
	writeBatch,
} from "firebase/firestore";
import { db } from "@/firebase-config";

// Worker interface matching the User structure with additional fields
export interface Worker {
	id: string;
	name: string;
	email: string;
	phoneNumber?: string;
	employeeId?: string;
	roleAssignments: Array<{
		branchId: string;
		role: "manager" | "worker";
		assignedAt: Date;
		assignedBy: string;
		isActive: boolean;
	}>;
	isAdmin: boolean;
	adminAssignedBy?: string;
	adminAssignedAt?: Date;
	currentStatus?: "clocked_in" | "clocked_out"; // Optional - admins don't have status tracking
	currentBranchId?: string;
	lastTimeIn?: Date;
	lastTimeOut?: Date;
	profilePicture?: string;
	createdAt: Date;
	updatedAt: Date;
	createdBy: string;
	isActive: boolean;
	lastLoginAt?: Date;
	passwordResetRequired?: boolean;
	twoFactorEnabled?: boolean;
}

export interface WorkerService {
	// User CRUD Operations
	createWorker: (userData: CreateWorkerRequest) => Promise<string>; // Returns userId
	getWorker: (userId: string) => Promise<Worker | null>;
	updateWorker: (userId: string, updates: Partial<Worker>) => Promise<void>;
	deleteWorker: (userId: string) => Promise<void>;
	deleteWorkerData: (userId: string) => Promise<void>; // Internal method for Firestore cleanup
	listWorkers: (filters?: WorkerFilters) => Promise<Worker[]>;

	// Branch-specific operations
	getWorkersByBranch: (branchId: string) => Promise<Worker[]>;
	getClockedInWorkers: (branchId: string) => Promise<Worker[]>;
	assignWorkerToBranch: (
		userId: string,
		branchId: string,
		role: UserRole
	) => Promise<void>;
	removeWorkerFromBranch: (userId: string, branchId: string) => Promise<void>;

	// Role Management
	updateWorkerRole: (
		userId: string,
		branchId: string,
		newRole: UserRole
	) => Promise<void>;
	promoteToAdmin: (userId: string) => Promise<void>;
	demoteFromAdmin: (userId: string) => Promise<void>;

	// Worker Statistics (work session data will come from workSessionService)
	getWorkerStats: (userId: string) => Promise<WorkerStats>;
}

export const workerService: WorkerService = {
	createWorker: async (userData: CreateWorkerRequest): Promise<string> => {
		try {
			console.log("🔄 Creating worker:", userData.email);

			// Call API route to create worker (handles Firebase Admin SDK operations)
			const response = await fetch("/api/admin/workers", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ userData }),
			});

			const result = await response.json();
			await authService.createUserProfile(result.userId, {
				name: userData.name,
				email: userData.email,
				isAdmin: userData.isAdmin || false,
				roleAssignments: userData.branchAssignments || [],
				phoneNumber: userData.phoneNumber,
				employeeId: userData.employeeId,
				profilePicture: userData.profilePicture || "",
			});
			if (!response.ok) {
				throw new Error(result.error || "Failed to create worker");
			}

			console.log("✅ Worker created successfully:", result.userId);
			return result.userId;
		} catch (error) {
			console.error("❌ Error creating worker:", error);
			throw error;
		}
	},

	getWorker: async (userId: string): Promise<Worker | null> => {
		try {
			const userDocRef = doc(db, "users", userId);
			const userDocSnap = await getDoc(userDocRef);

			if (userDocSnap.exists()) {
				const data = userDocSnap.data();
				return {
					id: userId,
					name: data.name || "",
					email: data.email || "",
					phoneNumber: data.phoneNumber,
					employeeId: data.employeeId,
					roleAssignments: data.roleAssignments || [],
					isAdmin: data.isAdmin || false,
					adminAssignedBy: data.adminAssignedBy,
					adminAssignedAt: data.adminAssignedAt?.toDate(),
					currentStatus: data.isAdmin
						? undefined
						: data.currentStatus || "clocked_out",
					currentBranchId: data.currentBranchId,
					lastTimeIn: data.lastTimeIn?.toDate(),
					lastTimeOut: data.lastTimeOut?.toDate(),
					profilePicture: data.profilePicture,
					createdAt: data.createdAt?.toDate() || new Date(),
					updatedAt: data.updatedAt?.toDate() || new Date(),
					createdBy: data.createdBy || "",
					isActive: data.isActive !== false, // Default to true if not set
					lastLoginAt: data.lastLoginAt?.toDate(),
					passwordResetRequired: data.passwordResetRequired || false,
					twoFactorEnabled: data.twoFactorEnabled || false,
				} as Worker;
			}

			return null;
		} catch (error) {
			console.error("Error fetching worker:", error);
			throw error;
		}
	},

	updateWorker: async (
		userId: string,
		updates: Partial<Worker>
	): Promise<void> => {
		try {
			const userDocRef = doc(db, "users", userId);

			// Convert dates to Timestamps for Firestore
			const firestoreUpdates: any = { ...updates };

			if (updates.adminAssignedAt) {
				firestoreUpdates.adminAssignedAt = Timestamp.fromDate(
					updates.adminAssignedAt
				);
			}
			if (updates.lastTimeIn) {
				firestoreUpdates.lastTimeIn = Timestamp.fromDate(updates.lastTimeIn);
			}
			if (updates.lastTimeOut) {
				firestoreUpdates.lastTimeOut = Timestamp.fromDate(updates.lastTimeOut);
			}
			if (updates.createdAt) {
				firestoreUpdates.createdAt = Timestamp.fromDate(updates.createdAt);
			}
			if (updates.lastLoginAt) {
				firestoreUpdates.lastLoginAt = Timestamp.fromDate(updates.lastLoginAt);
			}

			// Always update the updatedAt timestamp
			firestoreUpdates.updatedAt = Timestamp.now();

			// Remove the id field from updates as it shouldn't be updated
			delete firestoreUpdates.id;

			await updateDoc(userDocRef, firestoreUpdates);
		} catch (error) {
			console.error("Error updating worker:", error);
			throw error;
		}
	},

	deleteWorker: async (userId: string): Promise<void> => {
		try {
			// Call API route first to handle complete deletion (Auth + Firestore)
			const response = await fetch("/api/admin/workers", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId }),
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || "Failed to delete worker");
			}

			console.log("✅ Worker deleted successfully:", userId);
		} catch (error) {
			console.error("Error deleting worker:", error);
			throw error;
		}
	},

	// Internal method for Firestore cleanup only (called by API route)
	deleteWorkerData: async (userId: string): Promise<void> => {
		try {
			const batch = writeBatch(db);

			// Delete user document from Firestore
			const userDocRef = doc(db, "users", userId);
			batch.delete(userDocRef);

			// Delete all work sessions for this user
			const workSessionsRef = collection(db, "workSessions");
			const sessionQuery = query(
				workSessionsRef,
				where("userId", "==", userId)
			);
			const sessionSnapshot = await getDocs(sessionQuery);

			sessionSnapshot.forEach((doc) => {
				batch.delete(doc.ref);
			});

			// Commit the batch
			await batch.commit();
			console.log("🗑️ Worker data deleted from Firestore:", userId);
		} catch (error) {
			console.error("Error deleting worker data from Firestore:", error);
			throw error;
		}
	},

	listWorkers: async (filters?: WorkerFilters): Promise<Worker[]> => {
		try {
			const usersRef = collection(db, "users");
			let q = query(usersRef, orderBy("name"));

			// Apply filters
			// Note: Branch filtering is done locally since roleAssignments have complex objects
			// that can't be matched exactly with array-contains

			if (filters?.status) {
				// Only filter by status for non-admin users (admins don't have currentStatus)
				q = query(
					q,
					where("isAdmin", "==", false),
					where("currentStatus", "==", filters.status)
				);
			} // Apply pagination
			if (filters?.limit) {
				q = query(q, limit(filters.limit));
			}

			console.log("🔍 Executing Firestore query...");
			const querySnapshot = await getDocs(q);
			const workers: Worker[] = [];

			querySnapshot.forEach((doc) => {
				const data = doc.data();

				// Apply search filter locally (since Firestore doesn't support full-text search)
				if (filters?.searchQuery) {
					const searchTerm = filters.searchQuery.toLowerCase();
					const matchesSearch =
						data.name?.toLowerCase().includes(searchTerm) ||
						data.email?.toLowerCase().includes(searchTerm) ||
						data.employeeId?.toLowerCase().includes(searchTerm);

					if (!matchesSearch) return;
				}

				// Apply branch filter locally (skip for admins as they have global access)
				if (filters?.branchId && !data.isAdmin) {
					const hasBranchAccess = data.roleAssignments?.some(
						(assignment: any) =>
							assignment.branchId === filters.branchId &&
							assignment.isActive === true
					);
					if (!hasBranchAccess) return;
				}

				// Apply excludeAdmins filter locally (for managers who shouldn't see admins)
				if (filters?.excludeAdmins && data.isAdmin) {
					return;
				}

				// Admins should not have branch assignments, so skip branch filter for them
				if (filters?.branchId && data.isAdmin) {
					// For admins, we continue processing since they have global access
				}

				// Apply role filter locally
				if (filters?.role) {
					if (filters.role === "admin" && !data.isAdmin) return;
					if (filters.role !== "admin") {
						const hasRole = data.roleAssignments?.some(
							(assignment: any) =>
								assignment.role === filters.role && assignment.isActive === true
						);
						if (!hasRole) return;
					}
				}

				workers.push({
					id: doc.id,
					name: data.name || "",
					email: data.email || "",
					phoneNumber: data.phoneNumber,
					employeeId: data.employeeId,
					roleAssignments: data.roleAssignments || [],
					isAdmin: data.isAdmin || false,
					adminAssignedBy: data.adminAssignedBy,
					adminAssignedAt: data.adminAssignedAt?.toDate(),
					currentStatus: data.isAdmin
						? undefined
						: data.currentStatus || "clocked_out",
					currentBranchId: data.currentBranchId,
					lastTimeIn: data.lastTimeIn?.toDate(),
					lastTimeOut: data.lastTimeOut?.toDate(),
					profilePicture: data.profilePicture,
					createdAt: data.createdAt?.toDate() || new Date(),
					updatedAt: data.updatedAt?.toDate() || new Date(),
					createdBy: data.createdBy || "",
					isActive: data.isActive !== false,
					lastLoginAt: data.lastLoginAt?.toDate(),
					passwordResetRequired: data.passwordResetRequired || false,
					twoFactorEnabled: data.twoFactorEnabled || false,
				});
			});

			return workers;
		} catch (error) {
			console.error("Error listing workers:", error);
			throw error;
		}
	},

	getWorkersByBranch: async (branchId: string): Promise<Worker[]> => {
		try {
			return await workerService.listWorkers({ branchId });
		} catch (error) {
			console.error("Error getting workers by branch:", error);
			throw error;
		}
	},

	getClockedInWorkers: async (branchId: string): Promise<Worker[]> => {
		try {
			return await workerService.listWorkers({
				branchId,
				status: "clocked_in",
			});
		} catch (error) {
			console.error("Error getting clocked in workers:", error);
			throw error;
		}
	},

	assignWorkerToBranch: async (
		userId: string,
		branchId: string,
		role: UserRole
	): Promise<void> => {
		try {
			await authService.assignUserToBranch(
				userId,
				branchId,
				role as "manager" | "worker"
			);
		} catch (error) {
			console.error("Error assigning worker to branch:", error);
			throw error;
		}
	},

	removeWorkerFromBranch: async (
		userId: string,
		branchId: string
	): Promise<void> => {
		try {
			await authService.removeUserFromBranch(userId, branchId);
		} catch (error) {
			console.error("Error removing worker from branch:", error);
			throw error;
		}
	},

	updateWorkerRole: async (
		userId: string,
		branchId: string,
		newRole: UserRole
	): Promise<void> => {
		try {
			const userData = await authService.getUserData(userId);
			if (!userData) {
				throw new Error("User not found");
			}

			// Find and update the existing assignment while preserving metadata
			const updatedAssignments = userData.roleAssignments.map((assignment) => {
				if (assignment.branchId === branchId) {
					return {
						...assignment,
						role: newRole as "manager" | "worker",
					};
				}
				return assignment;
			});

			await authService.updateUserRoles(userId, updatedAssignments);
		} catch (error) {
			console.error("Error updating worker role:", error);
			throw error;
		}
	},

	promoteToAdmin: async (userId: string): Promise<void> => {
		try {
			await authService.promoteToAdmin(userId);
		} catch (error) {
			console.error("Error promoting worker to admin:", error);
			throw error;
		}
	},

	demoteFromAdmin: async (userId: string): Promise<void> => {
		try {
			await authService.demoteFromAdmin(userId);
		} catch (error) {
			console.error("Error demoting worker from admin:", error);
			throw error;
		}
	},

	getWorkerStats: async (userId: string): Promise<WorkerStats> => {
		try {
			// Get all work sessions for this worker using workSessionService
			const allSessions = await workSessionService.listWorkSessions(userId);

			// Calculate date ranges
			const now = new Date();
			const startOfWeek = new Date(
				now.getFullYear(),
				now.getMonth(),
				now.getDate() - now.getDay()
			);
			const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

			let totalHoursWorked = 0;
			const totalSessions = allSessions.length;
			let weekHours = 0;
			let monthHours = 0;
			let weekSessions = 0;
			let monthSessions = 0;
			const weekDays = new Set<string>();
			const monthDays = new Set<string>();

			const branchStatsMap = new Map<
				string,
				{
					hoursWorked: number;
					sessionsCount: number;
					lastWorked?: Timestamp;
				}
			>();

			let lastSession: WorkerStats["lastSession"] | undefined;

			// Process each session
			allSessions.forEach((session: WorkSession) => {
				const sessionDate = session.timeInAt.toDate();
				const duration = session.duration || 0;
				const hours = duration / 60;

				// Total stats
				totalHoursWorked += hours;

				// Week stats
				if (sessionDate >= startOfWeek) {
					weekHours += hours;
					weekSessions++;
					weekDays.add(sessionDate.toDateString());
				}

				// Month stats
				if (sessionDate >= startOfMonth) {
					monthHours += hours;
					monthSessions++;
					monthDays.add(sessionDate.toDateString());
				}

				// Branch stats
				const branchId = session.branchId;
				const branchStats = branchStatsMap.get(branchId) || {
					hoursWorked: 0,
					sessionsCount: 0,
				};

				branchStats.hoursWorked += hours;
				branchStats.sessionsCount++;

				if (
					!branchStats.lastWorked ||
					sessionDate > branchStats.lastWorked.toDate()
				) {
					branchStats.lastWorked = session.timeInAt;
				}

				branchStatsMap.set(branchId, branchStats);

				// Last session (most recent)
				if (!lastSession || sessionDate > lastSession.timeInAt.toDate()) {
					lastSession = {
						timeInAt: session.timeInAt,
						timeOutAt: session.timeOutAt,
						branchId: session.branchId,
						duration: session.duration,
					};
				}
			});

			// Calculate averages and streaks
			const averageSessionDuration =
				totalSessions > 0 ? (totalHoursWorked * 60) / totalSessions : 0;

			// Note: Streak calculation would require more complex logic to check consecutive days
			// For now, using placeholder values
			const currentStreak = 0;
			const longestStreak = 0;

			// Convert branch stats map to array
			const branchStats = Array.from(branchStatsMap.entries()).map(
				([branchId, stats]) => ({
					branchId,
					hoursWorked: stats.hoursWorked,
					sessionsCount: stats.sessionsCount,
					lastWorked: stats.lastWorked,
				})
			);

			return {
				userId,
				totalHoursWorked,
				totalSessions,
				averageSessionDuration,
				currentStreak,
				longestStreak,
				thisWeek: {
					hoursWorked: weekHours,
					sessionsCount: weekSessions,
					daysWorked: weekDays.size,
				},
				thisMonth: {
					hoursWorked: monthHours,
					sessionsCount: monthSessions,
					daysWorked: monthDays.size,
				},
				lastSession,
				branchStats,
				overtime: {
					thisWeek: 0, // Would need business logic to determine overtime
					thisMonth: 0,
					total: 0,
				},
				attendance: {
					punctualityScore: 100, // Would need scheduled vs actual time data
					averageClockInDelay: 0,
					missedShifts: 0,
				},
			};
		} catch (error) {
			console.error("Error getting worker stats:", error);
			throw error;
		}
	},
};
