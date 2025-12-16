
import React, { useState, useEffect } from 'react';
import { AppState, SapOrderItem, VendorSummary, TabType, ComparisonReportData, VendorContact, Supplier } from './types';
import { FileUpload } from './components/FileUpload';
import Dashboard from './components/Dashboard';
import EmailGenerator from './components/EmailGenerator';
import ComparisonReport from './components/ComparisonReport';
import { SettingsModal } from './components/SettingsModal';
import { compareDatasets } from './utils/comparison';
import { getContactsFromFirebase, saveOrdersToFirebase, getOrdersFromFirebase, upsertSuppliersFromExcel } from './services/firebase';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [data, setData] = useState<SapOrderItem[]>([]);
  const [contacts, setContacts] = useState<Record<string, VendorContact>>({});
  const [selectedVendor, setSelectedVendor] = useState<VendorSummary | null>(null);
  const [processedVendorIds, setProcessedVendorIds] = useState<Set<string>>(new Set());
  const [askedVendorIds, setAskedVendorIds] = useState<Set<string>>(new Set());
  const [initialTab, setInitialTab] = useState<TabType>('email');
  
  // Auth & Settings State
  const [apiKey, setApiKey] = useState<string>('');
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [warningThreshold, setWarningThreshold] = useState<number>(7); 
  
  // Loading States
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false); // New Offline State

  // Comparison Data
  const [comparisonResult, setComparisonResult] = useState<ComparisonReportData | null>(null);

  useEffect(() => {
    // 1. Check LocalStorage for User Provided Key
    const localKey = localStorage.getItem('gemini_api_key');
    const envKey = process.env.API_KEY;
    const activeKey = localKey || envKey;

    if (activeKey) {
        setApiKey(activeKey);
        setApiKeyMissing(false);
    } else {
        setApiKeyMissing(true);
    }
    
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }

    // 2. Load Data from Firebase on Init
    const initData = async () => {
      setIsDbLoading(true);
      try {
        const [dbContacts, dbOrders] = await Promise.all([
          getContactsFromFirebase(),
          getOrdersFromFirebase()
        ]);

        if (dbOrders.length > 0) {
          const processedData = recalculateStatus(dbOrders, warningThreshold);
          setData(processedData);
          setContacts(dbContacts);
          setAppState(AppState.DASHBOARD);
        } else if (Object.keys(dbContacts).length > 0) {
           setContacts(dbContacts);
        }
        setIsOffline(false);
      } catch (error: any) {
        console.warn("Firebase connection failed, switching to offline mode:", error);
        // If API is disabled or permissions denied, we work offline
        setIsOffline(true);
      } finally {
        setIsDbLoading(false);
      }
    };

    initData();
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
          if (item.kalanGun < 0) {
              status = 'critical';
          } else if (item.kalanGun <= threshold) {
              status = 'warning';
          }
          return { ...item, status };
      });
  };

  const handleDataLoaded = async (loadedData: SapOrderItem[], loadedContacts: Record<string, VendorContact>, suppliers: Supplier[], fileName: string) => {
    const processedData = recalculateStatus(loadedData, warningThreshold);
    setData(processedData);
    
    // Optimistic UI update with loaded contacts first
    let finalContacts = { ...contacts, ...loadedContacts };
    
    setAppState(AppState.DASHBOARD);
    setProcessedVendorIds(new Set());
    setAskedVendorIds(new Set());

    // Sync to Firebase if online
    if (!isOffline) {
      try {
        console.log("Syncing to Firebase...");
        
        // 1. Sync Suppliers (Upsert Logic)
        if (suppliers.length > 0) {
            await upsertSuppliersFromExcel(suppliers, fileName);
            // 2. Refresh contacts from DB to ensure we have the absolute latest source of truth (merging previous DB data + new excel data)
            const refreshedContacts = await getContactsFromFirebase();
            finalContacts = { ...finalContacts, ...refreshedContacts };
        }
        
        // 3. Sync Orders
        await saveOrdersToFirebase(processedData);
        
        console.log("Sync complete.");
      } catch (e) {
        console.error("Firebase save error:", e);
        setIsOffline(true); 
      }
    }
    
    setContacts(finalContacts);
  };
  
  const handleCompareLoaded = (oldData: SapOrderItem[], newData: SapOrderItem[]) => {
      const processedNewData = recalculateStatus(newData, warningThreshold);
      const report = compareDatasets(oldData, processedNewData);
      setComparisonResult(report);
      setData(processedNewData); 
      setAppState(AppState.COMPARISON);
  };

  const handleSettingsSave = (newThreshold: number, newApiKey?: string) => {
      setWarningThreshold(newThreshold);
      
      if (newApiKey !== undefined) {
          if (newApiKey.trim() === '') {
              localStorage.removeItem('gemini_api_key');
              const envKey = process.env.API_KEY;
              if (envKey) {
                  setApiKey(envKey);
                  setApiKeyMissing(false);
              } else {
                  setApiKey('');
                  setApiKeyMissing(true);
              }
          } else {
              localStorage.setItem('gemini_api_key', newApiKey);
              setApiKey(newApiKey);
              setApiKeyMissing(false);
          }
      }
      
      if (data.length > 0) {
          const updatedData = recalculateStatus(data, newThreshold);
          setData(updatedData);
          if (selectedVendor) {
             const updatedVendorItems = recalculateStatus(selectedVendor.items, newThreshold);
             setSelectedVendor({
                 ...selectedVendor,
                 items: updatedVendorItems,
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

  const handleUpdateItem = async (saBelgesi: string, sasKalemNo: string, newDate: string) => {
    // 1. Update Local State
    const updatedData = data.map(item => {
        if (item.saBelgesi === saBelgesi && (item.sasKalemNo === sasKalemNo || !sasKalemNo)) {
             return { ...item, revizeTarih: newDate };
        }
        return item;
    });
    setData(updatedData);
    
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

    // 2. Sync specific item to Firebase (Optimization: Save only the modified one)
    if (!isOffline) {
        const modifiedItem = updatedData.find(item => item.saBelgesi === saBelgesi && (item.sasKalemNo === sasKalemNo || !sasKalemNo));
        if (modifiedItem) {
            try {
                await saveOrdersToFirebase([modifiedItem]);
            } catch (e) {
                console.error("Failed to sync item update:", e);
                // Optionally switch to offline mode here too, but silent fail is often better for UX during typing
            }
        }
    }
  };

  const handleUpdateNote = async (saBelgesi: string, sasKalemNo: string, note: string) => {
    const updatedData = data.map(item => {
        if (item.saBelgesi === saBelgesi && (item.sasKalemNo === sasKalemNo || !sasKalemNo)) {
             return { ...item, aciklama: note };
        }
        return item;
    });
    setData(updatedData);
    
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

    if (!isOffline) {
        const modifiedItem = updatedData.find(item => item.saBelgesi === saBelgesi && (item.sasKalemNo === sasKalemNo || !sasKalemNo));
        if (modifiedItem) {
            try {
                await saveOrdersToFirebase([modifiedItem]);
            } catch (e) {
                console.error("Failed to sync note update:", e);
            }
        }
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
    const wscols = Object.keys(exportData[0] || {}).map(key => ({ wch: Math.max(key.length + 5, 15) }));
    ws['!cols'] = wscols;

    window.XLSX.utils.book_append_sheet(wb, ws, "Genel Rapor");
    const dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '_');
    window.XLSX.writeFile(wb, `koluman_siparis_takip_${dateStr}.xlsx`);
  };

  if (apiKeyMissing) {
     return (
       <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
         <SettingsModal 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)} 
            currentThreshold={warningThreshold}
            currentApiKey={apiKey}
            onSave={handleSettingsSave}
         />
         <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg border border-red-100 dark:border-red-900/30 max-w-md w-full text-center">
            <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">API Anahtarı Eksik</h2>
            <p className="text-slate-600 dark:text-slate-300 mb-6">Uygulamayı çalıştırmak için lütfen bir Google Gemini API anahtarı girin.</p>
            <div className="flex flex-col gap-3">
                <button 
                    onClick={() => setIsSettingsOpen(true)} 
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
                >
                    Ayarları Aç ve Anahtar Gir
                </button>
                <button 
                    onClick={() => window.location.reload()} 
                    className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition"
                >
                    Sayfayı Yenile
                </button>
            </div>
         </div>
       </div>
     )
  }

  // Show loading screen while DB is initializing
  if (isDbLoading && appState === AppState.UPLOAD) {
      return (
          <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center">
              <div className="flex flex-col items-center animate-pulse">
                  <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-900/50 mb-4">
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12L19.07 8.5A8 8 0 1 0 19.07 15.5L12 12Z" /></svg>
                  </div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white">Veritabanına Bağlanılıyor...</h2>
                  <p className="text-slate-500 dark:text-slate-400 mt-2">Lütfen bekleyin, verileriniz yükleniyor.</p>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col font-sans transition-colors duration-200">
      
      {/* Settings Modal */}
      <SettingsModal 
         isOpen={isSettingsOpen} 
         onClose={() => setIsSettingsOpen(false)} 
         currentThreshold={warningThreshold}
         currentApiKey={apiKey}
         onSave={handleSettingsSave}
      />

      {/* Navbar */}
      <header className="bg-slate-900 dark:bg-slate-950 text-white shadow-md z-20 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-900/50">
               <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                 <path d="M12 12L19.07 8.5A8 8 0 1 0 19.07 15.5L12 12Z" />
               </svg>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Koluman Sipariş Takip</h1>
            {isOffline && (
                <span className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded border border-slate-600 ml-2 flex items-center gap-1" title="Veritabanı bağlantısı yok, veriler sadece bu oturumda saklanır.">
                    <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                    Çevrimdışı Mod
                </span>
            )}
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
        {/* Offline Warning Banner */}
        {isOffline && appState === AppState.UPLOAD && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-3 text-amber-800 dark:text-amber-200">
                <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                <div>
                    <p className="font-bold text-sm">Çevrimdışı Mod (Veritabanı Bağlantısı Yok)</p>
                    <p className="text-xs mt-0.5 opacity-90">Google Cloud Firestore API etkinleştirilmemiş veya ağ hatası var. Dosya yükleyip çalışabilirsiniz ancak verileriniz kalıcı olarak kaydedilmeyecektir.</p>
                </div>
            </div>
        )}

        {appState === AppState.UPLOAD && (
          <FileUpload 
            onDataLoaded={handleDataLoaded} 
            onCompareLoaded={handleCompareLoaded}
          />
        )}

        {appState === AppState.DASHBOARD && (
          <Dashboard 
            data={data} 
            contacts={contacts}
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
            warningThreshold={warningThreshold} 
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
