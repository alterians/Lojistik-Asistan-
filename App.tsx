import React, { useState, useEffect } from 'react';
import { AppState, SapOrderItem, VendorSummary, TabType, ComparisonReportData } from './types';
import { FileUpload } from './components/FileUpload';
import Dashboard from './components/Dashboard';
import EmailGenerator from './components/EmailGenerator';
import ComparisonReport from './components/ComparisonReport';
import { compareDatasets } from './utils/comparison';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [data, setData] = useState<SapOrderItem[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<VendorSummary | null>(null);
  const [processedVendorIds, setProcessedVendorIds] = useState<Set<string>>(new Set());
  const [askedVendorIds, setAskedVendorIds] = useState<Set<string>>(new Set()); // New state for "Asked"
  const [initialTab, setInitialTab] = useState<TabType>('email');
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  
  // Comparison Data
  const [comparisonResult, setComparisonResult] = useState<ComparisonReportData | null>(null);

  useEffect(() => {
    // Check for API Key on mount
    if (!process.env.API_KEY) {
      setApiKeyMissing(true);
    }
  }, []);

  const handleDataLoaded = (loadedData: SapOrderItem[]) => {
    setData(loadedData);
    setAppState(AppState.DASHBOARD);
    setProcessedVendorIds(new Set());
    setAskedVendorIds(new Set());
  };
  
  const handleCompareLoaded = (oldData: SapOrderItem[], newData: SapOrderItem[]) => {
      const report = compareDatasets(oldData, newData);
      setComparisonResult(report);
      // We can also set the current data to the new data if user wants to switch context later
      setData(newData); 
      setAppState(AppState.COMPARISON);
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

  // Function to handle manual date updates from the UI
  const handleUpdateItem = (saBelgesi: string, sasKalemNo: string, newDate: string) => {
    setData(prevData => prevData.map(item => {
        // Match by PO and Item Number (fallback to PO+Material if ItemNo is missing, though less accurate)
        const isMatch = (item.saBelgesi === saBelgesi) && 
                        (item.sasKalemNo === sasKalemNo || (!sasKalemNo && item.malzeme === sasKalemNo)); 
        
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

  if (apiKeyMissing) {
     return (
       <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
         <div className="bg-white p-8 rounded-xl shadow-lg border border-red-100 max-w-md w-full text-center">
            <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <h2 className="text-xl font-bold text-slate-800 mb-2">API Anahtarı Eksik</h2>
            <p className="text-slate-600 mb-6">Uygulamayı çalıştırmak için lütfen bir Google Gemini API anahtarı seçin veya sağlayın.</p>
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
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Navbar */}
      <header className="bg-slate-900 text-white shadow-md z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
               <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
            <h1 className="text-xl font-semibold tracking-tight">LojistikAsistanı <span className="text-blue-400 font-light">AI</span></h1>
          </div>
          
          {appState === AppState.DASHBOARD && (
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <div>{data.length} Sipariş Yüklendi</div>
              {processedVendorIds.size > 0 && (
                <div className="bg-green-900/50 px-2 py-1 rounded text-green-400 border border-green-800">
                  {processedVendorIds.size} Tamamlandı
                </div>
              )}
            </div>
          )}
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
          />
        )}

        {appState === AppState.GENERATOR && selectedVendor && (
          <EmailGenerator 
            vendor={selectedVendor}
            initialTab={initialTab}
            onBack={handleBackToDashboard} 
            onMarkAsProcessed={() => handleMarkAsProcessedAndExit(selectedVendor.vendorId)}
            onUpdateItem={handleUpdateItem}
          />
        )}

        {appState === AppState.COMPARISON && comparisonResult && (
            <ComparisonReport 
                report={comparisonResult}
                onBack={handleBackToUpload}
            />
        )}
      </main>
    </div>
  );
};

export default App;