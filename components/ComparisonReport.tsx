
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ComparisonReportData, VendorComparison, DiffItem } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, CartesianGrid 
} from 'recharts';

interface ComparisonReportProps {
  report: ComparisonReportData;
  onBack: () => void;
  isDarkMode?: boolean;
}

// Helper interface for flattened material view
interface FlatDiffItem extends DiffItem {
  vendorName: string;
  vendorId: string;
}

// --- Local Filter Dropdown Component ---
interface FilterDropdownProps {
    columnKey: string;
    allData: FlatDiffItem[];
    currentFilter: string[] | undefined;
    onApply: (selected: string[] | undefined) => void;
    onClose: () => void;
    onSort: (direction: 'asc' | 'desc') => void;
    getValue: (item: FlatDiffItem, key: string) => string;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({
    columnKey,
    allData,
    currentFilter,
    onApply,
    onClose,
    onSort,
    getValue
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [tempSelected, setTempSelected] = useState<Set<string>>(() => {
        if (currentFilter) return new Set(currentFilter);
        return new Set(allData.map(i => getValue(i, columnKey))); 
    });

    const uniqueValues = useMemo(() => {
        const set = new Set(allData.map(i => getValue(i, columnKey)));
        return Array.from(set).sort();
    }, [allData, columnKey, getValue]);

    const filteredValues = useMemo(() => {
        if (!searchTerm) return uniqueValues;
        const lower = searchTerm.toLowerCase();
        return uniqueValues.filter(v => v.toLowerCase().includes(lower));
    }, [uniqueValues, searchTerm]);

    const isAllVisibleSelected = filteredValues.length > 0 && filteredValues.every(v => tempSelected.has(v));

    const handleToggleAll = () => {
        const newSet = new Set(tempSelected);
        if (isAllVisibleSelected) {
            filteredValues.forEach(v => newSet.delete(v));
        } else {
            filteredValues.forEach(v => newSet.add(v));
        }
        setTempSelected(newSet);
    };

    const handleToggleItem = (val: string) => {
        const newSet = new Set(tempSelected);
        if (newSet.has(val)) {
            newSet.delete(val);
        } else {
            newSet.add(val);
        }
        setTempSelected(newSet);
    };

    const handleApply = () => {
        if (tempSelected.size === uniqueValues.length) {
            onApply(undefined);
        } else {
            onApply(Array.from(tempSelected));
        }
        onClose();
    };

    // Click outside handler
    const dropdownRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    return (
        <div ref={dropdownRef} className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xl z-50 text-sm font-normal text-slate-700 dark:text-slate-200 flex flex-col">
            <div className="p-2 border-b border-slate-100 dark:border-slate-700 flex flex-col gap-1">
                <button onClick={() => { onSort('asc'); onClose(); }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-left w-full">
                    <span className="text-slate-400">↓</span> A'dan Z'ye Sırala
                </button>
                <button onClick={() => { onSort('desc'); onClose(); }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-left w-full">
                    <span className="text-slate-400">↑</span> Z'den A'ya Sırala
                </button>
            </div>
            <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                <input 
                    type="text" 
                    placeholder="Ara" 
                    className="w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1 focus:outline-none focus:border-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="max-h-60 overflow-y-auto p-2 flex flex-col gap-1">
                <label className="flex items-center gap-2 px-1 py-0.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={isAllVisibleSelected}
                        onChange={handleToggleAll}
                        className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 dark:bg-slate-700"
                    />
                    <span className="font-medium text-slate-800 dark:text-slate-200">(Tümünü Seç)</span>
                </label>
                {filteredValues.map(val => (
                    <label key={val} className="flex items-center gap-2 px-1 py-0.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={tempSelected.has(val)}
                            onChange={() => handleToggleItem(val)}
                            className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 dark:bg-slate-700"
                        />
                        <span className="truncate" title={val}>{val || "(Boş)"}</span>
                    </label>
                ))}
            </div>
            <div className="p-2 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2 bg-slate-50 dark:bg-slate-700/50 rounded-b-lg">
                 <button onClick={onClose} className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">İptal</button>
                 <button onClick={handleApply} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Tamam</button>
            </div>
        </div>
    );
};

const ComparisonReport: React.FC<ComparisonReportProps> = ({ report, onBack, isDarkMode }) => {
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'vendor' | 'material' | 'analysis'>('analysis');
  const [materialFilter, setMaterialFilter] = useState<'all' | 'added' | 'removed' | 'updated'>('all');

  // Sorting & Column Filtering States
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[] | undefined>>({});
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  
  // Explanation Notes & Asked Status State
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [askedItems, setAskedItems] = useState<Set<string>>(new Set());

  const toggleVendor = (vId: string) => {
    if (expandedVendor === vId) setExpandedVendor(null);
    else setExpandedVendor(vId);
  };
  
  const handleNoteChange = (id: string, val: string) => {
      setNotes(prev => ({ ...prev, [id]: val }));
  };

  const toggleAsked = (id: string) => {
      setAskedItems(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
      });
  };

  const getBadge = (type: string) => {
    switch (type) {
        case 'added': return <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap">YENİ</span>;
        case 'removed': return <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap">TESLİM/İPTAL</span>;
        case 'updated': return <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap">GÜNCELLENDİ</span>;
        default: return null;
    }
  };

  // Helper to extract values from the flat object for sorting/filtering
  const getRowValue = (item: FlatDiffItem, key: string): string => {
      switch(key) {
          case 'type': 
            if(item.type === 'added') return 'Yeni';
            if(item.type === 'removed') return 'Kapanan';
            if(item.type === 'updated') return 'Değişen';
            return item.type;
          case 'vendorName': return item.vendorName;
          case 'saBelgesi': return item.item.saBelgesi;
          case 'malzeme': return item.item.malzeme;
          case 'kisaMetin': return item.item.kisaMetin;
          case 'newDate': 
            if (item.type === 'updated') return item.newDate || '';
            return '';
          default: return '';
      }
  };

  // --- Filtering & Data Prep ---

  // 1. Filtered Vendors
  const filteredVendors = useMemo(() => {
    if (!searchTerm) return report.vendors;
    const lower = searchTerm.toLowerCase();
    return report.vendors.filter(v => 
        v.vendorName.toLowerCase().includes(lower) || 
        v.vendorId.includes(lower) ||
        v.items.some(i => i.item.malzeme.toLowerCase().includes(lower) || i.item.saBelgesi.includes(lower))
    );
  }, [report.vendors, searchTerm]);

  // 2. Flattened Materials
  const allMaterials = useMemo(() => {
    const flat: FlatDiffItem[] = [];
    report.vendors.forEach(v => {
        v.items.forEach(item => {
            flat.push({ ...item, vendorName: v.vendorName, vendorId: v.vendorId });
        });
    });
    return flat;
  }, [report.vendors]);

  // 3. Processed Materials (Search + Type Filter + Column Filter + Sort)
  const processedMaterials = useMemo(() => {
    let result = allMaterials;

    // A. Top Bar Type Filter
    if (materialFilter !== 'all') {
        result = result.filter(m => m.type === materialFilter);
    }

    // B. Search Term
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        result = result.filter(m => 
            m.item.malzeme.toLowerCase().includes(lower) || 
            m.item.kisaMetin.toLowerCase().includes(lower) ||
            m.item.saBelgesi.includes(lower) ||
            m.vendorName.toLowerCase().includes(lower)
        );
    }

    // C. Column Filters
    result = result.filter(item => {
        return Object.entries(columnFilters).every(([key, allowedValues]) => {
            if (!allowedValues) return true;
            const val = getRowValue(item, key);
            return (allowedValues as string[]).includes(val);
        });
    });

    // D. Sorting
    if (sortConfig) {
        result.sort((a, b) => {
            const valA = getRowValue(a, sortConfig.key);
            const valB = getRowValue(b, sortConfig.key);
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    return result;
  }, [allMaterials, searchTerm, materialFilter, columnFilters, sortConfig]);

  // 4. Analysis Data
  const analysisData = useMemo(() => {
      const topVendors = [...report.vendors]
        .map(v => ({
            name: v.vendorName.length > 15 ? v.vendorName.substring(0, 15) + '...' : v.vendorName,
            fullInfo: v,
            totalChange: v.addedCount + v.removedCount + v.updatedCount,
            Yeni: v.addedCount,
            Kapanan: v.removedCount,
            Degisen: v.updatedCount
        }))
        .sort((a, b) => b.totalChange - a.totalChange)
        .slice(0, 10);

      const pieData = [
          { name: 'Yeni Sipariş', value: report.totalAdded, color: '#22c55e' },
          { name: 'Kapanan/Teslim', value: report.totalRemoved, color: '#64748b' },
          { name: 'Termin Değişimi', value: report.totalUpdated, color: '#3b82f6' }
      ].filter(d => d.value > 0);

      return { topVendors, pieData };
  }, [report]);

  // Header Renderer
  const RenderHeader = ({ label, columnKey, widthClass }: { label: string, columnKey: string, widthClass: string }) => {
      const isFiltered = columnFilters[columnKey] !== undefined;
      const isSorted = sortConfig?.key === columnKey;
      
      return (
        <div className={`${widthClass} font-bold text-slate-700 dark:text-slate-300 text-sm flex items-center justify-between group relative`}>
            <div 
                className="flex items-center gap-1 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 select-none"
                onClick={() => setSortConfig({ key: columnKey, direction: sortConfig?.direction === 'asc' ? 'desc' : 'asc' })}
            >
                {label}
                {isSorted && <span className="text-blue-600 dark:text-blue-400 text-xs">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
            </div>
            <button 
                onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === columnKey ? null : columnKey); }}
                className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${isFiltered ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400'}`}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
            </button>
            {activeDropdown === columnKey && (
                <FilterDropdown 
                    columnKey={columnKey}
                    allData={allMaterials}
                    currentFilter={columnFilters[columnKey]}
                    onApply={(selected) => setColumnFilters(prev => {
                        const next = { ...prev };
                        if (selected === undefined) delete next[columnKey];
                        else next[columnKey] = selected;
                        return next;
                    })}
                    onClose={() => setActiveDropdown(null)}
                    onSort={(dir) => setSortConfig({ key: columnKey, direction: dir })}
                    getValue={getRowValue}
                />
            )}
        </div>
      );
  };

  const chartTickColor = isDarkMode ? '#94a3b8' : '#64748b';
  const chartGridStroke = isDarkMode ? '#334155' : '#f1f5f9';
  const chartTooltipStyle = isDarkMode ? {backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9'} : {};

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors">
        {/* Header Stats */}
        <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <button onClick={onBack} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    Rapor Karşılaştırma Sonucu
                </h2>
                <div className="flex gap-4">
                    <div className="bg-green-500 text-white px-4 py-2 rounded-lg shadow-sm text-center min-w-[100px]">
                        <span className="block text-xs opacity-80 font-bold uppercase">Yeni</span>
                        <span className="text-xl font-bold">+{report.totalAdded}</span>
                    </div>
                    <div className="bg-slate-500 text-white px-4 py-2 rounded-lg shadow-sm text-center min-w-[100px]">
                        <span className="block text-xs opacity-80 font-bold uppercase">Kapanan</span>
                        <span className="text-xl font-bold">-{report.totalRemoved}</span>
                    </div>
                    <div className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-sm text-center min-w-[100px]">
                        <span className="block text-xs opacity-80 font-bold uppercase">Değişen</span>
                        <span className="text-xl font-bold">{report.totalUpdated}</span>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col lg:flex-row gap-4 justify-between items-center">
                
                {/* Search (Hidden in Analysis Mode) */}
                <div className={`relative w-full lg:w-96 transition-opacity ${viewMode === 'analysis' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <input 
                        type="text" 
                        placeholder="Tedarikçi, Malzeme veya SAS no ara..." 
                        className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <svg className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>

                {/* Material Filters (Only visible in Material View) */}
                {viewMode === 'material' && (
                    <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                        <button onClick={() => setMaterialFilter('all')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${materialFilter === 'all' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Tümü</button>
                        <button onClick={() => setMaterialFilter('added')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${materialFilter === 'added' ? 'bg-white dark:bg-slate-600 text-green-600 dark:text-green-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Yeni</button>
                        <button onClick={() => setMaterialFilter('removed')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${materialFilter === 'removed' ? 'bg-white dark:bg-slate-600 text-slate-600 dark:text-slate-300 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Kapanan</button>
                        <button onClick={() => setMaterialFilter('updated')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${materialFilter === 'updated' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Değişen</button>
                    </div>
                )}

                {/* View Switcher */}
                <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg shrink-0">
                    <button 
                        onClick={() => setViewMode('analysis')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${viewMode === 'analysis' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        Özet Analiz
                    </button>
                    <button 
                        onClick={() => setViewMode('vendor')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${viewMode === 'vendor' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        Tedarikçi
                    </button>
                    <button 
                        onClick={() => setViewMode('material')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${viewMode === 'material' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        Malzeme
                    </button>
                </div>
            </div>
        </div>

        {/* Content Area */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden flex-1 min-h-0">
            
            {/* ANALYSIS VIEW */}
            {viewMode === 'analysis' && (
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Change Distribution Pie */}
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm h-80 flex flex-col">
                            <h3 className="font-bold text-slate-800 dark:text-white mb-4">Değişim Dağılımı</h3>
                            <div className="flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={analysisData.pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                            label={({ value }) => value}
                                        >
                                            {analysisData.pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={chartTooltipStyle} />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 gap-4 h-80">
                            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-center items-center text-center">
                                <h4 className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase mb-2">Toplam Hareket</h4>
                                <p className="text-4xl font-extrabold text-slate-800 dark:text-white">
                                    {report.totalAdded + report.totalRemoved + report.totalUpdated}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">İşlem Gören Satır</p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-center items-center text-center">
                                <h4 className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase mb-2">Etkilenen Tedarikçi</h4>
                                <p className="text-4xl font-extrabold text-blue-600 dark:text-blue-400">
                                    {report.vendors.length}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Firmada Değişim Var</p>
                            </div>
                            <div className="col-span-2 bg-gradient-to-r from-blue-600 to-blue-500 p-5 rounded-xl border border-blue-600 shadow-md flex items-center justify-between text-white">
                                <div>
                                    <h4 className="text-blue-100 text-sm font-bold uppercase mb-1">En Çok Değişim</h4>
                                    <p className="text-xl font-bold">{analysisData.topVendors[0]?.name || "-"}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-extrabold">{analysisData.topVendors[0]?.totalChange || 0}</p>
                                    <p className="text-blue-200 text-xs">Aksiyon</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Top Vendors Bar Chart */}
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm h-96 flex flex-col">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-2">En Çok Hareket Gören Tedarikçiler (Top 10)</h3>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">Yeni eklenen, kapanan ve tarihi değişen siparişlerin toplamı.</p>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={analysisData.topVendors}
                                    layout="vertical"
                                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                                    barSize={20}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={chartGridStroke} />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 11, fill: chartTickColor}} />
                                    <Tooltip cursor={{fill: isDarkMode ? '#334155' : '#f8fafc'}} contentStyle={chartTooltipStyle} />
                                    <Legend />
                                    <Bar dataKey="Yeni" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="Degisen" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="Kapanan" stackId="a" fill="#64748b" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* VENDOR VIEW */}
            {viewMode === 'vendor' && (
                <>
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 text-sm grid grid-cols-12 gap-4 sticky top-0 z-10">
                        <div className="col-span-5">Tedarikçi</div>
                        <div className="col-span-2 text-center text-green-600 dark:text-green-400">Yeni</div>
                        <div className="col-span-2 text-center text-slate-600 dark:text-slate-400">Kapanan</div>
                        <div className="col-span-2 text-center text-blue-600 dark:text-blue-400">Değişen</div>
                        <div className="col-span-1"></div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto">
                        {filteredVendors.length > 0 ? filteredVendors.map(vendor => (
                            <div key={vendor.vendorId} className="border-b border-slate-50 dark:border-slate-700 last:border-0">
                                <div 
                                    onClick={() => toggleVendor(vendor.vendorId)}
                                    className={`p-4 grid grid-cols-12 gap-4 items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition ${expandedVendor === vendor.vendorId ? 'bg-slate-50 dark:bg-slate-700/50' : ''}`}
                                >
                                    <div className="col-span-5 font-semibold text-slate-800 dark:text-slate-200">
                                        {vendor.vendorName}
                                        <span className="text-xs text-slate-400 dark:text-slate-500 font-normal ml-2">{vendor.vendorId}</span>
                                    </div>
                                    <div className="col-span-2 text-center font-bold text-green-600 dark:text-green-400">{vendor.addedCount > 0 ? `+${vendor.addedCount}` : '-'}</div>
                                    <div className="col-span-2 text-center font-bold text-slate-500 dark:text-slate-400">{vendor.removedCount > 0 ? `-${vendor.removedCount}` : '-'}</div>
                                    <div className="col-span-2 text-center font-bold text-blue-600 dark:text-blue-400">{vendor.updatedCount > 0 ? vendor.updatedCount : '-'}</div>
                                    <div className="col-span-1 text-right text-slate-400 dark:text-slate-500">
                                        <svg className={`w-5 h-5 transform transition ${expandedVendor === vendor.vendorId ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </div>

                                {expandedVendor === vendor.vendorId && (
                                    <div className="bg-slate-50 dark:bg-slate-900/30 p-4 pl-8 border-t border-slate-100 dark:border-slate-700 animate-in fade-in duration-200">
                                        <table className="w-full text-sm text-left text-slate-700 dark:text-slate-300">
                                            <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-600">
                                                <tr>
                                                    <th className="pb-2">Durum</th>
                                                    <th className="pb-2">SA Belgesi</th>
                                                    <th className="pb-2">Malzeme</th>
                                                    <th className="pb-2">Detay</th>
                                                    <th className="pb-2 w-1/4">Açıklama</th>
                                                    <th className="pb-2 w-10">Soruldu?</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                                {vendor.items.map((diff, i) => {
                                                    const rowId = `${vendor.vendorId}-${diff.item.saBelgesi}-${diff.item.malzeme}`;
                                                    const isAsked = askedItems.has(rowId);
                                                    return (
                                                    <tr key={i} className={isAsked ? 'opacity-50 grayscale transition-all' : 'transition-all'}>
                                                        <td className="py-2">{getBadge(diff.type)}</td>
                                                        <td className="py-2 font-mono text-slate-700 dark:text-slate-300">{diff.item.saBelgesi} {diff.item.sasKalemNo && `/${diff.item.sasKalemNo}`}</td>
                                                        <td className="py-2">
                                                            <div className="font-medium text-slate-800 dark:text-slate-200">{diff.item.malzeme}</div>
                                                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">{diff.item.kisaMetin}</div>
                                                        </td>
                                                        <td className="py-2 text-xs">
                                                            {diff.type === 'updated' && (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-slate-400 line-through">{diff.oldDate}</span>
                                                                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                                                    <span className="text-blue-600 dark:text-blue-400 font-bold">{diff.newDate}</span>
                                                                </div>
                                                            )}
                                                            {diff.type === 'added' && <span className="text-green-600 dark:text-green-400">Yeni Sipariş</span>}
                                                            {diff.type === 'removed' && <span className="text-slate-500 dark:text-slate-400">Listeden Çıktı</span>}
                                                        </td>
                                                        <td className="py-2">
                                                            <textarea
                                                                className="w-full text-xs border border-slate-200 dark:border-slate-600 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none resize-none bg-white dark:bg-slate-800 dark:text-slate-200 transition-colors"
                                                                rows={1}
                                                                placeholder="Not..."
                                                                value={notes[rowId] || ''}
                                                                onClick={(e) => e.stopPropagation()}
                                                                onChange={(e) => handleNoteChange(rowId, e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="py-2 text-center">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={isAsked}
                                                                onChange={() => toggleAsked(rowId)}
                                                                className="w-4 h-4 text-blue-600 border-gray-300 dark:border-slate-600 rounded focus:ring-blue-500 cursor-pointer dark:bg-slate-700"
                                                            />
                                                        </td>
                                                    </tr>
                                                )})}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )) : (
                            <div className="p-8 text-center text-slate-400 dark:text-slate-500">Aranan kriterlere uygun sonuç bulunamadı.</div>
                        )}
                    </div>
                </>
            )}

            {/* MATERIAL VIEW */}
            {viewMode === 'material' && (
                <div className="flex-1 flex flex-col min-h-0">
                     <div className="min-w-[1024px]">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 text-sm grid grid-cols-12 gap-4 sticky top-0 z-10">
                            <RenderHeader label="Durum" columnKey="type" widthClass="col-span-1" />
                            <RenderHeader label="Tedarikçi" columnKey="vendorName" widthClass="col-span-2" />
                            <RenderHeader label="SA Belgesi" columnKey="saBelgesi" widthClass="col-span-1" />
                            <RenderHeader label="Malzeme" columnKey="malzeme" widthClass="col-span-2" />
                            <RenderHeader label="Değişim Detayı" columnKey="newDate" widthClass="col-span-2" />
                            <div className="col-span-3 font-bold text-slate-700 dark:text-slate-300 text-sm pl-2">Açıklama</div>
                            <div className="col-span-1 font-bold text-slate-700 dark:text-slate-300 text-sm text-center">Soruldu?</div>
                        </div>
                     </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                         {processedMaterials.length > 0 ? processedMaterials.map((diff, i) => {
                             const rowId = `${diff.vendorId}-${diff.item.saBelgesi}-${diff.item.malzeme}`;
                             const isAsked = askedItems.has(rowId);
                             return (
                                <div key={i} className={`min-w-[1024px] p-4 grid grid-cols-12 gap-4 items-start hover:bg-slate-50 dark:hover:bg-slate-800/50 text-sm group ${isAsked ? 'opacity-50 grayscale' : ''}`}>
                                    <div className="col-span-1">{getBadge(diff.type)}</div>
                                    <div className="col-span-2">
                                        <div className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={diff.vendorName}>{diff.vendorName}</div>
                                        <div className="text-xs text-slate-400 dark:text-slate-500">{diff.vendorId}</div>
                                    </div>
                                    <div className="col-span-1 font-mono text-slate-600 dark:text-slate-400 text-xs break-all">
                                        {diff.item.saBelgesi}
                                    </div>
                                    <div className="col-span-2">
                                        <div className="font-medium text-slate-800 dark:text-slate-200 break-words">{diff.item.malzeme}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{diff.item.kisaMetin}</div>
                                    </div>
                                    <div className="col-span-2 text-xs">
                                        {diff.type === 'updated' && (
                                            <div className="flex flex-col">
                                                <span className="text-slate-400 line-through text-[10px]">{diff.oldDate}</span>
                                                <span className="text-blue-600 dark:text-blue-400 font-bold">{diff.newDate}</span>
                                            </div>
                                        )}
                                        {diff.type === 'added' && <span className="text-green-600 dark:text-green-400 block">Listeye eklendi</span>}
                                        {diff.type === 'removed' && <span className="text-slate-500 dark:text-slate-400 block">Listeden düştü</span>}
                                    </div>
                                    <div className="col-span-3">
                                        <textarea
                                            className="w-full text-xs border border-slate-200 dark:border-slate-600 rounded p-2 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none bg-white dark:bg-slate-800 dark:text-slate-200 transition-colors"
                                            rows={2}
                                            placeholder="Not ekle..."
                                            value={notes[rowId] || ''}
                                            onChange={(e) => handleNoteChange(rowId, e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-1 flex justify-center pt-2">
                                        <input 
                                            type="checkbox" 
                                            checked={isAsked}
                                            onChange={() => toggleAsked(rowId)}
                                            className="w-5 h-5 text-blue-600 border-gray-300 dark:border-slate-600 rounded focus:ring-blue-500 cursor-pointer dark:bg-slate-700"
                                            title="Termin Soruldu Olarak İşaretle"
                                        />
                                    </div>
                                </div>
                             );
                         }) : (
                            <div className="p-8 text-center text-slate-400 dark:text-slate-500">Aranan kriterlere uygun malzeme bulunamadı.</div>
                         )}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default ComparisonReport;
