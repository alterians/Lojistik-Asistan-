
import React, { useMemo, useState } from 'react';
import { SapOrderItem, VendorSummary, TabType } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface DashboardProps {
  data: SapOrderItem[];
  processedVendorIds: Set<string>;
  askedVendorIds: Set<string>;
  onToggleProcessed: (vendorId: string) => void;
  onToggleAsked: (vendorId: string) => void;
  onSelectVendor: (vendor: VendorSummary, tab: TabType) => void;
  onBack: () => void;
  onDownloadReport: () => void;
  isDarkMode?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  data, 
  processedVendorIds, 
  askedVendorIds,
  onToggleProcessed, 
  onToggleAsked,
  onSelectVendor, 
  onBack,
  onDownloadReport,
  isDarkMode
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'critical' | 'warning' | 'pending' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'smart' | 'orders' | 'critical' | 'name'>('smart');
  
  const vendorSummaries: VendorSummary[] = useMemo(() => {
    const groups: { [key: string]: VendorSummary } = {};
    
    data.forEach(item => {
      const key = item.saticiAdi;
      if (!groups[key]) {
        groups[key] = {
          vendorId: item.saticiKodu,
          vendorName: item.saticiAdi,
          itemCount: 0,
          criticalCount: 0,
          warningCount: 0,
          items: []
        };
      }
      groups[key].items.push(item);
      groups[key].itemCount++;
      if (item.status === 'critical') groups[key].criticalCount++;
      if (item.status === 'warning') groups[key].warningCount++;
    });

    return Object.values(groups);
  }, [data]);

  const filteredVendors = useMemo(() => {
    let result = [...vendorSummaries];

    // 1. Filter by Status
    if (filterStatus === 'critical') {
      result = result.filter(v => v.criticalCount > 0);
    } else if (filterStatus === 'warning') {
      result = result.filter(v => v.warningCount > 0);
    } else if (filterStatus === 'completed') {
      result = result.filter(v => processedVendorIds.has(v.vendorId));
    } else if (filterStatus === 'pending') {
      result = result.filter(v => !processedVendorIds.has(v.vendorId));
    }

    // 2. Search Term
    if (searchTerm) {
      const lowerTerm = searchTerm.toLocaleLowerCase('tr-TR');
      result = result.filter(v => 
        v.vendorName.toLocaleLowerCase('tr-TR').includes(lowerTerm) || 
        v.vendorId.includes(lowerTerm)
      );
    }

    // 3. Sorting
    result.sort((a, b) => {
      if (sortBy === 'name') {
        return a.vendorName.localeCompare(b.vendorName, 'tr-TR');
      } 
      
      if (sortBy === 'orders') {
        return b.itemCount - a.itemCount;
      }

      if (sortBy === 'critical') {
        // First sort by critical, then by warning
        if (b.criticalCount !== a.criticalCount) return b.criticalCount - a.criticalCount;
        return b.warningCount - a.warningCount;
      }

      // Default 'smart' sort
      // 1. Processed at bottom
      const aProcessed = processedVendorIds.has(a.vendorId);
      const bProcessed = processedVendorIds.has(b.vendorId);
      if (aProcessed !== bProcessed) return aProcessed ? 1 : -1;

      // 2. Critical count desc
      if (b.criticalCount !== a.criticalCount) return b.criticalCount - a.criticalCount;

      // 3. Warning count desc
      if (b.warningCount !== a.warningCount) return b.warningCount - a.warningCount;
      
      // 4. Total count desc
      return b.itemCount - a.itemCount;
    });

    return result;
  }, [vendorSummaries, searchTerm, filterStatus, sortBy, processedVendorIds]);

  const totalOrders = data.length;
  const totalCritical = data.filter(d => d.status === 'critical').length;
  const totalWarning = data.filter(d => d.status === 'warning').length;
  const totalVendors = vendorSummaries.length;

  // Chart data (Top 5 from filtered or total)
  const chartData = (filteredVendors.length > 0 ? filteredVendors : vendorSummaries).slice(0, 5).map(v => ({
    name: v.vendorName.length > 15 ? v.vendorName.substring(0, 15) + '...' : v.vendorName,
    Gecikme: v.criticalCount,
    Yaklaşan: v.warningCount,
    Sorunsuz: v.itemCount - v.criticalCount - v.warningCount
  }));

  const chartFillColor = isDarkMode ? "#475569" : "#e2e8f0"; // slate-600 vs slate-200 for 'Sorunsuz'

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Toplam Açık Sipariş</p>
          <p className="text-3xl font-bold text-slate-800 dark:text-white mt-2">{totalOrders}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-red-100 dark:border-red-900/30 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-red-500 text-sm font-medium">Acil / Geciken</p>
            <div className="flex items-baseline gap-2 mt-2">
                <p className="text-3xl font-bold text-red-600 dark:text-red-500">{totalCritical}</p>
                {totalWarning > 0 && (
                    <span className="text-sm font-bold text-orange-600 dark:text-amber-300 bg-orange-50 dark:bg-amber-400/10 px-2 py-0.5 rounded-full border border-orange-100 dark:border-amber-400/20">
                        + {totalWarning} Yaklaşan
                    </span>
                )}
            </div>
          </div>
          <div className="absolute right-0 top-0 p-4 opacity-5 text-red-600 dark:text-red-400">
             <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Tedarikçi Sayısı</p>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">{totalVendors}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 min-h-0">
        
        {/* Vendor List */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center">
              Tedarikçi Listesi
              <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                {filteredVendors.length}
              </span>
            </h3>
            <div className="flex gap-4">
                <button onClick={onDownloadReport} className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Güncel Raporu İndir
                </button>
                <button onClick={onBack} className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:underline">
                    Dosya Değiştir
                </button>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mb-4 flex flex-col md:flex-row gap-3">
             <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Şirket veya kod ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <svg className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
             </div>
             
             <div className="flex gap-2">
                <select 
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:bg-white dark:hover:bg-slate-600"
                >
                    <option value="all">Tüm Durumlar</option>
                    <option value="critical">🔴 Sadece Gecikenler</option>
                    <option value="warning">🟠 Yaklaşanlar (10 Gün)</option>
                    <option value="pending">⏳ Bekleyen İşler</option>
                    <option value="completed">✅ Tamamlananlar</option>
                </select>

                <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:bg-white dark:hover:bg-slate-600"
                >
                    <option value="smart">⚡ Akıllı Sıralama</option>
                    <option value="critical">🔥 Risk Analizi</option>
                    <option value="orders">📦 Sipariş Sayısı</option>
                    <option value="name">🔤 İsim (A-Z)</option>
                </select>
             </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex-1 flex flex-col">
            <div className="overflow-y-auto flex-1 p-2">
              {filteredVendors.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
                    <tr>
                      <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tedarikçi</th>
                      <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Sipariş</th>
                      <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Durum</th>
                      <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">İşlem</th>
                      <th className="p-4 w-16 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">SORULDU?</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredVendors.map((vendor) => {
                      const isProcessed = processedVendorIds.has(vendor.vendorId);
                      const isAsked = askedVendorIds.has(vendor.vendorId);
                      const hasCritical = vendor.criticalCount > 0;
                      const hasWarning = vendor.warningCount > 0;
                      
                      return (
                        <tr 
                            key={vendor.vendorId} 
                            className={`transition-colors group ${isProcessed ? 'bg-green-50/40 dark:bg-green-900/20' : isAsked ? 'opacity-50 grayscale' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                        >
                          <td 
                            className="p-4 cursor-pointer" 
                            onClick={() => onSelectVendor(vendor, 'orders')}
                          >
                            <div className={`font-semibold ${isProcessed ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors'}`}>{vendor.vendorName}</div>
                            <div className="text-xs text-slate-400 dark:text-slate-500">{vendor.vendorId}</div>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${isProcessed ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                              {vendor.itemCount}
                            </span>
                          </td>
                          <td className="p-4 text-center align-middle">
                            <div className="flex flex-col gap-1 items-center justify-center">
                                {hasCritical ? (
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium w-fit ${isProcessed ? 'bg-red-50 dark:bg-red-900/30 text-red-300' : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200'}`}>
                                        {vendor.criticalCount} Gecikme
                                    </span>
                                ) : null}
                                
                                {hasWarning ? (
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium w-fit ${isProcessed ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-300' : 'bg-orange-100 dark:bg-amber-400/10 text-orange-800 dark:text-amber-300 dark:border dark:border-amber-400/20'}`}>
                                        {vendor.warningCount} Yaklaşan
                                    </span>
                                ) : null}

                                {!hasCritical && !hasWarning && (
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium w-fit ${isProcessed ? 'bg-green-50 dark:bg-green-900/30 text-green-400' : 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200'}`}>
                                        Sorun Yok
                                    </span>
                                )}
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => onSelectVendor(vendor, 'orders')}
                                    className="px-3 py-2 text-sm font-medium bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-500 transition shadow-sm whitespace-nowrap"
                                >
                                    İncele
                                </button>
                                <button
                                    onClick={() => onSelectVendor(vendor, 'email')}
                                    className={`px-3 py-2 text-sm font-medium rounded-lg transition shadow-sm whitespace-nowrap ${
                                        isProcessed 
                                        ? 'bg-green-600 text-white hover:bg-green-700' 
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                    }`}
                                >
                                    E-posta
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onToggleProcessed(vendor.vendorId); }}
                                    title={isProcessed ? "Tamamlandı işlemini geri al" : "Tamamlandı olarak işaretle"}
                                    className={`p-2 rounded-lg border transition flex items-center justify-center w-10 ${
                                        isProcessed 
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 hover:bg-green-200 dark:hover:bg-green-900/50' 
                                        : 'bg-white dark:bg-slate-700 text-slate-300 dark:text-slate-500 border-slate-200 dark:border-slate-600 hover:text-green-600 dark:hover:text-green-400 hover:border-green-300 dark:hover:border-green-600'
                                    }`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                </button>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                             <input 
                                type="checkbox" 
                                checked={isAsked}
                                onChange={() => onToggleAsked(vendor.vendorId)}
                                className="w-5 h-5 text-blue-600 border-gray-300 dark:border-slate-600 rounded focus:ring-blue-500 cursor-pointer dark:bg-slate-700"
                                title="Termin Soruldu (Listeden silinmez, sadece işaretlenir)"
                             />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400 dark:text-slate-500">
                  <svg className="w-12 h-12 mb-2 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p>Filtrelere uygun tedarikçi bulunamadı.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Analytics / Mini Chart */}
        <div className="flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Gecikme Analizi (Gösterilenler)</h3>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex-1">
             <div className="h-64 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12, fill: isDarkMode ? '#cbd5e1' : '#64748b'}} />
                    <Tooltip 
                        cursor={{fill: 'transparent'}} 
                        contentStyle={isDarkMode ? {backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9'} : {}}
                    />
                    <Legend iconType="circle" wrapperStyle={{fontSize: '11px', marginTop: '10px'}}/>
                    <Bar dataKey="Gecikme" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} barSize={20} />
                    <Bar dataKey="Yaklaşan" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} barSize={20} />
                    <Bar dataKey="Sorunsuz" stackId="a" fill={chartFillColor} radius={[0, 4, 4, 0]} barSize={20} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
             <div className="mt-6 text-sm text-slate-500 dark:text-slate-400">
               <p className="mb-2"><strong>İpucu:</strong> Gecikme ve Yaklaşan (10 gün) terminler ayrı renklerle gösterilir.</p>
               <ul className="list-disc list-inside space-y-1 mt-2 text-xs text-slate-400 dark:text-slate-500">
                  <li>"Yaklaşanlar" filtresiyle riskli siparişleri görebilirsiniz.</li>
                  <li>Tamamlanan işler yeşil renkle işaretlenir.</li>
               </ul>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
