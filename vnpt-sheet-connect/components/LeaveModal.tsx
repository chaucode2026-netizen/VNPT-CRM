
import React, { useState, useEffect } from 'react';
import { User } from '../types';

interface LeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (date: string, content: string, instructor: string) => Promise<void>;
  month: string; // Current selected month (e.g., "05")
  user: User;
  instructors: string[]; // List of available instructors for Admin
}

export const LeaveModal: React.FC<LeaveModalProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  month, 
  user, 
  instructors 
}) => {
  const [date, setDate] = useState('');
  const [content, setContent] = useState('');
  const [selectedInstructor, setSelectedInstructor] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      // Set default date to today if it matches the month, otherwise first day of month
      const today = new Date();
      const currentYear = today.getFullYear();
      const monthIdx = parseInt(month, 10) - 1;
      
      let defaultDate = today.toISOString().split('T')[0];
      if (today.getMonth() !== monthIdx) {
        // Create date for 1st of the selected month
        const d = new Date(currentYear, monthIdx, 2); // Use 2 to avoid timezone issues going back a month
        defaultDate = d.toISOString().split('T')[0];
      }
      
      setDate(defaultDate);
      setContent('');
      setSelectedInstructor(user.role === 'ADMIN' ? '' : user.fullName);
      setError('');
    }
  }, [isOpen, month, user]);

  const validateDate = (dateStr: string): boolean => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const selectedMonthInt = parseInt(month, 10);
    // getMonth() returns 0-11, so add 1
    return (d.getMonth() + 1) === selectedMonthInt;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateDate(date)) {
      setError(`Vui lòng chọn ngày thuộc tháng ${month}.`);
      return;
    }

    if (!content.trim()) {
      setError('Vui lòng nhập nội dung.');
      return;
    }

    const targetInstructor = user.role === 'ADMIN' ? selectedInstructor : user.fullName;
    if (!targetInstructor) {
      setError('Vui lòng chọn giảng viên.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit(date, content, targetInstructor);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isAdmin = user.role === 'ADMIN';

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-[fadeIn_0.2s]">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 bg-orange-600 text-white flex justify-between items-center">
          <h3 className="text-lg font-bold uppercase tracking-wide">Nhập Bù / Phép</h3>
          <button onClick={onClose} className="hover:bg-orange-700 p-1 rounded transition-colors text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded border border-red-200 flex items-start">
               <span className="mr-2 font-bold">!</span> {error}
            </div>
          )}

          {/* Instructor Selection (Admin Only) */}
          {isAdmin ? (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Giảng viên</label>
              <select 
                value={selectedInstructor}
                onChange={(e) => setSelectedInstructor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 outline-none text-sm bg-gray-50"
                required
              >
                <option value="">-- Chọn giảng viên --</option>
                {instructors.map((name, idx) => (
                  <option key={idx} value={name}>{name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Giảng viên</label>
              <input 
                type="text" 
                value={user.fullName} 
                disabled 
                className="w-full px-3 py-2 border border-gray-200 bg-gray-100 rounded text-gray-500 text-sm font-medium"
              />
            </div>
          )}

          {/* Date Selection */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Ngày (Tháng {month})</label>
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 outline-none text-sm"
              required
            />
            <p className="text-[10px] text-gray-400 mt-1 italic">Chỉ được chọn ngày trong tháng đang hiển thị.</p>
          </div>

          {/* Content Input */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Nội dung</label>
            <input 
              type="text" 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Nhập lý do (VD: P, KP, B...)"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold text-gray-800"
              required
            />
          </div>

          {/* Actions */}
          <div className="pt-4 flex justify-end space-x-3">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 rounded text-gray-600 hover:bg-gray-100 font-medium text-sm transition-colors"
            >
              Hủy
            </button>
            <button 
              type="submit"
              disabled={loading}
              className={`px-6 py-2 rounded text-white font-bold shadow transition-all text-sm
                ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700 active:scale-95'}
              `}
            >
              {loading ? 'Đang lưu...' : 'Lưu dữ liệu'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
