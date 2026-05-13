'use client';

import { useState } from 'react';
import PlusIcon from '@/components/icons/PlusIcon';
import { branchService } from '@/services/branchService';
import ImageUpload from '@/components/ImageUpload';
import { MEDIA_BUCKETS } from '@/lib/firebaseStorage';

interface AddBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export default function AddBranchModal({
  isOpen,
  onClose,
  onSuccess,
  onError
}: AddBranchModalProps) {
  const [loading, setLoading] = useState(false);
  const [branchData, setBranchData] = useState({
    name: '',
    location: '',
    imgUrl: ''
  });

  if (!isOpen) return null;

  const validateForm = () => {
    if (!branchData.name.trim()) {
      onError('Branch name is required');
      return false;
    }
    if (!branchData.location.trim()) {
      onError('Branch location is required');
      return false;
    }
    return true;
  };

  const handleCreateBranch = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      await branchService.createBranch({
        name: branchData.name.trim(),
        location: branchData.location.trim(),
        isActive: true,
        imgUrl: branchData.imgUrl
      });

      // Reset form
      setBranchData({
        name: '',
        location: '',
        imgUrl: ''
      });
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating branch:', error);
      onError('Failed to create branch. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof typeof branchData, value: string) => {
    setBranchData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div 
      className="fixed inset-0 bg-[var(--primary)]/80 flex items-center justify-center z-50 p-4 sm:p-6"
      onClick={!loading ? onClose : undefined}
    >
      <div 
        className="bg-white rounded-2xl p-4 sm:p-6 lg:p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          /* Loading Screen */
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-[var(--light-accent)] rounded-xl mx-auto mb-4 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-dashed border-[var(--accent)]"></div>
            </div>
            <h3 className="text-xl font-bold text-[var(--secondary)] mb-2">
              Creating Branch...
            </h3>
            <p className="text-[var(--secondary)] opacity-70">
              Please wait while we create your new branch
            </p>
          </div>
        ) : (
          <>
            {/* Modal Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-[var(--light-accent)] rounded-xl mx-auto mb-4 flex items-center justify-center">
                <PlusIcon className='size-6 text-[var(--accent)]'/>
              </div>
              <h3 className="text-xl font-bold text-[var(--secondary)] mb-2">
                Add New Branch
              </h3>
              <p className="text-[var(--secondary)] opacity-70">
                Create a new branch location for your business
              </p>
            </div>

            {/* Add Branch Form */}
            <div className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                  Branch Name <span className="text-[var(--error)]">*</span>
                </label>
                <input
                  type="text"
                  value={branchData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 text-sm sm:text-[14px] h-10 sm:h-[44px] rounded-lg border-2 border-[var(--secondary)]/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  placeholder="Enter branch name"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                  Location <span className="text-[var(--error)]">*</span>
                </label>
                <input
                  type="text"
                  value={branchData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  className="w-full px-3 py-2 text-sm sm:text-[14px] h-10 sm:h-[44px] rounded-lg border-2 border-[var(--secondary)]/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  placeholder="Enter branch location"
                  maxLength={200}
                />
                
                
              </div>
              <div>
                  <ImageUpload
                    currentImageUrl={branchData.imgUrl}
                    onImageUpload={(imageUrl) => setBranchData({...branchData, imgUrl: imageUrl})}
                    onImageRemove={() => setBranchData({...branchData, imgUrl: ""})}
                    label='Branch Image'
                    bucket={MEDIA_BUCKETS.BRANCHES}
                  />
                </div>

              {/* Preview Section */}
              {/* {(branchData.name.trim() || branchData.location.trim()) && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-[var(--secondary)] opacity-70 mb-2">Preview:</div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[var(--light-accent)] rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-[var(--secondary)] mb-1">
                        {branchData.name.trim() || 'Branch Name'}
                      </h4>
                      <p className="text-sm text-[var(--secondary)] opacity-70">
                        {branchData.location.trim() || 'Branch Location'}
                      </p>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                        Active
                      </div>
                    </div>
                  </div>
                </div>
              )} */}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8">
              <button
                onClick={onClose}
                className="w-full sm:flex-1 py-2.5 sm:py-3 bg-gray-200 hover:bg-gray-300 text-[var(--secondary)] rounded-xl font-semibold transition-all hover:scale-105 active:scale-95 text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBranch}
                disabled={!branchData.name.trim() || !branchData.location.trim()}
                className={`w-full sm:flex-1 py-2.5 sm:py-3 rounded-xl font-semibold transition-all text-sm sm:text-base ${
                  branchData.name.trim() && branchData.location.trim()
                    ? 'bg-[var(--accent)] hover:bg-[var(--accent)] text-[var(--primary)] text-shadow-lg hover:scale-105 cursor-pointer'
                    : 'bg-[var(--secondary)]/20 text-[var(--secondary)]/40 hover:scale-100 active:scale-100 cursor-not-allowed'
                }`}
              >
                Create Branch
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
