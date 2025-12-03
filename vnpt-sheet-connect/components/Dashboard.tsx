
import React, { useState, useEffect, useMemo } from 'react';
import { SheetData, SheetRow, User } from '../types';
import { EntryModal } from './EntryModal';
import { saveSheetRow, createMonthSheets } from '../services/sheetService';

interface DashboardProps {
  data: SheetData;
  availableSheets: string[];
  currentSheetName: string;
  onSheetChange: (sheetName: string) => void;
  scriptUrl: string;
  onRefresh: () => Promise<void>;
  spreadsheetUrl?: string;
  onUrlUpdate: (url: string) => void;
  user: User; // User prop for permission check
}

// Columns for Report view
const REPORT_COLUMNS = [
  'STT', 'Mã Lớp', 'Nội dung', 'Buổi', 'Ngày', 'Thứ', 'GV', 
  '91', '66', '60', 'OL', 'KN', 'Coach', 'OKR', 'STL', 'OS', 'CT', 'HOC', 
  'Đơn vị', 'SL HV', 'Hình Thức', 'ĐTV'
];

// Definition for Statistics (TH) View
const TH_GROUPS = [
  { 
    title: 'ĐTV-M', 
    colorClass: 'bg-gray-100 text-gray-700 border-r-2 border-gray-300', 
    cols: ['91', '66', '60', 'OL', 'KN', 'Coach', 'Tổng'],
    keys: ['91', '66', '60', 'OL', 'KN', 'Coach', 'Tổng']
  },
  { 
    title: 'ĐTV-HH', 
    colorClass: 'bg-gray-100 text-gray-700 border-r-2 border-gray-300', 
    cols: ['91', '66', '60', 'OL', 'KN', 'Coach', 'Tổng'],
    keys: ['91_1', '66_1', '60_1', 'OL_1', 'KN_1', 'Coach_1', 'Tổng_1']
  },
  { 
    title: 'ALL', 
    colorClass: 'bg-gray-100 text-gray-700', 
    cols: ['91', '66', '60', 'OL', 'KN', 'Coach', 'OS', 'CT', 'Họp', 'Học', 'Tổng'],
    keys: ['91_2', '66_2', '60_2', 'OL_2', 'KN_2', 'Coach_2', 'OS', 'CT', 'Họp', 'Học', 'Tổng_2']
  }
];

// Generate standard 12 months list
const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => {
  const m = i + 1;
  return m < 10 ? `0${m}` : `${m}`;
});

// Helper to get days array for a specific month
const getDaysArray = (monthStr: string) => {
  const year = new Date().getFullYear();
  const monthIndex = parseInt(monthStr, 10); 
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    return day < 10 ? `0${day}` : `${day}`;
  });
};

type SheetCategory = 'BC' | 'BF' | 'TH';

export const Dashboard: React.FC<DashboardProps> = ({ 
  data, 
  availableSheets, 
  currentSheetName, 
  onSheetChange,
  scriptUrl,
  onRefresh,
  spreadsheetUrl,
  onUrlUpdate,
  user
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const currentMonth = new Date().getMonth() + 1;
    return currentMonth < 10 ? `0${currentMonth}` : `${currentMonth}`;
  });
  
  const [activeCategory, setActiveCategory] = useState<SheetCategory>('BC');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [foundSheetName, setFoundSheetName] = useState<string>('');

  // --- PERMISSION LOGIC ---
  const canCreateMonth = user.role === 'ADMIN';
  // Admin and Leader can add data, Instructor is read-only. Also checks category.
  const canAddData = (user.role === 'ADMIN' || user.role === 'LEADER') && activeCategory === 'BC' && !!foundSheetName;

  useEffect(() => {
    if (!selectedMonth) return;

    const findMatchingSheet = () => {
      const monthPattern = selectedMonth.length === 1 ? `0${selectedMonth}` : selectedMonth;
      
      return availableSheets.find(name => {
        const nameUpper = name.toUpperCase();
        const hasMonth = nameUpper.includes(`T${monthPattern}`) || nameUpper.includes(monthPattern);
        
        if (!hasMonth) return false;

        if (activeCategory === 'BC') return nameUpper.includes('BC') || nameUpper.includes('BAO');
        if (activeCategory === 'BF') return nameUpper.includes('BF') || nameUpper.includes('BU') || nameUpper.includes('PHEP');
        if (activeCategory === 'TH') return nameUpper.includes('TONG') || nameUpper.includes('TH') || nameUpper.startsWith('T-'); 
        
        return false;
      });
    };

    const target = findMatchingSheet();
    setFoundSheetName(target || '');

    if (target && target !== currentSheetName) {
      onSheetChange(target);
    }
  }, [selectedMonth, activeCategory, availableSheets, onSheetChange, currentSheetName]);

  const currentColumns = useMemo(() => {
    if (activeCategory === 'BF') {
      const days = selectedMonth ? getDaysArray(selectedMonth) : [];
      return ['STT', 'Giảng Viên', ...days];
    }
    if (activeCategory === 'TH') {
      return ['STT', 'Giảng Viên'];
    }
    return REPORT_COLUMNS;
  }, [activeCategory, selectedMonth]);

  const filteredRows = data.rows.filter(row => 
    Object.values(row).some((val) => 
      (val as string).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const getCellColor = (value: string, header: string) => {
    if (activeCategory === 'BF') {
        if (header !== 'STT' && header !== 'Giảng Viên') {
            const val = value?.toLowerCase().trim();
            if (val === 'p') return 'bg-yellow-100 font-bold text-yellow-700';
            if (val === 'kp' || val === 'x') return 'bg-red-100 font-bold text-red-700';
            if (val === 'b') return 'bg-blue-100 font-bold text-blue-700';
        }
    }

    if (typeof value === 'string' && value.includes('%')) {
       const num = parseFloat(value);
       if (!isNaN(num)) {
         if (num >= 80) return 'text-green-600 font-bold bg-green-50';
         if (num < 50) return 'text-red-600 font-bold bg-red-50';
         return 'text-blue-600';
       }
    }
    if (value && !isNaN(Number(value)) && Number(value) > 0) {
       return 'font-medium text-gray-900';
    }
    return '';
  };

  const getRowValue = (row: SheetRow, header: string) => {
    if (row[header] !== undefined) return row[header];
    const foundKey = Object.keys(row).find(k => k.toLowerCase() === header.toLowerCase());
    if (foundKey) return row[foundKey];
    if (header === 'Mã Lớp' && row['Đài']) return row['Đài'];
    if (header === 'Nội dung' && row['Mã Lớp']) return row['Mã Lớp'];
    if (!isNaN(Number(header))) {
        const numKey = parseInt(header, 10).toString(); 
        if (row[numKey] !== undefined) return row[numKey];
    }
    return '';
  };

  const handleSaveData = async (rowData: SheetRow) => {
    if (!foundSheetName) return;
    await saveSheetRow(scriptUrl, foundSheetName, rowData);
    data.rows.push(rowData);
  };

  const handleCreateMonth = async () => {
    setIsCreating(true);
    try {
      const res = await createMonthSheets(scriptUrl, selectedMonth);
      if (res.success) {
          if (res.spreadsheetUrl) {
            onUrlUpdate(res.spreadsheetUrl);
          }
          await onRefresh(); 
      }
    } catch (error) {
      console.error("Lỗi khởi tạo: " + error);
    } finally {
      setIsCreating(false);
    }
  };

  const nextStt = data.rows.length + 1;

  // Render Helpers
  const renderTableHeader = () => {
    if (activeCategory === 'TH') {
      return (
        <thead className="sticky top-0 z-20 shadow-sm text-center">
          <tr>
            <th rowSpan={2} className="px-2 py-2 bg-gray-100 border border-gray-300 text-gray-600 font-bold sticky left-0 z-30 w-12 border-r-2 border-r-gray-300">STT</th>
            <th rowSpan={2} className="px-4 py-2 bg-gray-100 border border-gray-300 text-gray-600 font-bold sticky left-12 z-30 min-w-[180px] text-left border-r-2 border-r-gray-300">GIẢNG VIÊN</th>
            {TH_GROUPS.map((group, idx) => (
              <th key={idx} colSpan={group.cols.length} className={`px-2 py-2 text-sm font-bold border border-gray-300 uppercase tracking-wide ${group.colorClass}`}>
                {group.title}
              </th>
            ))}
          </tr>
          <tr>
            {TH_GROUPS.map((group) => (
              group.cols.map((col, idx) => (
                <th key={`${group.title}-${idx}`} className="px-1 py-1 bg-gray-50 border border-gray-300 text-[10px] font-bold text-gray-600 min-w-[40px]">
                  {col}
                </th>
              ))
            ))}
          </tr>
        </thead>
      );
    }

    return (
      <thead className="bg-gray-100 sticky top-0 z-20 shadow-sm">
        <tr>
          {currentColumns.map((header, idx) => (
            <th key={idx} className={`px-2 py-3 border border-gray-300 text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap text-center
                ${header === 'STT' ? 'sticky left-0 bg-gray-100 z-30 border-r-2 border-r-gray-300 w-12' : ''}
                ${(header === 'Giảng Viên' && activeCategory === 'BF') ? 'sticky left-12 bg-gray-100 z-30 border-r-2 border-r-gray-300 min-w-[180px] text-left px-4' : ''}
                ${header === 'Mã Lớp' ? 'min-w-[100px]' : ''}
                ${header === 'Nội dung' ? 'min-w-[250px] text-left px-3' : ''}
                ${activeCategory === 'BF' && !isNaN(Number(header)) ? 'w-10 min-w-[2.5rem]' : ''} 
            `}>
              {header}
            </th>
          ))}
        </tr>
      </thead>
    );
  };

  const renderTableBody = () => {
    if (activeCategory === 'TH') {
      return filteredRows.map((row, rIdx) => (
        <tr key={rIdx} className="hover:bg-blue-50 transition-colors">
          <td className="px-2 py-1 text-xs border border-gray-200 text-center sticky left-0 bg-white border-r-2 border-r-gray-300 z-10 font-mono">{getRowValue(row, 'STT')}</td>
          <td className="px-4 py-1 text-xs border border-gray-200 text-left sticky left-12 bg-white border-r-2 border-r-gray-300 z-10 font-bold whitespace-nowrap">{getRowValue(row, 'Giảng Viên') || getRowValue(row, 'GV')}</td>
          
          {TH_GROUPS.map(group => 
             group.keys.map((key, kIdx) => {
               const val = getRowValue(row, key);
               return (
                 <td key={`${group.title}-${key}-${kIdx}`} className={`px-2 py-1 text-xs border border-gray-200 text-center ${val && Number(val) > 0 ? 'font-medium' : 'text-gray-400'}`}>
                   {val}
                 </td>
               )
             })
          )}
        </tr>
      ));
    }

    return filteredRows.map((row, rIdx) => (
      <tr key={rIdx} className="group hover:bg-blue-50 transition-colors">
        {currentColumns.map((header, cIdx) => {
          const value = getRowValue(row, header);
          return (
            <td 
              key={cIdx} 
              className={`px-2 py-2 text-xs border border-gray-200 text-gray-700 whitespace-nowrap max-w-xs truncate
                ${header === 'STT' ? 'text-center sticky left-0 bg-gray-50 group-hover:bg-blue-50 border-r-2 border-r-gray-300 font-mono z-10' : ''}
                ${(header === 'Giảng Viên' && activeCategory === 'BF') ? 'sticky left-12 bg-gray-50 group-hover:bg-blue-50 border-r-2 border-r-gray-300 z-10 font-bold text-vnpt-primary px-4' : ''}
                ${header === 'Nội dung' ? 'whitespace-normal min-w-[250px] text-left px-3' : ''}
                ${activeCategory === 'BF' && !isNaN(Number(header)) ? 'text-center' : 'text-left'}
                ${getCellColor(value as string, header)}
              `}
              title={value as string}
            >
              {value as React.ReactNode}
            </td>
          );
        })}
      </tr>
    ));
  };

  const renderContent = () => {
    if (!foundSheetName) {
       return (
         <div className="flex flex-col items-center justify-center h-full bg-gray-50/50">
           <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center max-w-md">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-vnpt-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Chưa có dữ liệu Tháng {selectedMonth}</h3>
              
              {canCreateMonth ? (
                <>
                  <p className="text-gray-500 text-sm mb-6">
                     Hệ thống chưa tìm thấy dữ liệu cho tháng này. Bạn có muốn khởi tạo ngay không?
                  </p>
                  <button 
                    onClick={handleCreateMonth}
                    disabled={isCreating}
                    className={`w-full py-2.5 rounded-md font-bold text-white shadow transition-all flex items-center justify-center space-x-2
                      ${isCreating ? 'bg-gray-400 cursor-not-allowed' : 'bg-vnpt-primary hover:bg-blue-700 active:transform active:scale-95'}
                    `}
                  >
                    <span>{isCreating ? 'Đang khởi tạo...' : `Khởi tạo dữ liệu Tháng ${selectedMonth}`}</span>
                  </button>
                </>
              ) : (
                <p className="text-red-500 text-sm mt-4 bg-red-50 p-2 rounded border border-red-100">
                  Vui lòng liên hệ Admin để khởi tạo dữ liệu tháng này.
                </p>
              )}
           </div>
         </div>
       );
    }
    
    if (filteredRows.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
             <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
             </svg>
             <p className="text-sm font-medium">Bảng tính trống</p>
             {canAddData && <p className="text-xs mt-1">Sử dụng nút "Thêm mới" để nhập liệu</p>}
          </div>
        );
    }
    
    return (
        <div className="flex-1 overflow-auto bg-white custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-max">
              {renderTableHeader()}
              <tbody className="divide-y divide-gray-200">
                {renderTableBody()}
              </tbody>
            </table>
        </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="border-b border-gray-200 px-4 py-3 bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-4 sticky top-0 z-30 shadow-sm">
        
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
          <div className="flex items-center space-x-2 bg-gray-50 rounded-md border border-gray-200 px-3 py-1.5 whitespace-nowrap">
             <span className="text-gray-500 text-sm font-medium">Tháng:</span>
             <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent font-bold text-vnpt-primary outline-none cursor-pointer min-w-[50px]"
             >
                {ALL_MONTHS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
             </select>
          </div>
          
          <div className="h-6 w-px bg-gray-300 hidden md:block"></div>

          <div className="flex items-center space-x-2">
            <div className="flex space-x-1 bg-gray-100/80 p-1 rounded-lg whitespace-nowrap">
              {[
                { id: 'BC', label: 'Báo cáo' },
                { id: 'BF', label: 'Bù Phép' },
                { id: 'TH', label: 'Thống kê' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id as SheetCategory)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all
                    ${activeCategory === tab.id 
                      ? 'bg-white text-vnpt-primary shadow-sm font-bold' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            
            {spreadsheetUrl && (
              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 border border-green-700 transition-all ml-4 font-bold text-sm shadow whitespace-nowrap"
                title="Mở Google Sheet"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M19.5 21a1.5 1.5 0 001.5-1.5V15a.75.75 0 00-1.5 0v3a.75.75 0 00.75.75zm-15 0a.75.75 0 00.75-.75v-3a.75.75 0 00-1.5 0v3a1.5 1.5 0 001.5 1.5zM3 7.5a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 7.5z" clipRule="evenodd" />
                  <path d="M19.5 3H4.5A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zM4.5 4.5h15v15h-15v-15z" />
                </svg>
                <span>Mở Sheet</span>
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="relative group w-full lg:w-64">
             <div className="flex items-center border border-gray-300 rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-vnpt-primary focus-within:border-vnpt-primary transition-all bg-gray-50">
               <input
                type="text"
                placeholder="Tìm kiếm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={!foundSheetName}
                className="w-full px-3 py-1.5 text-sm outline-none bg-transparent disabled:opacity-50"
              />
            </div>
          </div>

          {canAddData && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center space-x-1 px-4 py-1.5 bg-vnpt-primary text-white rounded shadow hover:bg-blue-700 transition-transform active:scale-95 text-sm font-bold whitespace-nowrap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Thêm mới</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative flex flex-col">
        {renderContent()}
      </div>
      
      <EntryModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSaveData}
        sheetName={foundSheetName || 'Chưa chọn Sheet'}
        nextStt={nextStt}
      />
    </div>
  );
};
