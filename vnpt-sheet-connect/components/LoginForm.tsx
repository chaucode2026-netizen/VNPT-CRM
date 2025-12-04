
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
      if (err.message === 'Invalid Action') {
        setRegError('Lỗi Server: Backend chưa hỗ trợ đăng ký (Invalid Action). Hãy cập nhật Script.');
      } else {
        setRegError(err.message || 'Đăng ký thất bại');
      }
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200">
        
        {/* Header - Clean Look */}
        <div className="bg-vnpt-primary p-8 text-center relative overflow-hidden">
           <div className="absolute inset-0 bg-blue-600 opacity-20 transform rotate-12 scale-150"></div>
           <div className="relative z-10">
            <div className="w-16 h-16 bg-white rounded-xl mx-auto mb-3 flex items-center justify-center shadow-lg text-vnpt-primary">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                 <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
               </svg>
            </div>
            <h2 className="text-2xl font-bold text-white uppercase tracking-wider">VNPT CRM</h2>
            <p className="text-blue-100 text-sm mt-1 font-medium">Hệ thống quản lý đào tạo</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button 
            className={`flex-1 py-4 text-sm font-bold transition-colors ${!isRegistering ? 'text-vnpt-primary border-b-2 border-vnpt-primary bg-blue-50/50' : 'text-gray-400 hover:text-gray-600'}`}
            onClick={() => { setIsRegistering(false); setRegSuccess(false); }}
          >
            ĐĂNG NHẬP
          </button>
          <button 
            className={`flex-1 py-4 text-sm font-bold transition-colors ${isRegistering ? 'text-vnpt-primary border-b-2 border-vnpt-primary bg-blue-50/50' : 'text-gray-400 hover:text-gray-600'}`}
            onClick={() => setIsRegistering(true)}
          >
            ĐĂNG KÝ
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          {isRegistering ? (
            /* --- REGISTER FORM --- */
            regSuccess ? (
              <div className="text-center py-6 animate-[fadeIn_0.5s]">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Đăng ký thành công!</h3>
                <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                  Tài khoản của bạn đã được gửi lên hệ thống và đang chờ Admin phê duyệt.
                </p>
                <button 
                  onClick={() => { setIsRegistering(false); setRegSuccess(false); }}
                  className="w-full py-3 bg-vnpt-primary text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all"
                >
                  Quay về Đăng nhập
                </button>
              </div>
            ) : (
              <form onSubmit={handleRegSubmit} className="space-y-4 animate-[fadeIn_0.3s]">
                {regError && <div className="text-red-500 text-xs bg-red-50 p-3 rounded-lg border border-red-100 flex items-center"><span className="mr-2">⚠️</span>{regError}</div>}
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Họ và tên</label>
                    <input type="text" required className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-vnpt-primary focus:border-vnpt-primary outline-none text-sm transition-all" 
                      value={regData.fullName} onChange={e => setRegData({...regData, fullName: e.target.value})} placeholder="Nguyễn Văn A" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Tên đăng nhập</label>
                    <input type="text" required className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-vnpt-primary focus:border-vnpt-primary outline-none text-sm transition-all" 
                       value={regData.username} onChange={e => setRegData({...regData, username: e.target.value})} placeholder="user123" />
                  </div>
                   <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Mật khẩu</label>
                    <input type="password" required className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-vnpt-primary focus:border-vnpt-primary outline-none text-sm transition-all" 
                       value={regData.password} onChange={e => setRegData({...regData, password: e.target.value})} placeholder="******" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Email</label>
                    <input type="email" required className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-vnpt-primary focus:border-vnpt-primary outline-none text-sm transition-all" 
                       value={regData.email} onChange={e => setRegData({...regData, email: e.target.value})} placeholder="email@vnpt.vn" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">SĐT</label>
                    <input type="text" required className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-vnpt-primary focus:border-vnpt-primary outline-none text-sm transition-all" 
                       value={regData.phone} onChange={e => setRegData({...regData, phone: e.target.value})} placeholder="091xxxxxxx" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Địa chỉ</label>
                    <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-vnpt-primary focus:border-vnpt-primary outline-none text-sm transition-all" 
                       value={regData.address} onChange={e => setRegData({...regData, address: e.target.value})} placeholder="Hà Nội" />
                  </div>
                </div>

                <button type="submit" disabled={regLoading}
                  className={`w-full py-3 text-white font-bold rounded-lg shadow-md transition-all mt-4
                    ${regLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-vnpt-primary hover:bg-blue-700 hover:shadow-lg active:scale-95'}`}>
                  {regLoading ? 'Đang xử lý...' : 'GỬI ĐĂNG KÝ'}
                </button>
              </form>
            )
          ) : (
            /* --- LOGIN FORM --- */
            <form onSubmit={handleLoginSubmit} className="space-y-6 animate-[fadeIn_0.3s]">
              {error && <div className="text-red-500 text-xs bg-red-50 p-3 rounded-lg border border-red-100 flex items-start"><span className="mr-2 mt-0.5">⚠️</span><span>{error}</span></div>}
              
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Tài khoản</label>
                <div className="relative">
                  <input 
                    type="text" required 
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vnpt-primary focus:border-vnpt-primary outline-none text-sm transition-all" 
                    value={loginUser} onChange={e => setLoginUser(e.target.value)} placeholder="Nhập tên đăng nhập"
                  />
                   <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Mật khẩu</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} required 
                    className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vnpt-primary focus:border-vnpt-primary outline-none text-sm transition-all" 
                    value={loginPass} onChange={e => setLoginPass(e.target.value)} placeholder="Nhập mật khẩu"
                  />
                  <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none">
                     {showPassword ? <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg> 
                     : <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" /><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.742L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" /></svg>}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isLoading}
                className={`w-full py-3 text-white font-bold rounded-lg shadow-md transition-all uppercase tracking-wide
                  ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-vnpt-primary hover:bg-blue-700 hover:shadow-lg active:scale-95'}`}>
                {isLoading ? 'Đang xác thực...' : 'ĐĂNG NHẬP'}
              </button>
            </form>
          )}
        </div>
        
        {/* Footer */}
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-500">
            Hỗ trợ kỹ thuật: <span className="text-vnpt-primary font-bold">1800 1091</span>
          </p>
        </div>
      </div>
    </div>
  );
};
