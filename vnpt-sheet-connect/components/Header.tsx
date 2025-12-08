
import React from 'react';
import { User } from '../types';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  hasData: boolean;
  user: User | null;
  onLogout: () => void;
  pendingCount?: number; // Count of BLOCKED users
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange, user, onLogout, pendingCount = 0 }) => {
  const isAdmin = user?.role === 'ADMIN';

  const navItems = [
    { id: 'home', label: 'Trang chủ' },
    { id: 'reports', label: 'Báo cáo', disabled: false },
    { id: 'operations', label: 'Nghiệp vụ', disabled: false },
    // Only Admin can see Settings
    { id: 'settings', label: 'Cấu hình & User', hidden: !isAdmin },
  ];

  const getRoleLabel = (role?: string) => {
    switch(role) {
      case 'ADMIN': return 'Quản Trị Viên';
      case 'LEADER': return 'Tổ Trưởng';
      case 'INSTRUCTOR': return 'Giảng Viên';
      default: return 'User';
    }
  }

  return (
    <header className="bg-vnpt-primary text-white shadow-md z-40 relative">
      <div className="flex flex-col">
        {/* Top Bar: Logo & User Info */}
        <div className="px-4 py-2 flex items-center justify-between border-b border-blue-600/30">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white rounded flex items-center justify-center text-vnpt-primary font-bold text-lg shadow-sm">
              V
            </div>
            <h1 className="text-lg font-bold tracking-wide uppercase">VNPT CRM</h1>
          </div>
          
          <div className="flex items-center space-x-4 text-sm">
            {user && (
              <>
                {/* Notification Bell for Admin */}
                {isAdmin && (
                  <button 
                    onClick={() => onTabChange('settings')}
                    className="relative p-1.5 rounded-full hover:bg-blue-700 transition-colors mr-2 group"
                    title="Thông báo duyệt tài khoản"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-200 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {pendingCount > 0 && (
                      <span className="absolute top-0 right-0 block h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center border border-white">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                )}

                <div className="hidden md:flex flex-col items-end mr-2">
                   <span className="font-bold leading-none">{user.fullName}</span>
                   <span className="text-[10px] bg-blue-800 px-2 py-0.5 rounded-full mt-1 text-blue-100 border border-blue-600/50">
                     {getRoleLabel(user.role)}
                   </span>
                </div>
                <div className="flex items-center space-x-3">
                   <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center font-bold border border-blue-400">
                     {user.username.charAt(0).toUpperCase()}
                   </div>
                   <button 
                    onClick={onLogout}
                    className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded transition-colors font-medium shadow-sm"
                   >
                     Thoát
                   </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Navigation Bar */}
        <nav className="px-4 flex items-center space-x-1 overflow-x-auto no-scrollbar">
          {navItems.filter(item => !item.hidden).map((item) => (
            <button
              key={item.id}
              onClick={() => !item.disabled && onTabChange(item.id)}
              disabled={item.disabled}
              className={`px-4 py-3 text-sm font-medium transition-all border-b-2 whitespace-nowrap
                ${activeTab === item.id 
                  ? 'border-white text-white bg-blue-700/50' 
                  : 'border-transparent text-blue-100 hover:text-white hover:bg-blue-600/50'
                }
                ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {item.label}
              {item.id === 'settings' && pendingCount > 0 && (
                 <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingCount}</span>
              )}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
};
