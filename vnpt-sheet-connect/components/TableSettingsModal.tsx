
import React, { useState, useEffect } from 'react';
import { TableConfig, ConditionalRule } from '../types';

interface TableSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: TableConfig;
  onSave: (config: TableConfig) => Promise<void>;
  instructors: string[];
}

const PRESETS = [
  { name: 'Mặc định', headerBg: '#f3f4f6', headerText: '#374151', odd: '#ffffff', even: '#ffffff' },
  { name: 'Xanh VNPT', headerBg: '#0060af', headerText: '#ffffff', odd: '#f0f9ff', even: '#ffffff' },
  { name: 'Doanh nghiệp', headerBg: '#1e293b', headerText: '#ffffff', odd: '#f8fafc', even: '#ffffff' },
  { name: 'Xanh lá', headerBg: '#15803d', headerText: '#ffffff', odd: '#f0fdf4', even: '#ffffff' },
  { name: 'Tối giản', headerBg: '#ffffff', headerText: '#1f293b', odd: '#f9fafb', even: '#ffffff' },
];

export const TableSettingsModal: React.FC<TableSettingsModalProps> = ({ 
  isOpen, onClose, config, onSave, instructors 
}) => {
  const [activeTab, setActiveTab] = useState<'styles' | 'conditional' | 'instructors'>('styles');
  const [localConfig, setLocalConfig] = useState<TableConfig>(config);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // New Rule State
  const [newRule, setNewRule] = useState<ConditionalRule>({
    condition: 'contains', value: '', backgroundColor: '#fef08a', textColor: '#854d0e', bold: false
  });

  useEffect(() => {
    if (isOpen) setLocalConfig(config);
  }, [isOpen, config]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(localConfig);
    setSaving(false);
    onClose();
  };

  const applyPreset = (preset: any) => {
    setLocalConfig(prev => ({
      ...prev,
      alternatingColor: {
        headerBg: preset.headerBg,
        headerText: preset.headerText,
        oddRowBg: preset.odd,
        evenRowBg: preset.even
      }
    }));
  };

  const addRule = () => {
    if (!newRule.value) return alert("Vui lòng nhập giá trị");
    setLocalConfig(prev => ({
      ...prev,
      conditionalRules: [...prev.conditionalRules, newRule]
    }));
    setNewRule({ condition: 'contains', value: '', backgroundColor: '#fef08a', textColor: '#854d0e', bold: false });
  };

  const removeRule = (idx: number) => {
    setLocalConfig(prev => ({
      ...prev,
      conditionalRules: prev.conditionalRules.filter((_, i) => i !== idx)
    }));
  };

  const updateInstructorColor = (name: string, color: string) => {
    setLocalConfig(prev => ({
      ...prev,
      instructorColors: { ...prev.instructorColors, [name]: color }
    }));
  };

  if (!isOpen) return null;

  // --- UI COMPONENTS ---

  const ColorPickerInput = ({ label, value, onChange }: { label: string, value: string, onChange: (val: string) => void }) => (
    <div className="flex flex-col">
      <span className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{label}</span>
      <div className="flex items-center space-x-2 border border-gray-200 p-1 rounded-lg bg-white hover:border-gray-300 transition-colors">
        <div className="relative w-8 h-8 rounded shadow-sm overflow-hidden flex-shrink-0" style={{ backgroundColor: value }}>
          <input 
            type="color" 
            value={value} 
            onChange={e => onChange(e.target.value)} 
            className="absolute -top-2 -left-2 w-16 h-16 opacity-0 cursor-pointer" 
          />
        </div>
        <input 
           type="text" 
           value={value} 
           onChange={e => onChange(e.target.value)}
           className="text-xs font-mono text-gray-900 w-full outline-none uppercase bg-transparent"
        />
      </div>
    </div>
  );

  const ToggleSwitch = ({ checked, onChange, label }: { checked: boolean, onChange: (c: boolean) => void, label: string }) => (
    <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
      <span className="font-medium text-gray-700 text-sm">{label}</span>
      <div 
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${checked ? 'bg-vnpt-primary' : 'bg-gray-300'}`}
      >
        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${checked ? 'translate-x-5' : ''}`}></div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-gray-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-[fadeIn_0.2s]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col h-[85vh] md:h-auto md:max-h-[85vh]">
        
        {/* Header */}
        <div className="bg-white px-6 py-5 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Cấu hình hiển thị</h3>
            <p className="text-xs text-gray-500 mt-0.5">Tùy chỉnh giao diện bảng và màu sắc</p>
          </div>
          <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 bg-white px-6 space-x-6">
          {[
            { id: 'styles', label: 'Màu sắc & Giao diện' },
            { id: 'conditional', label: 'Định dạng điều kiện' },
            { id: 'instructors', label: 'Màu Giảng viên' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)} 
              className={`py-4 text-sm font-bold border-b-2 transition-colors ${
                activeTab === tab.id 
                ? 'text-vnpt-primary border-vnpt-primary' 
                : 'text-gray-400 border-transparent hover:text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50 custom-scrollbar">
          
          {/* TAB 1: STYLES */}
          {activeTab === 'styles' && (
            <div className="space-y-6">
              
              <ToggleSwitch 
                label="Bật chế độ tô màu xen kẽ dòng (Zebra Striping)"
                checked={localConfig.isEnabledAlternating}
                onChange={(v) => setLocalConfig(p => ({...p, isEnabledAlternating: v}))}
              />

              {localConfig.isEnabledAlternating && (
                <div className="animate-[fadeIn_0.3s]">
                  <div className="mb-6">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-3">Thư viện mẫu (Presets)</label>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {PRESETS.map((p, idx) => (
                        <button 
                          key={idx}
                          onClick={() => applyPreset(p)}
                          className="group relative border border-gray-200 rounded-lg overflow-hidden hover:ring-2 hover:ring-vnpt-primary transition-all text-left"
                        >
                          <div className="h-6 w-full" style={{ backgroundColor: p.headerBg }}></div>
                          <div className="h-4 w-full" style={{ backgroundColor: p.odd }}></div>
                          <div className="h-4 w-full" style={{ backgroundColor: p.even }}></div>
                          <div className="p-2 bg-white text-[10px] font-bold text-gray-600 text-center">{p.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                     <ColorPickerInput 
                        label="Nền Header" 
                        value={localConfig.alternatingColor.headerBg} 
                        onChange={v => setLocalConfig(p => ({...p, alternatingColor: {...p.alternatingColor, headerBg: v}}))} 
                     />
                     <ColorPickerInput 
                        label="Chữ Header" 
                        value={localConfig.alternatingColor.headerText} 
                        onChange={v => setLocalConfig(p => ({...p, alternatingColor: {...p.alternatingColor, headerText: v}}))} 
                     />
                     <ColorPickerInput 
                        label="Nền dòng Lẻ" 
                        value={localConfig.alternatingColor.oddRowBg} 
                        onChange={v => setLocalConfig(p => ({...p, alternatingColor: {...p.alternatingColor, oddRowBg: v}}))} 
                     />
                     <ColorPickerInput 
                        label="Nền dòng Chẵn" 
                        value={localConfig.alternatingColor.evenRowBg} 
                        onChange={v => setLocalConfig(p => ({...p, alternatingColor: {...p.alternatingColor, evenRowBg: v}}))} 
                     />
                  </div>

                  {/* Preview */}
                  <div className="mt-6">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Xem trước</label>
                    <div className="rounded-lg overflow-hidden border border-gray-300 shadow-sm">
                      <div className="px-4 py-3 font-bold text-sm flex justify-between" style={{ backgroundColor: localConfig.alternatingColor.headerBg, color: localConfig.alternatingColor.headerText }}>
                        <span>STT</span><span>Nội dung mô phỏng</span><span>Trạng thái</span>
                      </div>
                      <div className="px-4 py-3 text-sm flex justify-between" style={{ backgroundColor: localConfig.alternatingColor.oddRowBg }}>
                        <span>01</span><span>Dữ liệu dòng lẻ...</span><span>Active</span>
                      </div>
                      <div className="px-4 py-3 text-sm flex justify-between" style={{ backgroundColor: localConfig.alternatingColor.evenRowBg }}>
                        <span>02</span><span>Dữ liệu dòng chẵn...</span><span>Pending</span>
                      </div>
                      <div className="px-4 py-3 text-sm flex justify-between" style={{ backgroundColor: localConfig.alternatingColor.oddRowBg }}>
                        <span>03</span><span>Dữ liệu dòng lẻ...</span><span>Closed</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CONDITIONAL RULES */}
          {activeTab === 'conditional' && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h4 className="font-bold text-sm text-gray-800 mb-4 flex items-center">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-vnpt-primary flex items-center justify-center mr-2 text-xs">1</span>
                  Thiết lập điều kiện mới
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4">
                   <div className="md:col-span-4">
                     <select 
                        className="w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-vnpt-primary outline-none bg-white text-gray-900"
                        value={newRule.condition}
                        onChange={e => setNewRule({...newRule, condition: e.target.value as any})}
                     >
                       <option value="contains">Văn bản chứa (Contains)</option>
                       <option value="equals">Bằng chính xác (Equals)</option>
                       <option value="starts_with">Bắt đầu bằng (Starts with)</option>
                       <option value="greater_than">Lớn hơn (&gt;)</option>
                       <option value="less_than">Nhỏ hơn (&lt;)</option>
                     </select>
                   </div>
                   <div className="md:col-span-8">
                     <input 
                        placeholder="Nhập giá trị cần kiểm tra..." 
                        className="w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-vnpt-primary outline-none bg-white text-gray-900"
                        value={newRule.value}
                        onChange={e => setNewRule({...newRule, value: e.target.value})}
                     />
                   </div>
                </div>

                <div className="flex flex-wrap items-end gap-4 border-t border-gray-100 pt-4">
                   <ColorPickerInput label="Màu nền" value={newRule.backgroundColor} onChange={v => setNewRule({...newRule, backgroundColor: v})} />
                   <ColorPickerInput label="Màu chữ" value={newRule.textColor} onChange={v => setNewRule({...newRule, textColor: v})} />
                   
                   <label className="flex items-center space-x-2 cursor-pointer bg-gray-100 px-3 py-2 rounded-lg border border-gray-200 h-[42px] mb-[1px]">
                      <input type="checkbox" checked={newRule.bold} onChange={e => setNewRule({...newRule, bold: e.target.checked})} className="rounded text-vnpt-primary focus:ring-0" />
                      <span className="text-sm font-medium text-gray-700">In đậm</span>
                   </label>

                   <button onClick={addRule} className="ml-auto bg-vnpt-primary text-white text-sm font-bold px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-shadow shadow-md">
                     + Thêm quy tắc
                   </button>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-sm text-gray-500 uppercase mb-3 px-1">Danh sách quy tắc ({localConfig.conditionalRules.length})</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                   {localConfig.conditionalRules.map((rule, idx) => (
                     <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-white shadow-sm group hover:border-blue-300 transition-colors">
                        <div className="flex items-center space-x-3 text-sm">
                           <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-mono border border-gray-200">
                             {rule.condition === 'contains' ? 'Chứa' : rule.condition}
                           </span>
                           <span className="font-bold text-gray-800 text-base">"{rule.value}"</span>
                           <span className="text-gray-400">&rarr;</span>
                           <span 
                              className="px-3 py-1 rounded border text-xs shadow-sm" 
                              style={{ backgroundColor: rule.backgroundColor, color: rule.textColor, fontWeight: rule.bold ? 'bold' : 'normal' }}
                           >
                             AaBbCc 123
                           </span>
                        </div>
                        <button onClick={() => removeRule(idx)} className="text-gray-400 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                     </div>
                   ))}
                   {localConfig.conditionalRules.length === 0 && (
                     <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                       <p className="text-gray-400 text-sm">Chưa có quy tắc nào được thiết lập.</p>
                     </div>
                   )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INSTRUCTOR COLORS */}
          {activeTab === 'instructors' && (
            <div className="flex flex-col h-full">
               <div className="relative mb-4">
                  <input 
                    placeholder="Tìm kiếm giảng viên..." 
                    className="w-full border border-gray-300 pl-10 pr-4 py-3 rounded-lg text-sm focus:ring-2 focus:ring-vnpt-primary outline-none shadow-sm bg-white text-gray-900"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto pb-4 pr-1 custom-scrollbar">
                  {instructors.filter(i => i.toLowerCase().includes(searchTerm.toLowerCase())).map(inst => {
                    const currentColor = localConfig.instructorColors[inst];
                    const hasColor = !!currentColor;
                    
                    return (
                    <div key={inst} className={`flex items-center justify-between p-3 border rounded-lg transition-all ${hasColor ? 'bg-white border-blue-200 shadow-sm' : 'bg-gray-50 border-gray-100'}`}>
                       <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${hasColor ? 'text-white shadow-sm' : 'bg-gray-200 text-gray-500'}`} style={{ backgroundColor: hasColor ? currentColor : undefined }}>
                            {inst.charAt(0).toUpperCase()}
                          </div>
                          <span className={`text-sm font-medium ${hasColor ? 'text-gray-900' : 'text-gray-500'}`}>{inst}</span>
                       </div>
                       
                       <div className="flex items-center space-x-2 bg-white rounded-md p-1 border border-gray-100 shadow-sm">
                          <div className="relative w-6 h-6 rounded-full overflow-hidden border border-gray-200 cursor-pointer hover:scale-110 transition-transform" style={{ backgroundColor: currentColor || '#ffffff' }}>
                             <input 
                                type="color" 
                                value={currentColor || '#ffffff'} 
                                onChange={e => updateInstructorColor(inst, e.target.value)}
                                className="absolute -top-4 -left-4 w-16 h-16 cursor-pointer opacity-0"
                             />
                          </div>
                          {hasColor && (
                            <button onClick={() => {
                                const curr = {...localConfig.instructorColors};
                                delete curr[inst];
                                setLocalConfig(p => ({...p, instructorColors: curr}));
                            }} className="text-gray-400 hover:text-red-500 px-1">
                               <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </button>
                          )}
                       </div>
                    </div>
                  )})}
               </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-5 bg-white border-t border-gray-200 flex justify-end space-x-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100 transition-colors">Hủy bỏ</button>
          <button 
             onClick={handleSave} 
             disabled={saving}
             className="px-6 py-2.5 rounded-lg bg-vnpt-primary text-white font-bold hover:bg-blue-700 disabled:opacity-50 shadow-lg hover:shadow-xl transition-all flex items-center"
          >
             {saving && <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
             {saving ? 'Đang lưu...' : 'Lưu Cấu Hình'}
          </button>
        </div>
      </div>
    </div>
  );
};
