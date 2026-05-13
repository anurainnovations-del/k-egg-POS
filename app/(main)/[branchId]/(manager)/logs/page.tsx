"use client";

import { useState, useEffect } from "react";
import LogsIcon from "@/components/icons/SidebarNav/LogsIcon";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import ViewOnlyWrapper from "@/components/ViewOnlyWrapper";
import { useBranch } from "@/contexts/BranchContext";
import { auditService } from "@/services/auditService";
import { AuditLog, AuditAction } from "@/types/AuditLog";
import LoadingSpinner from "@/components/LoadingSpinner";
import { formatTimeAgo, formatFullDateTime } from "@/lib/date_formatter";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase-config";

const ACTION_COLORS: Record<string, string> = {
  STOCK_UPDATE: "bg-blue-100 text-blue-700",
  STOCK_ADJUSTMENT: "bg-amber-100 text-amber-700",
  ENTITY_CREATE: "bg-green-100 text-green-700",
  ENTITY_EDIT: "bg-indigo-100 text-indigo-700",
  ENTITY_DELETE: "bg-red-100 text-red-700",
  ORDER_COMPLETED: "bg-emerald-100 text-emerald-700",
  ORDER_VOIDED: "bg-rose-100 text-rose-700",
};

export default function LogsScreen() {
  const { currentBranch } = useBranch();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>("");

  useEffect(() => {
    if (!currentBranch) return;

    setLoading(true);
    const q = query(
      collection(db, 'auditLogs'),
      where("branchId", "==", currentBranch.id),
      orderBy("timestamp", "desc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AuditLog));
      setLogs(logsData);
      setLoading(false);
    }, (error) => {
      console.error("Logs subscription error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentBranch]);

  const filteredLogs = logs.filter(log => 
    !filterAction || log.action === filterAction
  );

  return (
    <ViewOnlyWrapper branchId={currentBranch?.id} pageName='logs'>
      <div className='flex h-full flex-col overflow-hidden'>
        <div className='xl:hidden w-full'>
          <MobileTopBar title='Activity Logs' icon={<LogsIcon className="w-6 h-6" />} />
        </div>
        <div className='hidden xl:block w-full'>
          <TopBar title='Activity Logs' icon={<LogsIcon className="w-6 h-6" />} />
        </div>

        <div className='flex-1 overflow-hidden flex flex-col'>
          {/* Filters */}
          <div className="px-6 py-4 bg-white border-b border-[var(--border)] flex gap-4">
            <select 
              value={filterAction} 
              onChange={(e) => setFilterAction(e.target.value)}
              className="text-sm px-4 py-2 rounded-xl border border-[var(--border)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="">All Actions</option>
              <option value="STOCK_UPDATE">Stock Update</option>
              <option value="STOCK_ADJUSTMENT">Stock Adjustment</option>
              <option value="ENTITY_CREATE">Creation</option>
              <option value="ENTITY_EDIT">Editing</option>
              <option value="ENTITY_DELETE">Deletion</option>
              <option value="ORDER_COMPLETED">Order Completed</option>
              <option value="ORDER_VOIDED">Order Voided</option>
            </select>
          </div>

          <div className='flex-1 overflow-y-auto px-6 py-6'>
            {loading ? (
              <div className="flex items-center justify-center h-full gap-3">
                <LoadingSpinner size="lg" />
                <span className="text-sm text-gray-500 font-medium">Fetching activities…</span>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className='flex flex-col items-center justify-center h-full text-center'>
                <div className='w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4'>
                  <LogsIcon className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className='text-lg font-bold text-[var(--secondary)]'>No logs found</h3>
                <p className='text-sm text-gray-500'>Activities for this branch will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="bg-white rounded-2xl p-4 border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-[var(--accent)] text-[var(--secondary)] flex items-center justify-center font-bold text-sm">
                          {log.userName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-[var(--secondary)]">{log.userName}</span>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                              {log.action.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 font-medium">
                            {log.details.message || `Performed ${log.action} on ${log.entityType}`}
                          </p>
                          <div className="mt-2 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                            ID: {log.entityId} • {log.timestamp ? formatFullDateTime(log.timestamp.toDate()) : 'Recent'}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 font-bold whitespace-nowrap">
                        {log.timestamp ? formatTimeAgo(log.timestamp.toDate()) : 'Now'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ViewOnlyWrapper>
  );
}
