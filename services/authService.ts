import { RoleAssignment } from "@/contexts/AuthContext";
import { 
	doc, 
	Timestamp, 
	getDoc, 
	updateDoc, 
	setDoc,
	collection,
	query,
	where,
	orderBy,
	getDocs
} from "firebase/firestore";
import { auth, db } from "@/firebase-config";
import {
	createUserWithEmailAndPassword,
	updateProfile,
	sendPasswordResetEmail,
} from "firebase/auth";

interface UserData {
	name: string;
	username?: string;
	email: string;
	roleAssignments: RoleAssignment[];
	isAdmin: boolean;
	createdAt?: Timestamp;
	updatedAt?: Timestamp;
}

interface CreateUserRequest {
	name: string;
	email: string;
	password: string;
	isAdmin?: boolean;
	roleAssignments?: RoleAssignment[];
}

interface CreateUserResult {
	userId: string;
	success: boolean;
	error?: string;
}

interface UserImportData {
	name: string;
	email: string;
	password: string;
	isAdmin?: boolean;
	roleAssignments?: RoleAssignment[];
}

interface ImportResult {
	successCount: number;
	errorCount: number;
	errors: Array<{
		email: string;
		error: string;
	}>;
}

export const authService = {
	createUserAccount: async (createUserData: {
		name: string;
		email: string;
		password: string;
	}) => {
		try {
			const userCredential = await createUserWithEmailAndPassword(
				auth,
				createUserData.email,
				createUserData.password
			);
			await updateProfile(userCredential.user, {
				displayName: createUserData.name,
			});
			return userCredential.user;
		} catch (error) {
			console.error("Error creating user account:", error);
			throw Error("Error creating user account:" + error);
		}
	},
	// User data management
	getUserData: async (userId: string): Promise<UserData | null> => {
		try {
			const userDocRef = doc(db, "users", userId);
			const userDocSnap = await getDoc(userDocRef);

			if (userDocSnap.exists()) {
				const data = userDocSnap.data();
				console.log("🔍 [authService] Raw user data from Firestore:", data);

				// Normalize roleAssignments to always be an array
				let normalizedRoleAssignments = [];
				if (data.roleAssignments) {
					if (Array.isArray(data.roleAssignments)) {
						normalizedRoleAssignments = data.roleAssignments;
					} else if (typeof data.roleAssignments === "object") {
						// If it's a map, wrap it in an array
						normalizedRoleAssignments = [data.roleAssignments];
					}
				}

				return {
					name: data.name || "",
					username: data.username || "",
					email: data.email || "",
					roleAssignments: normalizedRoleAssignments,
					isAdmin: data.isAdmin || false,
					createdAt: data.createdAt,
					updatedAt: data.updatedAt,
				} as UserData;
			}

			return null;
		} catch (error) {
			console.error("Error fetching user data:", error);
			return null;
		}
	},

	updateUserRoles: async (
		userId: string,
		roleAssignments: RoleAssignment[]
	): Promise<void> => {
		try {
			const userDocRef = doc(db, "users", userId);
			await updateDoc(userDocRef, {
				roleAssignments,
				updatedAt: Timestamp.now(),
			});
		} catch (error) {
			console.error("Error updating user roles:", error);
			throw error;
		}
	},

	// Branch assignment management
	assignUserToBranch: async (
		userId: string,
		branchId: string,
		role: "manager" | "worker"
	): Promise<void> => {
		try {
			const userData = await authService.getUserData(userId);
			if (!userData) {
				throw new Error("User not found");
			}

			// Get current user for assignedBy
			const currentUser = auth.currentUser;
			if (!currentUser) {
				throw new Error("No authenticated user found");
			}

			// Check if there's an existing assignment for this branch
			const existingAssignment = userData.roleAssignments.find(
				(assignment) => assignment.branchId === branchId
			);

			let newAssignments;

			if (existingAssignment) {
				// Update existing assignment
				newAssignments = userData.roleAssignments.map((assignment) => {
					if (assignment.branchId === branchId) {
						return {
							...assignment,
							role,
							isActive: true,
							assignedBy: currentUser.uid, // Update who made the change
						};
					}
					return assignment;
				});
			} else {
				// Create new assignment with proper metadata
				const newAssignment = {
					branchId,
					role,
					assignedAt: Timestamp.now(),
					assignedBy: currentUser.uid,
					isActive: true,
				};

				newAssignments = [...userData.roleAssignments, newAssignment];
			}

			await authService.updateUserRoles(userId, newAssignments);
		} catch (error) {
			console.error("Error assigning user to branch:", error);
			throw error;
		}
	},

	removeUserFromBranch: async (
		userId: string,
		branchId: string
	): Promise<void> => {
		try {
			const userData = await authService.getUserData(userId);
			if (!userData) {
				throw new Error("User not found");
			}

			// Deactivate assignment for this branch instead of removing (preserves history)
			const updatedAssignments = userData.roleAssignments.map((assignment) => {
				if (assignment.branchId === branchId) {
					return {
						...assignment,
						isActive: false,
					};
				}
				return assignment;
			});

			await authService.updateUserRoles(userId, updatedAssignments);
		} catch (error) {
			console.error("Error removing user from branch:", error);
			throw error;
		}
	},

	// Admin operations
	promoteToAdmin: async (userId: string): Promise<void> => {
		try {
			const userDocRef = doc(db, "users", userId);
			await updateDoc(userDocRef, {
				isAdmin: true,
				updatedAt: Timestamp.now(),
			});
		} catch (error) {
			console.error("Error promoting user to admin:", error);
			throw error;
		}
	},

	demoteFromAdmin: async (userId: string): Promise<void> => {
		try {
			const userDocRef = doc(db, "users", userId);
			await updateDoc(userDocRef, {
				isAdmin: false,
				updatedAt: Timestamp.now(),
			});
		} catch (error) {
			console.error("Error demoting user from admin:", error);
			throw error;
		}
	},

	// User creation (for new user registration)
	createUserProfile: async (
		userId: string,
		userData: {
			name: string;
			username?: string;
			email: string;
			isAdmin?: boolean;
			roleAssignments?: RoleAssignment[];
			phoneNumber?: string;
			employeeId?: string;
			profilePicture?: string;
		}
	): Promise<void> => {
		try {
			// Get current authenticated user for tracking who created this user
			const currentUser = auth.currentUser;
			if (!currentUser) {
				throw new Error("Not authenticated - cannot create user profile");
			}

			console.log("🔄 Creating complete user profile in Firestore:", userId);

			const userDocRef = doc(db, "users", userId);

			// Process role assignments with proper metadata
			const processedRoleAssignments =
				userData.roleAssignments?.map((assignment) => ({
					...assignment,
					assignedAt: Timestamp.now(),
					assignedBy: currentUser.uid,
					isActive: true,
				})) || [];

			// Create complete user document
			const userDoc: any = {
				name: userData.name,
				username: userData.username || "",
				email: userData.email,
				phoneNumber: userData.phoneNumber || "",
				employeeId: userData.employeeId || "",
				profilePicture: userData.profilePicture || "",
				isAdmin: userData.isAdmin || false,
				roleAssignments: processedRoleAssignments,
				isActive: true,
				createdAt: Timestamp.now(),
				createdBy: currentUser.uid,
				updatedAt: Timestamp.now(),
				passwordResetRequired: false,
				twoFactorEnabled: false,
			};

			// Only add currentStatus for non-admin users (avoid undefined)
			if (!userData.isAdmin) {
				userDoc.currentStatus = "clocked_out";
			}

			await setDoc(userDocRef, userDoc);

			console.log("✅ Complete user profile created in Firestore");
		} catch (error) {
			console.error("Error creating user profile:", error);
			throw error;
		}
	},

	// Firebase Auth Profile Management
	updateUserProfile: async (
		userId: string,
		updates: { displayName?: string; photoURL?: string }
	): Promise<void> => {
		try {
			// Note: This would typically require Firebase Admin SDK for server-side operations
			// For client-side, you can only update the current user's profile
			console.warn(
				"updateUserProfile requires Firebase Admin SDK for full functionality"
			);

			// Update Firestore user document
			const userDocRef = doc(db, "users", userId);
			const firestoreUpdates: any = {};

			if (updates.displayName) {
				firestoreUpdates.name = updates.displayName;
			}
			if (updates.photoURL) {
				firestoreUpdates.profilePicture = updates.photoURL;
			}

			firestoreUpdates.updatedAt = Timestamp.now();

			await updateDoc(userDocRef, firestoreUpdates);
		} catch (error) {
			console.error("Error updating user profile:", error);
			throw error;
		}
	},

	deleteUserAccount: async (userId: string): Promise<void> => {
		try {
			// Note: This requires Firebase Admin SDK for complete functionality
			// For now, we'll just disable the user in Firestore
			console.warn("Full user deletion requires Firebase Admin SDK");

			const userDocRef = doc(db, "users", userId);
			await updateDoc(userDocRef, {
				isActive: false,
				updatedAt: Timestamp.now(),
			});

			// In a real implementation, you'd also need to:
			// 1. Delete the Firebase Auth user (requires Admin SDK)
			// 2. Clean up related data (work sessions, etc.)
		} catch (error) {
			console.error("Error deleting user account:", error);
			throw error;
		}
	},

	resetUserPassword: async (email: string): Promise<void> => {
		try {
			await sendPasswordResetEmail(auth, email);
		} catch (error) {
			console.error("Error sending password reset email:", error);
			throw error;
		}
	},

	// Admin Operations (require Firebase Admin SDK)
	setCustomClaims: async (
		userId: string,
		claims: Record<string, any>
	): Promise<void> => {
		try {
			// This requires Firebase Admin SDK
			console.warn("setCustomClaims requires Firebase Admin SDK");

			// For now, store claims in Firestore
			const userDocRef = doc(db, "users", userId);
			await updateDoc(userDocRef, {
				customClaims: claims,
				updatedAt: Timestamp.now(),
			});
		} catch (error) {
			console.error("Error setting custom claims:", error);
			throw error;
		}
	},

	revokeRefreshTokens: async (userId: string): Promise<void> => {
		try {
			// This requires Firebase Admin SDK
			console.warn("revokeRefreshTokens requires Firebase Admin SDK");

			// Mark in Firestore that tokens should be revoked
			const userDocRef = doc(db, "users", userId);
			await updateDoc(userDocRef, {
				tokensRevokedAt: Timestamp.now(),
				updatedAt: Timestamp.now(),
			});
		} catch (error) {
			console.error("Error revoking refresh tokens:", error);
			throw error;
		}
	},

	disableUser: async (userId: string): Promise<void> => {
		try {
			// This requires Firebase Admin SDK for full functionality
			console.warn(
				"disableUser requires Firebase Admin SDK for complete functionality"
			);

			const userDocRef = doc(db, "users", userId);
			await updateDoc(userDocRef, {
				isActive: false,
				disabledAt: Timestamp.now(),
				updatedAt: Timestamp.now(),
			});
		} catch (error) {
			console.error("Error disabling user:", error);
			throw error;
		}
	},

	enableUser: async (userId: string): Promise<void> => {
		try {
			// This requires Firebase Admin SDK for full functionality
			console.warn(
				"enableUser requires Firebase Admin SDK for complete functionality"
			);

			const userDocRef = doc(db, "users", userId);
			await updateDoc(userDocRef, {
				isActive: true,
				disabledAt: null,
				updatedAt: Timestamp.now(),
			});
		} catch (error) {
			console.error("Error enabling user:", error);
			throw error;
		}
	},

	// Bulk Operations
	createMultipleUsers: async (
		users: CreateUserRequest[]
	): Promise<CreateUserResult[]> => {
		const results: CreateUserResult[] = [];

		for (const userData of users) {
			try {
				const userCredential = await createUserWithEmailAndPassword(
					auth,
					userData.email,
					userData.password
				);

				// Create user profile in Firestore
				await authService.createUserProfile(userCredential.user.uid, {
					name: userData.name,
					email: userData.email,
					isAdmin: userData.isAdmin || false,
					roleAssignments: userData.roleAssignments || [],
				});

				results.push({
					userId: userCredential.user.uid,
					success: true,
				});
			} catch (error) {
				console.error(`Error creating user ${userData.email}:`, error);
				results.push({
					userId: "",
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				});
			}
		}

		return results;
	},

	importUsers: async (userData: UserImportData[]): Promise<ImportResult> => {
		const results = await authService.createMultipleUsers(userData);

		const successCount = results.filter((r) => r.success).length;
		const errorCount = results.filter((r) => !r.success).length;
		const errors = results
			.filter((r) => !r.success)
			.map((r, index) => ({
				email: userData[index]?.email || "unknown",
				error: r.error || "Unknown error",
			}));

		return {
			successCount,
			errorCount,
			errors,
		};
	},

	// Validation functions for signup
	checkEmailExists: async (email: string): Promise<boolean> => {
		try {
			const usersRef = collection(db, "users");
			const q = query(usersRef, where("email", "==", email));
			const querySnapshot = await getDocs(q);
			return !querySnapshot.empty;
		} catch (error) {
			console.error("Error checking email existence:", error);
			return false; // Return false on error to allow signup attempt
		}
	},

	checkUsernameExists: async (username: string): Promise<boolean> => {
		try {
			const usersRef = collection(db, "users");
			const q = query(usersRef, where("username", "==", username));
			const querySnapshot = await getDocs(q);
			return !querySnapshot.empty;
		} catch (error) {
			console.error("Error checking username existence:", error);
			return false; // Return false on error to allow signup attempt
		}
	},

	// Admin user management functions
	getAllUsers: async (): Promise<(UserData & { id: string })[]> => {
		try {
			const usersRef = collection(db, "users");
			const q = query(usersRef, orderBy("createdAt", "desc"));
			const querySnapshot = await getDocs(q);
			
			return querySnapshot.docs.map((doc) => {
				const data = doc.data();
				
				// Normalize roleAssignments
				let normalizedRoleAssignments = [];
				if (data.roleAssignments) {
					if (Array.isArray(data.roleAssignments)) {
						normalizedRoleAssignments = data.roleAssignments;
					} else if (typeof data.roleAssignments === "object") {
						normalizedRoleAssignments = [data.roleAssignments];
					}
				}

				return {
					id: doc.id,
					...data,
					roleAssignments: normalizedRoleAssignments,
				} as UserData & { id: string };
			});
		} catch (error) {
			console.error("Error fetching all users:", error);
			throw error;
		}
	},

	adminAssignUserToBranch: async (
		userId: string,
		branchId: string,
		role: "manager" | "worker"
	): Promise<void> => {
		try {
			const userData = await authService.getUserData(userId);
			if (!userData) {
				throw new Error("User not found");
			}

			// Remove existing assignment for this branch if any
			const filteredAssignments = userData.roleAssignments.filter(
				(assignment) => assignment.branchId !== branchId
			);

			// Add new assignment
			const newAssignments = [...filteredAssignments, { branchId, role }];

			await authService.updateUserRoles(userId, newAssignments);
		} catch (error) {
			console.error("Error assigning user to branch:", error);
			throw error;
		}
	},

	adminRemoveUserFromBranch: async (
		userId: string,
		branchId: string
	): Promise<void> => {
		try {
			const userData = await authService.getUserData(userId);
			if (!userData) {
				throw new Error("User not found");
			}

			// Remove assignment for this branch
			const filteredAssignments = userData.roleAssignments.filter(
				(assignment) => assignment.branchId !== branchId
			);

			await authService.updateUserRoles(userId, filteredAssignments);
		} catch (error) {
			console.error("Error removing user from branch:", error);
			throw error;
		}
	},

	removeAllUserAssignments: async (userId: string): Promise<void> => {
		try {
			await authService.updateUserRoles(userId, []);
		} catch (error) {
			console.error("Error removing all user assignments:", error);
			throw error;
		}
	},
};
