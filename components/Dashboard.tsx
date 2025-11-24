
import React, { useMemo, useState } from 'react';
import { SapOrderItem, VendorSummary, TabType } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardProps {
  data: SapOrderItem[];
  processedVendorIds: Set<string>;
  onToggleProcessed: (vendorId: string) => void;
  onSelectVendor: (vendor: VendorSummary, tab: TabType) => void;
  onBack: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  data, 
  processedVendorIds, 
  onToggleProcessed, 
  onSelectVendor, 
  onBack 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'critical' | 'pending' | 'completed'>('all');
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
          items: []
        };
      }
      groups[key].items.push(item);
      groups[key].itemCount++;
      if (item.status === 'critical') groups[key].criticalCount++;
    });

    return Object.values(groups);
  }, [data]);

  const filteredVendors = useMemo(() => {
    let result = [...vendorSummaries];

    // 1. Filter by Status
    if (filterStatus === 'critical') {
      result = result.filter(v => v.criticalCount > 0);
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
        return b.criticalCount - a.criticalCount;
      }

      // Default 'smart' sort
      // 1. Processed at bottom
      const aProcessed = processedVendorIds.has(a.vendorId);
      const bProcessed = processedVendorIds.has(b.vendorId);
      if (aProcessed !== bProcessed) return aProcessed ? 1 : -1;

      // 2. Critical count desc
      if (b.criticalCount !== a.criticalCount) return b.criticalCount - a.criticalCount;
      
      // 3. Total count desc
      return b.itemCount - a.itemCount;
    });

    return result;
  }, [vendorSummaries, searchTerm, filterStatus, sortBy, processedVendorIds]);

  const totalOrders = data.length;
  const totalCritical = data.filter(d => d.status === 'critical').length;
  const totalVendors = vendorSummaries.length;

  // Chart data (Top 5 from filtered or total)
  const chartData = (filteredVendors.length > 0 ? filteredVendors : vendorSummaries).slice(0, 5).map(v => ({
    name: v.vendorName.length > 15 ? v.vendorName.substring(0, 15) + '...' : v.vendorName,
    Acil: v.criticalCount,
    Normal: v.itemCount - v.criticalCount
  }));

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-slate-500 text-sm font-medium">Toplam Açık Sipariş</p>
          <p className="text-3xl font-bold text-slate-800 mt-2">{totalOrders}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-red-100">
          <p className="text-red-500 text-sm font-medium">Acil / Geciken</p>
          <p className="text-3xl font-bold text-red-600 mt-2">{totalCritical}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-slate-500 text-sm font-medium">Tedarikçi Sayısı</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{totalVendors}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 min-h-0">
        
        {/* Vendor List */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-slate-800 flex items-center">
              Tedarikçi Listesi
              <span className="ml-2 text-xs font-normal text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                {filteredVendors.length}
              </span>
            </h3>
             <button onClick={onBack} className="text-sm text-slate-500 hover:text-blue-600 hover:underline">
                Dosya Değiştir
              </button>
          </div>

          {/* Filter Toolbar */}
          <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 mb-4 flex flex-col md:flex-row gap-3">
             <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Şirket veya kod ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
             </div>
             
             <div className="flex gap-2">
                <select 
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:bg-white"
                >
                    <option value="all">Tüm Durumlar</option>
                    <option value="critical">⚠️ Sadece Gecikenler</option>
                    <option value="pending">⏳ Bekleyen İşler</option>
                    <option value="completed">✅ Tamamlananlar</option>
                </select>

                <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:bg-white"
                >
                    <option value="smart">⚡ Akıllı Sıralama</option>
                    <option value="critical">🔥 Gecikme Sayısı</option>
                    <option value="orders">📦 Sipariş Sayısı</option>
                    <option value="name">🔤 İsim (A-Z)</option>
                </select>
             </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
            <div className="overflow-y-auto flex-1 p-2">
              {filteredVendors.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="p-4 w-16 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Durum</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tedarikçi</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Sipariş</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Durum</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredVendors.map((vendor) => {
                      const isProcessed = processedVendorIds.has(vendor.vendorId);
                      return (
                        <tr 
                            key={vendor.vendorId} 
                            className={`transition-colors group ${isProcessed ? 'bg-green-50/60' : 'hover:bg-slate-50'}`}
                        >
                          <td className="p-4 text-center">
                             <input 
                                type="checkbox" 
                                checked={isProcessed}
                                onChange={() => onToggleProcessed(vendor.vendorId)}
                                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                title="Bildiri Yapıldı Olarak İşaretle"
                             />
                          </td>
                          <td 
                            className="p-4 cursor-pointer" 
                            onClick={() => onSelectVendor(vendor, 'orders')}
                          >
                            <div className={`font-semibold ${isProcessed ? 'text-slate-500' : 'text-slate-800 group-hover:text-blue-600 transition-colors'}`}>{vendor.vendorName}</div>
                            <div className="text-xs text-slate-400">{vendor.vendorId}</div>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${isProcessed ? 'bg-slate-100 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                              {vendor.itemCount}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            {vendor.criticalCount > 0 ? (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isProcessed ? 'bg-red-50 text-red-300' : 'bg-red-100 text-red-800'}`}>
                                {vendor.criticalCount} Gecikme
                              </span>
                            ) : (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isProcessed ? 'bg-green-50 text-green-400' : 'bg-green-100 text-green-800'}`}>
                                Sorun Yok
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => onSelectVendor(vendor, 'orders')}
                                    className="px-3 py-2 text-sm font-medium bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition shadow-sm whitespace-nowrap"
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
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                  <svg className="w-12 h-12 mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p>Filtrelere uygun tedarikçi bulunamadı.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Analytics / Mini Chart */}
        <div className="flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Gecikme Analizi (Gösterilenler)</h3>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex-1">
             <div className="h-64 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Bar dataKey="Acil" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
                    <Bar dataKey="Normal" stackId="a" fill="#e2e8f0" radius={[0, 4, 4, 0]} barSize={20} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
             <div className="mt-6 text-sm text-slate-500">
               <p className="mb-2"><strong>İpucu:</strong> Listeyi yukarıdaki araç çubuğunu kullanarak filtreleyebilir ve sıralayabilirsiniz.</p>
               <ul className="list-disc list-inside space-y-1 mt-2 text-xs text-slate-400">
                  <li>"Gecikme Var" seçeneği sadece sorunlu siparişleri gösterir.</li>
                  <li>"Akıllı Sıralama" en kritik tedarikçileri en üste taşır.</li>
               </ul>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
