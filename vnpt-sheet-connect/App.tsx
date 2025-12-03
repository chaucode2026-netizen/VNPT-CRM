
import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ConfigPanel } from './components/ConfigPanel';
import { Dashboard } from './components/Dashboard';
import { LoginForm } from './components/LoginForm';
import { fetchSheetNames, fetchSheetData, loginUser, getAllUsers } from './services/sheetService';
import { SheetData, LoadingState, User } from './types';

// Updated to the latest provided URL (D3/exec)
const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyILRT9suOh1oM76A8Ss3---Tv21ZMhritA9qiwJO9VL1sjL8ewtAEXttjCj2SkypD3/exec";

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // App States
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [scriptUrl, setScriptUrl] = useState<string>(DEFAULT_SCRIPT_URL);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [currentSheetData, setCurrentSheetData] = useState<SheetData>({ headers: [], rows: [] });
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('home'); 
  const [selectedSheetName, setSelectedSheetName] = useState<string>('');
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>('');
  const [pendingCount, setPendingCount] = useState(0);

  // Check for notifications if Admin
  useEffect(() => {
    if (currentUser?.role === 'ADMIN' && scriptUrl) {
      checkNotifications();
    }
  }, [currentUser, scriptUrl, activeTab]); // Re-check when tab changes in case of updates

  const checkNotifications = async () => {
    try {
      const users = await getAllUsers(scriptUrl);
      const pending = users.filter(u => u.status === 'BLOCKED').length;
      setPendingCount(pending);
    } catch (e) {
      console.warn("Notification check failed", e);
    }
  };

  // --- LOGIN HANDLER ---
  const handleLogin = async (username: string, pass: string) => {
    setLoadingState(LoadingState.LOADING);
    setErrorMsg('');
    try {
      // 1. Authenticate with GAS
      const user = await loginUser(scriptUrl, username, pass);
      setCurrentUser(user);
      
      // 2. Fetch Initial Data immediately after login
      try {
        const { sheetNames, spreadsheetUrl } = await fetchSheetNames(scriptUrl);
        setSheetNames(sheetNames);
        setSpreadsheetUrl(spreadsheetUrl || '');
        
        // Auto load first sheet if exists
        if (sheetNames.length > 0) {
           await loadSheetData(scriptUrl, sheetNames[0]);
        }
      } catch (e) {
        console.warn("Could not fetch initial sheets", e);
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
    setActiveTab('home');
    setErrorMsg('');
    setLoadingState(LoadingState.IDLE);
    setPendingCount(0);
  };

  // --- DATA LOADING HANDLERS ---
  const handleRefresh = async () => {
    if (scriptUrl) {
      const { sheetNames, spreadsheetUrl } = await fetchSheetNames(scriptUrl);
      setSheetNames(sheetNames);
      if (spreadsheetUrl) setSpreadsheetUrl(spreadsheetUrl);
      
      if (selectedSheetName) {
        await loadSheetData(scriptUrl, selectedSheetName);
      }
    }
  };

  const loadSheetData = async (url: string, sheetName: string) => {
    setSelectedSheetName(sheetName);
    try {
      const data = await fetchSheetData(url, sheetName);
      setCurrentSheetData(data);
      if (data.fileUrl) {
        setSpreadsheetUrl(data.fileUrl);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleSheetChange = async (sheetName: string) => {
    if (scriptUrl) {
       await loadSheetData(scriptUrl, sheetName);
    }
  };
  
  const handleUrlUpdate = (url: string) => {
    setSpreadsheetUrl(url);
  };

  const handleConfigUpdate = (url: string) => {
    setScriptUrl(url);
    // handleRefresh();
  };

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
                onRefresh={handleRefresh}
                spreadsheetUrl={spreadsheetUrl}
                onUrlUpdate={handleUrlUpdate}
                user={currentUser}
              />
          );

      case 'settings':
        if (currentUser.role !== 'ADMIN') {
           return <div className="p-10 text-center text-red-500 font-bold">Bạn không có quyền truy cập khu vực này.</div>;
        }
        return (
           <div className="p-8 max-w-6xl mx-auto">
              <div className="flex items-center space-x-2 mb-6 text-gray-500">
                <span>Trang chủ</span>
                <span>/</span>
                <span className="text-gray-800 font-medium">Cấu hình & User</span>
              </div>
              <ConfigPanel scriptUrl={scriptUrl} onUrlChange={handleConfigUpdate} />
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
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
