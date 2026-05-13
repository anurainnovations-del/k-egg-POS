import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs 
} from "firebase/firestore";
import { db } from "@/firebase-config";
import { AuditLog } from "@/types/AuditLog";

export const auditService = {
  async logAction(log: Omit<AuditLog, 'id' | 'timestamp'>) {
    try {
      const logRef = collection(db, 'auditLogs');
      await addDoc(logRef, {
        ...log,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Failed to create audit log:", error);
    }
  },

  async getBranchLogs(branchId: string, limitCount: number = 50): Promise<AuditLog[]> {
    try {
      const logRef = collection(db, 'auditLogs');
      const q = query(
        logRef,
        where("branchId", "==", branchId),
        orderBy("timestamp", "desc"),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AuditLog));
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
      return [];
    }
  }
};
