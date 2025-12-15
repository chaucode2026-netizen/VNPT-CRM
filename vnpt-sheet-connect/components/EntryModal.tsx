
import React, { useState, useEffect } from 'react';
import { SheetRow, AppConfig } from '../types';

interface EntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SheetRow) => Promise<void>;
  sheetName: string;
  nextStt: number; // Receive the next auto-calculated STT
  appConfig: AppConfig;
}

const LIST_HINH_THUC = ['Online', 'Offline'];
// Updated: Added 'CD' option
const LIST_DTV = ['HH', 'M', 'CD'];

export const EntryModal: React.FC<EntryModalProps> = ({ isOpen, onClose, onSubmit, sheetName, nextStt, appConfig }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<SheetRow>({
    'STT': nextStt.toString(),
    'Mã Lớp': '',
    'Nội dung': '',
    'Buổi': 'S',
    'Ngày': new Date().toISOString().split('T')[0],
    'Thứ': '',
    'GV': '',
    // Updated keys
    'DĐ': '0', 'BRCĐ': '0', 'CNTT': '0', 'OL': '0', 'KN': '0', 'Coach': '0', 
    'AI Mentor': '0', 'TTKD': '0', 'OKR': '0', 'STL': '0', 'OS': '0', 'CT': '0', 'HOC': '0',
    'Đơn vị': '',
    'SL HV': '0',
    'Hình Thức': 'Offline',
    'ĐTV': 'HH',
    'Màu': '#ffffff' // Default white
  });

  // Update STT when nextStt prop changes or modal opens
  useEffect(() => {
    if (isOpen) {
        setFormData(prev => ({ ...prev, 'STT': nextStt.toString() }));
    }
  }, [isOpen, nextStt]);

  // Auto-calculate Day of Week when Date changes
  useEffect(() => {
    if (formData['Ngày']) {
      const date = new Date(formData['Ngày']);
      const days = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
      const dayName = days[date.getDay()];
      setFormData(prev => ({ ...prev, 'Thứ': dayName }));
    }
  }, [formData['Ngày']]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
      onClose();
      // Reset logic can be handled by parent or by resetting state here if needed
      // For now, next open will reset STT via useEffect
    } catch (err) {
      alert('Có lỗi xảy ra khi lưu dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Use config lists with fallbacks
  const listMaLop = appConfig.classCodes.length ? appConfig.classCodes : ['VNPT-DEFAULT'];
  const listGV = appConfig.instructors.length ? appConfig.instructors : ['Giảng viên mặc định'];
  const listDonVi = appConfig.units.length ? appConfig.units : ['TTKD'];

  // Common input styles for dark mode
  const inputClass = "w-full px-3 py-2 border border-slate-600 bg-slate-700 text-white rounded focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none text-sm placeholder-gray-400";
  const labelClass = "block text-xs font-bold text-gray-200 mb-1";

  // List of metric fields to render in grid
  const metricFields = ['DĐ', 'BRCĐ', 'CNTT', 'OL', 'KN', 'Coach', 'AI Mentor', 'TTKD', 'OKR', 'STL', 'OS', 'CT', 'HOC'];

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm">
      <div className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col border border-slate-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-blue-600 bg-vnpt-primary text-white flex justify-between items-center sticky top-0 z-10 shadow-md">
          <div>
            <h3 className="text-lg font-bold uppercase tracking-wide">Nhập liệu Báo Cáo</h3>
            <p className="text-xs text-blue-100 opacity-90">Sheet: {sheetName}</p>
          </div>
          <button onClick={onClose} className="hover:bg-blue-700 p-1 rounded transition-colors text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-12 gap-4">
          
          {/* Row 1: Mã Lớp (Expanded), Nội dung */}
          {/* STT hidden from UI but exists in state */}
          
          <div className="md:col-span-4">
            <label className={labelClass}>Mã Lớp</label>
            <select 
              required
              value={formData['Mã Lớp']}
              onChange={(e) => handleChange('Mã Lớp', e.target.value)}
              className={inputClass}
            >
              <option value="" className="bg-slate-700 text-gray-300">-- Chọn Mã Lớp --</option>
              {listMaLop.map(item => <option key={item} value={item} className="bg-slate-700 text-white">{item}</option>)}
            </select>
          </div>

          <div className="md:col-span-8">
            <label className={labelClass}>Nội dung</label>
            <input 
              type="text"
              required
              value={formData['Nội dung']}
              onChange={(e) => handleChange('Nội dung', e.target.value)}
              className={inputClass}
              placeholder="Nhập nội dung đào tạo..."
            />
          </div>

          {/* Row 2: Buổi, Ngày, Thứ, GV */}
          <div className="md:col-span-2">
            <label className={labelClass}>Buổi</label>
            <select 
              value={formData['Buổi']}
              onChange={(e) => handleChange('Buổi', e.target.value)}
              className={inputClass}
            >
              <option value="S" className="bg-slate-700">S (Sáng)</option>
              <option value="C" className="bg-slate-700">C (Chiều)</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label className={labelClass}>Ngày</label>
            <input 
              type="date"
              required
              value={formData['Ngày']}
              onChange={(e) => handleChange('Ngày', e.target.value)}
              className={`${inputClass} [color-scheme:dark]`}
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Thứ</label>
            <input 
              type="text"
              value={formData['Thứ']}
              readOnly
              className="w-full px-3 py-2 border border-slate-600 bg-slate-900 rounded text-sm text-blue-300 font-bold cursor-not-allowed"
            />
          </div>

          <div className="md:col-span-5">
            <label className={labelClass}>Giảng Viên (GV)</label>
            <select 
              required
              value={formData['GV']}
              onChange={(e) => handleChange('GV', e.target.value)}
              className={inputClass}
            >
              <option value="" className="bg-slate-700">-- Chọn Giảng Viên --</option>
              {listGV.map(item => <option key={item} value={item} className="bg-slate-700">{item}</option>)}
            </select>
          </div>

          {/* Row 3: Numeric Metrics Grid */}
          <div className="md:col-span-12 border-t border-slate-600 py-4 my-2 bg-slate-800/50 rounded px-2">
            <label className="block text-xs font-bold text-blue-300 mb-3 uppercase border-l-4 border-blue-500 pl-2">Chỉ số đào tạo</label>
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-2">
              {metricFields.map((field) => (
                <div key={field}>
                  <label className="block text-[10px] text-gray-400 text-center mb-1 truncate" title={field}>{field}</label>
                  <input 
                    type="number"
                    min="0"
                    value={formData[field]}
                    onChange={(e) => handleChange(field, e.target.value)}
                    className="w-full px-1 py-1 text-center border border-slate-600 bg-slate-700 text-white rounded focus:ring-1 focus:ring-blue-400 outline-none text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Row 4: Đơn vị, SL HV, Hình thức, ĐTV */}
          <div className="md:col-span-4">
            <label className={labelClass}>Đơn vị</label>
            <select 
              required
              value={formData['Đơn vị']}
              onChange={(e) => handleChange('Đơn vị', e.target.value)}
              className={inputClass}
            >
              <option value="" className="bg-slate-700">-- Chọn Đơn vị --</option>
              {listDonVi.map(item => <option key={item} value={item} className="bg-slate-700">{item}</option>)}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>SL HV</label>
            <input 
              type="number"
              min="0"
              required
              value={formData['SL HV']}
              onChange={(e) => handleChange('SL HV', e.target.value)}
              className="w-full px-3 py-2 border border-slate-600 bg-slate-700 rounded focus:ring-1 focus:ring-blue-400 outline-none text-sm font-bold text-green-400"
            />
          </div>

          <div className="md:col-span-3">
            <label className={labelClass}>Hình Thức</label>
            <select 
              value={formData['Hình Thức']}
              onChange={(e) => handleChange('Hình Thức', e.target.value)}
              className={inputClass}
            >
              {LIST_HINH_THUC.map(item => <option key={item} value={item} className="bg-slate-700">{item}</option>)}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className={labelClass}>ĐTV</label>
            <select 
              value={formData['ĐTV']}
              onChange={(e) => handleChange('ĐTV', e.target.value)}
              className={inputClass}
            >
               {LIST_DTV.map(item => <option key={item} value={item} className="bg-slate-700">{item}</option>)}
            </select>
          </div>

          {/* Row 5: Màu sắc (Color Picker) */}
          <div className="md:col-span-12 flex items-center justify-end space-x-3 mt-2">
             <label className="text-xs font-bold text-gray-200 uppercase">Màu hiển thị dòng:</label>
             <div className="relative overflow-hidden rounded-md border border-slate-500 w-10 h-8">
                <input 
                  type="color" 
                  value={formData['Màu']}
                  onChange={(e) => handleChange('Màu', e.target.value)}
                  className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer border-none p-0"
                  title="Chọn màu nền cho dòng này"
                />
             </div>
          </div>

        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-900 border-t border-slate-700 flex justify-end space-x-3 sticky bottom-0 z-10">
          <button 
            type="button" 
            onClick={onClose}
            className="px-5 py-2 rounded border border-slate-600 text-gray-300 bg-transparent hover:bg-slate-800 font-medium transition-colors"
          >
            Hủy bỏ
          </button>
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className={`px-6 py-2 rounded text-white font-bold shadow-md transition-all flex items-center
              ${loading ? 'bg-gray-600 cursor-not-allowed' : 'bg-vnpt-primary hover:bg-blue-600 active:scale-95'}
            `}
          >
            {loading && (
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {loading ? 'Đang lưu...' : 'Lưu dữ liệu'}
          </button>
        </div>
      </div>
    </div>
  );
};
