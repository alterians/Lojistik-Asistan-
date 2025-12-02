
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { VendorSummary, ChatMessage, TabType, SapOrderItem, OrderUpdateResult } from '../types';
import { generateEmailDraft, refineEmail, processOrderUpdates } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, LabelList } from 'recharts';

interface EmailGeneratorProps {
  vendor: VendorSummary;
  initialTab?: TabType;
  onBack: () => void;
  onMarkAsProcessed: () => void;
  onUpdateItem: (saBelgesi: string, sasKalemNo: string, newDate: string) => void;
  onUpdateNote: (saBelgesi: string, sasKalemNo: string, note: string) => void;
  isDarkMode?: boolean;
}

type SortKey = keyof SapOrderItem;
type SortDirection = 'asc' | 'desc';

// --- Helper for Date Input ---
const formatForInput = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    const parts = dateStr.split('.');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return '';
};

// --- Helper to Calculate Days Remaining ---
const calculateDaysRemaining = (dateStr: string): number | null => {
    if (!dateStr) return null;
    const parts = dateStr.split('.'); // DD.MM.YYYY
    if (parts.length !== 3) return null;
    
    const targetDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    if (isNaN(targetDate.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = targetDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// --- Helper for Image Upload ---
const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // Remove data:image/png;base64, prefix for API
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
};

// --- Filter Dropdown Component ---
interface FilterDropdownProps<T> {
    columnKey: keyof T;
    allData: T[];
    currentFilter: string[] | undefined;
    onApply: (selected: string[] | undefined) => void;
    onClose: () => void;
    onSort: (direction: SortDirection) => void;
    columnTitle: string;
}

const FilterDropdown = <T,>({
    columnKey,
    allData,
    currentFilter,
    onApply,
    onClose,
    onSort,
    columnTitle
}: FilterDropdownProps<T>) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [tempSelected, setTempSelected] = useState<Set<string>>(() => {
        if (currentFilter) return new Set(currentFilter);
        return new Set(allData.map(i => String(i[columnKey] ?? ''))); 
    });

    const uniqueValues = useMemo(() => {
        const set = new Set(allData.map(i => String(i[columnKey] ?? '')));
        return Array.from(set).sort();
    }, [allData, columnKey]);

    const filteredValues = useMemo(() => {
        if (!searchTerm) return uniqueValues;
        const lower = searchTerm.toLowerCase();
        return uniqueValues.filter(v => v.toLowerCase().includes(lower));
    }, [uniqueValues, searchTerm]);

    const isAllVisibleSelected = filteredValues.length > 0 && filteredValues.every(v => tempSelected.has(v));
    const isSomeVisibleSelected = filteredValues.some(v => tempSelected.has(v));

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
        <div ref={dropdownRef} className="absolute top-full right-0 mt-1 w-64 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xl z-50 text-sm font-normal text-slate-700 dark:text-slate-200 flex flex-col">
            <div className="p-2 border-b border-slate-100 dark:border-slate-700 flex flex-col gap-1">
                <button 
                    onClick={() => { onSort('asc'); onClose(); }}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-left w-full"
                >
                    <span className="text-slate-400">↓</span> A'dan Z'ye Sırala
                </button>
                <button 
                    onClick={() => { onSort('desc'); onClose(); }}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-left w-full"
                >
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
                        ref={input => { if(input) input.indeterminate = !isAllVisibleSelected && isSomeVisibleSelected }}
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

// --- Update Review Modal ---
interface PendingUpdate extends OrderUpdateResult {
  currentDate?: string;
  material?: string;
  materialDesc?: string;
  qty?: number;
}

const UpdateReviewModal: React.FC<{
    updates: PendingUpdate[];
    onConfirm: (selected: PendingUpdate[]) => void;
    onCancel: () => void;
}> = ({ updates, onConfirm, onCancel }) => {
    // Unique ID Helper
    const getUpdateKey = (u: PendingUpdate) => `${u.saBelgesi}_${u.sasKalemNo || u.material}_${u.newDate}`;
    
    // State
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set(updates.map(getUpdateKey)));
    const [sortConfig, setSortConfig] = useState<{ key: keyof PendingUpdate; direction: SortDirection } | null>(null);
    const [filters, setFilters] = useState<Record<string, string[] | undefined>>({});
    const [activeFilterDropdown, setActiveFilterDropdown] = useState<string | null>(null);

    // Derived Data (Filtered & Sorted)
    const displayedUpdates = useMemo(() => {
        let result = [...updates];
        
        // Filter
        result = result.filter(item => {
            return Object.entries(filters).every(([key, allowedValues]) => {
                if (!allowedValues) return true;
                const val = String(item[key as keyof PendingUpdate] ?? '');
                return (allowedValues as string[]).includes(val);
            });
        });

        // Sort
        if (sortConfig) {
            result.sort((a, b) => {
                const valA = a[sortConfig.key] ?? '';
                const valB = b[sortConfig.key] ?? '';
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [updates, filters, sortConfig]);

    // Handlers
    const toggle = (key: string) => {
        const newSet = new Set(selectedKeys);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        setSelectedKeys(newSet);
    };

    const toggleAllVisible = () => {
        const newSet = new Set(selectedKeys);
        const allVisibleSelected = displayedUpdates.every(u => newSet.has(getUpdateKey(u)));
        
        if (allVisibleSelected) {
            displayedUpdates.forEach(u => newSet.delete(getUpdateKey(u)));
        } else {
            displayedUpdates.forEach(u => newSet.add(getUpdateKey(u)));
        }
        setSelectedKeys(newSet);
    };

    const handleConfirm = () => {
        const toUpdate = updates.filter(u => selectedKeys.has(getUpdateKey(u)));
        onConfirm(toUpdate);
    };

    const requestSort = (key: keyof PendingUpdate, direction?: SortDirection) => {
        if (direction) {
             setSortConfig({ key, direction });
             return;
        }
        let newDirection: SortDirection = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
          newDirection = 'desc';
        }
        setSortConfig({ key, direction: newDirection });
    };

    const applyFilter = (key: string, values: string[] | undefined) => {
        setFilters(prev => {
            const next = { ...prev };
            if (values === undefined) delete next[key];
            else next[key] = values;
            return next;
        });
    };

    // Header Helper
    const ModalHeader = ({ label, field, className }: { label: string, field: keyof PendingUpdate, className?: string }) => {
        const isFiltered = filters[field] !== undefined;
        return (
            <th className={`p-3 bg-slate-100 dark:bg-slate-800 font-semibold text-slate-500 dark:text-slate-400 sticky top-0 z-10 select-none ${className || ''}`}>
                <div className="flex items-center justify-between gap-1 group">
                    <span 
                        className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 flex items-center" 
                        onClick={() => requestSort(field)}
                    >
                        {label}
                        {sortConfig?.key === field && (
                            <span className="ml-1 text-blue-600 dark:text-blue-400 text-xs">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                        )}
                    </span>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setActiveFilterDropdown(activeFilterDropdown === field ? null : field); }}
                        className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${isFiltered ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400'}`}
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                    </button>
                </div>
                {activeFilterDropdown === field && (
                    <FilterDropdown<PendingUpdate>
                        columnKey={field}
                        columnTitle={label}
                        allData={updates} 
                        currentFilter={filters[field]}
                        onApply={(vals) => applyFilter(field, vals)}
                        onClose={() => setActiveFilterDropdown(null)}
                        onSort={(dir) => requestSort(field, dir)}
                    />
                )}
            </th>
        );
    };

    const allVisibleSelected = displayedUpdates.length > 0 && displayedUpdates.every(u => selectedKeys.has(getUpdateKey(u)));

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 rounded-t-xl">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Termin Güncellemelerini Onayla</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Yapay zeka tarafından tespit edilen değişiklikler</p>
                    </div>
                    <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="overflow-y-auto p-0 flex-1">
                    <table className="w-full text-sm text-left text-slate-700 dark:text-slate-300">
                        <thead>
                            <tr>
                                <th className="p-3 w-10 text-center bg-slate-100 dark:bg-slate-800 sticky top-0 z-10">
                                    <input 
                                        type="checkbox" 
                                        checked={allVisibleSelected}
                                        onChange={toggleAllVisible}
                                        className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer dark:bg-slate-700"
                                    />
                                </th>
                                <ModalHeader label="Sipariş No" field="saBelgesi" />
                                <ModalHeader label="Mevcut Tarih" field="currentDate" className="text-center" />
                                <ModalHeader label="Yeni Tarih" field="newDate" className="text-center" />
                                <th className="p-3 w-20 bg-slate-100 dark:bg-slate-800 font-semibold text-slate-500 dark:text-slate-400 sticky top-0 z-10">Durum</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {displayedUpdates.length > 0 ? displayedUpdates.map((u, idx) => {
                                const key = getUpdateKey(u);
                                const isSelected = selectedKeys.has(key);
                                return (
                                    <tr key={key} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${isSelected ? 'bg-blue-50/30 dark:bg-blue-900/20' : ''}`} onClick={() => toggle(key)}>
                                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                            <input 
                                                type="checkbox" 
                                                checked={isSelected}
                                                onChange={() => toggle(key)}
                                                className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer dark:bg-slate-700"
                                            />
                                        </td>
                                        <td className="p-3">
                                            <div className="font-medium text-slate-800 dark:text-slate-200">{u.saBelgesi} <span className="text-slate-400 dark:text-slate-600 text-xs">/ {u.sasKalemNo || '-'}</span></div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">{u.material} - {u.materialDesc}</div>
                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{u.qty} ADT</div>
                                        </td>
                                        <td className="p-3 text-center font-mono text-slate-500 dark:text-slate-400">{u.currentDate || '-'}</td>
                                        <td className="p-3 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                                            {u.newDate}
                                            <span className="block text-[10px] text-blue-400 dark:text-blue-500 font-normal">YENİ</span>
                                        </td>
                                        <td className="p-3">
                                            {isSelected ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                                                    Güncelle
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                                                    Atla
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-400 dark:text-slate-500">
                                        Filtrelere uygun kayıt bulunamadı.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex justify-between items-center rounded-b-xl">
                    <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                        {selectedKeys.size} kayıt seçildi
                    </span>
                    <div className="flex gap-3">
                        <button onClick={onCancel} className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition">
                            İptal
                        </button>
                        <button 
                            onClick={handleConfirm} 
                            disabled={selectedKeys.size === 0}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Seçilenleri Güncelle
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


const EmailGenerator: React.FC<EmailGeneratorProps> = ({ 
  vendor, 
  initialTab = 'email', 
  onBack, 
  onMarkAsProcessed,
  onUpdateItem,
  onUpdateNote,
  isDarkMode
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  
  // Email Chat State
  const [emailContent, setEmailContent] = useState<string>('');
  const [emailLoading, setEmailLoading] = useState<boolean>(false);
  const [emailChatHistory, setEmailChatHistory] = useState<ChatMessage[]>([]);
  const [emailInputMessage, setEmailInputMessage] = useState('');
  
  // Order Chat State
  const [isOrderChatOpen, setIsOrderChatOpen] = useState(false);
  const [orderChatHistory, setOrderChatHistory] = useState<ChatMessage[]>([]);
  const [orderInputMessage, setOrderInputMessage] = useState('');
  const [orderChatLoading, setOrderChatLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  // Review Update State
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Asked Status State
  const [askedItems, setAskedItems] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Sorting & Filtering State
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>({
    key: 'kalanGun',
    direction: 'asc'
  });
  
  const [filters, setFilters] = useState<Record<string, string[] | undefined>>({});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState<string | null>(null);

  useEffect(() => {
      setActiveTab(initialTab);
      setEmailContent(''); 
      setEmailChatHistory([]);
      setOrderChatHistory([
        { role: 'model', text: "Merhaba! Malzemeler hakkında konuşabilir veya toplu tarih güncellemesi yapabilirim. Görsel veya metin gönderebilirsiniz.", timestamp: new Date() }
      ]);
      setSortConfig({ key: 'kalanGun', direction: 'asc' });
      setFilters({});
      // Removed setNotes({}) as notes are now persistent in item data
      setAskedItems(new Set());
  }, [vendor, initialTab]);

  const getRowKey = (item: SapOrderItem) => `${item.saBelgesi}-${item.sasKalemNo || item.malzeme}`;

  const toggleAsked = (key: string) => {
      setAskedItems(prev => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
      });
  };

  // --- Email Logic ---
  const generateDraft = async () => {
    setEmailLoading(true);
    setEmailChatHistory([]);
    try {
        const draft = await generateEmailDraft(vendor.vendorName, vendor.items);
        setEmailContent(draft);
        setEmailChatHistory([
          { role: 'model', text: "Taslağı hazırladım. Aşağıdaki panelden düzenleme yapabilir veya dosyayı indirebilirsiniz.", timestamp: new Date() }
        ]);
    } catch (e) {
        console.error(e);
    } finally {
        setEmailLoading(false);
    }
  };

  const handleSendEmailMessage = async () => {
    if (!emailInputMessage.trim() || emailLoading) return;
    const userMsg = emailInputMessage;
    setEmailInputMessage('');
    setEmailChatHistory(prev => [...prev, { role: 'user', text: userMsg, timestamp: new Date() }]);
    setEmailLoading(true);
    try {
      const refinedDraft = await refineEmail(emailContent, userMsg);
      setEmailContent(refinedDraft);
      setEmailChatHistory(prev => [...prev, { role: 'model', text: "E-posta içeriğini güncelledim.", timestamp: new Date() }]);
    } catch (e) {
      setEmailChatHistory(prev => [...prev, { role: 'model', text: "Üzgünüm, bir hata oluştu.", timestamp: new Date() }]);
    } finally {
      setEmailLoading(false);
    }
  };

  // --- Order Chat Logic ---
  const handleSendOrderMessage = async () => {
    if ((!orderInputMessage.trim() && !selectedImage) || orderChatLoading) return;
    
    const userMsg = orderInputMessage;
    const currentImage = selectedImage;
    
    // Clear inputs
    setOrderInputMessage('');
    setSelectedImage(null);

    // Add user message to UI
    setOrderChatHistory(prev => [...prev, { 
        role: 'user', 
        text: userMsg || (currentImage ? "Görsel Yüklendi" : ""), 
        timestamp: new Date(),
        image: currentImage ? URL.createObjectURL(currentImage) : undefined
    }]);

    setOrderChatLoading(true);

    try {
        let base64Image = undefined;
        if (currentImage) {
            base64Image = await convertFileToBase64(currentImage);
        }

        const result = await processOrderUpdates(vendor.items, userMsg, base64Image);
        
        // Add AI response text to UI
        setOrderChatHistory(prev => [...prev, { 
            role: 'model', 
            text: result.text, 
            timestamp: new Date() 
        }]);

        // Check for updates
        if (result.updates && result.updates.length > 0) {
            // Hydrate updates with current data for Review Modal
            const hydrated: PendingUpdate[] = result.updates.map(u => {
                const item = vendor.items.find(i => 
                    i.saBelgesi === u.saBelgesi && 
                    (i.sasKalemNo === u.sasKalemNo || (!u.sasKalemNo && i.malzeme === u.sasKalemNo)) // Loose match fallback
                );
                return {
                    ...u,
                    currentDate: item?.revizeTarih || item?.teslimatTarihi || '-',
                    material: item?.malzeme || '?',
                    materialDesc: item?.kisaMetin || '?',
                    qty: item?.bakiyeMiktari || 0
                };
            });
            
            setPendingUpdates(hydrated);
            setShowReviewModal(true);
        }

    } catch (e) {
        console.error(e);
        setOrderChatHistory(prev => [...prev, { role: 'model', text: "İsteğinizi işlerken bir hata oluştu.", timestamp: new Date() }]);
    } finally {
        setOrderChatLoading(false);
    }
  };

  const finalizeUpdates = (selected: PendingUpdate[]) => {
      let count = 0;
      selected.forEach(u => {
          onUpdateItem(u.saBelgesi, u.sasKalemNo, u.newDate);
          count++;
      });
      setShowReviewModal(false);
      setPendingUpdates([]);
      
      setOrderChatHistory(prev => [...prev, { 
          role: 'model', 
          text: `✅ ${count} adet sipariş tarihi güncellendi.`, 
          timestamp: new Date() 
      }]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [emailChatHistory, orderChatHistory, activeTab, isOrderChatOpen]);

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
    const updatedItems = vendor.items.filter(item => item.revizeTarih);
    if (updatedItems.length === 0) {
        alert("Henüz güncellenmiş bir tarih yok. Lütfen listeden teslim tarihlerini güncelleyin.");
        return;
    }
    const exportData = updatedItems.map(item => ({
        "SAS No": item.saBelgesi,
        "Kalem No": item.sasKalemNo || "10", 
        "Teslim Tarihi": item.revizeTarih
    }));
    const ws = window.XLSX.utils.json_to_sheet(exportData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Guncel Terminler");
    const safeName = vendor.vendorName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    window.XLSX.writeFile(wb, `termin_guncelleme_${safeName}.xlsx`);
  };

  const downloadTableAsExcel = () => {
    if (!window.XLSX) {
        alert("Excel kütüphanesi yüklenemedi.");
        return;
    }
    const exportData = filteredAndSortedItems.map(item => {
        const key = getRowKey(item);
        return {
            "SA BELGESİ": item.sasKalemNo ? `${item.saBelgesi} / ${item.sasKalemNo}` : item.saBelgesi,
            "MALZEME": item.malzeme,
            "KISA METİN": item.kisaMetin,
            "TESLİMAT TARİHİ": item.revizeTarih || item.teslimatTarihi || "",
            "KALAN GÜN": item.kalanGun,
            "BAKİYE": item.bakiyeMiktari,
            "BİRİM": item.olcuBirimi,
            "TALEP EDEN": item.talepEden,
            "OLUŞTURAN": item.olusturan,
            "AÇIKLAMA": item.aciklama || '',
            "DURUM": askedItems.has(key) ? 'Soruldu' : 'Bekliyor'
        };
    });
    const ws = window.XLSX.utils.json_to_sheet(exportData);
    const wscols = [
        { wch: 20 }, { wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 12 }
    ];
    ws['!cols'] = wscols;
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Siparis Listesi");
    const safeName = vendor.vendorName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    window.XLSX.writeFile(wb, `siparis_listesi_${safeName}.xlsx`);
  };

  const requestSort = (key: SortKey, direction?: SortDirection) => {
    if (direction) {
         setSortConfig({ key, direction });
         return;
    }
    let newDirection: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      newDirection = 'desc';
    }
    setSortConfig({ key, direction: newDirection });
  };

  const applyFilter = (key: string, values: string[] | undefined) => {
      setFilters(prev => {
          const next = { ...prev };
          if (values === undefined) {
              delete next[key];
          } else {
              next[key] = values;
          }
          return next;
      });
  };

  const filteredAndSortedItems = useMemo(() => {
    let items = vendor.items.filter(item => {
        return Object.entries(filters).every(([key, allowedValues]) => {
            const values = allowedValues as string[] | undefined;
            if (!values) return true;
            const itemVal = String(item[key as keyof SapOrderItem] ?? '');
            return values.includes(itemVal);
        });
    });

    if (sortConfig !== null) {
      items.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [vendor.items, sortConfig, filters]);

  const stats = useMemo(() => {
    const total = vendor.items.length;
    const critical = vendor.items.filter(i => i.status === 'critical').length;
    const warning = vendor.items.filter(i => i.status === 'warning').length;
    const ok = total - critical - warning;
    const onTimeRate = total > 0 ? Math.round((ok / total) * 100) : 0;
    const delayedItems = vendor.items.filter(i => i.kalanGun < 0);
    const avgDelay = delayedItems.length 
        ? Math.round(delayedItems.reduce((acc, i) => acc + Math.abs(i.kalanGun), 0) / delayedItems.length) 
        : 0;

    const pieData = [
        { name: 'Gecikmiş', value: critical, color: '#ef4444' },
        { name: 'Yaklaşan', value: warning, color: '#f59e0b' },
        { name: 'Zamanında', value: ok, color: '#10b981' }
    ].filter(d => d.value > 0);

    const sortedByDelay = [...vendor.items]
        .filter(i => i.status === 'critical')
        .sort((a, b) => a.kalanGun - b.kalanGun)
        .slice(0, 7)
        .map(i => ({
            name: i.saBelgesi,
            gun: Math.abs(i.kalanGun),
            desc: `${i.malzeme} - ${i.kisaMetin}`,
            color: Math.abs(i.kalanGun) > 60 ? '#b91c1c' : '#ef4444'
        }));

    const timelineGroups: Record<string, number> = {};
    vendor.items.forEach(item => {
        if (!item.teslimatTarihi) return;
        const parts = item.teslimatTarihi.split('.');
        if (parts.length === 3) {
            const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, 1);
            if (!isNaN(date.getTime())) {
                const key = date.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' });
                timelineGroups[key] = (timelineGroups[key] || 0) + 1;
            }
        }
    });
    const timelineData = Object.entries(timelineGroups).map(([name, count]) => ({ name, count }));
    return { total, critical, warning, ok, avgDelay, pieData, sortedByDelay, timelineData, onTimeRate };
  }, [vendor]);

  const modifiedCount = vendor.items.filter(i => i.revizeTarih).length;

  const RenderHeader = ({ label, field }: { label: string, field: SortKey }) => {
      const isFiltered = filters[field] !== undefined;
      return (
          <th className="p-4 border-b bg-slate-50 dark:bg-slate-800 select-none group relative whitespace-nowrap">
              <div className="flex items-center justify-between gap-2">
                  <span 
                    className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 flex items-center dark:text-slate-300" 
                    onClick={() => requestSort(field)}
                  >
                      {label}
                      {sortConfig?.key === field && (
                          <span className="ml-1 text-blue-600 dark:text-blue-400">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                  </span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setActiveFilterDropdown(activeFilterDropdown === field ? null : field); }}
                    className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${isFiltered ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-300'}`}
                  >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                  </button>
              </div>
              {activeFilterDropdown === field && (
                  <FilterDropdown<SapOrderItem>
                      columnKey={field}
                      columnTitle={label}
                      allData={vendor.items} 
                      currentFilter={filters[field]}
                      onApply={(vals) => applyFilter(field, vals)}
                      onClose={() => setActiveFilterDropdown(null)}
                      onSort={(dir) => requestSort(field, dir)}
                  />
              )}
          </th>
      );
  };

  const chartTickColor = isDarkMode ? '#94a3b8' : '#64748b';
  const chartGridStroke = isDarkMode ? '#334155' : '#f1f5f9';
  const chartTooltipStyle = isDarkMode ? {backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9'} : {};

  return (
    <div className="h-full flex flex-col gap-6 relative">
      
      {/* UPDATE REVIEW MODAL */}
      {showReviewModal && (
          <UpdateReviewModal 
              updates={pendingUpdates}
              onCancel={() => setShowReviewModal(false)}
              onConfirm={finalizeUpdates}
          />
      )}
      
      {/* Header Area */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 flex flex-col md:flex-row justify-between items-center gap-4">
        {/* ... (Header content unchanged) ... */}
        <div className="flex items-center gap-4 w-full md:w-auto">
           <button 
              onClick={onBack} 
              className="px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 hover:text-slate-900 dark:hover:text-white rounded-lg transition flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              Geri
            </button>
            <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white leading-tight">{vendor.vendorName}</h2>
                <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                    <span>{vendor.vendorId}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                    <span>{stats.total} Sipariş</span>
                    {stats.critical > 0 && <span className="text-red-500 font-medium">({stats.critical} Gecikme)</span>}
                </div>
            </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto md:justify-end">
             {activeTab === 'email' && emailContent && (
                 <>
                    <button onClick={downloadMarkdown} className="px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center gap-1 shadow-sm">
                        İndir (.md)
                    </button>
                    <button onClick={copyToClipboard} className="px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-1 shadow-sm">
                        Kopyala
                    </button>
                 </>
             )}
             
             {activeTab === 'orders' && (
                <>
                <button 
                  onClick={downloadTableAsExcel} 
                  className="px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center gap-1 shadow-sm transition mr-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    <span className="hidden lg:inline">Listeyi İndir</span>
                </button>
                <button 
                  onClick={downloadUpdatedExcel} 
                  className={`px-3 py-2 text-sm border rounded-lg flex items-center gap-1 shadow-sm transition ${
                      modifiedCount > 0 
                      ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' 
                      : 'bg-white dark:bg-slate-700 text-slate-400 border-slate-200 dark:border-slate-600 cursor-not-allowed'
                  }`}
                  disabled={modifiedCount === 0}
                  title={modifiedCount === 0 ? "İndirmek için tablodan tarih güncelleyin" : `${modifiedCount} güncellemeyi indir`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    <span className="hidden lg:inline">Excel (Yükleme Formatı)</span>
                    {modifiedCount > 0 && <span className="bg-white/20 px-1.5 rounded text-xs ml-1">{modifiedCount}</span>}
                </button>
                </>
             )}

            <button 
              onClick={onMarkAsProcessed}
              className="flex-1 md:flex-none px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-1 shadow-sm transition"
            >
              Tamamla & Çık
            </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700 flex gap-6 px-2">
          {/* ... (Tabs unchanged) ... */}
          <button onClick={() => setActiveTab('email')} className={`pb-3 px-1 text-sm font-medium transition-colors relative ${activeTab === 'email' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
             E-posta Taslağı
             {activeTab === 'email' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full"></span>}
          </button>
          <button onClick={() => setActiveTab('orders')} className={`pb-3 px-1 text-sm font-medium transition-colors relative ${activeTab === 'orders' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
             Sipariş Listesi
             {activeTab === 'orders' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full"></span>}
          </button>
          <button onClick={() => setActiveTab('analysis')} className={`pb-3 px-1 text-sm font-medium transition-colors relative ${activeTab === 'analysis' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
             Analiz Raporu
             {activeTab === 'analysis' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full"></span>}
          </button>
      </div>

      <div className="flex-1 min-h-0 relative">
          {/* EMAIL TAB */}
          {activeTab === 'email' && (
            <div className="h-full flex flex-col lg:flex-row gap-6">
                <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                        {emailLoading ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
                                <svg className="animate-spin w-8 h-8 mb-3 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <p>Gemini AI e-postayı oluşturuyor...</p>
                            </div>
                        ) : !emailContent ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
                                <svg className="w-16 h-16 mb-4 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                <p className="text-lg font-medium text-slate-600 dark:text-slate-300 mb-2">E-posta Taslağı Henüz Oluşturulmadı</p>
                                <p className="text-sm mb-6 text-center max-w-md">Bu tedarikçi için yapay zeka destekli bir e-posta taslağı oluşturmak için aşağıdaki butona tıklayın.</p>
                                <button onClick={generateDraft} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 shadow-md transition-all active:scale-95 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    AI ile Taslağı Oluştur
                                </button>
                            </div>
                        ) : (
                            <div className="prose prose-slate prose-sm max-w-none dark:prose-invert">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{emailContent}</ReactMarkdown>
                            </div>
                        )}
                    </div>
                </div>
                <div className="w-full lg:w-96 flex flex-col gap-4">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                        {/* ... (Summary unchanged) ... */}
                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Özet</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-700 text-center">
                                <span className="block text-2xl font-bold text-slate-700 dark:text-slate-200">{stats.total}</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">Toplam Sipariş</span>
                            </div>
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30 text-center">
                                <span className="block text-2xl font-bold text-red-600 dark:text-red-400">{stats.critical}</span>
                                <span className="text-xs text-red-400 dark:text-red-300">Geciken</span>
                            </div>
                        </div>
                    </div>
                    {/* ... (Chat Window unchanged) ... */}
                    <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                        <div className="p-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 font-medium text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
                            <span>Asistan ile Düzenle</span>
                            <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px] font-bold">AI</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
                            {emailChatHistory.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-lg p-3 text-sm shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-bl-none'}`}>
                                {msg.text}
                                </div>
                            </div>
                            ))}
                            {emailLoading && emailContent && (
                            <div className="flex justify-start">
                                <div className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg p-3 rounded-bl-none shadow-sm flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                                </div>
                            </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
                            <div className="flex gap-2">
                            <input
                                type="text"
                                value={emailInputMessage}
                                onChange={(e) => setEmailInputMessage(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendEmailMessage()}
                                placeholder="Revize isteği yaz..."
                                className="flex-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition"
                                disabled={emailLoading || !emailContent}
                            />
                            <button onClick={handleSendEmailMessage} disabled={emailLoading || !emailInputMessage.trim() || !emailContent} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
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
             <div className="h-full relative">
                 {/* Table Pane (Now Full Width) */}
                 <div className="w-full h-full bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                     <div className="flex-1 overflow-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <RenderHeader label="SA BELGESİ" field="saBelgesi" />
                                    <RenderHeader label="MALZEME" field="malzeme" />
                                    <RenderHeader label="KISA METİN" field="kisaMetin" />
                                    <RenderHeader label="TESLİMAT TARİHİ" field="teslimatTarihi" />
                                    <RenderHeader label="KALAN GÜN" field="kalanGun" />
                                    <RenderHeader label="BAKİYE" field="bakiyeMiktari" />
                                    <RenderHeader label="BİRİM" field="olcuBirimi" />
                                    <RenderHeader label="TALEP EDEN" field="talepEden" />
                                    <RenderHeader label="OLUŞTURAN" field="olusturan" />
                                    <th className="p-4 border-b bg-slate-50 dark:bg-slate-900 select-none text-slate-700 dark:text-slate-300 font-bold text-sm w-1/6">AÇIKLAMA</th>
                                    <th className="p-4 border-b bg-slate-50 dark:bg-slate-900 select-none text-slate-700 dark:text-slate-300 font-bold text-sm text-center">SORULDU?</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                                {filteredAndSortedItems.length > 0 ? (
                                    filteredAndSortedItems.map((item, idx) => {
                                        const isDelayed = item.kalanGun < 0;
                                        const isWarning = item.kalanGun >= 0 && item.kalanGun <= 7;
                                        const displayDate = item.revizeTarih || item.teslimatTarihi;
                                        const isModified = !!item.revizeTarih;
                                        const rowKey = getRowKey(item);
                                        const isAsked = askedItems.has(rowKey);
                                        
                                        const newRemainingDays = item.revizeTarih ? calculateDaysRemaining(item.revizeTarih) : null;
                                        const effectiveRemainingDays = newRemainingDays !== null ? newRemainingDays : item.kalanGun;
                                        
                                        const effectiveIsDelayed = effectiveRemainingDays < 0;
                                        const effectiveIsWarning = effectiveRemainingDays >= 0 && effectiveRemainingDays <= 7;

                                        return (
                                            <tr key={`${item.saBelgesi}-${idx}`} className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 group ${isAsked ? 'opacity-50 grayscale' : ''}`}>
                                                <td className="p-4 font-medium text-slate-800 dark:text-slate-200">
                                                    {item.saBelgesi} 
                                                    {item.sasKalemNo && <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">/{item.sasKalemNo}</span>}
                                                </td>
                                                <td className="p-4 text-slate-600 dark:text-slate-300">{item.malzeme}</td>
                                                <td className="p-4 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={item.kisaMetin}>{item.kisaMetin}</td>
                                                <td className={`p-4 ${isModified ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}>
                                                    <div className="relative flex items-center">
                                                        <input 
                                                            type="date" 
                                                            className="bg-transparent border-none focus:ring-0 text-sm w-full p-0 text-slate-700 dark:text-slate-200 cursor-pointer"
                                                            value={formatForInput(displayDate)}
                                                            onChange={(e) => {
                                                                const val = e.target.value; 
                                                                if(!val) return;
                                                                const [y, m, d] = val.split('-');
                                                                const newVal = `${d}.${m}.${y}`;
                                                                onUpdateItem(item.saBelgesi, item.sasKalemNo || '', newVal);
                                                            }}
                                                        />
                                                        {isModified && (
                                                            <span className="absolute right-0 top-0 -mt-2 -mr-2 flex h-2 w-2">
                                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center align-top">
                                                    {newRemainingDays !== null ? (
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[10px] text-slate-400 line-through decoration-slate-400 leading-none mb-1">
                                                                {item.kalanGun}
                                                            </span>
                                                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${effectiveIsDelayed ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300' : effectiveIsWarning ? 'bg-yellow-100 dark:bg-amber-400/10 text-yellow-700 dark:text-amber-300 dark:border dark:border-amber-400/20' : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'}`}>
                                                                {newRemainingDays}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${isDelayed ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300' : isWarning ? 'bg-yellow-100 dark:bg-amber-400/10 text-yellow-700 dark:text-amber-300 dark:border dark:border-amber-400/20' : 'bg-green-100 dark:bg-green-900/50 text-green-100 text-green-700 dark:text-green-300'}`}>
                                                            {item.kalanGun}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-center font-mono text-slate-700 dark:text-slate-300">{item.bakiyeMiktari}</td>
                                                <td className="p-4 text-slate-500 dark:text-slate-400 text-xs">{item.olcuBirimi}</td>
                                                <td className="p-4 text-slate-600 dark:text-slate-400">{item.talepEden}</td>
                                                <td className="p-4 text-slate-600 dark:text-slate-400">{item.olusturan}</td>
                                                <td className="p-4">
                                                    <textarea
                                                        className="w-full text-xs border border-slate-200 dark:border-slate-600 rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none resize-none bg-white dark:bg-slate-700 dark:text-slate-200 transition-colors"
                                                        rows={1}
                                                        placeholder="Not..."
                                                        value={item.aciklama || ''}
                                                        onChange={(e) => onUpdateNote(item.saBelgesi, item.sasKalemNo || '', e.target.value)}
                                                    />
                                                </td>
                                                <td className="p-4 text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isAsked}
                                                        onChange={() => toggleAsked(rowKey)}
                                                        className="w-5 h-5 text-blue-600 border-gray-300 dark:border-slate-600 rounded focus:ring-blue-500 cursor-pointer dark:bg-slate-700"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={11} className="p-8 text-center text-slate-400 flex flex-col items-center justify-center">
                                            <p>Listelenecek sipariş bulunamadı.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                     </div>
                 </div>
                 {/* ... (Chat Button and Modal unchanged) ... */}
                 {/* Floating Chat Button */}
                 <button
                    onClick={() => setIsOrderChatOpen(!isOrderChatOpen)}
                    className="fixed bottom-8 right-8 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center z-40 hover:scale-105 active:scale-95"
                    title="Liste Asistanı"
                 >
                    {isOrderChatOpen ? (
                         <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    ) : (
                         <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    )}
                 </button>

                 {/* Floating Chat Window */}
                 {isOrderChatOpen && (
                    <div className="fixed bottom-24 right-8 w-96 h-[500px] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden z-40 animate-in fade-in slide-in-from-bottom-10 duration-200">
                         {/* Chat Header */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-700 border-b border-slate-100 dark:border-slate-600 font-medium text-sm text-slate-700 dark:text-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                <span>Liste Asistanı</span>
                                <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px] font-bold">AI</span>
                            </div>
                            <button onClick={() => setIsOrderChatOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </button>
                        </div>

                        {/* Chat Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
                            {orderChatHistory.map((msg, idx) => (
                                <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div className={`max-w-[90%] rounded-lg p-3 text-sm shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-bl-none'}`}>
                                        {msg.image && (
                                            <img src={msg.image} alt="Uploaded" className="w-full h-auto rounded mb-2 border border-white/20" />
                                        )}
                                        {msg.text}
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-1">{msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                            ))}
                            {orderChatLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg p-3 rounded-bl-none shadow-sm flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Chat Input */}
                        <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
                            {selectedImage && (
                                <div className="flex items-center gap-2 mb-2 p-2 bg-slate-100 dark:bg-slate-700 rounded text-xs text-slate-600 dark:text-slate-300">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    <span className="truncate flex-1">{selectedImage.name}</span>
                                    <button onClick={() => setSelectedImage(null)} className="text-red-500 hover:text-red-700">✕</button>
                                </div>
                            )}
                            <div className="flex gap-2">
                                <label className="cursor-pointer p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition" title="Görsel Yükle">
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        className="hidden" 
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                setSelectedImage(e.target.files[0]);
                                            }
                                        }}
                                    />
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                </label>
                                <input
                                    type="text"
                                    value={orderInputMessage}
                                    onChange={(e) => setOrderInputMessage(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendOrderMessage()}
                                    placeholder="Mesaj yaz veya görsel ekle..."
                                    className="flex-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition"
                                    disabled={orderChatLoading}
                                />
                                <button onClick={handleSendOrderMessage} disabled={orderChatLoading || (!orderInputMessage.trim() && !selectedImage)} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                 )}
             </div>
          )}
          
          {/* ... (Analysis tab unchanged) ... */}
          {/* ANALYSIS TAB */}
          {activeTab === 'analysis' && (
             <div className="h-full overflow-y-auto pr-2">
                 {/* ... (Existing Analysis Content) ... */}
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                     <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden group">
                         <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <svg className="w-12 h-12 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" /></svg>
                         </div>
                         <h4 className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Toplam Açık İş</h4>
                         <p className="text-3xl font-extrabold text-slate-800 dark:text-white">{stats.total}</p>
                         <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span> Aktif Siparişler
                         </p>
                     </div>

                     <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden group">
                         <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <svg className="w-12 h-12 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                         </div>
                         <h4 className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Kritik Gecikme</h4>
                         <p className="text-3xl font-extrabold text-red-600 dark:text-red-500">{stats.critical}</p>
                         <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1">
                            <span className="text-red-500 font-bold">{Math.round((stats.critical / stats.total) * 100)}%</span> toplam sipariş oranı
                         </p>
                     </div>

                     <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden group">
                         <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <svg className="w-12 h-12 text-orange-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" /></svg>
                         </div>
                         <h4 className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Ortalama Gecikme</h4>
                         <p className="text-3xl font-extrabold text-orange-500">{stats.avgDelay}<span className="text-lg font-medium text-slate-400 dark:text-slate-500 ml-1">Gün</span></p>
                         <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Geciken kalemler için</p>
                     </div>

                     <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden group">
                         <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <svg className="w-12 h-12 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                         </div>
                         <h4 className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Zamanında Teslim Oranı</h4>
                         <p className={`text-3xl font-extrabold ${stats.onTimeRate > 80 ? 'text-emerald-500' : 'text-slate-700 dark:text-slate-200'}`}>%{stats.onTimeRate}</p>
                         <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                             Hedef: %90 ve üzeri
                         </p>
                     </div>
                 </div>

                 {/* Timeline Chart (Area) */}
                 <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 mb-6">
                     <div className="flex items-center justify-between mb-6">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Teslimat Zaman Çizelgesi (Önümüzdeki Aylar)</h4>
                        <span className="text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-900/50">Tahmini İş Yükü</span>
                     </div>
                     <div className="h-64 w-full">
                         {stats.timelineData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats.timelineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: chartTickColor, fontSize: 12}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: chartTickColor, fontSize: 12}} />
                                    <CartesianGrid vertical={false} stroke={chartGridStroke} />
                                    <RechartsTooltip 
                                        contentStyle={chartTooltipStyle}
                                        itemStyle={{color: isDarkMode ? '#f1f5f9' : '#1e293b', fontWeight: 'bold'}}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="count" 
                                        stroke="#3b82f6" 
                                        strokeWidth={3}
                                        fillOpacity={1} 
                                        fill="url(#colorCount)" 
                                        name="Teslimat Sayısı"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                         ) : (
                             <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                                 Veri Yetersiz
                             </div>
                         )}
                     </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                     <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 h-96 flex flex-col">
                         <h4 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-2">Sipariş Durum Dağılımı</h4>
                         <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">Genel portföy durumu</p>
                         <div className="flex-1 min-h-0 relative">
                             <ResponsiveContainer width="100%" height="100%">
                                 <PieChart>
                                     <Pie
                                        data={stats.pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                     >
                                         {stats.pieData.map((entry, index) => (
                                             <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                         ))}
                                     </Pie>
                                     <RechartsTooltip contentStyle={chartTooltipStyle} />
                                     <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                                 </PieChart>
                             </ResponsiveContainer>
                             <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none -mt-4">
                                <span className="block text-3xl font-extrabold text-slate-800 dark:text-white">{stats.total}</span>
                                <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest">Sipariş</span>
                             </div>
                         </div>
                     </div>

                     <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 h-96 flex flex-col">
                         <h4 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-2">En Kritik Gecikmeler (Top 7)</h4>
                         <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">SAS bazlı gecikme süreleri</p>
                         {stats.sortedByDelay.length > 0 ? (
                            <div className="flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        layout="vertical"
                                        data={stats.sortedByDelay}
                                        margin={{ top: 0, right: 30, left: 40, bottom: 0 }}
                                        barSize={20}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={chartGridStroke} />
                                        <XAxis type="number" hide />
                                        <YAxis 
                                            dataKey="name" 
                                            type="category" 
                                            width={80} 
                                            tick={{fontSize: 11, fill: chartTickColor}} 
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <RechartsTooltip 
                                            cursor={{fill: isDarkMode ? '#334155' : '#f8fafc'}}
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                const d = payload[0].payload;
                                                return (
                                                    <div className="bg-slate-800 dark:bg-slate-700 text-white p-3 shadow-xl rounded-lg text-xs z-50">
                                                        <p className="font-bold text-sm mb-1">SAS: {d.name}</p>
                                                        <p className="text-slate-300 mb-2">{d.desc}</p>
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                                            <span className="font-bold">{d.gun} Gün Gecikme</span>
                                                        </div>
                                                    </div>
                                                );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey="gun" radius={[0, 4, 4, 0]}>
                                            {stats.sortedByDelay.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                            <LabelList dataKey="gun" position="right" style={{ fontSize: '11px', fill: chartTickColor, fontWeight: 'bold' }} formatter={(val: number) => `${val} Gün`} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                         ) : (
                             <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-600">
                                 <svg className="w-10 h-10 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                 <p className="font-medium">Harika! Geciken sipariş yok.</p>
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
