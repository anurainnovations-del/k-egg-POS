import {
	collection,
	addDoc,
	getDocs,
	doc,
	query,
	orderBy,
	onSnapshot,
	Timestamp,
	getDoc,
	updateDoc,
	where,
	writeBatch,
	DocumentReference,
} from "firebase/firestore";
import { db } from "@/firebase-config";

export interface Branch {
	id: string;
	name: string;
	location: string;
	isActive: boolean;
	imgUrl: string;
	managerPin?: string;
	createdAt: Timestamp;
	updatedAt: Timestamp;
}

export interface CreateBranchData {
	name: string;
	location: string;
	isActive?: boolean;
	imgUrl?: string;
	managerPin?: string;
}

export interface UpdateBranchData {
	name?: string;
	location?: string;
	isActive?: boolean;
	imgUrl?: string;
	managerPin?: string;
}

export const branchService = {
	// Get all branches (admin only)
	getAllBranches: async (): Promise<Branch[]> => {
		try {
			const branchesRef = collection(db, "branches");
			const q = query(branchesRef, orderBy("name", "asc"));
			const querySnapshot = await getDocs(q);

			return querySnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			})) as Branch[];
		} catch (error) {
			console.error("Error fetching all branches:", error);
			throw error;
		}
	},

	// Get specific branch by ID
	getBranchById: async (branchId: string): Promise<Branch | null> => {
		try {
			const branchDocRef = doc(db, "branches", branchId);
			const branchDocSnap = await getDoc(branchDocRef);

			if (branchDocSnap.exists()) {
				return {
					id: branchDocSnap.id,
					...branchDocSnap.data(),
				} as Branch;
			}

			return null;
		} catch (error) {
			console.error("Error fetching branch:", error);
			throw error;
		}
	},

	// Get branches assigned to a specific user
	getUserBranches: async (
		userRoleAssignments: Array<{ branchId: string; role: string }>
	): Promise<Branch[]> => {
		try {
			if (userRoleAssignments.length === 0) {
				return [];
			}

			const branchIds = userRoleAssignments.map(
				(assignment) => assignment.branchId
			);
			const branches: Branch[] = [];

			// Firestore doesn't support 'in' queries with more than 10 items,
			// so we batch the requests if needed
			const batchSize = 10;
			for (let i = 0; i < branchIds.length; i += batchSize) {
				const batch = branchIds.slice(i, i + batchSize);
				const branchesRef = collection(db, "branches");
				const q = query(branchesRef, where("__name__", "in", batch));
				const querySnapshot = await getDocs(q);

				const batchBranches = querySnapshot.docs.map((doc) => ({
					id: doc.id,
					...doc.data(),
				})) as Branch[];

				branches.push(...batchBranches);
			}

			return branches;
		} catch (error) {
			console.error("Error fetching user branches:", error);
			throw error;
		}
	},

	// Create new branch (admin only)
	createBranch: async (branchData: CreateBranchData): Promise<string> => {
		try {
			const branchesRef = collection(db, "branches");
			const docRef = await addDoc(branchesRef, {
				name: branchData.name,
				location: branchData.location,
				isActive: branchData.isActive ?? true,
				imgUrl: branchData.imgUrl || '',
				createdAt: Timestamp.now(),
				updatedAt: Timestamp.now(),
			});

			return docRef.id;
		} catch (error) {
			console.error("Error creating branch:", error);
			throw error;
		}
	},

	// Update branch (admin/manager only)
	updateBranch: async (
		branchId: string,
		updates: UpdateBranchData
	): Promise<void> => {
		try {
			const branchDocRef = doc(db, "branches", branchId);
			await updateDoc(branchDocRef, {
				...updates,
				updatedAt: Timestamp.now(),
			});
		} catch (error) {
			console.error("Error updating branch:", error);
			throw error;
		}
	},

	// Delete branch (admin only) — cascade-deletes every branch-scoped record and
	// strips the branch from all users' role assignments, so no dangling data or
	// references are left behind. Destructive; not atomic across chunks, but safe
	// to re-run if interrupted.
	deleteBranch: async (branchId: string): Promise<void> => {
		try {
			// Collections whose documents are scoped to one branch via `branchId`.
			const SCOPED_COLLECTIONS = [
				"ingredients",
				"menuItems",
				"orders",
				"discounts",
				"restockLogs",
				"workSessions",
				"auditLogs",
			];

			const ops: Array<
				| { kind: "delete"; ref: DocumentReference }
				| { kind: "update"; ref: DocumentReference; data: Record<string, unknown> }
			> = [];

			// 1. Queue every branch-scoped document for deletion.
			for (const collectionName of SCOPED_COLLECTIONS) {
				const snap = await getDocs(
					query(collection(db, collectionName), where("branchId", "==", branchId))
				);
				snap.forEach((d) => ops.push({ kind: "delete", ref: d.ref }));
			}

			// 2. Strip the branch from users. roleAssignments is an array of objects,
			//    which Firestore can't filter on directly, so scan users and patch the
			//    affected ones (also clear currentBranchId if it points here).
			const usersSnap = await getDocs(collection(db, "users"));
			usersSnap.forEach((u) => {
				const data = u.data();
				const assignments = Array.isArray(data.roleAssignments)
					? data.roleAssignments
					: [];
				const hasAssignment = assignments.some(
					(a: { branchId?: string }) => a.branchId === branchId
				);
				const clearsCurrent = data.currentBranchId === branchId;
				if (!hasAssignment && !clearsCurrent) return;

				const patch: Record<string, unknown> = { updatedAt: Timestamp.now() };
				if (hasAssignment) {
					patch.roleAssignments = assignments.filter(
						(a: { branchId?: string }) => a.branchId !== branchId
					);
				}
				if (clearsCurrent) patch.currentBranchId = null;
				ops.push({ kind: "update", ref: u.ref, data: patch });
			});

			// 3. The branch document itself, last.
			ops.push({ kind: "delete", ref: doc(db, "branches", branchId) });

			// Commit in chunks — a single Firestore batch is capped at 500 writes.
			const CHUNK = 450;
			for (let i = 0; i < ops.length; i += CHUNK) {
				const batch = writeBatch(db);
				for (const op of ops.slice(i, i + CHUNK)) {
					if (op.kind === "delete") batch.delete(op.ref);
					else batch.update(op.ref, op.data);
				}
				await batch.commit();
			}
		} catch (error) {
			console.error("Error deleting branch:", error);
			throw error;
		}
	},

	// Soft delete branch (set isActive to false)
	deactivateBranch: async (branchId: string): Promise<void> => {
		try {
			await branchService.updateBranch(branchId, { isActive: false });
		} catch (error) {
			console.error("Error deactivating branch:", error);
			throw error;
		}
	},

	// Reactivate branch
	activateBranch: async (branchId: string): Promise<void> => {
		try {
			await branchService.updateBranch(branchId, { isActive: true });
		} catch (error) {
			console.error("Error activating branch:", error);
			throw error;
		}
	},

	// Get active branches only
	getActiveBranches: async (): Promise<Branch[]> => {
		try {
			const branchesRef = collection(db, "branches");
			const q = query(
				branchesRef,
				where("isActive", "==", true),
				orderBy("name", "asc")
			);
			const querySnapshot = await getDocs(q);

			return querySnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			})) as Branch[];
		} catch (error) {
			console.error("Error fetching active branches:", error);
			throw error;
		}
	},

	// Real-time listener for branches
	subscribeToBranches: (
		callback: (branches: Branch[]) => void
	): (() => void) => {
		const branchesRef = collection(db, "branches");
		const q = query(branchesRef, orderBy("name", "asc"));

		const unsubscribe = onSnapshot(
			q,
			(querySnapshot) => {
				const branches = querySnapshot.docs.map((doc) => ({
					id: doc.id,
					...doc.data(),
				})) as Branch[];

				callback(branches);
			},
			(error) => {
				console.error("Error in branches subscription:", error);
			}
		);

		return unsubscribe;
	},
};
