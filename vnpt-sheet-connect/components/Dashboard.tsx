
import React, { useState, useEffect, useMemo } from 'react';
import { SheetData, SheetRow, User, AppConfig } from '../types';
import { EntryModal } from './EntryModal';
import { LeaveModal } from './LeaveModal';
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
  user: User;
  isRefreshing?: boolean;
  appConfig: AppConfig;
}

// Columns for Report view
const REPORT_COLUMNS = [
  'STT', 'Mã Lớp', 'Nội dung', 'Buổi', 'Ngày', 'Thứ', 'GV', 
  '91', '66', '60', 'OL', 'KN', 'Coach', 'OKR', 'STL', 'OS', 'CT', 'HOC', 
  'Đơn vị', 'SL HV', 'Hình Thức', 'ĐTV'
];

// Definition for Statistics (TH) View
// Updated keys to match the calculated object structure
const TH_GROUPS = [
  { 
    title: 'ĐTV-M', 
    colorClass: 'bg-blue-50 text-blue-800 border-r-2 border-gray-300', 
    cols: ['91', '66', '60', 'OL', 'KN', 'Coach', 'Tổng'],
    keys: ['M_91', 'M_66', 'M_60', 'M_OL', 'M_KN', 'M_Coach', 'M_Tong']
  },
  { 
    title: 'ĐTV-HH', 
    colorClass: 'bg-green-50 text-green-800 border-r-2 border-gray-300', 
    cols: ['91', '66', '60', 'OL', 'KN', 'Coach', 'Tổng'],
    keys: ['HH_91', 'HH_66', 'HH_60', 'HH_OL', 'HH_KN', 'HH_Coach', 'HH_Tong']
  },
  { 
    title: 'ALL', 
    colorClass: 'bg-orange-50 text-orange-800', 
    cols: ['91', '66', '60', 'OL', 'KN', 'Coach', 'OS', 'CT', 'Họp', 'Học', 'Tổng'],
    keys: ['ALL_91', 'ALL_66', 'ALL_60', 'ALL_OL', 'ALL_KN', 'ALL_Coach', 'ALL_OS', 'ALL_CT', 'ALL_Hop', 'ALL_Hoc', 'ALL_Tong']
  }
];

const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => {
  const m = i + 1;
  return m < 10 ? `0${m}` : `${m}`;
});

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

// Helper to safely parse numbers from strings like "5", "5.5", "5,5", ""
const parseVal = (val: any): number => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const str = val.toString().trim().replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

export const Dashboard: React.FC<DashboardProps> = ({ 
  data, 
  availableSheets, 
  currentSheetName, 
  onSheetChange,
  scriptUrl,
  onRefresh,
  spreadsheetUrl,
  onUrlUpdate,
  user,
  isRefreshing = false,
  appConfig
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // --- STATE ---
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const currentMonth = new Date().getMonth() + 1;
    return currentMonth < 10 ? `0${currentMonth}` : `${currentMonth}`;
  });
  
  const [activeCategory, setActiveCategory] = useState<SheetCategory>('BC');
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false); // For BC (EntryModal)
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false); // For BF (LeaveModal)
  
  const [isCreating, setIsCreating] = useState(false);

  // --- AUTO-SWITCH MONTH LOGIC ---
  useEffect(() => {
    if (availableSheets.length === 0) return;

    const availableMonths = [...new Set(availableSheets
      .map(name => {
        const match = name.match(/-T(\d{2})/); 
        return match ? match[1] : null;
      })
      .filter(m => m !== null)
    )] as string[];

    if (availableMonths.length > 0) {
      if (!availableMonths.includes(selectedMonth)) {
        availableMonths.sort();
        const latestMonth = availableMonths[availableMonths.length - 1];
        setSelectedMonth(latestMonth);
      }
    }
  }, [availableSheets]); 


  // --- DERIVED STATE ---
  const targetSheetName = useMemo(() => {
    const monthPattern = selectedMonth.length === 1 ? `0${selectedMonth}` : selectedMonth;
    const suffix = `-T${monthPattern}`;

    // CRITICAL CHANGE: When Active Category is 'TH' (Thống kê), we still want to load 'BC' (Báo cáo) data
    // because we calculate statistics FROM the report data.
    const searchType = activeCategory === 'TH' ? 'BC' : activeCategory;

    return availableSheets.find(name => {
      const nameUpper = name.toUpperCase();
      if (!nameUpper.includes(suffix)) return false;
      if (searchType === 'BC') return nameUpper.includes('BC');
      if (searchType === 'BF') return nameUpper.includes('BF') || nameUpper.includes('BU');
      return false;
    });
  }, [availableSheets, selectedMonth, activeCategory]);

  useEffect(() => {
    if (targetSheetName && targetSheetName !== currentSheetName) {
      onSheetChange(targetSheetName);
    }
  }, [targetSheetName, currentSheetName, onSheetChange]);


  // --- CALCULATE STATISTICS (THE "TẬP HỢP" LOGIC) ---
  const statisticsData = useMemo(() => {
    if (activeCategory !== 'TH' || !data || !data.rows) return [];

    const statsMap: Record<string, any> = {};

    data.rows.forEach(row => {
      // Normalize Instructor Name
      const gv = row['GV'] || row['Giảng Viên'];
      if (!gv) return;
      
      const gvKey = gv.trim();
      if (!statsMap[gvKey]) {
        statsMap[gvKey] = {
          'Giảng Viên': gvKey,
          // Initialize all counters
          'M_91': 0, 'M_66': 0, 'M_60': 0, 'M_OL': 0, 'M_KN': 0, 'M_Coach': 0, 'M_Tong': 0,
          'HH_91': 0, 'HH_66': 0, 'HH_60': 0, 'HH_OL': 0, 'HH_KN': 0, 'HH_Coach': 0, 'HH_Tong': 0,
          'ALL_91': 0, 'ALL_66': 0, 'ALL_60': 0, 'ALL_OL': 0, 'ALL_KN': 0, 'ALL_Coach': 0, 
          'ALL_OS': 0, 'ALL_CT': 0, 'ALL_Hop': 0, 'ALL_Hoc': 0, 'ALL_Tong': 0
        };
      }

      const dtvRaw = row['ĐTV'] ? row['ĐTV'].toString().toUpperCase() : '';
      const isM = dtvRaw.includes('M');
      const isHH = dtvRaw.includes('HH');

      // Metric columns to process
      const metrics = ['91', '66', '60', 'OL', 'KN', 'Coach'];
      
      let rowSumM = 0;
      let rowSumHH = 0;
      let rowSumALL = 0;

      // Process standard metrics
      metrics.forEach(metric => {
        const val = parseVal(row[metric]);
        
        // Add to M group
        if (isM) {
          statsMap[gvKey][`M_${metric}`] += val;
          rowSumM += val;
        }
        
        // Add to HH group
        if (isHH) {
          statsMap[gvKey][`HH_${metric}`] += val;
          rowSumHH += val;
        }

        // Add to ALL group (Includes both M and HH rows)
        statsMap[gvKey][`ALL_${metric}`] += val;
        rowSumALL += val;
      });

      // Update Group Totals
      if (isM) statsMap[gvKey]['M_Tong'] += rowSumM;
      if (isHH) statsMap[gvKey]['HH_Tong'] += rowSumHH;

      // Process Extra columns for ALL group only (OS, CT, HOC, HOP)
      const valOS = parseVal(row['OS']);
      const valCT = parseVal(row['CT']);
      const valHoc = parseVal(row['HOC']);
      // Mapping: Họp = OKR + STL
      const valHop = parseVal(row['OKR']) + parseVal(row['STL']); 

      statsMap[gvKey]['ALL_OS'] += valOS;
      statsMap[gvKey]['ALL_CT'] += valCT;
      statsMap[gvKey]['ALL_Hoc'] += valHoc;
      statsMap[gvKey]['ALL_Hop'] += valHop;

      // Grand Total for ALL (Metrics + Extras)
      // Note: rowSumALL currently only has 91..Coach. We need to add the extras.
      rowSumALL += (valOS + valCT + valHoc + valHop);
      statsMap[gvKey]['ALL_Tong'] += rowSumALL;
    });

    // Convert map to array and add STT
    return Object.values(statsMap).map((item: any, index) => ({
      ...item,
      'STT': (index + 1).toString()
    }));

  }, [data, activeCategory]);

  // --- EXTRACT INSTRUCTORS FOR LEAVE MODAL (FROM CONFIG + DATA) ---
  const instructorList = useMemo(() => {
    // Merge config instructors with those in data (in case config changed but data remains)
    const fromConfig = appConfig.instructors || [];
    const fromData = data.rows ? [...new Set(data.rows.map(r => r['Giảng Viên'] || r['GV']).filter(Boolean))] : [];
    
    return [...new Set([...fromConfig, ...fromData])].sort();
  }, [data, appConfig]);


  // --- HELPERS ---
  const canCreateMonth = user.role === 'ADMIN';
  
  // BC Add Button Condition
  const canAddBCData = (user.role === 'ADMIN' || user.role === 'LEADER') && activeCategory === 'BC' && !!targetSheetName;
  
  // BF Add Button Condition (New)
  const canAddBFData = activeCategory === 'BF' && !!targetSheetName;

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

  const filteredRows = useMemo(() => {
    // If Statistics mode, use calculated data
    if (activeCategory === 'TH') {
       if (!statisticsData) return [];
       return statisticsData.filter((row: any) => 
          row['Giảng Viên'].toLowerCase().includes(searchTerm.toLowerCase())
       );
    }

    // Default BC/BF mode
    if (!data || !data.rows) return [];
    return data.rows.filter(row => 
      Object.values(row).some((val) => 
        (val as string).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [data, statisticsData, searchTerm, activeCategory]);

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
    if (!targetSheetName) return;
    await saveSheetRow(scriptUrl, targetSheetName, rowData);
    data.rows.push(rowData);
  };

  // --- SAVE BF DATA (LEAVE/COMPENSATION) ---
  const handleSaveLeave = async (dateStr: string, content: string, instructor: string) => {
    if (!targetSheetName) return;

    // 1. Extract Day (e.g., "2024-05-12" -> "12")
    const day = dateStr.split('-')[2];
    
    // 2. Construct Payload
    // Note: We use the existing saveSheetRow which typically 'upserts' or 'appends'. 
    // Since BF is a matrix, we ideally want to UPDATE a cell. 
    // We send a payload that identifies the row ('Giảng Viên') and the column to update (day).
    const rowData: SheetRow = {
      'Giảng Viên': instructor,
      [day]: content
    };

    // 3. Send to Backend
    await saveSheetRow(scriptUrl, targetSheetName, rowData);

    // 4. Update Local State (Optimistic UI Update)
    const rowIndex = data.rows.findIndex(r => (r['Giảng Viên'] === instructor || r['GV'] === instructor));
    if (rowIndex >= 0) {
      // Update existing row (Matrix style)
      data.rows[rowIndex] = {
        ...data.rows[rowIndex],
        [day]: content
      };
    } else {
      // Create new row (Unlikely if sheets are pre-populated, but safe fallback)
      data.rows.push({
        'STT': (data.rows.length + 1).toString(),
        'Giảng Viên': instructor,
        [day]: content
      });
    }
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

  const nextStt = (data.rows?.length || 0) + 1;

  // --- RENDERERS ---

  const renderTableHeader = () => {
    if (activeCategory === 'TH') {
      return (
        <thead className="sticky top-0 z-20 shadow-sm text-center bg-white">
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
      if (filteredRows.length === 0) {
        return (
          <tr>
            <td colSpan={25} className="text-center py-8 text-gray-400">
               Không có dữ liệu tổng hợp cho tháng này (hoặc chưa nhập ĐTV trong Báo Cáo).
            </td>
          </tr>
        )
      }

      return filteredRows.map((row, rIdx) => (
        <tr key={rIdx} className="hover:bg-blue-50 transition-colors">
          <td className="px-2 py-1 text-xs border border-gray-200 text-center sticky left-0 bg-white border-r-2 border-r-gray-300 z-10 font-mono text-gray-700">{row['STT']}</td>
          <td className="px-4 py-1 text-xs border border-gray-200 text-left sticky left-12 bg-white border-r-2 border-r-gray-300 z-10 font-bold whitespace-nowrap text-gray-800">{row['Giảng Viên']}</td>
          
          {TH_GROUPS.map(group => 
             group.keys.map((key, kIdx) => {
               const val = row[key]; // key matches calculated data properties
               const num = Number(val);
               // Show value only if > 0, otherwise show dash
               const hasValue = val && !isNaN(num) && num > 0;
               
               let cellClass = hasValue ? 'font-bold text-gray-900' : 'text-gray-400';
               
               // Highlight Total Columns
               if (hasValue && key.endsWith('Tong')) {
                 if (key.startsWith('M_')) cellClass = 'font-bold text-blue-700 bg-blue-50';
                 else if (key.startsWith('HH_')) cellClass = 'font-bold text-green-700 bg-green-50';
                 else if (key.startsWith('ALL_')) cellClass = 'font-bold text-red-600 bg-red-50';
               }

               return (
                 <td key={`${group.title}-${key}-${kIdx}`} className={`px-2 py-1 text-xs border border-gray-200 text-center ${cellClass}`}>
                   {hasValue ? val : '-'}
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
    // 1. NO SHEET EXISTS
    if (!targetSheetName) {
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
                  <p className="text-gray-500 text-sm mb-6">Bạn có muốn khởi tạo dữ liệu cho tháng này không?</p>
                  <button 
                    onClick={handleCreateMonth}
                    disabled={isCreating}
                    className={`w-full py-2.5 rounded-md font-bold text-white shadow transition-all
                      ${isCreating ? 'bg-gray-400' : 'bg-vnpt-primary hover:bg-blue-700'}
                    `}
                  >
                    {isCreating ? 'Đang khởi tạo...' : 'Khởi tạo ngay'}
                  </button>
                </>
              ) : (
                <p className="text-red-500 text-sm mt-2">Vui lòng liên hệ Admin để tạo bảng.</p>
              )}
           </div>
         </div>
       );
    }
    
    // 2. LOADING STATE (Blocking)
    // Only block if we have no rows AND we are refreshing.
    if (isRefreshing && filteredRows.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-vnpt-primary rounded-full animate-spin mb-4"></div>
            <span className="text-gray-500 text-sm font-medium">Đang tải dữ liệu...</span>
          </div>
        );
    }

    // 3. EMPTY SHEET
    // If we are in TH mode, filteredRows comes from statisticsData which handles its own empty check.
    if (filteredRows.length === 0 && activeCategory !== 'TH') {
        return (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
             <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
             </svg>
             <p className="text-sm font-medium">Bảng tính trống</p>
             {(canAddBCData || canAddBFData) && <p className="text-xs mt-1">Sử dụng nút "Thêm mới" / "ADD" để nhập liệu</p>}
          </div>
        );
    }
    
    // 4. DATA TABLE
    return (
        <div className="flex-1 overflow-auto bg-white custom-scrollbar relative">
            {isRefreshing && (
               <div className="absolute top-0 left-0 w-full h-1 bg-blue-100 overflow-hidden z-50">
                  <div className="h-full bg-vnpt-primary animate-progress"></div>
               </div>
            )}
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
    <div className="flex flex-col h-full bg-white relative">
       <style>{`
        @keyframes progress {
          0% { width: 0%; margin-left: 0; }
          50% { width: 50%; margin-left: 25%; }
          100% { width: 100%; margin-left: 100%; }
        }
        .animate-progress {
          animation: progress 1.5s infinite linear;
        }
      `}</style>

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
          </div>

          <div className="flex items-center space-x-2">
             <button
               onClick={() => onRefresh()}
               disabled={isRefreshing}
               className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-all"
               title="Làm mới dữ liệu"
             >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
               </svg>
             </button>
             {spreadsheetUrl && (
              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 border border-green-700 transition-all font-bold text-sm shadow whitespace-nowrap"
                title="Mở Google Sheet"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M19.5 21a1.5 1.5 0 001.5-1.5V15a.75.75 0 00-1.5 0v3a.75.75 0 00.75.75zm-15 0a.75.75 0 00.75-.75v-3a.75.75 0 00-1.5 0v3a1.5 1.5 0 001.5 1.5zM3 7.5a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 7.5z" clipRule="evenodd" />
                  <path d="M19.5 3H4.5A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zM4.5 4.5h15v15h-15v-15z" />
                </svg>
                <span className="hidden sm:inline">Mở Sheet</span>
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
                disabled={!targetSheetName}
                className="w-full px-3 py-1.5 text-sm outline-none bg-transparent disabled:opacity-50"
              />
            </div>
          </div>

          {canAddBCData && (
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

          {canAddBFData && (
            <button 
              onClick={() => setIsLeaveModalOpen(true)}
              className="flex items-center space-x-1 px-4 py-1.5 bg-orange-600 text-white rounded shadow hover:bg-orange-700 transition-transform active:scale-95 text-sm font-bold whitespace-nowrap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span className="hidden sm:inline">ADD</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative flex flex-col">
        {renderContent()}
      </div>
      
      {/* BC Modal */}
      <EntryModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSaveData}
        sheetName={targetSheetName || 'Chưa chọn Sheet'}
        nextStt={nextStt}
        appConfig={appConfig}
      />

      {/* BF Modal */}
      <LeaveModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        onSubmit={handleSaveLeave}
        month={selectedMonth}
        user={user}
        instructors={instructorList}
      />
    </div>
  );
};
