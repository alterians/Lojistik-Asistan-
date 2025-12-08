
import React, { useState, useEffect } from 'react';
import { AppState, SapOrderItem, VendorSummary, TabType, ComparisonReportData } from './types';
import { FileUpload } from './components/FileUpload';
import Dashboard from './components/Dashboard';
import EmailGenerator from './components/EmailGenerator';
import ComparisonReport from './components/ComparisonReport';
import { SettingsModal } from './components/SettingsModal'; // Import Settings Modal
import { compareDatasets } from './utils/comparison';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [data, setData] = useState<SapOrderItem[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<VendorSummary | null>(null);
  const [processedVendorIds, setProcessedVendorIds] = useState<Set<string>>(new Set());
  const [askedVendorIds, setAskedVendorIds] = useState<Set<string>>(new Set());
  const [initialTab, setInitialTab] = useState<TabType>('email');
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [warningThreshold, setWarningThreshold] = useState<number>(7); // Default 7 days
  
  // Comparison Data
  const [comparisonResult, setComparisonResult] = useState<ComparisonReportData | null>(null);

  useEffect(() => {
    // Check for API Key on mount
    if (!process.env.API_KEY) {
      setApiKeyMissing(true);
    }
    
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  // --- Recalculate Logic ---
  const recalculateStatus = (items: SapOrderItem[], threshold: number): SapOrderItem[] => {
      return items.map(item => {
          let status: 'critical' | 'warning' | 'ok' = 'ok';
          // Logic: Negative is critical, 0 to Threshold is warning
          if (item.kalanGun < 0) {
              status = 'critical';
          } else if (item.kalanGun <= threshold) {
              status = 'warning';
          }
          return { ...item, status };
      });
  };

  const handleDataLoaded = (loadedData: SapOrderItem[]) => {
    // Apply current threshold immediately upon load
    const processedData = recalculateStatus(loadedData, warningThreshold);
    setData(processedData);
    setAppState(AppState.DASHBOARD);
    setProcessedVendorIds(new Set());
    setAskedVendorIds(new Set());
  };
  
  const handleCompareLoaded = (oldData: SapOrderItem[], newData: SapOrderItem[]) => {
      // Apply threshold to new data in comparison too
      const processedNewData = recalculateStatus(newData, warningThreshold);
      const report = compareDatasets(oldData, processedNewData);
      setComparisonResult(report);
      setData(processedNewData); 
      setAppState(AppState.COMPARISON);
  };

  const handleSettingsSave = (newThreshold: number) => {
      setWarningThreshold(newThreshold);
      
      // Update existing data if loaded
      if (data.length > 0) {
          const updatedData = recalculateStatus(data, newThreshold);
          setData(updatedData);
          
          // If a vendor is currently selected, update it too to reflect changes immediately
          if (selectedVendor) {
             const updatedVendorItems = recalculateStatus(selectedVendor.items, newThreshold);
             setSelectedVendor({
                 ...selectedVendor,
                 items: updatedVendorItems,
                 // Re-count stats
                 criticalCount: updatedVendorItems.filter(i => i.status === 'critical').length,
                 warningCount: updatedVendorItems.filter(i => i.status === 'warning').length,
             });
          }
      }
  };

  const handleSelectVendor = (vendor: VendorSummary, tab: TabType = 'orders') => {
    setSelectedVendor(vendor);
    setInitialTab(tab);
    setAppState(AppState.GENERATOR);
  };

  const handleBackToDashboard = () => {
    setSelectedVendor(null);
    setAppState(AppState.DASHBOARD);
  };

  const handleBackToUpload = () => {
    setData([]);
    setComparisonResult(null);
    setAppState(AppState.UPLOAD);
  };

  const handleToggleProcessed = (vendorId: string) => {
    setProcessedVendorIds(prev => {
      const next = new Set(prev);
      if (next.has(vendorId)) {
        next.delete(vendorId);
      } else {
        next.add(vendorId);
      }
      return next;
    });
  };

  const handleToggleAsked = (vendorId: string) => {
    setAskedVendorIds(prev => {
      const next = new Set(prev);
      if (next.has(vendorId)) {
        next.delete(vendorId);
      } else {
        next.add(vendorId);
      }
      return next;
    });
  };

  const handleMarkAsProcessedAndExit = (vendorId: string) => {
     setProcessedVendorIds(prev => {
       const next = new Set(prev);
       next.add(vendorId);
       return next;
     });
     handleBackToDashboard();
  };

  const handleUpdateItem = (saBelgesi: string, sasKalemNo: string, newDate: string) => {
    setData(prevData => prevData.map(item => {
        if (item.saBelgesi === saBelgesi && (item.sasKalemNo === sasKalemNo || !sasKalemNo)) {
             return { ...item, revizeTarih: newDate };
        }
        return item;
    }));
    
    if (selectedVendor) {
        setSelectedVendor(prev => {
            if (!prev) return null;
            return {
                ...prev,
                items: prev.items.map(item => {
                    if (item.saBelgesi === saBelgesi && (item.sasKalemNo === sasKalemNo || !sasKalemNo)) {
                        return { ...item, revizeTarih: newDate };
                    }
                    return item;
                })
            };
        });
    }
  };

  const handleUpdateNote = (saBelgesi: string, sasKalemNo: string, note: string) => {
    setData(prevData => prevData.map(item => {
        if (item.saBelgesi === saBelgesi && (item.sasKalemNo === sasKalemNo || !sasKalemNo)) {
             return { ...item, aciklama: note };
        }
        return item;
    }));
    
    if (selectedVendor) {
        setSelectedVendor(prev => {
            if (!prev) return null;
            return {
                ...prev,
                items: prev.items.map(item => {
                    if (item.saBelgesi === saBelgesi && (item.sasKalemNo === sasKalemNo || !sasKalemNo)) {
                        return { ...item, aciklama: note };
                    }
                    return item;
                })
            };
        });
    }
  };

  const handleDownloadReport = () => {
    if (!window.XLSX) {
      alert("Excel kütüphanesi yüklenemedi.");
      return;
    }

    const exportData = data.map(item => ({
      "SA Belgesi": item.saBelgesi,
      "Kalem": item.sasKalemNo || "",
      "Satıcı Kodu": item.saticiKodu,
      "Satıcı Adı": item.saticiAdi,
      "Malzeme": item.malzeme,
      "Kısa Metin": item.kisaMetin,
      "Miktar": item.sasMiktari,
      "Bakiye": item.bakiyeMiktari,
      "Birim": item.olcuBirimi,
      "Teslimat Tarihi": item.teslimatTarihi || "",
      "Revize Tarih": item.revizeTarih || "",
      "Kalan Gün": item.kalanGun,
      "Talep Eden": item.talepEden,
      "Oluşturan": item.olusturan,
      "Açıklama": item.aciklama || "",
      "İşlendi (Tedarikçi)": processedVendorIds.has(item.saticiKodu) ? "Evet" : "Hayır",
      "Soruldu (Tedarikçi)": askedVendorIds.has(item.saticiKodu) ? "Evet" : "Hayır"
    }));

    const ws = window.XLSX.utils.json_to_sheet(exportData);
    const wb = window.XLSX.utils.book_new();
    // Auto-width for columns
    const wscols = Object.keys(exportData[0] || {}).map(key => ({ wch: Math.max(key.length + 5, 15) }));
    ws['!cols'] = wscols;

    window.XLSX.utils.book_append_sheet(wb, ws, "Genel Rapor");
    const dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '_');
    window.XLSX.writeFile(wb, `koluman_siparis_takip_${dateStr}.xlsx`);
  };

  if (apiKeyMissing) {
     return (
       <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
         <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg border border-red-100 dark:border-red-900/30 max-w-md w-full text-center">
            <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">API Anahtarı Eksik</h2>
            <p className="text-slate-600 dark:text-slate-300 mb-6">Uygulamayı çalıştırmak için lütfen bir Google Gemini API anahtarı seçin veya sağlayın.</p>
            <button 
                onClick={() => window.location.reload()} 
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
            >
                Yeniden Dene
            </button>
         </div>
       </div>
     )
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col font-sans transition-colors duration-200">
      
      {/* Settings Modal */}
      <SettingsModal 
         isOpen={isSettingsOpen} 
         onClose={() => setIsSettingsOpen(false)} 
         currentThreshold={warningThreshold}
         onSave={handleSettingsSave}
      />

      {/* Navbar */}
      <header className="bg-slate-900 dark:bg-slate-950 text-white shadow-md z-20 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Pacman Icon (Orange) */}
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-900/50">
               <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                 {/* Pacman shape: Circle with a slice cut out */}
                 <path d="M12 12L19.07 8.5A8 8 0 1 0 19.07 15.5L12 12Z" />
               </svg>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Koluman Sipariş Takip</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {appState === AppState.DASHBOARD && (
                <div className="hidden sm:flex items-center gap-4 text-sm text-slate-400">
                <div>{data.length} Sipariş Yüklendi</div>
                {processedVendorIds.size > 0 && (
                    <div className="bg-green-900/50 px-2 py-1 rounded text-green-400 border border-green-800">
                    {processedVendorIds.size} Tamamlandı
                    </div>
                )}
                </div>
            )}
            
            {/* Settings Button */}
            <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 group"
                title="Uygulama Ayarları"
            >
                <svg className="w-5 h-5 group-hover:rotate-45 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>

            <button 
                onClick={toggleTheme} 
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
                title={isDarkMode ? "Aydınlık Mod" : "Karanlık Mod"}
            >
                {isDarkMode ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 h-[calc(100vh-4rem)]">
        {appState === AppState.UPLOAD && (
          <FileUpload 
            onDataLoaded={handleDataLoaded} 
            onCompareLoaded={handleCompareLoaded}
          />
        )}

        {appState === AppState.DASHBOARD && (
          <Dashboard 
            data={data} 
            processedVendorIds={processedVendorIds}
            askedVendorIds={askedVendorIds}
            onToggleProcessed={handleToggleProcessed}
            onToggleAsked={handleToggleAsked}
            onSelectVendor={handleSelectVendor} 
            onBack={handleBackToUpload}
            onDownloadReport={handleDownloadReport}
            isDarkMode={isDarkMode}
          />
        )}

        {appState === AppState.GENERATOR && selectedVendor && (
          <EmailGenerator 
            vendor={selectedVendor}
            initialTab={initialTab}
            warningThreshold={warningThreshold} // Pass dynamic threshold
            onBack={handleBackToDashboard} 
            onMarkAsProcessed={() => handleMarkAsProcessedAndExit(selectedVendor.vendorId)}
            onUpdateItem={handleUpdateItem}
            onUpdateNote={handleUpdateNote}
            isDarkMode={isDarkMode}
          />
        )}

        {appState === AppState.COMPARISON && comparisonResult && (
            <ComparisonReport 
                report={comparisonResult}
                onBack={handleBackToUpload}
                isDarkMode={isDarkMode}
            />
        )}
      </main>
    </div>
  );
};

export default App;
