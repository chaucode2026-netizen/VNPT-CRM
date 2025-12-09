
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { ConfigPanel } from './components/ConfigPanel';
import { Dashboard } from './components/Dashboard';
import { LoginForm } from './components/LoginForm';
import { fetchSheetNames, fetchSheetData, loginUser, getAllUsers, fetchAppConfig } from './services/sheetService';
import { SheetData, LoadingState, User, AppConfig } from './types';

// Updated to the latest provided URL (D3/exec)
const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyILRT9suOh1oM76A8Ss3---Tv21ZMhritA9qiwJO9VL1sjL8ewtAEXttjCj2SkypD3/exec";

// Keys for LocalStorage
const LS_KEYS = {
  USER: 'vnpt_user_v1',
  SHEETS: 'vnpt_sheets_v1',
  CONFIG: 'vnpt_config_v1' // New key for config cache
};

function App() {
  // --- STATE WITH LOCAL STORAGE PERSISTENCE ---
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(LS_KEYS.USER);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  // App Config State (Instructors, Units, ClassCodes)
  const [appConfig, setAppConfig] = useState<AppConfig>(() => {
    try {
        const saved = localStorage.getItem(LS_KEYS.CONFIG);
        return saved ? JSON.parse(saved) : { classCodes: [], instructors: [], units: [] };
    } catch { return { classCodes: [], instructors: [], units: [] }; }
  });

  // App States
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [isRefreshing, setIsRefreshing] = useState(false); // Silent refresh state
  const [scriptUrl, setScriptUrl] = useState<string>(DEFAULT_SCRIPT_URL);
  
  const [sheetNames, setSheetNames] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LS_KEYS.SHEETS);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Data Cache: Stores loaded data for each sheet { "BC T05": {headers:..., rows:...} }
  const sheetCache = useRef<Record<string, SheetData>>({});
  // Version to trigger re-renders when cache updates
  const [cacheVersion, setCacheVersion] = useState(0);

  const [currentSheetData, setCurrentSheetData] = useState<SheetData>({ headers: [], rows: [] });
  const [selectedSheetName, setSelectedSheetName] = useState<string>('');

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('home'); 
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>('');
  const [masterUrl, setMasterUrl] = useState<string>(''); // NEW: Track the Master Sheet URL explicitly
  const [pendingCount, setPendingCount] = useState(0);

  // --- PERSISTENCE EFFECTS ---
  useEffect(() => {
    if (currentUser) localStorage.setItem(LS_KEYS.USER, JSON.stringify(currentUser));
    else localStorage.removeItem(LS_KEYS.USER);
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(LS_KEYS.SHEETS, JSON.stringify(sheetNames));
  }, [sheetNames]);

  useEffect(() => {
      localStorage.setItem(LS_KEYS.CONFIG, JSON.stringify(appConfig));
  }, [appConfig]);

  // --- AUTO REFRESH (15 Minutes) ---
  useEffect(() => {
    if (!currentUser || !scriptUrl) return;

    // Fetch config once on mount if empty
    if (appConfig.instructors.length === 0) {
        loadAppConfig();
    }

    const interval = setInterval(() => {
      console.log("Auto refreshing data...");
      handleRefresh(true); // Trigger silent refresh
    }, 15 * 60 * 1000); // 15 minutes

    return () => clearInterval(interval);
  }, [currentUser, scriptUrl]); 


  // Check for notifications if Admin
  useEffect(() => {
    if (currentUser?.role === 'ADMIN' && scriptUrl) {
      checkNotifications();
    }
  }, [currentUser, scriptUrl, activeTab]);

  const checkNotifications = async () => {
    try {
      const users = await getAllUsers(scriptUrl);
      const pending = users.filter(u => u.status === 'BLOCKED').length;
      setPendingCount(pending);
    } catch (e) {
      console.warn("Notification check failed", e);
    }
  };

  const loadAppConfig = async () => {
      if (!scriptUrl) return;
      try {
          const config = await fetchAppConfig(scriptUrl);
          setAppConfig(config);
      } catch (e) {
          console.error("Failed to load config", e);
      }
  };

  // --- LOGIN HANDLER ---
  const handleLogin = async (username: string, pass: string) => {
    setLoadingState(LoadingState.LOADING);
    setErrorMsg('');
    try {
      const user = await loginUser(scriptUrl, username, pass);
      setCurrentUser(user);
      
      // Fetch Initial Data & Config
      try {
        const { sheetNames: names, spreadsheetUrl: url } = await fetchSheetNames(scriptUrl);
        setSheetNames(names);
        setSpreadsheetUrl(url || '');
        setMasterUrl(url || ''); // Set master URL
        await loadAppConfig();
        
      } catch (e) {
        console.warn("Could not fetch initial data", e);
      }
      
      setLoadingState(LoadingState.SUCCESS);
    } catch (err: any) {
      setLoadingState(LoadingState.IDLE);
      if (err.message === 'Failed to fetch') {
        setErrorMsg('Lỗi kết nối: Không thể gọi đến Google Script. Vui lòng kiểm tra đường dẫn URL trong phần Cài đặt (icon bánh răng).');
      } else {
        setErrorMsg(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại.');
      }
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSheetNames([]);
    setCurrentSheetData({ headers: [], rows: [] });
    setSelectedSheetName('');
    sheetCache.current = {}; // Clear cache
    localStorage.clear(); 
    setActiveTab('home');
    setErrorMsg('');
    setLoadingState(LoadingState.IDLE);
    setPendingCount(0);
    setMasterUrl('');
  };

  // --- DATA LOADING HANDLERS ---
  
  const handleRefresh = async (silent = false) => {
    if (!scriptUrl) return;
    
    if (!silent) setLoadingState(LoadingState.LOADING);
    else setIsRefreshing(true);

    try {
      // 1. Refresh Sheet List
      const { sheetNames: names, spreadsheetUrl: url } = await fetchSheetNames(scriptUrl);
      setSheetNames(names);
      if (url) {
        setSpreadsheetUrl(url);
        setMasterUrl(url); // Update master URL
      }
      
      // 2. Refresh Config
      await loadAppConfig();

      // 3. Refresh Current Sheet Data if selected
      // Pass the NEW names list to avoid state update race conditions
      if (selectedSheetName) {
         await loadSheetData(scriptUrl, selectedSheetName, !silent, true, names);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoadingState(LoadingState.IDLE);
      setIsRefreshing(false);
    }
  };

  const loadSheetData = async (
      url: string, 
      sheetName: string, 
      showLoading = true, 
      forceRefresh = false,
      overrideSheetList?: string[] // Optional: Use this list if state hasn't updated yet
  ) => {
    if (!sheetName) return;

    // Optimistically update selected name
    setSelectedSheetName(sheetName);

    // --- LOGIC TẢI ĐỒNG THỜI (PARALLEL FETCHING) ---
    // 1. Xác định các sheet liên quan (Siblings)
    // Ví dụ: Chọn BC-T12 -> Cần tải cả BF-T12 và TH-T12
    const currentList = overrideSheetList || sheetNames;
    const match = sheetName.match(/-(T\d{1,2})$/); // Tìm đuôi -T12
    let sheetsToFetch = [sheetName];

    if (match) {
        const suffix = match[0]; // "-T12"
        // Tìm tất cả sheet có cùng đuôi tháng trong danh sách
        const siblings = currentList.filter(s => s.endsWith(suffix) && s !== sheetName);
        sheetsToFetch = [...sheetsToFetch, ...siblings];
    }

    // 2. Lọc ra những sheet cần tải (Chưa có trong cache hoặc bắt buộc tải lại)
    const needed = forceRefresh 
        ? sheetsToFetch 
        : sheetsToFetch.filter(s => !sheetCache.current[s]);

    // 3. Nếu sheet ĐÍCH đã có trong cache và không cần refresh, hiển thị ngay
    if (!forceRefresh && sheetCache.current[sheetName]) {
        console.log(`Loaded ${sheetName} from cache`);
        setCurrentSheetData(sheetCache.current[sheetName]);
        
        // FIX: Ensure correct URL is set from cache, fallback to Master if missing
        if (sheetCache.current[sheetName].fileUrl) {
            setSpreadsheetUrl(sheetCache.current[sheetName].fileUrl!);
        } else {
            setSpreadsheetUrl(masterUrl);
        }
        
        // Nếu các sheet phụ chưa có, tải ngầm (background fetch)
        const backgroundNeeded = sheetsToFetch.filter(s => !sheetCache.current[s]);
        if (backgroundNeeded.length > 0) {
            Promise.all(backgroundNeeded.map(name => fetchSheetData(url, name)))
                .then(results => {
                    results.forEach((data, i) => {
                        sheetCache.current[backgroundNeeded[i]] = data;
                    });
                    console.log(`Background loaded siblings: ${backgroundNeeded.join(', ')}`);
                    setCacheVersion(v => v + 1); // Notify change
                })
                .catch(err => console.error("Background fetch error", err));
        }
        return; 
    }

    // 4. TẢI DỮ LIỆU (Blocking)
    // Nếu sheet đích chưa có, ta hiện loading và tải TẤT CẢ các sheet cần thiết cùng lúc
    if (showLoading) setLoadingState(LoadingState.LOADING);
    else setIsRefreshing(true);
    
    // Xóa dữ liệu cũ để hiện loading state (tránh hiển thị dữ liệu không khớp)
    if (!forceRefresh) {
        setCurrentSheetData({ headers: [], rows: [] });
    }

    try {
      console.log(`Fetching parallel: ${needed.join(', ')}`);
      
      // Thực hiện gọi API song song
      await Promise.all(needed.map(async (name) => {
          try {
              const data = await fetchSheetData(url, name);
              sheetCache.current[name] = data; // Lưu vào cache
          } catch (err) {
              console.error(`Error loading ${name}`, err);
          }
      }));
      
      // 5. Cập nhật UI cho sheet ĐÍCH
      if (sheetCache.current[sheetName]) {
        setCurrentSheetData(sheetCache.current[sheetName]);
        // FIX: Reset URL to Master if child sheet has no specific URL (avoids sticky URL)
        if (sheetCache.current[sheetName].fileUrl) {
          setSpreadsheetUrl(sheetCache.current[sheetName].fileUrl!);
        } else {
          setSpreadsheetUrl(masterUrl);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setCacheVersion(v => v + 1); // Notify change for dependent components
      if (showLoading) setLoadingState(LoadingState.IDLE);
      else setIsRefreshing(false);
    }
  };

  // Used for Yearly Statistics
  const handleLoadAllMonths = async (year: string) => {
      if (!scriptUrl) return;
      setIsRefreshing(true);
      try {
          // Filter all sheets that are BC and match year (or just match T01..T12 if year implicit)
          // We need "BC" sheets because statistics are derived from them
          const yearSuffix = `-${year}`;
          const bcSheets = sheetNames.filter(name => {
              // Strict matching with year if present, otherwise flexible
              if (name.includes(yearSuffix) && name.includes('BC')) return true;
              // If no year in name, we might just fetch all BC-Txx
              if (name.includes('BC') && !name.match(/-\d{4}$/)) return true;
              return false;
          });

          // Filter out what we already have
          const toFetch = bcSheets.filter(s => !sheetCache.current[s]);
          
          if (toFetch.length > 0) {
             console.log("Fetching yearly data...", toFetch);
             await Promise.all(toFetch.map(async (name) => {
                try {
                    const data = await fetchSheetData(scriptUrl, name);
                    sheetCache.current[name] = data; 
                } catch (err) { console.error(err); }
             }));
             setCacheVersion(v => v + 1);
          }
      } finally {
          setIsRefreshing(false);
      }
  };

  const handleSheetChange = async (sheetName: string) => {
    if (scriptUrl) {
       // When user switches tab, show loading spinner (showLoading=true) but allow cache (forceRefresh=false)
       await loadSheetData(scriptUrl, sheetName, true, false);
    }
  };
  
  const handleUrlUpdate = (url: string) => {
    setSpreadsheetUrl(url);
  };

  const handleConfigUpdate = (url: string) => {
    setScriptUrl(url);
  };

  // Helper to access cached data (for cross-sheet logic in Dashboard)
  const getDataBySheetName = useCallback((name: string) => {
     return sheetCache.current[name];
  }, []);

  // --- RENDER ---
  
  if (!currentUser) {
    return (
      <LoginForm 
        onLogin={handleLogin} 
        isLoading={loadingState === LoadingState.LOADING}
        error={errorMsg}
        currentUrl={scriptUrl}
        onUrlChange={setScriptUrl}
      />
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'reports':
          return (
              <Dashboard 
                data={currentSheetData} 
                availableSheets={sheetNames}
                currentSheetName={selectedSheetName}
                onSheetChange={handleSheetChange}
                scriptUrl={scriptUrl}
                onRefresh={() => handleRefresh(false)}
                spreadsheetUrl={spreadsheetUrl}
                onUrlUpdate={handleUrlUpdate}
                user={currentUser}
                isRefreshing={isRefreshing || loadingState === LoadingState.LOADING}
                appConfig={appConfig}
                getDataBySheetName={getDataBySheetName}
                cacheVersion={cacheVersion}
                initialCategory="BC"
                onLoadAllMonths={handleLoadAllMonths}
                key="dashboard-bc"
              />
          );

      case 'operations':
          return (
              <Dashboard 
                data={currentSheetData} 
                availableSheets={sheetNames}
                currentSheetName={selectedSheetName}
                onSheetChange={handleSheetChange}
                scriptUrl={scriptUrl}
                onRefresh={() => handleRefresh(false)}
                spreadsheetUrl={spreadsheetUrl}
                onUrlUpdate={handleUrlUpdate}
                user={currentUser}
                isRefreshing={isRefreshing || loadingState === LoadingState.LOADING}
                appConfig={appConfig}
                getDataBySheetName={getDataBySheetName}
                cacheVersion={cacheVersion}
                initialCategory="NV"
                key="dashboard-nv"
              />
          );

      case 'settings':
        if (currentUser.role !== 'ADMIN') {
           return <div className="p-10 text-center text-red-500 font-bold">Bạn không có quyền truy cập khu vực này.</div>;
        }
        return (
           <div className="h-full overflow-y-auto bg-gray-50 custom-scrollbar">
              <div className="p-8 max-w-6xl mx-auto pb-20">
                  <div className="flex items-center space-x-2 mb-6 text-gray-500">
                    <span>Trang chủ</span>
                    <span>/</span>
                    <span className="text-gray-800 font-medium">Cấu hình & User</span>
                  </div>
                  <ConfigPanel 
                    scriptUrl={scriptUrl} 
                    onUrlChange={handleConfigUpdate} 
                    currentUser={currentUser}
                    appConfig={appConfig}
                    onConfigUpdate={setAppConfig}
                  />
              </div>
           </div>
        );

      case 'home':
      default:
        return (
          <div className="h-full flex items-center justify-center bg-gray-50">
             <div className="bg-white p-10 rounded-2xl shadow-xl border border-gray-100 max-w-lg w-full text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-vnpt-primary"></div>
                <div className="w-24 h-24 bg-gradient-to-br from-vnpt-primary to-vnpt-secondary text-white rounded-2xl flex items-center justify-center text-4xl font-bold mx-auto shadow-lg mb-6 transform rotate-3">
                  V
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Xin chào, {currentUser.fullName}</h2>
                <p className="text-gray-500 mb-8">
                  Vai trò: <span className="font-bold text-vnpt-primary bg-blue-50 px-2 py-1 rounded">{currentUser.role}</span>
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setActiveTab('reports')}
                    className="col-span-2 py-3 bg-vnpt-primary text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
                  >
                    Truy cập Báo Cáo
                  </button>
                  <button 
                    onClick={() => {
                        // Pass props to dashboard via activeTab=reports but change category logic if needed.
                        // Here we just switch tabs.
                        // For TH stats: user goes to Reports -> Clicks 'Thống kê'
                        setActiveTab('reports');
                    }}
                    className="col-span-2 py-3 bg-white border border-gray-300 text-vnpt-primary rounded-lg font-bold hover:bg-blue-50 transition-all shadow-sm"
                  >
                    Truy cập Thống kê
                  </button>
                  {currentUser.role === 'ADMIN' && (
                    <button 
                       onClick={() => setActiveTab('settings')}
                       className="col-span-2 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors relative"
                    >
                      Quản trị Hệ thống
                      {pendingCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 items-center justify-center text-[9px] text-white">{pendingCount}</span>
                        </span>
                      )}
                    </button>
                  )}
                </div>
             </div>
          </div>
        );
    }
  };

  return (
    <div className="h-screen bg-gray-50 font-sans flex flex-col overflow-hidden text-[#333]">
      <Header 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        hasData={true} 
        user={currentUser}
        onLogout={handleLogout}
        pendingCount={pendingCount}
      />
      <main className="flex-1 overflow-hidden relative flex flex-col">
         {/* Pass handleLoadAllMonths to Dashboard via renderContent -> Dashboard */}
         {activeTab === 'reports' ? (
              <Dashboard 
                data={currentSheetData} 
                availableSheets={sheetNames}
                currentSheetName={selectedSheetName}
                onSheetChange={handleSheetChange}
                scriptUrl={scriptUrl}
                onRefresh={() => handleRefresh(false)}
                spreadsheetUrl={spreadsheetUrl}
                onUrlUpdate={handleUrlUpdate}
                user={currentUser}
                isRefreshing={isRefreshing || loadingState === LoadingState.LOADING}
                appConfig={appConfig}
                getDataBySheetName={getDataBySheetName}
                cacheVersion={cacheVersion}
                initialCategory="BC"
                onLoadAllMonths={handleLoadAllMonths}
                key="dashboard-bc"
              />
         ) : renderContent()}
      </main>
    </div>
  );
}

export default App;
