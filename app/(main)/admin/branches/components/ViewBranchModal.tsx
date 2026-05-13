'use client';

import { Branch } from '@/services/branchService';

interface ViewBranchModalProps {
  isOpen: boolean;
  branch: Branch | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function formatDate(date: Date) {
  return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ViewBranchModal({
  isOpen,
  branch,
  onClose,
  onEdit,
  onDelete
}: ViewBranchModalProps) {
  if (!isOpen || !branch) return null;

  const createdAt = branch.createdAt.toDate();
  const updatedAt = branch.updatedAt.toDate();
  const isRecent = (Date.now() - updatedAt.getTime()) < 24 * 60 * 60 * 1000; // Less than 24 hours

  return (
    <div 
      className="fixed inset-0 bg-[var(--primary)]/80 flex items-center justify-center z-50 p-4 sm:p-6"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl p-4 sm:p-6 lg:p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-[var(--light-accent)] rounded-xl mx-auto mb-4 flex items-center justify-center">
            <svg className="w-6 h-6 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-[var(--secondary)] mb-2">
            Branch Details
          </h3>
          <p className="text-[var(--secondary)] opacity-70">
            Complete information about this branch
          </p>
        </div>

        {/* Branch Information */}
        <div className="space-y-4 sm:space-y-6">
          {/* Basic Info Card */}
          <div className="bg-gray-50 rounded-xl p-4 sm:p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h4 className="text-xl font-bold text-[var(--secondary)] mb-2">
                  {branch.name}
                </h4>
                <div className="flex items-center gap-2 text-[var(--secondary)] opacity-70 mb-3">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{branch.location}</span>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                branch.isActive 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {branch.isActive ? 'Active' : 'Inactive'}
              </div>
            </div>

            {/* Status Description */}
            <div className="border-t border-gray-200 pt-4">
              <p className="text-sm text-[var(--secondary)] opacity-70">
                {branch.isActive 
                  ? 'This branch is currently operational and accessible to users for transactions and management.'
                  : 'This branch is currently disabled and will not appear in user selections or operations.'
                }
              </p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            {/* Branch ID */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--secondary)]">Branch ID</p>
                  <p className="text-xs text-[var(--secondary)] opacity-70 font-mono bg-gray-100 px-2 py-1 rounded mt-1">
                    {branch.id}
                  </p>
                </div>
              </div>
            </div>

            {/* Creation Date */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--secondary)]">Created</p>
                  <p className="text-xs text-[var(--secondary)] opacity-70">
                    {formatDate(createdAt)}
                  </p>
                </div>
              </div>
            </div>

            {/* Last Updated */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--secondary)]">Last Updated</p>
                    {isRecent && (
                      <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">Recent</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--secondary)] opacity-70">
                    {formatDate(updatedAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-gradient-to-r from-[var(--light-accent)] to-yellow-50 rounded-xl p-4 border border-yellow-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[var(--accent)] rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-[var(--primary)]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--secondary)]">Branch Operations</p>
                <p className="text-xs text-[var(--secondary)] opacity-70">
                  {branch.isActive 
                    ? 'Ready for business operations, inventory management, and sales tracking'
                    : 'Operations suspended - branch requires activation to resume business activities'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-6 sm:mt-8">
          <button
            onClick={onClose}
            className="w-full sm:flex-1 py-2.5 sm:py-3 bg-gray-200 hover:bg-gray-300 text-[var(--secondary)] rounded-xl font-semibold transition-all hover:scale-105 active:scale-95 text-sm sm:text-base"
          >
            Close
          </button>
          <button
            onClick={onEdit}
            className="w-full sm:flex-1 py-2.5 sm:py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
          <button
            onClick={onDelete}
            className="w-full sm:flex-1 py-2.5 sm:py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}