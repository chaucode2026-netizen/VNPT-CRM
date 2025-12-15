
// ... imports ... (Keeping existing structure)
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { SheetData, SheetRow, User, AppConfig, TableConfig } from '../types';
import { EntryModal } from './EntryModal';
import { LeaveModal } from './LeaveModal';
import { TableSettingsModal } from './TableSettingsModal';
import { saveSheetRow, createMonthSheets, createNVSheets, fetchTableConfig, saveTableConfig } from '../services/sheetService';

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
  onLoadAllMonths?: (year: string) => Promise<void>;
  isSheetNotFound?: boolean; // New prop indicating file is missing on backend
}

// ... Columns and Constants definitions (Keep exactly as provided previously) ...
const REPORT_COLUMNS = [
  'STT', 'Mã Lớp', 'Nội dung', 'Buổi', 'Ngày', 'Thứ', 'Giảng Viên', 
  'DĐ', 'BRCĐ', 'CNTT', 'OL', 'KN', 'Coach', 'AI Mentor', 'TTKD', 
  'OKR', 'STL', 'OS', 'CT', 'HOC', 
  'Đơn vị', 'SL HV', 'Hình Thức', 'ĐTV'
];

const TH_GROUPS = [
  { 
    title: 'ĐTV-M', 
    colorClass: 'bg-blue-50 text-blue-800 border-r-2 border-gray-300', 
    cols: ['DĐ', 'BRCĐ', 'CNTT', 'OL', 'KN', 'Coach', 'AI Mentor', 'Tổng'],
    keys: ['M_DD', 'M_BRCD', 'M_CNTT', 'M_OL', 'M_KN', 'M_Coach', 'M_AIMentor', 'M_Tong']
  },
  { 
    title: 'ĐTV-HH', 
    colorClass: 'bg-green-50 text-green-800 border-r-2 border-gray-300', 
    cols: ['DĐ', 'BRCĐ', 'CNTT', 'OL', 'KN', 'Coach', 'AI Mentor', 'Tổng'],
    keys: ['HH_DD', 'HH_BRCD', 'HH_CNTT', 'HH_OL', 'HH_KN', 'HH_Coach', 'HH_AIMentor', 'HH_Tong']
  },
  { 
    title: 'ALL', 
    colorClass: 'bg-orange-50 text-orange-800', 
    cols: ['DĐ', 'BRCĐ', 'CNTT', 'OL', 'KN', 'Coach', 'AI Mentor', 'TTKD', 'OKR', 'STL', 'OS', 'CT', 'Họp', 'Học', 'Tổng'],
    keys: ['ALL_DD', 'ALL_BRCD', 'ALL_CNTT', 'ALL_OL', 'ALL_KN', 'ALL_Coach', 'ALL_AIMentor', 'ALL_TTKD', 'ALL_OKR', 'ALL_STL', 'ALL_OS', 'ALL_CT', 'ALL_Hop', 'ALL_Hoc', 'ALL_Tong']
  }
];

const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => {
  const m = i + 1;
  return m < 10 ? `0${m}` : `${m}`;
});

const currentRealYear = new Date().getFullYear();
const YEAR_LIST = Array.from({ length: 11 }, (_, i) => currentRealYear - 5 + i);

// Default Table Config
const DEFAULT_TABLE_CONFIG: TableConfig = {
    isEnabledAlternating: false,
    alternatingColor: {
        headerBg: '#f3f4f6', 
        headerText: '#374151', 
        oddRowBg: '#ffffff',
        evenRowBg: '#ffffff'
    },
    conditionalRules: [],
    instructorColors: {},
    columnWidths: {}
};

// Configuration for Tabs Display
const TABS_CONFIG: { id: SheetCategory; label: string }[] = [
  { id: 'BC', label: 'Báo Cáo' },
  { id: 'BF', label: 'Bù Phép' },
  { id: 'TH', label: 'Thống Kê' },
  { id: 'KH', label: 'Kế Hoạch' },
];

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
  onLoadAllMonths,
  isSheetNotFound = false
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

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false); 
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isTableSettingsOpen, setIsTableSettingsOpen] = useState(false); 
  
  const [isCreating, setIsCreating] = useState(false);
  const [updateTrigger, setUpdateTrigger] = useState(0); 
  
  // Table Configuration State
  const [tableConfig, setTableConfig] = useState<TableConfig>(DEFAULT_TABLE_CONFIG);
  const [isConfigLoading, setIsConfigLoading] = useState(false); // Changed default to false to handle initial empty state better
  
  // Cache for Table Configs to prevent re-fetching
  const configCache = useRef<Record<string, TableConfig>>({});

  useEffect(() => {
    setActiveCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    if (activeCategory !== 'TH') {
      setIsYearlyMode(false);
    }
  }, [activeCategory]);
  
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
    const paddedMonth = mInt < 10 ? `0${mInt}` : `${mInt}`;
    const unpaddedMonth = `${mInt}`;
    
    // Logic tìm sheet: Ưu tiên có năm -> không năm -> tháng 0x -> tháng x
    const suffixesToCheck = [
        `-T${paddedMonth}-${yearStr}`, 
        `-T${unpaddedMonth}-${yearStr}`,
        `-T${paddedMonth}`,            
        `-T${unpaddedMonth}`           
    ];

    for (const suffix of suffixesToCheck) {
        const found = availableSheets.find(name => {
            const nameUpper = name.toUpperCase();
            return nameUpper.includes(searchType) && nameUpper.includes(suffix);
        });
        if (found) return found;
    }

    if (!isYearlyMode) {
        return `${searchType}-T${paddedMonth}-${yearStr}`;
    }

    return '';
  }, [availableSheets, selectedMonth, selectedYear, activeCategory, nvSubTab, isYearlyMode]);

  // Shared Config Key per Month
  const configKey = useMemo(() => {
    return `CONF_T${selectedMonth}_${selectedYear}`;
  }, [selectedMonth, selectedYear]);

  // Change sheet when target changes
  useEffect(() => {
    if (targetSheetName && targetSheetName !== currentSheetName && !isYearlyMode) {
      onSheetChange(targetSheetName);
    }
  }, [targetSheetName, currentSheetName, onSheetChange, isYearlyMode]);

  // --- LOAD TABLE CONFIG WITH CACHING ---
  useEffect(() => {
      let isMounted = true;
      const loadConfig = async () => {
          if (!configKey) return;

          // 1. Check Cache First
          if (configCache.current[configKey]) {
              setTableConfig(configCache.current[configKey]);
              setIsConfigLoading(false);
              return;
          }

          // 2. Load
          setIsConfigLoading(true);
          try {
              const cfg = await fetchTableConfig(scriptUrl, configKey);
              if (isMounted) {
                  const finalConfig = cfg || DEFAULT_TABLE_CONFIG;
                  setTableConfig(finalConfig);
                  configCache.current[configKey] = finalConfig;
              }
          } catch (e) { 
              console.error("Load config error", e); 
              if (isMounted) setTableConfig(DEFAULT_TABLE_CONFIG);
          } finally {
              if (isMounted) setIsConfigLoading(false);
          }
      };
      
      // Only load config if we are in a mode that needs it, or if we expect to show a sheet
      // However, we load it anyway based on month/year selection so it's ready when sheet is created
      loadConfig();
      return () => { isMounted = false; };
  }, [configKey, scriptUrl]);

  const handleSaveTableConfig = async (newConfig: TableConfig) => {
      setTableConfig(newConfig);
      if (configKey) {
          configCache.current[configKey] = newConfig;
          try {
              await saveTableConfig(scriptUrl, configKey, newConfig);
              alert("Đã lưu cấu hình bảng cho tháng này thành công!");
          } catch(e) { alert("Lỗi lưu cấu hình bảng"); }
      }
  };

  // --- CALCULATE STATISTICS (Kept same) ---
  const statisticsData = useMemo(() => {
    // ... (Keep existing logic unchanged) ...
    if (activeCategory !== 'TH') return [];
    let sourceRows: SheetRow[] = [];
    if (isYearlyMode) {
        ALL_MONTHS.forEach(m => {
             const mInt = parseInt(m, 10);
             const padded = mInt < 10 ? `0${mInt}` : `${mInt}`;
             const unpadded = `${mInt}`;
             const ySuffix = `-${selectedYear}`;
             let sName = availableSheets.find(n => 
                 n.includes('BC') && n.includes(ySuffix) && (n.includes(`-T${padded}`) || n.includes(`-T${unpadded}`))
             );
             if (!sName) sName = availableSheets.find(n => n.includes('BC') && (n.includes(`-T${padded}`) || n.includes(`-T${unpadded}`)));

             if (sName) {
                 const sData = getDataBySheetName(sName);
                 if (sData && sData.rows) sourceRows = [...sourceRows, ...sData.rows];
             }
        });
    } else {
        if (data && data.rows) sourceRows = data.rows;
    }
    if (sourceRows.length === 0) return [];

    const statsMap: Record<string, any> = {};
    sourceRows.forEach(row => {
      const gv = row['Giảng Viên'] || row['GV'];
      if (!gv) return;
      const gvKey = gv.trim();
      if (!statsMap[gvKey]) {
        statsMap[gvKey] = {
          'Giảng Viên': gvKey,
          'M_DD': 0, 'M_BRCD': 0, 'M_CNTT': 0, 'M_OL': 0, 'M_KN': 0, 'M_Coach': 0, 'M_AIMentor': 0, 'M_Tong': 0,
          'HH_DD': 0, 'HH_BRCD': 0, 'HH_CNTT': 0, 'HH_OL': 0, 'HH_KN': 0, 'HH_Coach': 0, 'HH_AIMentor': 0, 'HH_Tong': 0,
          'ALL_DD': 0, 'ALL_BRCD': 0, 'ALL_CNTT': 0, 'ALL_OL': 0, 'ALL_KN': 0, 'ALL_Coach': 0, 'ALL_AIMentor': 0,
          'ALL_TTKD': 0, 'ALL_OS': 0, 'ALL_CT': 0, 'ALL_OKR': 0, 'ALL_STL': 0, 'ALL_Hop': 0, 'ALL_Hoc': 0, 'ALL_Tong': 0,
          'Màu': row['Màu'] || ''
        };
      }
      const dtvRaw = row['ĐTV'] ? row['ĐTV'].toString().toUpperCase() : '';
      const isM = dtvRaw.includes('M');
      // UPDATED: 'CD' is counted as 'HH' for statistics
      const isCD = dtvRaw.includes('CD');
      const isHH = dtvRaw.includes('HH') || isCD;

      const metrics = ['DĐ', 'BRCĐ', 'CNTT', 'OL', 'KN', 'Coach', 'AI Mentor'];
      let rowSumM = 0; let rowSumHH = 0; let rowSumALL = 0;
      metrics.forEach(metric => {
        const val = parseVal(row[metric]);
        let keySuffix = metric;
        if(metric === 'DĐ') keySuffix = 'DD';
        if(metric === 'BRCĐ') keySuffix = 'BRCD';
        if(metric === 'AI Mentor') keySuffix = 'AIMentor';

        if (isM) { statsMap[gvKey][`M_${keySuffix}`] += val; rowSumM += val; }
        if (isHH) { statsMap[gvKey][`HH_${keySuffix}`] += val; rowSumHH += val; }
        statsMap[gvKey][`ALL_${keySuffix}`] += val;
        rowSumALL += val;
      });
      if (isM) statsMap[gvKey]['M_Tong'] += rowSumM;
      if (isHH) statsMap[gvKey]['HH_Tong'] += rowSumHH;
      
      const valTTKD = parseVal(row['TTKD']); const valOS = parseVal(row['OS']); const valCT = parseVal(row['CT']);
      const valHoc = parseVal(row['HOC']); const valOKR = parseVal(row['OKR']); const valSTL = parseVal(row['STL']);
      const valHop = valOKR + valSTL;

      statsMap[gvKey]['ALL_TTKD'] += valTTKD; statsMap[gvKey]['ALL_OS'] += valOS; statsMap[gvKey]['ALL_CT'] += valCT;
      statsMap[gvKey]['ALL_Hoc'] += valHoc; statsMap[gvKey]['ALL_OKR'] += valOKR; statsMap[gvKey]['ALL_STL'] += valSTL;
      statsMap[gvKey]['ALL_Hop'] += valHop;
      
      rowSumALL += (valTTKD + valOS + valCT + valHoc + valOKR + valSTL);
      statsMap[gvKey]['ALL_Tong'] += rowSumALL;
    });

    return Object.values(statsMap).map((item: any, index) => ({ ...item, 'STT': (index + 1).toString() }));
  }, [data, activeCategory, isYearlyMode, selectedYear, availableSheets, cacheVersion]); 
  // ... (Rest of derived logic and helper functions) ...

  const instructorList = useMemo(() => {
    const fromConfig = appConfig.instructors || [];
    const fromData = data.rows ? [...new Set(data.rows.map(r => r['Giảng Viên'] || r['GV']).filter(Boolean))] : [];
    return [...new Set([...fromConfig, ...fromData])].sort();
  }, [data, appConfig]);

  const canCreateMonth = user.role === 'ADMIN';
  const canAddBCData = (user.role === 'ADMIN' || user.role === 'LEADER') && (activeCategory === 'BC' || activeCategory === 'NV') && !!targetSheetName && !isSheetNotFound;

  const currentColumns = useMemo(() => {
    if (activeCategory === 'BF' || activeCategory === 'KH') {
      const days = selectedMonth ? getDaysArray(selectedMonth, selectedYear) : [];
      return ['STT', 'Giảng Viên', ...days];
    }
    if (activeCategory === 'TH') return ['STT', 'Giảng Viên'];
    return REPORT_COLUMNS;
  }, [activeCategory, selectedMonth, selectedYear]);

  const filteredRows = useMemo(() => {
     // ... (Keep existing filtering logic) ...
    if (activeCategory === 'TH') {
       if (!statisticsData) return [];
       return statisticsData.filter((row: any) => row['Giảng Viên'].toLowerCase().includes(searchTerm.toLowerCase()));
    }
    if (activeCategory === 'NV') {
       if (!data || !data.rows) return [];
       return data.rows.filter(row => Object.values(row).some((val) => String(val).toLowerCase().includes(searchTerm.toLowerCase())));
    }
    if (activeCategory === 'KH' || activeCategory === 'BF') {
         // ... (Keep existing complex logic for KH/BF) ...
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
         if (data && data.rows) data.rows.forEach(r => { const name = r['Giảng Viên'] || r['GV'] || r['Họ và tên']; if (name) allInstructorsSet.add(String(name).trim()); });
         const sortedInstructors = [...allInstructorsSet].sort();
         const daysArray = getDaysArray(selectedMonth, selectedYear);

         const calculatedRows = sortedInstructors.map((instructor: string, idx) => {
            const rowObj: SheetRow = { 'STT': (idx + 1).toString(), 'Giảng Viên': instructor };
            if (data && data.rows) {
                const matches = data.rows.filter(r => normalize((r['Giảng Viên'] || r['GV'] || r['Họ và tên']) as string) === normalize(instructor));
                matches.forEach(m => {
                    Object.keys(m).forEach(key => { if (key !== 'STT' && key !== 'Giảng Viên' && key !== 'GV' && m[key]) rowObj[key] = String((m as any)[key]); });
                    if(m['Màu']) rowObj['Màu'] = m['Màu'];
                });
            }
            if (activeCategory === 'KH') {
                 daysArray.forEach(day => {
                    const dayKey = day; const dayNumKey = parseInt(day, 10).toString();
                    if (!rowObj[day] && !rowObj[dayNumKey]) {
                        let cellContent = '';
                        if (bfData && bfData.rows) {
                             const bfRow = bfData.rows.find(r => normalize(String(r['Giảng Viên']||'')) === normalize(instructor));
                             if (bfRow) cellContent = (bfRow[dayKey] as string) || (bfRow[dayNumKey] as string) || '';
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
                                     const code = String(item['Mã Lớp'] || item['Nội dung'] || '?');
                                     const session = String(item['Buổi'] || '');
                                     return `${code}-${session}`;
                                 });
                                 cellContent = lines.join('\n');
                             }
                        }
                        if (cellContent) rowObj[day] = cellContent;
                    }
                 });
            }
            return rowObj;
         });
         return calculatedRows.filter(row => row['Giảng Viên'].toLowerCase().includes(searchTerm.toLowerCase()));
    }
    if (!data || !data.rows) return [];
    return data.rows.filter(row => Object.values(row).some((val) => (val as string).toLowerCase().includes(searchTerm.toLowerCase())));
  }, [data, statisticsData, searchTerm, activeCategory, nvSubTab, targetSheetName, appConfig, updateTrigger, selectedMonth, selectedYear, availableSheets, getDataBySheetName, cacheVersion, isYearlyMode]);

  // ... (Helper functions for rendering: getCellColor, getRowValue, getConditionalStyle) ...
  const getCellColor = (value: string, header: string, dayLabel?: string) => {
    // 1. Weekends
    if (dayLabel === 'CN' || dayLabel === 'T7') return 'bg-pink-100 text-pink-900';
    // 2. KH/BF Content
    if (activeCategory === 'BF' || activeCategory === 'KH') {
        const val = value?.toLowerCase().trim();
        if (val === 'p') return 'bg-yellow-100 font-bold text-yellow-700';
        if (val === 'kp' || val === 'x') return 'bg-red-100 font-bold text-red-700';
        if (val === 'b') return 'bg-blue-100 font-bold text-blue-700';
    }
    // 3. Percentage
    if (typeof value === 'string' && value.includes('%')) {
       const num = parseFloat(value);
       if (!isNaN(num)) {
         if (num >= 80) return 'text-green-600 font-bold bg-green-50';
         if (num < 50) return 'text-red-600 font-bold bg-red-50';
         return 'text-blue-600';
       }
    }
    // 4. BC weekends
    if ((activeCategory === 'BC' || activeCategory === 'NV') && (header === 'Thứ')) {
        const val = value?.trim().toLowerCase();
        if (val === 'cn' || val === 'chủ nhật') return 'bg-pink-100 text-pink-700 font-bold';
        if (val === 't7' || val === 'thứ 7' || val === 'thứ bảy') return 'bg-pink-100 text-pink-700 font-bold';
    }
    
    // 5. Numeric Values
    if (value && !isNaN(Number(value)) && Number(value) > 0 && activeCategory === 'TH') {
       return 'font-medium text-gray-900';
    }

    return '';
  };

  const getRowValue = (row: SheetRow, header: string) => {
    if (row[header] !== undefined) return row[header];
    if (header === 'Giảng Viên' && row['GV']) return row['GV'];
    if (header === 'GV' && row['Giảng Viên']) return row['Giảng Viên'];
    const foundKey = Object.keys(row).find(k => k.toLowerCase() === header.toLowerCase());
    if (foundKey) return row[foundKey];
    if (header === 'Mã Lớp' && row['Đài']) return row['Đài'];
    if (header === 'Nội dung' && row['Mã Lớp']) return row['Mã Lớp'];
    if (!isNaN(Number(header))) { const numKey = parseInt(header, 10).toString(); if (row[numKey] !== undefined) return row[numKey]; }
    return '';
  };

  const getConditionalStyle = (value: string): React.CSSProperties => {
      if (!tableConfig.conditionalRules || tableConfig.conditionalRules.length === 0) return {};
      const valStr = String(value || '').toLowerCase();
      const numVal = parseFloat(value);

      for (const rule of tableConfig.conditionalRules) {
          const ruleVal = rule.value.toLowerCase();
          let match = false;
          switch(rule.condition) {
              case 'equals': match = valStr === ruleVal; break;
              case 'contains': match = valStr.includes(ruleVal); break;
              case 'starts_with': match = valStr.startsWith(ruleVal); break;
              case 'greater_than': match = !isNaN(numVal) && numVal > parseFloat(ruleVal); break;
              case 'less_than': match = !isNaN(numVal) && numVal < parseFloat(ruleVal); break;
          }
          if (match) {
              return { 
                  backgroundColor: rule.backgroundColor, 
                  color: rule.textColor,
                  fontWeight: rule.bold ? 'bold' : 'normal'
              };
          }
      }
      return {};
  };

  const handleSaveData = async (rowData: SheetRow) => {
    if (!targetSheetName) return;
    await saveSheetRow(scriptUrl, targetSheetName, rowData);
    data.rows.push(rowData);
    setUpdateTrigger(prev => prev + 1);
  };

  const handleSaveMatrix = async (dateStr: string, content: string, instructor: string) => {
    if (!targetSheetName) return;
    await saveSheetRow(scriptUrl, targetSheetName, { 'Giảng Viên': instructor, [dateStr.split('-')[2]]: content }, 'Giảng Viên');
    setUpdateTrigger(p => p+1);
  };

  const handleCreateMonth = async () => {
    setIsCreating(true);
    try {
      const res = await createMonthSheets(scriptUrl, selectedMonth, selectedYear);
      if (res.success) {
          if (res.spreadsheetUrl) onUrlUpdate(res.spreadsheetUrl);
          await onRefresh(); 
      }
    } catch (error) { console.error("Lỗi khởi tạo: " + error); } finally { setIsCreating(false); }
  };
  
  const handleCreateNVSheets = async () => {
    setIsCreating(true);
    try {
      const res = await createNVSheets(scriptUrl);
      if (res.success) { await onRefresh(); alert("Đã khởi tạo các sheet Nghiệp vụ thành công!"); }
    } catch (error) { alert("Lỗi khởi tạo: " + error); } finally { setIsCreating(false); }
  };

  const handleYearlyClick = async () => {
      const newMode = !isYearlyMode; setIsYearlyMode(newMode);
      if (newMode && onLoadAllMonths) await onLoadAllMonths(selectedYear.toString());
  };

  const nextStt = (data.rows?.length || 0) + 1;

  // --- RENDERERS ---
  const renderTableHeader = () => {
     // ... (Keep existing header logic) ...
    const { headerBg, headerText } = tableConfig.alternatingColor;
    const headerStyle = { backgroundColor: headerBg, color: headerText };

    if (activeCategory === 'TH') {
      return (
        <thead className="sticky top-0 z-20 shadow-sm text-center">
          <tr>
            <th rowSpan={2} className="px-2 py-2 border border-gray-300 font-bold sticky left-0 z-30 w-12 border-r-2" style={headerStyle}>STT</th>
            <th rowSpan={2} className="px-4 py-2 border border-gray-300 font-bold sticky left-12 z-30 min-w-[180px] text-left border-r-2" style={headerStyle}>GIẢNG VIÊN</th>
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

    if (activeCategory === 'KH' || activeCategory === 'BF') {
      const days = selectedMonth ? getDaysArray(selectedMonth, selectedYear) : [];
      return (
        <thead className="sticky top-0 z-20 shadow-sm text-center">
          <tr style={headerStyle}>
            <th rowSpan={2} className="px-2 py-2 border border-gray-300 font-bold sticky left-0 z-30 w-12 border-r-2" style={headerStyle}>STT</th>
            <th rowSpan={2} className="px-4 py-2 border border-gray-300 font-bold sticky left-12 z-30 min-w-[130px] text-left border-r-2" style={headerStyle}>GIẢNG VIÊN</th>
            {days.map((day, idx) => {
               const dayLabel = getDayLabel(day, selectedMonth, selectedYear);
               const weekendClass = (dayLabel === 'CN' || dayLabel === 'T7') ? 'text-pink-900' : '';
               return (
                 <th key={`dow-${idx}`} className={`px-1 py-1 border border-gray-300 text-sm font-bold ${weekendClass}`} style={headerStyle}>
                   {dayLabel}
                 </th>
               );
            })}
          </tr>
          <tr className="bg-gray-50 text-gray-800">
            {days.map((day, idx) => {
               const dayLabel = getDayLabel(day, selectedMonth, selectedYear);
               const weekendClass = (dayLabel === 'CN' || dayLabel === 'T7') ? 'text-pink-900' : '';
               return (
                  <th key={`date-${idx}`} className={`px-1 py-2 border border-gray-300 text-sm font-bold ${weekendClass} min-w-[90px]`}>
                    {day}
                  </th>
               );
            })}
          </tr>
        </thead>
      );
    }
    
    return (
      <thead className="sticky top-0 z-20 shadow-sm">
        <tr>
          {currentColumns.map((header, idx) => {
            const width = tableConfig.columnWidths[header];
            const style = { ...headerStyle, width: width ? `${width}px` : undefined };
            return (
              <th key={idx} className={`px-2 py-3 border border-gray-300 text-sm font-bold uppercase tracking-wider whitespace-nowrap text-center
                  ${header === 'STT' ? 'sticky left-0 z-30 border-r-2 border-r-gray-300 w-12' : ''}
                  ${header === 'Mã Lớp' ? 'min-w-[100px]' : ''}
                  ${header === 'Nội dung' ? 'min-w-[250px] text-left px-3' : ''}
              `}
              style={style}
              >
                {header}
              </th>
            );
          })}
        </tr>
      </thead>
    );
  };

  const renderTableBody = () => {
    // ... (Keep existing body logic) ...
    const getRowBg = (idx: number) => {
        if (tableConfig.isEnabledAlternating) {
            return idx % 2 === 0 ? tableConfig.alternatingColor.oddRowBg : tableConfig.alternatingColor.evenRowBg;
        }
        return 'white';
    };

    if (activeCategory === 'TH') {
      if (filteredRows.length === 0) return <tr><td colSpan={25} className="text-center py-8 text-gray-400">Không có dữ liệu.</td></tr>;
      return filteredRows.map((row, rIdx) => {
         const rowBg = getRowBg(rIdx);
         return (
            <tr key={rIdx} className="hover:bg-blue-50 transition-colors" style={{ backgroundColor: rowBg, color: '#1f2937' }}>
               <td className="px-2 py-1 text-sm border border-gray-200 text-center sticky left-0 z-10 border-r-2 border-r-gray-300 align-middle" style={{ backgroundColor: rowBg }}>{row['STT']}</td>
               <td className="px-4 py-1 text-sm border border-gray-200 text-left sticky left-12 z-10 border-r-2 border-r-gray-300 font-bold align-middle" style={{ backgroundColor: rowBg }}>{row['Giảng Viên']}</td>
               {TH_GROUPS.map(group => group.keys.map((key, kIdx) => {
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
                        <td key={`${group.title}-${key}-${kIdx}`} className={`px-2 py-1 text-sm border border-gray-200 text-center align-middle ${cellClass}`}>
                            {hasValue ? val : '-'}
                        </td>
                    )
               }))}
            </tr>
         )
      });
    }

    return filteredRows.map((row, rIdx) => {
      const instructorName = row['Giảng Viên'] || row['GV'] || '';
      const rowBg = getRowBg(rIdx);
      return (
      <tr key={rIdx} className="group hover:bg-blue-50 transition-colors" style={{ backgroundColor: rowBg, color: '#1f2937' }}>
        {currentColumns.map((header, cIdx) => {
          const value = getRowValue(row, header);
          const isDateCol = (activeCategory === 'BF' || activeCategory === 'KH') && !isNaN(Number(header));
          const dayLabel = isDateCol ? getDayLabel(header, selectedMonth, selectedYear) : '';
          const width = tableConfig.columnWidths[header];
          const baseColorClass = getCellColor(value as string, header, dayLabel);
          const hasBaseBg = baseColorClass.includes('bg-');
          const hasBaseText = baseColorClass.includes('text-');
          const conditionalStyle = getConditionalStyle(value as string);
          const isInstructorCol = header === 'Giảng Viên' || header === 'GV' || header === 'Họ và tên';
          const instructorColor = (isInstructorCol && instructorName) ? tableConfig.instructorColors[instructorName] : undefined;

          const stickyStyle: React.CSSProperties = { 
             width: width ? `${width}px` : undefined,
             ...conditionalStyle
          };
          if (!stickyStyle.backgroundColor && !hasBaseBg) {
             stickyStyle.backgroundColor = rowBg;
          }
          if (!stickyStyle.color && !hasBaseText) {
             stickyStyle.color = '#1f2937';
          }
          let content: React.ReactNode = value;
          if (isInstructorCol && instructorColor && value) {
              content = (
                  <span className="inline-block px-2 py-0.5 rounded shadow-sm text-gray-800 font-bold border border-black/10" style={{ backgroundColor: instructorColor }}>{value as string}</span>
              );
          }
          return (
            <td 
              key={cIdx} 
              className={`px-2 py-2 text-sm border border-gray-200 whitespace-pre-wrap max-w-xs align-middle
                ${header === 'STT' ? 'text-center sticky left-0 border-r-2 border-r-gray-300 font-mono z-10' : 'text-left'}
                ${(header === 'Giảng Viên' && (activeCategory === 'BF' || activeCategory === 'KH')) ? 'sticky left-12 border-r-2 border-r-gray-300 z-10 font-bold text-vnpt-primary px-4 min-w-[130px]' : ''}
                ${header === 'Nội dung' ? 'whitespace-normal min-w-[250px] px-3' : ''}
                ${!conditionalStyle.backgroundColor ? baseColorClass : ''}
              `}
              title={value as string}
              style={stickyStyle}
            >
              {content}
            </td>
          );
        })}
      </tr>
    )});
  };

  const renderContent = () => {
      // 1. If we are refreshing data from the server, show loading
      if (isRefreshing && !isYearlyMode) {
          return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <svg className="animate-spin h-10 w-10 text-vnpt-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-gray-500 font-medium">Đang tải dữ liệu...</span>
            </div>
          );
      }

      // 2. CRITICAL: If no target sheet found OR explicit Not Found flag (deleted from backend)
      // Show CREATE BUTTON immediately.
      // We skip 'KH' because KH can aggregate data, but for simplicity, if nothing exists, allow creation.
      if ((!targetSheetName || isSheetNotFound) && activeCategory !== 'KH' && !isYearlyMode) {
          return (
             <div className="flex flex-col items-center justify-center h-64 space-y-4">
                 <p className="text-gray-500 mb-2">
                    {isSheetNotFound 
                        ? `Dữ liệu Tháng ${selectedMonth}/${selectedYear} chưa tồn tại (hoặc đã bị xóa).` 
                        : `Dữ liệu Tháng ${selectedMonth}/${selectedYear} chưa được khởi tạo.`}
                 </p>
                 <button 
                    onClick={activeCategory === 'NV' ? handleCreateNVSheets : handleCreateMonth} 
                    className="bg-vnpt-primary text-white px-6 py-2.5 rounded shadow-lg font-bold hover:bg-blue-700 transition-all flex items-center"
                 >
                    {isCreating ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Đang khởi tạo...
                        </>
                    ) : (
                        `Khởi tạo Dữ Liệu Tháng ${selectedMonth}`
                    )}
                 </button>
             </div>
          );
      }

      // 3. If Config is Loading (and we have a sheet to show), show spinner
      if (isConfigLoading && !isYearlyMode) {
          return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <svg className="animate-spin h-10 w-10 text-vnpt-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-gray-500 font-medium">Đang tải cấu hình bảng...</span>
            </div>
          );
      }

      // 4. Default: Show Table
      return (
        <div className="flex-1 overflow-auto bg-white custom-scrollbar relative">
            <table className="w-full text-left border-collapse min-w-max animate-[fadeIn_0.3s]">
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
      <div className="border-b border-gray-200 px-4 py-3 bg-white flex flex-col z-30 shadow-sm sticky top-0">
         <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
             <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
                {activeCategory !== 'NV' && (
                    <div className="flex items-center space-x-2 bg-white rounded-md border border-blue-200 px-3 py-1.5 whitespace-nowrap shadow-sm text-vnpt-primary font-bold">
                        <span>Năm:</span><select className="bg-transparent border-none outline-none cursor-pointer" value={selectedYear} onChange={e=>setSelectedYear(parseInt(e.target.value))}>{YEAR_LIST.map(y=><option key={y} value={y}>{y}</option>)}</select>
                        <div className="w-px h-4 bg-blue-200 mx-2"></div>
                        <span>Tháng:</span><select className="bg-transparent border-none outline-none cursor-pointer" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)}>{ALL_MONTHS.map(m=><option key={m} value={m}>{m}</option>)}</select>
                    </div>
                )}
                
                {activeCategory === 'TH' && (
                   <button 
                      onClick={handleYearlyClick}
                      className={`px-3 py-1.5 rounded text-sm font-bold flex items-center transition-colors shadow-sm whitespace-nowrap
                         ${isYearlyMode ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}
                      `}
                   >
                     {isYearlyMode ? 'Xem theo Tháng' : 'Tổng cả năm'}
                   </button>
                )}

                <div className="flex items-center space-x-2">
                    {activeCategory !== 'NV' && (
                      <div className="flex space-x-1 bg-gray-100/80 p-1 rounded-lg">
                          {TABS_CONFIG.map(tab => (
                             <button 
                                key={tab.id} 
                                onClick={()=>setActiveCategory(tab.id)} 
                                className={`px-4 py-1.5 rounded text-sm font-medium transition-all whitespace-nowrap ${activeCategory===tab.id ? 'bg-white shadow-sm text-vnpt-primary font-bold' : 'text-gray-500 hover:bg-gray-200/50'}`}
                             >
                                {tab.label}
                             </button>
                          ))}
                      </div>
                    )}
                </div>
             </div>

             <div className="flex items-center gap-3">
                 <input className="border p-1 rounded" placeholder="Tìm kiếm..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                 
                 {spreadsheetUrl && !isSheetNotFound && (
                     <a 
                        href={spreadsheetUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-green-600 text-white rounded-md text-sm font-bold flex items-center hover:bg-green-700 shadow-sm"
                        title="Mở Google Sheet"
                     >
                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        Mở Sheet
                     </a>
                 )}

                 {user.role === 'ADMIN' && (
                     <button 
                        onClick={() => setIsTableSettingsOpen(true)}
                        className="px-3 py-1.5 bg-gray-700 text-white rounded-md text-sm font-bold flex items-center hover:bg-gray-800"
                        title="Cấu hình giao diện bảng"
                     >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Table Settings
                     </button>
                 )}

                 {canAddBCData && <button onClick={()=>setIsModalOpen(true)} className="bg-vnpt-primary text-white px-3 py-1.5 rounded text-sm">Thêm mới</button>}
             </div>
         </div>
      </div>

      <div className="flex-1 overflow-hidden relative flex flex-col">{renderContent()}</div>

      <EntryModal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} onSubmit={handleSaveData} sheetName={targetSheetName} nextStt={nextStt} appConfig={appConfig} />
      <LeaveModal isOpen={isLeaveModalOpen} onClose={()=>setIsLeaveModalOpen(false)} onSubmit={handleSaveMatrix} month={selectedMonth} user={user} instructors={instructorList} />
      <LeaveModal isOpen={isPlanModalOpen} onClose={()=>setIsPlanModalOpen(false)} onSubmit={handleSaveMatrix} month={selectedMonth} user={user} instructors={instructorList} title="Nhập Kế Hoạch" />
      
      <TableSettingsModal 
         isOpen={isTableSettingsOpen} 
         onClose={() => setIsTableSettingsOpen(false)} 
         config={tableConfig}
         onSave={handleSaveTableConfig}
         instructors={instructorList}
      />
    </div>
  );
};
