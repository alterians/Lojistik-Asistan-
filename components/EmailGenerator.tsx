
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { VendorSummary, ChatMessage, TabType, SapOrderItem } from '../types';
import { generateEmailDraft, refineEmail } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface EmailGeneratorProps {
  vendor: VendorSummary;
  initialTab?: TabType;
  onBack: () => void;
  onMarkAsProcessed: () => void;
  onUpdateItem: (saBelgesi: string, sasKalemNo: string, newDate: string) => void;
}

type SortKey = keyof SapOrderItem;
type SortDirection = 'asc' | 'desc';

const EmailGenerator: React.FC<EmailGeneratorProps> = ({ 
  vendor, 
  initialTab = 'email', 
  onBack, 
  onMarkAsProcessed,
  onUpdateItem
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [emailContent, setEmailContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>({
    key: 'kalanGun',
    direction: 'asc'
  });

  // Reset tab when vendor changes (optional but good for consistency if component is recycled)
  useEffect(() => {
      setActiveTab(initialTab);
      setEmailContent(''); // Clear previous email if any
      setChatHistory([]);
      setSortConfig({ key: 'kalanGun', direction: 'asc' });
  }, [vendor, initialTab]);

  const generateDraft = async () => {
    setLoading(true);
    setChatHistory([]);
    try {
        const draft = await generateEmailDraft(vendor.vendorName, vendor.items);
        setEmailContent(draft);
        setChatHistory([
          { role: 'model', text: "Taslağı hazırladım. Aşağıdaki panelden düzenleme yapabilir veya dosyayı indirebilirsiniz.", timestamp: new Date() }
        ]);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, activeTab]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const userMsg = inputMessage;
    setInputMessage('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg, timestamp: new Date() }]);
    setLoading(true);

    try {
      const refinedDraft = await refineEmail(emailContent, userMsg);
      setEmailContent(refinedDraft);
      setChatHistory(prev => [...prev, { role: 'model', text: "E-posta içeriğini güncelledim.", timestamp: new Date() }]);
    } catch (e) {
      setChatHistory(prev => [...prev, { role: 'model', text: "Üzgünüm, bir hata oluştu.", timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(emailContent);
  };
  
  const downloadMarkdown = () => {
    const element = document.createElement("a");
    const file = new Blob([emailContent], {type: 'text/markdown'});
    element.href = URL.createObjectURL(file);
    const safeName = vendor.vendorName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    element.download = `mail_draft_${safeName}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const downloadUpdatedExcel = () => {
    if (!window.XLSX) {
        alert("Excel kütüphanesi yüklenemedi.");
        return;
    }

    // Filter items that have a revised date
    const updatedItems = vendor.items.filter(item => item.revizeTarih);
    
    if (updatedItems.length === 0) {
        alert("Henüz güncellenmiş bir tarih yok. Lütfen listeden teslim tarihlerini güncelleyin.");
        return;
    }

    // Format for Export: SAS No | Kalem No | Teslim Tarihi
    const exportData = updatedItems.map(item => ({
        "SAS No": item.saBelgesi,
        "Kalem No": item.sasKalemNo || "10", // Default to 10 if missing, but usually parser catches it
        "Teslim Tarihi": item.revizeTarih
    }));

    const ws = window.XLSX.utils.json_to_sheet(exportData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Guncel Terminler");
    
    const safeName = vendor.vendorName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    window.XLSX.writeFile(wb, `termin_guncelleme_${safeName}.xlsx`);
  };

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedItems = useMemo(() => {
    let items = [...vendor.items];
    if (sortConfig !== null) {
      items.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        // Handle undefined/null
        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return items;
  }, [vendor.items, sortConfig]);

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortConfig?.key !== columnKey) return <span className="ml-1 text-slate-300">↕</span>;
    return <span className="ml-1 text-blue-600">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  // Analytics Calculations
  const stats = useMemo(() => {
    const total = vendor.items.length;
    const critical = vendor.items.filter(i => i.status === 'critical').length;
    const warning = vendor.items.filter(i => i.status === 'warning').length;
    const ok = total - critical - warning;
    
    // Avg delay for delayed items
    const delayedItems = vendor.items.filter(i => i.kalanGun < 0);
    const avgDelay = delayedItems.length 
        ? Math.round(delayedItems.reduce((acc, i) => acc + Math.abs(i.kalanGun), 0) / delayedItems.length) 
        : 0;

    const pieData = [
        { name: 'Gecikmiş', value: critical, color: '#ef4444' },
        { name: 'Yaklaşan', value: warning, color: '#f59e0b' },
        { name: 'Normal', value: ok, color: '#10b981' }
    ].filter(d => d.value > 0);

    const sortedByDelay = [...vendor.items]
        .filter(i => i.status === 'critical')
        .sort((a, b) => a.kalanGun - b.kalanGun)
        .slice(0, 7)
        .map(i => ({
            name: i.saBelgesi,
            gun: Math.abs(i.kalanGun),
            desc: `${i.malzeme} - ${i.kisaMetin}`
        }));

    return { total, critical, warning, ok, avgDelay, pieData, sortedByDelay };
  }, [vendor]);

  // Count modified items
  const modifiedCount = vendor.items.filter(i => i.revizeTarih).length;

  return (
    <div className="h-full flex flex-col gap-6">
      
      {/* Header Area */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
           <button 
              onClick={onBack} 
              className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              Geri
            </button>
            <div>
                <h2 className="text-xl font-bold text-slate-800 leading-tight">{vendor.vendorName}</h2>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                    <span>{vendor.vendorId}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span>{stats.total} Sipariş</span>
                    {stats.critical > 0 && <span className="text-red-500 font-medium">({stats.critical} Gecikme)</span>}
                </div>
            </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto md:justify-end">
             {/* Dynamic Buttons based on Tab */}
             {activeTab === 'email' && emailContent && (
                 <>
                    <button onClick={downloadMarkdown} className="px-3 py-2 text-sm bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-1 shadow-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        <span className="hidden lg:inline">İndir (.md)</span>
                    </button>
                    <button onClick={copyToClipboard} className="px-3 py-2 text-sm bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 flex items-center gap-1 shadow-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                        <span className="hidden lg:inline">Kopyala</span>
                    </button>
                 </>
             )}
             
             {activeTab === 'orders' && (
                <button 
                  onClick={downloadUpdatedExcel} 
                  className={`px-3 py-2 text-sm border rounded-lg flex items-center gap-1 shadow-sm transition ${
                      modifiedCount > 0 
                      ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' 
                      : 'bg-white text-slate-400 border-slate-200 cursor-not-allowed'
                  }`}
                  disabled={modifiedCount === 0}
                  title={modifiedCount === 0 ? "İndirmek için tablodan tarih güncelleyin" : `${modifiedCount} güncellemeyi indir`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    <span className="hidden lg:inline">Excel (Yükleme Formatı)</span>
                    {modifiedCount > 0 && <span className="bg-white/20 px-1.5 rounded text-xs ml-1">{modifiedCount}</span>}
                </button>
             )}

            <button 
              onClick={onMarkAsProcessed}
              className="flex-1 md:flex-none px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-1 shadow-sm transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              Tamamla & Çık
            </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-6 px-2">
          <button 
            onClick={() => setActiveTab('email')}
            className={`pb-3 px-1 text-sm font-medium transition-colors relative ${activeTab === 'email' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
             E-posta Taslağı
             {activeTab === 'email' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></span>}
          </button>
          <button 
            onClick={() => setActiveTab('orders')}
            className={`pb-3 px-1 text-sm font-medium transition-colors relative ${activeTab === 'orders' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
             Sipariş Listesi
             {activeTab === 'orders' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></span>}
          </button>
          <button 
            onClick={() => setActiveTab('analysis')}
            className={`pb-3 px-1 text-sm font-medium transition-colors relative ${activeTab === 'analysis' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
             Analiz Raporu
             {activeTab === 'analysis' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></span>}
          </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0">
          
          {/* EMAIL TAB */}
          {activeTab === 'email' && (
            <div className="h-full flex flex-col lg:flex-row gap-6">
                <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-8 bg-white">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <svg className="animate-spin w-8 h-8 mb-3 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <p>Gemini AI e-postayı oluşturuyor...</p>
                            </div>
                        ) : !emailContent ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <svg className="w-16 h-16 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                <p className="text-lg font-medium text-slate-600 mb-2">E-posta Taslağı Henüz Oluşturulmadı</p>
                                <p className="text-sm mb-6 text-center max-w-md">Bu tedarikçi için yapay zeka destekli bir e-posta taslağı oluşturmak için aşağıdaki butona tıklayın.</p>
                                <button 
                                    onClick={generateDraft}
                                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 shadow-md transition-all active:scale-95 flex items-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    AI ile Taslağı Oluştur
                                </button>
                            </div>
                        ) : (
                            <div className="prose prose-slate prose-sm max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {emailContent}
                                </ReactMarkdown>
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-full lg:w-96 flex flex-col gap-4">
                    {/* Quick Stats */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Özet</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-center">
                                <span className="block text-2xl font-bold text-slate-700">{stats.total}</span>
                                <span className="text-xs text-slate-500">Toplam Sipariş</span>
                            </div>
                            <div className="p-3 bg-red-50 rounded-lg border border-red-100 text-center">
                                <span className="block text-2xl font-bold text-red-600">{stats.critical}</span>
                                <span className="text-xs text-red-400">Geciken</span>
                            </div>
                        </div>
                    </div>

                    {/* Chat Interface */}
                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                        <div className="p-3 bg-slate-50 border-b border-slate-100 font-medium text-sm text-slate-700 flex items-center gap-2">
                            <span>Asistan ile Düzenle</span>
                            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold">AI</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                            {chatHistory.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-lg p-3 text-sm shadow-sm ${
                                msg.role === 'user' 
                                    ? 'bg-blue-600 text-white rounded-br-none' 
                                    : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'
                                }`}>
                                {msg.text}
                                </div>
                            </div>
                            ))}
                            {loading && emailContent && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-slate-200 rounded-lg p-3 rounded-bl-none shadow-sm flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                                </div>
                            </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                        
                        <div className="p-3 bg-white border-t border-slate-100">
                            <div className="flex gap-2">
                            <input
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="Revize isteği yaz..."
                                className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                                disabled={loading || !emailContent}
                            />
                            <button 
                                onClick={handleSendMessage}
                                disabled={loading || !inputMessage.trim() || !emailContent}
                                className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                            </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          )}

          {/* ORDERS TAB */}
          {activeTab === 'orders' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col overflow-hidden">
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10 text-xs font-bold text-slate-500 uppercase tracking-wider select-none">
                            <tr>
                                <th className="p-4 border-b cursor-pointer hover:bg-slate-100" onClick={() => requestSort('saBelgesi')}>
                                    SA Belgesi <SortIcon columnKey="saBelgesi" />
                                </th>
                                <th className="p-4 border-b cursor-pointer hover:bg-slate-100" onClick={() => requestSort('malzeme')}>
                                    Malzeme <SortIcon columnKey="malzeme" />
                                </th>
                                <th className="p-4 border-b cursor-pointer hover:bg-slate-100" onClick={() => requestSort('kisaMetin')}>
                                    Kısa Metin <SortIcon columnKey="kisaMetin" />
                                </th>
                                <th className="p-4 border-b w-40 cursor-pointer hover:bg-slate-100" onClick={() => requestSort('teslimatTarihi')}>
                                    Teslimat Tarihi <SortIcon columnKey="teslimatTarihi" />
                                </th>
                                <th className="p-4 border-b text-center cursor-pointer hover:bg-slate-100" onClick={() => requestSort('kalanGun')}>
                                    Kalan Gün <SortIcon columnKey="kalanGun" />
                                </th>
                                <th className="p-4 border-b text-right cursor-pointer hover:bg-slate-100" onClick={() => requestSort('bakiyeMiktari')}>
                                    Bakiye <SortIcon columnKey="bakiyeMiktari" />
                                </th>
                                <th className="p-4 border-b text-center">Birim</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {sortedItems.map((item, i) => (
                                <tr key={i} className={`hover:bg-slate-50 ${item.status === 'critical' ? 'bg-red-50/30' : ''}`}>
                                    <td className="p-4 font-medium text-slate-700">
                                        {item.saBelgesi}
                                        {item.sasKalemNo && <span className="text-xs text-slate-400 ml-1">/{item.sasKalemNo}</span>}
                                    </td>
                                    <td className="p-4 text-slate-600">{item.malzeme}</td>
                                    <td className="p-4 text-slate-600 max-w-xs truncate" title={item.kisaMetin}>{item.kisaMetin}</td>
                                    <td className="p-4 text-slate-600">
                                        <input 
                                            type="text"
                                            defaultValue={item.revizeTarih || item.teslimatTarihi}
                                            onBlur={(e) => {
                                                if (e.target.value !== (item.revizeTarih || item.teslimatTarihi)) {
                                                    onUpdateItem(item.saBelgesi, item.sasKalemNo || '', e.target.value);
                                                }
                                            }}
                                            placeholder="DD.MM.YYYY"
                                            className={`w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition-colors ${item.revizeTarih ? 'text-blue-600 font-semibold' : ''}`}
                                        />
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2 py-1 rounded font-bold text-xs ${
                                            item.status === 'critical' ? 'bg-red-100 text-red-700' : 
                                            item.status === 'warning' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                                        }`}>
                                            {item.kalanGun}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right font-mono text-slate-700">{item.bakiyeMiktari}</td>
                                    <td className="p-4 text-center text-slate-500 text-xs">{item.olcuBirimi}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
          )}

          {/* ANALYSIS TAB */}
          {activeTab === 'analysis' && (
             <div className="h-full overflow-y-auto pr-2">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                     {/* KPI Cards */}
                     <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                         <h4 className="text-slate-500 text-sm font-medium mb-1">Toplam Açık Sipariş</h4>
                         <p className="text-3xl font-bold text-slate-800">{stats.total}</p>
                     </div>
                     <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                         <h4 className="text-slate-500 text-sm font-medium mb-1">Toplam Geciken</h4>
                         <p className="text-3xl font-bold text-red-600">{stats.critical}</p>
                         <p className="text-xs text-slate-400 mt-1">Teslim tarihi geçmiş</p>
                     </div>
                     <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                         <h4 className="text-slate-500 text-sm font-medium mb-1">Ortalama Gecikme</h4>
                         <p className="text-3xl font-bold text-orange-500">{stats.avgDelay} <span className="text-base font-normal text-slate-500">Gün</span></p>
                         <p className="text-xs text-slate-400 mt-1">Sadece gecikenler için</p>
                     </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                     {/* Pie Chart */}
                     <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-80">
                         <h4 className="font-bold text-slate-800 mb-4">Sipariş Durum Dağılımı</h4>
                         <ResponsiveContainer width="100%" height="100%">
                             <PieChart>
                                 <Pie
                                    data={stats.pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                 >
                                     {stats.pieData.map((entry, index) => (
                                         <Cell key={`cell-${index}`} fill={entry.color} />
                                     ))}
                                 </Pie>
                                 <RechartsTooltip />
                                 <Legend verticalAlign="bottom" height={36}/>
                             </PieChart>
                         </ResponsiveContainer>
                     </div>

                     {/* Top Delayed Items Bar Chart */}
                     <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-80">
                         <h4 className="font-bold text-slate-800 mb-4">En Çok Geciken SAS Numaraları (Top 7)</h4>
                         {stats.sortedByDelay.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    layout="vertical"
                                    data={stats.sortedByDelay}
                                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 10}} />
                                    <RechartsTooltip 
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                            const d = payload[0].payload;
                                            return (
                                                <div className="bg-white p-2 border border-slate-200 shadow-md rounded text-xs">
                                                    <p className="font-bold">SAS: {d.name}</p>
                                                    <p>{d.desc}</p>
                                                    <p className="text-red-600 font-bold">{d.gun} Gün Gecikme</p>
                                                </div>
                                            );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="gun" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                         ) : (
                             <div className="flex items-center justify-center h-full text-slate-400">
                                 <p>Geciken sipariş bulunmuyor.</p>
                             </div>
                         )}
                     </div>
                 </div>
             </div>
          )}
      </div>
    </div>
  );
};

export default EmailGenerator;
