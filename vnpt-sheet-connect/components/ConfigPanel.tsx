
import React, { useState, useEffect } from 'react';
import { User, UserRole, UserStatus } from '../types';
import { getAllUsers, adminUpdateUser } from '../services/sheetService';

interface ConfigPanelProps {
  scriptUrl: string;
  onUrlChange: (url: string) => void;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ scriptUrl, onUrlChange }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState(scriptUrl);
  
  // Modal States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null); // For resetting password or editing
  const [newUser, setNewUser] = useState<User>({
      username: '', password: '', fullName: '', role: 'INSTRUCTOR', email: '', phone: '', address: '', status: 'ACTIVE'
  });

  useEffect(() => {
    loadUsers();
  }, [scriptUrl]);

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
    } catch (e) { alert('Lỗi cập nhật'); }
  };

  const handleChangeRole = async (user: User, newRole: UserRole) => {
     try {
      await adminUpdateUser(scriptUrl, 'UPDATE_STATUS', { ...user, role: newRole });
      loadUsers();
    } catch (e) { alert('Lỗi cập nhật role'); }
  };

  const handleResetPass = async (user: User) => {
     const newPass = prompt("Nhập mật khẩu mới cho " + user.username + ":");
     if (!newPass) return;
     try {
       await adminUpdateUser(scriptUrl, 'RESET_PASS', { ...user, password: newPass });
       alert("Đã đổi mật khẩu thành công!");
     } catch (e) { alert('Lỗi đổi mật khẩu'); }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminUpdateUser(scriptUrl, 'ADD', newUser);
      setIsAddOpen(false);
      setNewUser({ username: '', password: '', fullName: '', role: 'INSTRUCTOR', email: '', phone: '', address: '', status: 'ACTIVE' });
      loadUsers();
      alert("Thêm thành công");
    } catch (e) { alert('Lỗi thêm user'); }
  };

  return (
    <div className="space-y-8 animate-[fadeIn_0.3s]">
      
      {/* 1. Connection Settings (Collapsible or Small) */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <details>
            <summary className="text-sm font-bold text-gray-600 cursor-pointer mb-2">Cài đặt kết nối (URL Script)</summary>
            <div className="flex gap-2 mt-2">
                <input 
                    className="flex-1 border p-2 rounded text-sm font-mono"
                    value={url} onChange={e => setUrl(e.target.value)}
                />
                <button onClick={() => onUrlChange(url)} className="bg-vnpt-primary text-white px-4 py-1 rounded text-sm">Lưu</button>
            </div>
        </details>
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
                                    className="border-gray-300 rounded text-xs py-1 px-2 border bg-white focus:ring-vnpt-primary"
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
              <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
                  <h3 className="font-bold text-lg mb-4 text-vnpt-primary">Thêm tài khoản mới</h3>
                  <form onSubmit={handleAddUser} className="space-y-3">
                      <input placeholder="Tên đăng nhập" required className="w-full border p-2 rounded text-sm" value={newUser.username} onChange={e=>setNewUser({...newUser, username: e.target.value})} />
                      <input placeholder="Mật khẩu" required className="w-full border p-2 rounded text-sm" value={newUser.password} onChange={e=>setNewUser({...newUser, password: e.target.value})} />
                      <input placeholder="Họ và tên" required className="w-full border p-2 rounded text-sm" value={newUser.fullName} onChange={e=>setNewUser({...newUser, fullName: e.target.value})} />
                      <select className="w-full border p-2 rounded text-sm" value={newUser.role} onChange={e=>setNewUser({...newUser, role: e.target.value as UserRole})}>
                          <option value="ADMIN">Quản trị viên</option>
                          <option value="LEADER">Tổ trưởng</option>
                          <option value="INSTRUCTOR">Giảng viên</option>
                      </select>
                      <input placeholder="Email" className="w-full border p-2 rounded text-sm" value={newUser.email} onChange={e=>setNewUser({...newUser, email: e.target.value})} />
                      <input placeholder="SĐT" className="w-full border p-2 rounded text-sm" value={newUser.phone} onChange={e=>setNewUser({...newUser, phone: e.target.value})} />
                      
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
