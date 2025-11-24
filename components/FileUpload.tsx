import React, { useCallback, useState } from 'react';
import { parseExcelData } from '../utils/excelParser';
import { SapOrderItem } from '../types';

interface FileUploadProps {
  onDataLoaded: (data: SapOrderItem[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const data = await parseExcelData(file);
      if (data.length === 0) {
        setError("Veri bulunamadı. Lütfen Excel dosyasının doğru formatta olduğundan emin olun.");
      } else {
        onDataLoaded(data);
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
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 bg-white rounded-xl shadow-lg border border-slate-100">
      <div className="text-center mb-6">
        <div className="bg-blue-100 p-4 rounded-full inline-block mb-4">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-800">SAP Raporu Yükle</h2>
        <p className="text-slate-500 mt-2">Açık sipariş listenizi (.xlsx) yükleyerek asistanı başlatın.</p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          border-3 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer
          ${isDragging ? 'border-blue-500 bg-blue-50 scale-105' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}
        `}
        onClick={() => document.getElementById('fileInput')?.click()}
      >
        {loading ? (
          <div className="flex flex-col items-center">
            <svg className="animate-spin h-8 w-8 text-blue-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-blue-600 font-medium">Excel Analiz Ediliyor...</p>
          </div>
        ) : (
          <>
            <p className="text-lg text-slate-700 font-medium">Dosyayı Buraya Bırakın</p>
            <p className="text-sm text-slate-400 mt-1">veya seçmek için tıklayın</p>
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

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center">
          <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {error}
        </div>
      )}
      
      <div className="mt-6 border-t border-slate-100 pt-4">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Otomatik Algılanan Kolonlar</h4>
        <div className="flex flex-wrap gap-2">
          {['SA Belgesi', 'KALAN GÜN', 'Teslimat Tarihi', 'Satıcı Adı', 'Malzeme', 'Kısa Metin', 'Bakiye'].map(tag => (
            <span key={tag} className="px-2 py-1 bg-slate-100 text-slate-500 text-xs rounded-md border border-slate-200">{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FileUpload;