
import React, { useState, useEffect, useMemo } from 'react';
import { SheetData, SheetRow, User, AppConfig } from '../types';
import { EntryModal } from './EntryModal';
import { LeaveModal } from './LeaveModal';
import { saveSheetRow, createMonthSheets, createNVSheets } from '../services/sheetService';

// Added 'NV' (Nghiệp vụ) to Category Type
type SheetCategory = 'BC' | 'NV' | 'BF' | 'TH' | 'KH';
type NghiepVuTab = 'Di động' | 'BRCĐ' | 'CNTT' | 'ONLINE';

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
  getDataBySheetName: (name: string) => SheetData | undefined;
  cacheVersion?: number;
  initialCategory?: SheetCategory;
  onLoadAllMonths?: (year: string) => Promise<void>; // New prop for yearly data
}

// Columns for Report view
const REPORT_COLUMNS = [
  'STT', 'Mã Lớp', 'Nội dung', 'Buổi', 'Ngày', 'Thứ', 'Giảng Viên', 
  '91', '66', '60', 'OL', 'KN', 'Coach', 'OKR', 'STL', 'OS', 'CT', 'HOC', 
  'Đơn vị', 'SL HV', 'Hình Thức', 'ĐTV'
];

// Definition for Statistics (TH) View
// CHANGED: Added 'Họp' back to ALL group
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
    // Added 'Họp'
    cols: ['91', '66', '60', 'OL', 'KN', 'Coach', 'OS', 'CT', 'OKR', 'STL', 'Họp', 'Học', 'Tổng'],
    keys: ['ALL_91', 'ALL_66', 'ALL_60', 'ALL_OL', 'ALL_KN', 'ALL_Coach', 'ALL_OS', 'ALL_CT', 'ALL_OKR', 'ALL_STL', 'ALL_Hop', 'ALL_Hoc', 'ALL_Tong']
  }
];

const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => {
  const m = i + 1;
  return m < 10 ? `0${m}` : `${m}`;
});

// Generate Year Range: Current Year +/- 5 years
const currentRealYear = new Date().getFullYear();
const YEAR_LIST = Array.from({ length: 11 }, (_, i) => currentRealYear - 5 + i);

const getDaysArray = (monthStr: string, year: number) => {
  const monthIndex = parseInt(monthStr, 10); 
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    return day < 10 ? `0${day}` : `${day}`;
  });
};

const getDayLabel = (dayStr: string, monthStr: string, year: number) => {
  try {
    const date = new Date(year, parseInt(monthStr, 10) - 1, parseInt(dayStr, 10));
    const day = date.getDay(); // 0 = Sun
    const map = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return map[day];
  } catch {
    return '';
  }
};

const getWeekendClass = (label: string) => {
  if (label === 'CN' || label === 'T7') return 'bg-pink-100 text-pink-900';
  return '';
};

const parseVal = (val: any): number => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const str = val.toString().trim().replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

const normalize = (str: string | undefined) => (str || '').toString().trim().toLowerCase();

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
  appConfig,
  getDataBySheetName,
  cacheVersion = 0,
  initialCategory = 'BC',
  onLoadAllMonths
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // --- STATE ---
  const [selectedYear, setSelectedYear] = useState<number>(currentRealYear);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const currentMonth = new Date().getMonth() + 1;
    return currentMonth < 10 ? `0${currentMonth}` : `${currentMonth}`;
  });
  
  const [activeCategory, setActiveCategory] = useState<SheetCategory>(initialCategory);
  const [nvSubTab, setNvSubTab] = useState<NghiepVuTab>('Di động');
  const [isYearlyMode, setIsYearlyMode] = useState(false);

  // Update category if initialCategory changes
  useEffect(() => {
    setActiveCategory(initialCategory);
  }, [initialCategory]);

  // Turn off yearly mode when switching categories
  useEffect(() => {
    if (activeCategory !== 'TH') {
      setIsYearlyMode(false);
    }
  }, [activeCategory]);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false); 
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  
  const [isCreating, setIsCreating] = useState(false);
  const [updateTrigger, setUpdateTrigger] = useState(0); 

  // --- AUTO-SWITCH MONTH LOGIC ---
  useEffect(() => {
    if (availableSheets.length === 0 || activeCategory === 'NV') return;
  }, [availableSheets, activeCategory]); 


  // --- DERIVED STATE ---
  const targetSheetName = useMemo(() => {
    if (activeCategory === 'NV') {
        const subTabMap: Record<NghiepVuTab, string> = {
            'Di động': 'NV_DIDONG',
            'BRCĐ': 'NV_BRCD',
            'CNTT': 'NV_CNTT',
            'ONLINE': 'NV_ONLINE'
        };
        const keyword = subTabMap[nvSubTab];
        return availableSheets.find(s => s.toUpperCase().includes(keyword)) || '';
    }

    const searchType = (activeCategory === 'TH') ? 'BC' : activeCategory;
    const mInt = parseInt(selectedMonth, 10);
    const yearStr = selectedYear.toString();

    // Fix logic: Check both "09" and "9" formats
    const paddedMonth = mInt < 10 ? `0${mInt}` : `${mInt}`;
    const unpaddedMonth = `${mInt}`;

    // Priority: 1. Type-T09-2025, 2. Type-T9-2025, 3. Type-T09, 4. Type-T9
    const suffixesToCheck = [
        `-T${paddedMonth}-${yearStr}`, 
        `-T${unpaddedMonth}-${yearStr}`,
        `-T${paddedMonth}`,            
        `-T${unpaddedMonth}`           
    ];

    // 1. Try to find an EXACT match in the loaded availableSheets list
    for (const suffix of suffixesToCheck) {
        const found = availableSheets.find(name => {
            const nameUpper = name.toUpperCase();
            return nameUpper.includes(searchType) && nameUpper.includes(suffix);
        });
        if (found) return found;
    }

    // 2. FALLBACK: If not found in the list, CONSTRUCT a standard name.
    // This allows the frontend to request a sheet (e.g., BC-T09-2025) even if it's in a separate file 
    // that the frontend doesn't know about yet. The Backend Router will handle finding it.
    if (!isYearlyMode) {
        return `${searchType}-T${paddedMonth}-${yearStr}`;
    }

    return '';
  }, [availableSheets, selectedMonth, selectedYear, activeCategory, nvSubTab, isYearlyMode]);

  useEffect(() => {
    // Only switch sheet if NOT in yearly mode
    if (targetSheetName && targetSheetName !== currentSheetName && !isYearlyMode) {
      onSheetChange(targetSheetName);
    }
  }, [targetSheetName, currentSheetName, onSheetChange, isYearlyMode]);


  // --- CALCULATE STATISTICS ---
  const statisticsData = useMemo(() => {
    if (activeCategory !== 'TH') return [];

    // Determine Source Data
    let sourceRows: SheetRow[] = [];

    if (isYearlyMode) {
        // AGGREGATE ALL MONTHS (BC-T01 to BC-T12)
        ALL_MONTHS.forEach(m => {
             const mInt = parseInt(m, 10);
             const padded = mInt < 10 ? `0${mInt}` : `${mInt}`;
             const unpadded = `${mInt}`;
             const ySuffix = `-${selectedYear}`;
             
             // Try to find sheet for this month (strict year match first)
             // Check T01 and T1 variants
             let sName = availableSheets.find(n => 
                 n.includes('BC') && n.includes(ySuffix) && (n.includes(`-T${padded}`) || n.includes(`-T${unpadded}`))
             );
             
             if (!sName) {
                 // Fallback to year-less
                 sName = availableSheets.find(n => 
                    n.includes('BC') && (n.includes(`-T${padded}`) || n.includes(`-T${unpadded}`))
                 );
             }

             if (sName) {
                 const sData = getDataBySheetName(sName);
                 if (sData && sData.rows) {
                     sourceRows = [...sourceRows, ...sData.rows];
                 }
             }
        });
    } else {
        // SINGLE MONTH
        if (data && data.rows) {
            sourceRows = data.rows;
        }
    }

    if (sourceRows.length === 0) return [];

    const statsMap: Record<string, any> = {};

    sourceRows.forEach(row => {
      const gv = row['GV'] || row['Giảng Viên'];
      if (!gv) return;
      
      const gvKey = gv.trim();
      if (!statsMap[gvKey]) {
        statsMap[gvKey] = {
          'Giảng Viên': gvKey,
          'M_91': 0, 'M_66': 0, 'M_60': 0, 'M_OL': 0, 'M_KN': 0, 'M_Coach': 0, 'M_Tong': 0,
          'HH_91': 0, 'HH_66': 0, 'HH_60': 0, 'HH_OL': 0, 'HH_KN': 0, 'HH_Coach': 0, 'HH_Tong': 0,
          'ALL_91': 0, 'ALL_66': 0, 'ALL_60': 0, 'ALL_OL': 0, 'ALL_KN': 0, 'ALL_Coach': 0, 
          'ALL_OS': 0, 'ALL_CT': 0, 'ALL_OKR': 0, 'ALL_STL': 0, 'ALL_Hop': 0, 'ALL_Hoc': 0, 'ALL_Tong': 0
        };
      }

      const dtvRaw = row['ĐTV'] ? row['ĐTV'].toString().toUpperCase() : '';
      const isM = dtvRaw.includes('M');
      const isHH = dtvRaw.includes('HH');

      const metrics = ['91', '66', '60', 'OL', 'KN', 'Coach'];
      
      let rowSumM = 0;
      let rowSumHH = 0;
      let rowSumALL = 0;

      metrics.forEach(metric => {
        const val = parseVal(row[metric]);
        if (isM) { statsMap[gvKey][`M_${metric}`] += val; rowSumM += val; }
        if (isHH) { statsMap[gvKey][`HH_${metric}`] += val; rowSumHH += val; }
        statsMap[gvKey][`ALL_${metric}`] += val;
        rowSumALL += val;
      });

      if (isM) statsMap[gvKey]['M_Tong'] += rowSumM;
      if (isHH) statsMap[gvKey]['HH_Tong'] += rowSumHH;

      const valOS = parseVal(row['OS']);
      const valCT = parseVal(row['CT']);
      const valHoc = parseVal(row['HOC']);
      const valOKR = parseVal(row['OKR']);
      const valSTL = parseVal(row['STL']);
      
      // Calculate 'Họp' = OKR + STL
      const valHop = valOKR + valSTL;

      statsMap[gvKey]['ALL_OS'] += valOS;
      statsMap[gvKey]['ALL_CT'] += valCT;
      statsMap[gvKey]['ALL_Hoc'] += valHoc;
      statsMap[gvKey]['ALL_OKR'] += valOKR;
      statsMap[gvKey]['ALL_STL'] += valSTL;
      statsMap[gvKey]['ALL_Hop'] += valHop; // Accumulate Hop

      // Sum everything for Total
      rowSumALL += (valOS + valCT + valHoc + valOKR + valSTL);
      statsMap[gvKey]['ALL_Tong'] += rowSumALL;
    });

    return Object.values(statsMap).map((item: any, index) => ({
      ...item,
      'STT': (index + 1).toString()
    }));

  }, [data, activeCategory, isYearlyMode, selectedYear, availableSheets, cacheVersion]); 
  // Dependency on cacheVersion ensures re-calc when background sheets load

  // --- EXTRACT INSTRUCTORS ---
  const instructorList = useMemo(() => {
    const fromConfig = appConfig.instructors || [];
    const fromData = data.rows ? [...new Set(data.rows.map(r => r['Giảng Viên'] || r['GV']).filter(Boolean))] : [];
    return [...new Set([...fromConfig, ...fromData])].sort();
  }, [data, appConfig]);


  // --- HELPERS ---
  const canCreateMonth = user.role === 'ADMIN';
  const canAddBCData = (user.role === 'ADMIN' || user.role === 'LEADER') && (activeCategory === 'BC' || activeCategory === 'NV') && !!targetSheetName;
  const canAddBFData = user.role === 'ADMIN' && activeCategory === 'BF' && !!targetSheetName;
  const canAddKHData = user.role === 'ADMIN' && activeCategory === 'KH' && !!targetSheetName;

  const currentColumns = useMemo(() => {
    if (activeCategory === 'BF' || activeCategory === 'KH') {
      const days = selectedMonth ? getDaysArray(selectedMonth, selectedYear) : [];
      return ['STT', 'Giảng Viên', ...days];
    }
    if (activeCategory === 'TH') {
      return ['STT', 'Giảng Viên'];
    }
    // NV uses same columns as BC
    return REPORT_COLUMNS;
  }, [activeCategory, selectedMonth, selectedYear]);

  const filteredRows = useMemo(() => {
    // 1. Thống Kê
    if (activeCategory === 'TH') {
       if (!statisticsData) return [];
       return statisticsData.filter((row: any) => 
          row['Giảng Viên'].toLowerCase().includes(searchTerm.toLowerCase())
       );
    }

    // 2. Nghiệp Vụ (Specific Sheets)
    if (activeCategory === 'NV') {
       if (!data || !data.rows) return [];
       return data.rows.filter(row => 
          Object.values(row).some((val) => 
            String(val).toLowerCase().includes(searchTerm.toLowerCase())
          )
       );
    }

    // 3. Kế Hoạch & Bù Phép (Merge Logic)
    if (activeCategory === 'KH' || activeCategory === 'BF') {
         // Flexible ID match
         const mInt = parseInt(selectedMonth, 10);
         const padded = mInt < 10 ? `0${mInt}` : `${mInt}`;
         const unpadded = `${mInt}`;
         
         const findSheet = (type: string) => availableSheets.find(s => {
             const upper = s.toUpperCase();
             return (upper.includes(type)) && (upper.includes(`T${padded}`) || upper.includes(`T${unpadded}`));
         });

         const bfName = findSheet('BF') || findSheet('BU');
         const bcName = findSheet('BC');

         const bfData = bfName ? getDataBySheetName(bfName) : undefined;
         const bcData = bcName ? getDataBySheetName(bcName) : undefined;

         const allInstructorsSet = new Set<string>(appConfig.instructors || []);
         if (data && data.rows) {
             data.rows.forEach(r => {
                 const name = r['Giảng Viên'] || r['GV'] || r['Họ và tên'];
                 if (name) allInstructorsSet.add(String(name).trim());
             });
         }
         const sortedInstructors = [...allInstructorsSet].sort();
         const daysArray = getDaysArray(selectedMonth, selectedYear);

         const calculatedRows = sortedInstructors.map((instructor: string, idx) => {
            const rowObj: SheetRow = {
              'STT': (idx + 1).toString(),
              'Giảng Viên': instructor
            };

            // Merge logic from current data
            if (data && data.rows) {
                const matches = data.rows.filter(r => {
                    const rName = (r['Giảng Viên'] || r['GV'] || r['Họ và tên']) as string;
                    return normalize(rName) === normalize(instructor);
                });
                matches.forEach(m => {
                    Object.keys(m).forEach(key => {
                        if (key !== 'STT' && key !== 'Giảng Viên' && key !== 'GV' && m[key]) {
                            rowObj[key] = String((m as any)[key]);
                        }
                    });
                });
            }

            // Fetch from siblings if Plan (KH)
            if (activeCategory === 'KH') {
                daysArray.forEach(day => {
                    const dayKey = day;
                    const dayNumKey = parseInt(day, 10).toString();
                    
                    if (!rowObj[day] && !rowObj[dayNumKey]) {
                        let cellContent = '';

                        if (bfData && bfData.rows) {
                             const bfRow = bfData.rows.find(r => {
                                const rName = String(r['Giảng Viên'] || r['GV'] || r['Họ và tên'] || '');
                                return normalize(rName) === normalize(instructor);
                             });
                             if (bfRow) {
                                 cellContent = (bfRow[dayKey] as string) || (bfRow[dayNumKey] as string) || '';
                             }
                        }

                        if (!cellContent && bcData && bcData.rows) {
                             const matchingBC = bcData.rows.filter(r => {
                                const rName = String(r['Giảng Viên'] || r['GV'] || '');
                                const rDate = String(r['Ngày'] || '');
                                if (normalize(rName) !== normalize(instructor)) return false;
                                if (!rDate) return false;
                                const dateStr = rDate.toString().trim();
                                const parts = dateStr.split(/[-/]/);
                                if (parts.length >= 2) {
                                    let d = 0, m = 0;
                                    if (parts[0].length === 4) { m = parseInt(parts[1], 10); d = parseInt(parts[2], 10); } 
                                    else { d = parseInt(parts[0], 10); m = parseInt(parts[1], 10); }
                                    return d === parseInt(day, 10) && m === parseInt(selectedMonth, 10);
                                }
                                return false;
                             });
                             
                             if (matchingBC.length > 0) {
                                const lines = matchingBC.map(item => {
                                   const maLop = String(item['Mã Lớp'] || item['Nội dung'] || '?');
                                   const buoi = String(item['Buổi'] || '');
                                   // Compact format "Code-Shift" (e.g. A-S) without spaces
                                   return `${maLop}-${buoi}`;
                                });
                                // Join multiple entries
                                cellContent = lines.join('\n');
                             }
                        }

                        if (cellContent) {
                            rowObj[day] = cellContent;
                        }
                    }
                });
            }
            return rowObj;
         });

         return calculatedRows.filter(row => 
             row['Giảng Viên'].toLowerCase().includes(searchTerm.toLowerCase())
         );
    }

    // Default Fallback (BC)
    if (!data || !data.rows) return [];
    return data.rows.filter(row => 
      Object.values(row).some((val) => 
        (val as string).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [data, statisticsData, searchTerm, activeCategory, nvSubTab, targetSheetName, appConfig, updateTrigger, selectedMonth, availableSheets, getDataBySheetName, cacheVersion, isYearlyMode]);

  const getCellColor = (value: string, header: string, dayLabel?: string) => {
    // 1. Highlight Weekends for KH/BF (Column based)
    if (dayLabel) {
       // Use Pink for both CN and T7
       if (dayLabel === 'CN' || dayLabel === 'T7') return 'bg-pink-100 text-pink-900';
    }

    // 2. Highlight Specific Content for KH/BF
    if (activeCategory === 'BF' || activeCategory === 'KH') {
        if (header !== 'STT' && header !== 'Giảng Viên') {
            const val = value?.toLowerCase().trim();
            if (val === 'p') return 'bg-yellow-100 font-bold text-yellow-700';
            if (val === 'kp' || val === 'x') return 'bg-red-100 font-bold text-red-700';
            if (val === 'b') return 'bg-blue-100 font-bold text-blue-700';
        }
    }

    // 3. Highlight Percentage
    if (typeof value === 'string' && value.includes('%')) {
       const num = parseFloat(value);
       if (!isNaN(num)) {
         if (num >= 80) return 'text-green-600 font-bold bg-green-50';
         if (num < 50) return 'text-red-600 font-bold bg-red-50';
         return 'text-blue-600';
       }
    }
    
    // 4. Highlight specific cells for BC view (T7/CN)
    if ((activeCategory === 'BC' || activeCategory === 'NV') && (header === 'Ngày' || header === 'Thứ')) {
        const val = value?.trim().toLowerCase();
        if (val === 'cn' || val === 'chủ nhật' || (header === 'Ngày' && (new Date(value).getDay() === 0))) return 'bg-pink-100 text-pink-700 font-bold';
        if (val === 't7' || val === 'thứ 7' || val === 'thứ bảy' || (header === 'Ngày' && (new Date(value).getDay() === 6))) return 'bg-pink-100 text-pink-700 font-bold';
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
    setUpdateTrigger(prev => prev + 1);
  };

  const handleSaveMatrix = async (dateStr: string, content: string, instructor: string) => {
    if (!targetSheetName) return;

    const headers = data.headers || [];
    const dayParts = dateStr.split('-');
    const day = dayParts[2]; 
    const dayNum = parseInt(day, 10).toString();
    
    let dayKey = day;
    if (headers.includes(day)) dayKey = day;
    else if (headers.includes(dayNum)) dayKey = dayNum;

    let instructorKey = 'Giảng Viên'; 
    const foundHeader = headers.find(h => {
        const lower = h.trim().toLowerCase();
        return lower === 'giảng viên' || lower === 'gv' || lower === 'họ và tên';
    });
    if (foundHeader) instructorKey = foundHeader;

    const normalize = (s: any) => String(s || '').trim().toLowerCase();
    const targetName = normalize(instructor);

    const rowIndex = data.rows.findIndex(r => {
        let rName = r[instructorKey];
        if (!rName) rName = r['Giảng Viên'] || r['GV'] || r['Họ và tên'];
        return normalize(rName) === targetName;
    });

    if (rowIndex >= 0) {
        data.rows[rowIndex] = {
            ...data.rows[rowIndex],
            [dayKey]: content,
            [day]: content,
            [dayNum]: content
        };
    } else {
        const newRow: SheetRow = {
            'STT': (data.rows.length + 1).toString(),
            [instructorKey]: instructor,
            [dayKey]: content,
            'Giảng Viên': instructor,
            [day]: content
        };
        data.rows.push(newRow);
    }
    setUpdateTrigger(prev => prev + 1);

    const rowData: SheetRow = {
      [instructorKey]: instructor,
      [dayKey]: content
    };
    await saveSheetRow(scriptUrl, targetSheetName, rowData, instructorKey);
  };

  const handleCreateMonth = async () => {
    setIsCreating(true);
    try {
      // CHANGED: Pass selectedYear to creation function
      const res = await createMonthSheets(scriptUrl, selectedMonth, selectedYear);
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
  
  const handleCreateNVSheets = async () => {
    setIsCreating(true);
    try {
      const res = await createNVSheets(scriptUrl);
      if (res.success) {
          await onRefresh(); 
          alert("Đã khởi tạo các sheet Nghiệp vụ thành công!");
      }
    } catch (error) {
      alert("Lỗi khởi tạo: " + error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleYearlyClick = async () => {
      const newMode = !isYearlyMode;
      setIsYearlyMode(newMode);
      if (newMode && onLoadAllMonths) {
          // Trigger data loading for all months in the selected year
          await onLoadAllMonths(selectedYear.toString());
      }
  };

  const nextStt = (data.rows?.length || 0) + 1;

  // --- RENDERERS ---
  const renderTableHeader = () => {
    // 1. THỐNG KÊ (TH)
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
                <th key={`${group.title}-${idx}`} className="px-1 py-1 bg-gray-50 border border-gray-300 text-sm font-bold text-gray-600 min-w-[40px]">
                  {col}
                </th>
              ))
            ))}
          </tr>
        </thead>
      );
    }

    // 2. KẾ HOẠCH (KH) & BÙ PHÉP (BF) - Double Header Row
    if (activeCategory === 'KH' || activeCategory === 'BF') {
      const days = selectedMonth ? getDaysArray(selectedMonth, selectedYear) : [];
      return (
        <thead className="sticky top-0 z-20 shadow-sm text-center bg-white">
          {/* Row 1: Day of Week (Thứ) */}
          <tr className="bg-gray-100">
            <th rowSpan={2} className="px-2 py-2 border border-gray-300 text-gray-600 font-bold sticky left-0 z-30 w-12 border-r-2 border-r-gray-300 bg-gray-100">STT</th>
            <th rowSpan={2} className="px-4 py-2 border border-gray-300 text-gray-600 font-bold sticky left-12 z-30 min-w-[130px] text-left border-r-2 border-r-gray-300 bg-gray-100">GIẢNG VIÊN</th>
            {days.map((day, idx) => {
               const dayLabel = getDayLabel(day, selectedMonth, selectedYear);
               const weekendClass = getWeekendClass(dayLabel);
               return (
                 <th key={`dow-${idx}`} className={`px-1 py-1 border border-gray-300 text-sm font-bold ${weekendClass || 'text-gray-500 bg-gray-50'}`}>
                   {dayLabel}
                 </th>
               );
            })}
          </tr>
          {/* Row 2: Date (Ngày) */}
          <tr className="bg-gray-50">
            {days.map((day, idx) => {
               const dayLabel = getDayLabel(day, selectedMonth, selectedYear);
               const weekendClass = getWeekendClass(dayLabel);
               return (
                  // Min-width 90px to fit ~10 chars
                  <th key={`date-${idx}`} className={`px-1 py-2 border border-gray-300 text-sm font-bold ${weekendClass || 'text-gray-700'} min-w-[90px]`}>
                    {day}
                  </th>
               );
            })}
          </tr>
        </thead>
      );
    }

    // 3. BÁO CÁO (BC) / NGHIỆP VỤ (NV) - Single Header Row
    return (
      <thead className="bg-gray-100 sticky top-0 z-20 shadow-sm">
        <tr>
          {currentColumns.map((header, idx) => {
            return (
              // text-sm
              <th key={idx} className={`px-2 py-3 border border-gray-300 text-sm font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap text-center
                  ${header === 'STT' ? 'sticky left-0 bg-gray-100 z-30 border-r-2 border-r-gray-300 w-12' : ''}
                  ${header === 'Mã Lớp' ? 'min-w-[100px]' : ''}
                  ${header === 'Nội dung' ? 'min-w-[250px] text-left px-3' : ''}
              `}>
                {header}
              </th>
            );
          })}
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
               {isYearlyMode ? `Chưa có dữ liệu tổng hợp năm ${selectedYear}.` : 'Không có dữ liệu tổng hợp cho tháng này.'}
            </td>
          </tr>
        )
      }

      return filteredRows.map((row, rIdx) => (
        <tr key={rIdx} className="hover:bg-blue-50 transition-colors">
          <td className="px-2 py-1 text-sm border border-gray-200 text-center sticky left-0 bg-white border-r-2 border-r-gray-300 z-10 font-mono text-gray-700">{row['STT']}</td>
          <td className="px-4 py-1 text-sm border border-gray-200 text-left sticky left-12 bg-white border-r-2 border-r-gray-300 z-10 font-bold whitespace-nowrap text-gray-800">{row['Giảng Viên']}</td>
          {TH_GROUPS.map(group => 
             group.keys.map((key, kIdx) => {
               const val = row[key]; 
               const num = Number(val);
               const hasValue = val && !isNaN(num) && num > 0;
               let cellClass = hasValue ? 'font-bold text-gray-900' : 'text-gray-400';
               if (hasValue && key.endsWith('Tong')) {
                 if (key.startsWith('M_')) cellClass = 'font-bold text-blue-700 bg-blue-50';
                 else if (key.startsWith('HH_')) cellClass = 'font-bold text-green-700 bg-green-50';
                 else if (key.startsWith('ALL_')) cellClass = 'font-bold text-red-600 bg-red-50';
               }
               return (
                 <td key={`${group.title}-${key}-${kIdx}`} className={`px-2 py-1 text-sm border border-gray-200 text-center ${cellClass}`}>
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
          const isDateCol = (activeCategory === 'BF' || activeCategory === 'KH') && !isNaN(Number(header));
          
          let dayLabel = '';
          if (isDateCol) {
             dayLabel = getDayLabel(header, selectedMonth, selectedYear);
          }

          return (
            <td 
              key={cIdx} 
              // text-sm for larger font
              className={`px-1 py-2 text-sm border border-gray-200 text-gray-700 whitespace-pre-wrap max-w-xs align-top
                ${header === 'STT' ? 'text-center sticky left-0 bg-gray-50 group-hover:bg-blue-50 border-r-2 border-r-gray-300 font-mono z-10' : ''}
                ${(header === 'Giảng Viên' && (activeCategory === 'BF' || activeCategory === 'KH')) ? 'sticky left-12 bg-gray-50 group-hover:bg-blue-50 border-r-2 border-r-gray-300 z-10 font-bold text-vnpt-primary px-4 min-w-[130px]' : ''}
                ${header === 'Nội dung' ? 'whitespace-normal min-w-[250px] text-left px-3' : ''}
                ${isDateCol && activeCategory === 'KH' ? 'text-left leading-tight min-w-[90px]' : ''}
                ${isDateCol && activeCategory !== 'KH' ? 'text-center' : ''}
                ${!isDateCol && header !== 'Nội dung' && header !== 'Giảng Viên' ? 'text-left' : ''}
                ${getCellColor(value as string, header, dayLabel)}
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
    // Check loading first to avoid flickering
    if (isRefreshing && (!targetSheetName || filteredRows.length === 0) && !isYearlyMode) {
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-vnpt-primary rounded-full animate-spin mb-4"></div>
            <span className="text-gray-500 text-sm font-medium">Đang tải dữ liệu...</span>
          </div>
        );
    }
    
    // If no sheet is selected/found (and not loading)
    if (!targetSheetName && activeCategory !== 'KH' && !isYearlyMode) {
       const isNVMode = activeCategory === 'NV';
       const message = isNVMode 
         ? "Chưa có dữ liệu Nghiệp Vụ cho mục này."
         : `Chưa có dữ liệu Tháng ${selectedMonth}/${selectedYear}`;
         
       const btnAction = isNVMode ? handleCreateNVSheets : handleCreateMonth;
       const btnText = isNVMode ? "Khởi tạo NV" : "Khởi tạo tháng";

       return (
         <div className="flex flex-col items-center justify-center h-full bg-gray-50/50">
           <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center max-w-md">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-vnpt-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">{message}</h3>
              {canCreateMonth ? (
                <>
                  <p className="text-gray-500 text-sm mb-6">Bạn có muốn khởi tạo dữ liệu không?</p>
                  <button 
                    onClick={btnAction}
                    disabled={isCreating}
                    className={`w-full py-2.5 rounded-md font-bold text-white shadow transition-all
                      ${isCreating ? 'bg-gray-400' : 'bg-vnpt-primary hover:bg-blue-700'}
                    `}
                  >
                    {isCreating ? 'Đang khởi tạo...' : btnText}
                  </button>
                </>
              ) : (
                <p className="text-red-500 text-sm mt-2">Vui lòng liên hệ Admin để tạo bảng.</p>
              )}
           </div>
         </div>
       );
    }

    if (filteredRows.length === 0 && activeCategory !== 'TH') {
        return (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
             <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
             </svg>
             <p className="text-sm font-medium">Không tìm thấy dữ liệu phù hợp</p>
             {(canAddBCData || canAddBFData || canAddKHData) && <p className="text-xs mt-1">Sử dụng nút "Thêm mới" / "ADD" để nhập liệu</p>}
          </div>
        );
    }
    
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

      <div className="border-b border-gray-200 px-4 py-3 bg-white flex flex-col z-30 shadow-sm sticky top-0">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
            
            {/* Show Month/Year Selector ONLY if NOT in NV (Nghiệp Vụ) */}
            {activeCategory !== 'NV' && (
              <>
                <div className="flex items-center space-x-2 bg-gray-50 rounded-md border border-gray-200 px-3 py-1.5 whitespace-nowrap">
                    {/* YEAR SELECTOR */}
                    <span className="text-gray-500 text-sm font-medium">Năm:</span>
                    <select 
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="bg-transparent font-bold text-vnpt-primary outline-none cursor-pointer"
                        disabled={isYearlyMode}
                    >
                        {YEAR_LIST.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                    </select>

                    <div className="w-px h-4 bg-gray-300 mx-2"></div>

                    {/* MONTH SELECTOR */}
                    <span className="text-gray-500 text-sm font-medium">Tháng:</span>
                    <select 
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-transparent font-bold text-vnpt-primary outline-none cursor-pointer min-w-[40px]"
                        disabled={isYearlyMode}
                    >
                        {ALL_MONTHS.map(m => (
                        <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>
                
                <div className="h-6 w-px bg-gray-300 hidden md:block"></div>
              </>
            )}

            <div className="flex items-center space-x-2">
                {/* HIDE TABS IF IN NV MODE */}
                {activeCategory !== 'NV' && (
                  <div className="flex space-x-1 bg-gray-100/80 p-1 rounded-lg whitespace-nowrap">
                  {[
                      { id: 'BC', label: 'Báo cáo' },
                      // Removed 'NV' from internal tabs
                      { id: 'BF', label: 'Bù Phép' },
                      { id: 'TH', label: 'Thống kê' },
                      { id: 'KH', label: 'Kế hoạch' },
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
                )}

                {/* SHOW TITLE OR INDICATOR FOR NV MODE */}
                {activeCategory === 'NV' && (
                    <div className="px-4 py-1.5 bg-blue-50 text-vnpt-primary font-bold rounded-md border border-blue-100 text-sm uppercase">
                        NGHIỆP VỤ ĐÀO TẠO
                    </div>
                )}
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
                {/* UPDATED: Open Sheet Button Logic */}
                {/* Always show if not in NV mode, use data.fileUrl from backend which is specific to child sheet */}
                {activeCategory !== 'NV' && (
                  <a
                      href={data.fileUrl || spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 border border-green-700 transition-all font-bold text-sm shadow whitespace-nowrap"
                      title={`Mở file tháng ${selectedMonth}/${selectedYear}`}
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M19.5 21a1.5 1.5 0 001.5-1.5V15a.75.75 0 00-1.5 0v3a.75.75 0 00.75.75zm-15 0a.75.75 0 00.75-.75v-3a.75.75 0 00-1.5 0v3a1.5 1.5 0 001.5 1.5zM3 7.5a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 7.5z" clipRule="evenodd" />
                      <path d="M19.5 3H4.5A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zM4.5 4.5h15v15h-15v-15z" />
                      </svg>
                      <span className="hidden sm:inline">
                        {isYearlyMode ? `Sheet Năm ${selectedYear}` : `Mở Sheet T${selectedMonth}/${selectedYear}`}
                      </span>
                  </a>
                )}
            </div>
            </div>

            <div className="flex items-center gap-3 w-full lg:w-auto">
            
            {/* Year Summary Button */}
            {activeCategory === 'TH' && (
                <button
                    onClick={handleYearlyClick}
                    className={`px-3 py-1.5 text-sm font-bold rounded-md border transition-all whitespace-nowrap
                        ${isYearlyMode 
                            ? 'bg-orange-600 text-white border-orange-700' 
                            : 'bg-white text-orange-600 border-orange-300 hover:bg-orange-50'}`}
                >
                    {isYearlyMode ? 'Quay lại Tháng' : 'Tổng hợp Năm'}
                </button>
            )}

            <div className="relative group w-full lg:w-64">
                <div className="flex items-center border border-gray-300 rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-vnpt-primary focus-within:border-vnpt-primary transition-all bg-gray-50">
                <input
                    type="text"
                    placeholder="Tìm kiếm..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={(!targetSheetName && activeCategory !== 'KH') && !isYearlyMode}
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

            {canAddKHData && (
                <button 
                onClick={() => setIsPlanModalOpen(true)}
                className="flex items-center space-x-1 px-4 py-1.5 bg-green-600 text-white rounded shadow hover:bg-green-700 transition-transform active:scale-95 text-sm font-bold whitespace-nowrap"
                >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="hidden sm:inline">ADD</span>
                </button>
            )}
            </div>
        </div>

        {/* --- Sub-Tabs for Nghiệp Vụ --- */}
        {activeCategory === 'NV' && (
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center space-x-1 animate-[fadeIn_0.3s]">
                <span className="text-xs font-bold text-gray-400 uppercase mr-2">Bộ lọc:</span>
                {(['Di động', 'BRCĐ', 'CNTT', 'ONLINE'] as NghiepVuTab[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setNvSubTab(tab)}
                        className={`px-3 py-1 text-xs font-bold rounded-full transition-all border
                            ${nvSubTab === tab 
                                ? 'bg-blue-100 text-vnpt-primary border-blue-200' 
                                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>
        )}
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
        onSubmit={handleSaveMatrix}
        month={selectedMonth}
        user={user}
        instructors={instructorList}
        title="Nhập Bù / Phép"
      />

      {/* KH Modal (Reusing LeaveModal) */}
      <LeaveModal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        onSubmit={handleSaveMatrix}
        month={selectedMonth}
        user={user}
        instructors={instructorList}
        title="Nhập Kế Hoạch"
      />
    </div>
  );
};
