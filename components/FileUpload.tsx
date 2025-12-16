
import React, { useCallback, useState } from 'react';
import { parseExcelData } from '../utils/excelParser';
import { SapOrderItem, VendorContact, Supplier } from '../types';

interface FileUploadProps {
  onDataLoaded: (data: SapOrderItem[], contacts: Record<string, VendorContact>, suppliers: Supplier[], fileName: string) => void;
  onCompareLoaded: (oldData: SapOrderItem[], newData: SapOrderItem[]) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, onCompareLoaded }) => {
  const [mode, setMode] = useState<'single' | 'compare'>('single');
  
  // Single Mode State
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compare Mode State
  const [oldFile, setOldFile] = useState<File | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // --- Single File Logic ---
  const processFile = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const { items, contacts, suppliers } = await parseExcelData(file);
      if (items.length === 0) {
        setError("Veri bulunamadı. Lütfen Excel dosyasının doğru formatta olduğundan emin olun.");
      } else {
        onDataLoaded(items, contacts, suppliers, file.name);
      }
    } catch (err) {
      setError("Dosya işlenirken bir hata oluştu. Lütfen dosya formatını kontrol edin.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (mode === 'single') {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          processFile(files[0]);
        }
    }
  }, [mode]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  // --- Compare Logic ---
  const handleCompare = async () => {
    if (!oldFile || !newFile) return;
    setCompareLoading(true);
    setError(null);
    try {
        const oldResult = await parseExcelData(oldFile);
        const newResult = await parseExcelData(newFile);
        onCompareLoaded(oldResult.items, newResult.items);
    } catch (err) {
        setError("Dosyalar işlenirken hata oluştu.");
    } finally {
        setCompareLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10">
        
      {/* Tabs */}
      <div className="flex bg-white dark:bg-slate-800 rounded-t-xl overflow-hidden border-b border-slate-200 dark:border-slate-700">
        <button 
            onClick={() => setMode('single')}
            className={`flex-1 py-3 text-sm font-bold transition ${mode === 'single' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
        >
            Tek Rapor Yükle
        </button>
        <button 
            onClick={() => setMode('compare')}
            className={`flex-1 py-3 text-sm font-bold transition ${mode === 'compare' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
        >
            Rapor Karşılaştır
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-b-xl shadow-lg border border-slate-100 dark:border-slate-700">
        
        {mode === 'single' ? (
            <>
                <div className="text-center mb-6">
                    <div className="bg-blue-100 dark:bg-blue-900/50 p-4 rounded-full inline-block mb-4">
                    <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">SAP Raporu Yükle</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">Açık sipariş listenizi (.xlsx) yükleyerek asistanı başlatın.<br/><span className="text-xs text-blue-500">Not: 'TEDARİKCİ LIST' sayfası varsa iletişim bilgileri otomatik alınır.</span></p>
                </div>

                <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`
                    border-3 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer
                    ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-105' : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}
                    `}
                    onClick={() => document.getElementById('fileInput')?.click()}
                >
                    {loading ? (
                    <div className="flex flex-col items-center">
                        <svg className="animate-spin h-8 w-8 text-blue-600 dark:text-blue-400 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-blue-600 dark:text-blue-400 font-medium">Excel Analiz Ediliyor...</p>
                    </div>
                    ) : (
                    <>
                        <p className="text-lg text-slate-700 dark:text-slate-200 font-medium">Dosyayı Buraya Bırakın</p>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">veya seçmek için tıklayın</p>
                    </>
                    )}
                    <input 
                    id="fileInput" 
                    type="file" 
                    accept=".xlsx, .xls" 
                    className="hidden" 
                    onChange={handleFileInput}
                    />
                </div>
            </>
        ) : (
            <div className="space-y-6">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Rapor Fark Analizi</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">Dün ve bugünün raporunu yükleyerek aradaki farkları (Gelen/Giden/Değişen) görün.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="border border-slate-200 dark:border-slate-600 rounded-lg p-4 bg-slate-50 dark:bg-slate-700/50 hover:bg-white dark:hover:bg-slate-700 transition-colors">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Eski Rapor (Dün)</label>
                        <div className="relative">
                            <input 
                                type="file" 
                                accept=".xlsx"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={(e) => e.target.files && setOldFile(e.target.files[0])}
                            />
                            <div className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-sm text-slate-600 dark:text-slate-300">
                                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                <span className="truncate">{oldFile ? oldFile.name : "Dosya Seç..."}</span>
                            </div>
                        </div>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-600 rounded-lg p-4 bg-slate-50 dark:bg-slate-700/50 hover:bg-white dark:hover:bg-slate-700 transition-colors">
                        <label className="block text-xs font-bold text-blue-500 dark:text-blue-400 uppercase mb-2">Yeni Rapor (Bugün)</label>
                        <div className="relative">
                             <input 
                                type="file" 
                                accept=".xlsx"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={(e) => e.target.files && setNewFile(e.target.files[0])}
                            />
                            <div className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-500 rounded text-sm text-slate-600 dark:text-slate-300 shadow-sm ring-1 ring-blue-100 dark:ring-blue-900/30">
                                <svg className="w-5 h-5 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                <span className="truncate">{newFile ? newFile.name : "Dosya Seç..."}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <button 
                    onClick={handleCompare}
                    disabled={!oldFile || !newFile || compareLoading}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {compareLoading ? (
                        <>
                          <svg className="animate-spin w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          Karşılaştırılıyor...
                        </>
                    ) : "Farkları Analiz Et"}
                </button>
            </div>
        )}

        {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm flex items-center">
            <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
            </div>
        )}
      
        <div className="mt-6 border-t border-slate-100 dark:border-slate-700 pt-4">
            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Otomatik Algılanan Kolonlar</h4>
            <div className="flex flex-wrap gap-2">
            {['SA Belgesi', 'KALAN GÜN', 'Teslimat Tarihi', 'Satıcı Adı', 'Malzeme', 'Kısa Metin', 'TEDARİKCİ LIST (Opsiyonel)'].map(tag => (
                <span key={tag} className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs rounded-md border border-slate-200 dark:border-slate-600">{tag}</span>
            ))}
            </div>
        </div>
    </div>
  );
};
