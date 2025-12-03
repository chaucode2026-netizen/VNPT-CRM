
import React, { useState } from 'react';
import { User } from '../types';
import { registerUser } from '../services/sheetService';

interface LoginFormProps {
  onLogin: (username: string, password: string) => Promise<void>;
  isLoading: boolean;
  error?: string;
  currentUrl: string;
  onUrlChange: (url: string) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLogin, isLoading, error, currentUrl, onUrlChange }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Login State
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Register State
  const [regData, setRegData] = useState<User>({
    username: '',
    password: '',
    fullName: '',
    role: 'INSTRUCTOR', // Default role requests are Instructor
    email: '',
    phone: '',
    address: '',
    status: 'BLOCKED'
  });
  const [regSuccess, setRegSuccess] = useState(false);
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(loginUser.trim(), loginPass.trim());
  };

  const handleRegSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegLoading(true);
    try {
      await registerUser(currentUrl, regData);
      setRegSuccess(true);
      // Reset form
      setRegData({ ...regData, username: '', password: '', fullName: '', email: '', phone: '', address: '' });
    } catch (err: any) {
      setRegError(err.message || 'Đăng ký thất bại');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden border border-gray-200">
        
        {/* Header with Config Toggle */}
        <div className="bg-vnpt-primary p-6 text-center relative">
           <div className="absolute inset-0 bg-blue-600 opacity-20 transform rotate-12 scale-150"></div>
           <button 
            onClick={() => setShowConfig(!showConfig)}
            className="absolute top-4 right-4 text-blue-200 hover:text-white transition-colors z-20"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
             </svg>
          </button>
           <div className="relative z-10">
            <h2 className="text-2xl font-bold text-white uppercase tracking-wider">VNPT CRM</h2>
            <p className="text-blue-100 text-sm mt-1">Hệ thống quản lý đào tạo</p>
          </div>
        </div>

        {/* Config View */}
        {showConfig && (
          <div className="bg-gray-50 p-4 border-b border-gray-200">
             <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Web App URL</label>
             <textarea 
                value={currentUrl}
                onChange={(e) => onUrlChange(e.target.value)}
                className="w-full text-xs p-2 border border-gray-300 rounded outline-none h-16"
             />
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button 
            className={`flex-1 py-3 text-sm font-bold ${!isRegistering ? 'text-vnpt-primary border-b-2 border-vnpt-primary' : 'text-gray-500 hover:bg-gray-50'}`}
            onClick={() => { setIsRegistering(false); setRegSuccess(false); }}
          >
            Đăng Nhập
          </button>
          <button 
            className={`flex-1 py-3 text-sm font-bold ${isRegistering ? 'text-vnpt-primary border-b-2 border-vnpt-primary' : 'text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setIsRegistering(true)}
          >
            Đăng Ký
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isRegistering ? (
            /* --- REGISTER FORM --- */
            regSuccess ? (
              <div className="text-center py-6 animate-[fadeIn_0.5s]">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-800">Đăng ký thành công!</h3>
                <p className="text-gray-600 text-sm mt-2">
                  Tài khoản của bạn đang chờ Admin phê duyệt.<br/>Vui lòng quay lại sau.
                </p>
                <button 
                  onClick={() => { setIsRegistering(false); setRegSuccess(false); }}
                  className="mt-6 px-6 py-2 bg-vnpt-primary text-white rounded font-bold hover:bg-blue-700"
                >
                  Quay về Đăng nhập
                </button>
              </div>
            ) : (
              <form onSubmit={handleRegSubmit} className="space-y-4">
                {regError && <div className="text-red-500 text-xs bg-red-50 p-2 rounded">{regError}</div>}
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-gray-600">Họ và tên</label>
                    <input type="text" required className="w-full p-2 border rounded mt-1 text-sm" 
                      value={regData.fullName} onChange={e => setRegData({...regData, fullName: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600">Tên đăng nhập</label>
                    <input type="text" required className="w-full p-2 border rounded mt-1 text-sm" 
                       value={regData.username} onChange={e => setRegData({...regData, username: e.target.value})} />
                  </div>
                   <div>
                    <label className="text-xs font-bold text-gray-600">Mật khẩu</label>
                    <input type="password" required className="w-full p-2 border rounded mt-1 text-sm" 
                       value={regData.password} onChange={e => setRegData({...regData, password: e.target.value})} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-gray-600">Email</label>
                    <input type="email" required className="w-full p-2 border rounded mt-1 text-sm" 
                       value={regData.email} onChange={e => setRegData({...regData, email: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600">SĐT</label>
                    <input type="text" required className="w-full p-2 border rounded mt-1 text-sm" 
                       value={regData.phone} onChange={e => setRegData({...regData, phone: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600">Địa chỉ</label>
                    <input type="text" className="w-full p-2 border rounded mt-1 text-sm" 
                       value={regData.address} onChange={e => setRegData({...regData, address: e.target.value})} />
                  </div>
                </div>

                <button type="submit" disabled={regLoading}
                  className={`w-full py-2.5 text-white font-bold rounded ${regLoading ? 'bg-gray-400' : 'bg-vnpt-primary hover:bg-blue-700'}`}>
                  {regLoading ? 'Đang gửi...' : 'Gửi Đăng Ký'}
                </button>
              </form>
            )
          ) : (
            /* --- LOGIN FORM --- */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {error && <div className="text-red-500 text-xs bg-red-50 p-2 rounded">{error}</div>}
              
              <div>
                <label className="text-xs font-bold text-gray-600">Tài khoản</label>
                <div className="relative mt-1">
                  <input 
                    type="text" required 
                    className="w-full pl-9 p-2 border rounded text-sm focus:ring-1 focus:ring-vnpt-primary outline-none" 
                    value={loginUser} onChange={e => setLoginUser(e.target.value)} placeholder="Username"
                  />
                   <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600">Mật khẩu</label>
                <div className="relative mt-1">
                  <input 
                    type={showPassword ? "text" : "password"} required 
                    className="w-full pl-9 pr-9 p-2 border rounded text-sm focus:ring-1 focus:ring-vnpt-primary outline-none" 
                    value={loginPass} onChange={e => setLoginPass(e.target.value)} placeholder="Password"
                  />
                  <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                     {showPassword ? <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg> 
                     : <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" /><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.742L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" /></svg>}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isLoading}
                className={`w-full py-2.5 text-white font-bold rounded ${isLoading ? 'bg-gray-400' : 'bg-vnpt-primary hover:bg-blue-700'}`}>
                {isLoading ? 'Đang xác thực...' : 'ĐĂNG NHẬP'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
