
import React, { useState, useEffect } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentThreshold: number;
  onSave: (newThreshold: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  currentThreshold, 
  onSave 
}) => {
  const [threshold, setThreshold] = useState(currentThreshold);

  useEffect(() => {
    setThreshold(currentThreshold);
  }, [currentThreshold, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(threshold);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 border border-slate-200 dark:border-slate-700">
        
        {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-800 p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Uygulama Ayarları
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Yaklaşan Sipariş Eşiği (Gün)
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Teslimatına kaç gün kalan siparişlerin <span className="text-amber-500 font-bold">Sarı (Yaklaşan)</span> statüsünde görüneceğini belirleyin.
            </p>
            
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                 <input 
                    type="range" 
                    min="1" 
                    max="30" 
                    value={threshold} 
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                 />
                 <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>1 Gün</span>
                    <span>15 Gün</span>
                    <span>30 Gün</span>
                 </div>
              </div>
              
              <div className="w-20">
                <input 
                    type="number" 
                    min="1" 
                    max="90"
                    value={threshold}
                    onChange={(e) => setThreshold(Math.max(1, Number(e.target.value)))}
                    className="w-full text-center border border-slate-300 dark:border-slate-600 rounded-lg py-2 px-3 font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Preview Box */}
            <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Önizleme</div>
                <div className="flex gap-2">
                    <span className="px-3 py-1 rounded bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300 text-xs font-bold border border-red-200 dark:border-red-900">
                        &lt; 0 Geciken
                    </span>
                    <span className="px-3 py-1 rounded bg-yellow-100 dark:bg-amber-400/10 text-yellow-700 dark:text-amber-300 text-xs font-bold border border-yellow-200 dark:border-amber-400/20">
                        0 - {threshold} Yaklaşan
                    </span>
                    <span className="px-3 py-1 rounded bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs font-bold border border-green-200 dark:border-green-900">
                        &gt; {threshold} Sorun Yok
                    </span>
                </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            İptal
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
          >
            Kaydet ve Uygula
          </button>
        </div>
      </div>
    </div>
  );
};
