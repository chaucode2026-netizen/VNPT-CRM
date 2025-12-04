
import React, { useState, useEffect } from 'react';
import { User, UserRole, UserStatus, AppConfig } from '../types';
import { getAllUsers, adminUpdateUser, saveAppConfig } from '../services/sheetService';

interface ConfigPanelProps {
  scriptUrl: string;
  onUrlChange: (url: string) => void;
  currentUser: User;
  appConfig: AppConfig;
  onConfigUpdate: (newConfig: AppConfig) => void;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ 
    scriptUrl, onUrlChange, currentUser, appConfig, onConfigUpdate 
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  // URL state retained but UI hidden
  const [url, setUrl] = useState(scriptUrl);
  
  // Config Editors State
  const [configState, setConfigState] = useState<AppConfig>(appConfig);
  const [savingConfig, setSavingConfig] = useState(false);
  
  // Modal States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newUser, setNewUser] = useState<User>({
      username: '', password: '', fullName: '', role: 'INSTRUCTOR', email: '', phone: '', address: '', status: 'ACTIVE'
  });

  useEffect(() => {
    loadUsers();
    setConfigState(appConfig); // Sync local state with prop
  }, [scriptUrl, appConfig]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const list = await getAllUsers(scriptUrl);
      setUsers(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (user: User, newStatus: UserStatus) => {
    if (!window.confirm(`Bạn có chắc muốn chuyển ${user.username} sang trạng thái ${newStatus}?`)) return;
    try {
      await adminUpdateUser(scriptUrl, 'UPDATE_STATUS', { ...user, status: newStatus });
      loadUsers(); // Refresh
    } catch (e: any) { alert('Lỗi cập nhật: ' + (e.message || e)); }
  };

  const handleChangeRole = async (user: User, newRole: UserRole) => {
     try {
      await adminUpdateUser(scriptUrl, 'UPDATE_STATUS', { ...user, role: newRole });
      loadUsers();
    } catch (e: any) { alert('Lỗi cập nhật role: ' + (e.message || e)); }
  };

  const handleResetPass = async (user: User) => {
     const newPass = prompt("Nhập mật khẩu mới cho " + user.username + ":");
     if (!newPass) return;
     try {
       await adminUpdateUser(scriptUrl, 'RESET_PASS', { ...user, password: newPass });
       alert("Đã đổi mật khẩu thành công!");
     } catch (e: any) { alert('Lỗi đổi mật khẩu: ' + (e.message || e)); }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminUpdateUser(scriptUrl, 'ADD', newUser);
      setIsAddOpen(false);
      setNewUser({ username: '', password: '', fullName: '', role: 'INSTRUCTOR', email: '', phone: '', address: '', status: 'ACTIVE' });
      loadUsers();
      alert("Thêm thành công");
    } catch (e: any) { 
      // Show actual error message
      alert('Lỗi thêm user: ' + (e.message || e)); 
    }
  };

  // --- CONFIG HANDLERS ---
  const handleConfigSave = async () => {
    setSavingConfig(true);
    try {
        // Parse text areas back to arrays
        const parsedConfig: AppConfig = {
            classCodes: typeof configState.classCodes === 'string' ? (configState.classCodes as string).split('\n').filter((s: string) => s.trim()) : configState.classCodes,
            instructors: typeof configState.instructors === 'string' ? (configState.instructors as string).split('\n').filter((s: string) => s.trim()) : configState.instructors,
            units: typeof configState.units === 'string' ? (configState.units as string).split('\n').filter((s: string) => s.trim()) : configState.units,
        };
        
        await saveAppConfig(scriptUrl, currentUser, parsedConfig);
        onConfigUpdate(parsedConfig);
        alert("Đã lưu cấu hình danh mục thành công!");
    } catch (error: any) {
        alert("Lỗi lưu cấu hình: " + (error.message || error));
    } finally {
        setSavingConfig(false);
    }
  };

  const handleTextAreaChange = (field: keyof AppConfig, value: string) => {
      // Temporarily store as string for editing
      setConfigState(prev => ({ ...prev, [field]: value }));
  };

  const arrayToString = (arr: string[] | string) => {
      if (Array.isArray(arr)) return arr.join('\n');
      return arr;
  };

  // Shared style for inputs/textareas to ensure visibility
  const inputStyle = "w-full border border-gray-300 rounded p-3 text-sm focus:ring-2 focus:ring-vnpt-primary outline-none bg-white text-gray-900";
  const modalInputStyle = "w-full border border-gray-300 p-2 rounded text-sm bg-white text-gray-900 focus:ring-2 focus:ring-vnpt-primary outline-none";

  return (
    <div className="space-y-8 animate-[fadeIn_0.3s]">
      
      {/* 1. DATA LIST CONFIGURATION */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
         <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
             <h2 className="text-lg font-bold text-vnpt-primary">Quản lý Danh Mục</h2>
             <button 
                onClick={handleConfigSave}
                disabled={savingConfig}
                className="bg-orange-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-orange-700 shadow"
             >
                 {savingConfig ? 'Đang lưu...' : 'Lưu Danh Mục'}
             </button>
         </div>
         <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
             {/* Class Codes */}
             <div>
                 <label className="block text-sm font-bold text-gray-700 mb-2">Danh sách Mã Lớp</label>
                 <p className="text-xs text-gray-400 mb-2">Mỗi dòng 1 mã</p>
                 <textarea 
                    rows={10}
                    className={inputStyle}
                    value={arrayToString(configState.classCodes)}
                    onChange={(e) => handleTextAreaChange('classCodes', e.target.value)}
                 />
             </div>
             {/* Instructors */}
             <div>
                 <label className="block text-sm font-bold text-gray-700 mb-2">Danh sách Giảng Viên</label>
                 <p className="text-xs text-gray-400 mb-2">Mỗi dòng 1 tên</p>
                 <textarea 
                    rows={10}
                    className={inputStyle}
                    value={arrayToString(configState.instructors)}
                    onChange={(e) => handleTextAreaChange('instructors', e.target.value)}
                 />
             </div>
             {/* Units */}
             <div>
                 <label className="block text-sm font-bold text-gray-700 mb-2">Danh sách Đơn Vị</label>
                 <p className="text-xs text-gray-400 mb-2">Mỗi dòng 1 đơn vị</p>
                 <textarea 
                    rows={10}
                    className={inputStyle}
                    value={arrayToString(configState.units)}
                    onChange={(e) => handleTextAreaChange('units', e.target.value)}
                 />
             </div>
         </div>
      </div>

      {/* 2. User Management */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h2 className="text-lg font-bold text-vnpt-primary">Quản lý người dùng</h2>
            <button 
                onClick={() => setIsAddOpen(true)}
                className="bg-green-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-green-700 flex items-center"
            >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Thêm User
            </button>
        </div>
        
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold">
                    <tr>
                        <th className="px-6 py-3">Tài khoản</th>
                        <th className="px-6 py-3">Họ tên</th>
                        <th className="px-6 py-3">Vai trò</th>
                        <th className="px-6 py-3">Thông tin liên hệ</th>
                        <th className="px-6 py-3">Trạng thái</th>
                        <th className="px-6 py-3 text-right">Thao tác</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {loading ? (
                        <tr><td colSpan={6} className="p-4 text-center text-gray-500">Đang tải danh sách...</td></tr>
                    ) : users.map(user => (
                        <tr key={user.username} className="hover:bg-blue-50">
                            <td className="px-6 py-3 font-medium text-gray-900">{user.username}</td>
                            <td className="px-6 py-3 text-gray-600">{user.fullName}</td>
                            <td className="px-6 py-3">
                                <select 
                                    value={user.role} 
                                    onChange={(e) => handleChangeRole(user, e.target.value as UserRole)}
                                    className="border-gray-300 rounded text-xs py-1 px-2 border bg-white text-gray-900 focus:ring-vnpt-primary"
                                >
                                    <option value="ADMIN">ADMIN</option>
                                    <option value="LEADER">Tổ trưởng</option>
                                    <option value="INSTRUCTOR">Giảng viên</option>
                                </select>
                            </td>
                            <td className="px-6 py-3 text-xs text-gray-500">
                                <div>{user.email}</div>
                                <div>{user.phone}</div>
                            </td>
                            <td className="px-6 py-3">
                                {user.status === 'BLOCKED' ? (
                                    <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold animate-pulse">Chờ duyệt / Khóa</span>
                                ) : (
                                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">Hoạt động</span>
                                )}
                            </td>
                            <td className="px-6 py-3 text-right space-x-2">
                                <button onClick={() => handleResetPass(user)} className="text-blue-600 hover:underline text-xs" title="Đổi mật khẩu">Pass</button>
                                {user.status === 'BLOCKED' ? (
                                    <button onClick={() => handleUpdateStatus(user, 'ACTIVE')} className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-700 shadow">DUYỆT</button>
                                ) : (
                                    <button onClick={() => handleUpdateStatus(user, 'BLOCKED')} className="bg-red-100 text-red-600 px-3 py-1 rounded text-xs font-bold hover:bg-red-200">KHÓA</button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>

      {/* Add User Modal */}
      {isAddOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl border border-gray-200">
                  <h3 className="font-bold text-lg mb-4 text-vnpt-primary">Thêm tài khoản mới</h3>
                  <form onSubmit={handleAddUser} className="space-y-3">
                      <div>
                        <input placeholder="Tên đăng nhập" required className={modalInputStyle} value={newUser.username} onChange={e=>setNewUser({...newUser, username: e.target.value})} />
                      </div>
                      <div>
                        <input placeholder="Mật khẩu" required className={modalInputStyle} value={newUser.password} onChange={e=>setNewUser({...newUser, password: e.target.value})} />
                      </div>
                      <div>
                        <input placeholder="Họ và tên" required className={modalInputStyle} value={newUser.fullName} onChange={e=>setNewUser({...newUser, fullName: e.target.value})} />
                      </div>
                      <div>
                        <select className={modalInputStyle} value={newUser.role} onChange={e=>setNewUser({...newUser, role: e.target.value as UserRole})}>
                            <option value="ADMIN">Quản trị viên</option>
                            <option value="LEADER">Tổ trưởng</option>
                            <option value="INSTRUCTOR">Giảng viên</option>
                        </select>
                      </div>
                      <div>
                        <input placeholder="Email" className={modalInputStyle} value={newUser.email} onChange={e=>setNewUser({...newUser, email: e.target.value})} />
                      </div>
                      <div>
                        <input placeholder="SĐT" className={modalInputStyle} value={newUser.phone} onChange={e=>setNewUser({...newUser, phone: e.target.value})} />
                      </div>
                      
                      <div className="flex justify-end gap-2 mt-4">
                          <button type="button" onClick={() => setIsAddOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
                          <button type="submit" className="px-4 py-2 bg-vnpt-primary text-white rounded font-bold hover:bg-blue-700">Lưu</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};
