
import { SapOrderItem, ComparisonReportData, VendorComparison, DiffItem } from '../types';

// Helper to generate a unique key for an item
const getItemKey = (item: SapOrderItem) => `${item.saBelgesi}_${item.sasKalemNo || item.malzeme}`;

export const compareDatasets = (oldData: SapOrderItem[], newData: SapOrderItem[]): ComparisonReportData => {
  const oldMap = new Map<string, SapOrderItem>();
  const newMap = new Map<string, SapOrderItem>();

  oldData.forEach(item => oldMap.set(getItemKey(item), item));
  newData.forEach(item => newMap.set(getItemKey(item), item));

  const vendorDiffs: Record<string, VendorComparison> = {};

  const getVendorEntry = (item: SapOrderItem): VendorComparison => {
    const vId = item.saticiKodu;
    if (!vendorDiffs[vId]) {
      vendorDiffs[vId] = {
        vendorId: vId,
        vendorName: item.saticiAdi,
        addedCount: 0,
        removedCount: 0,
        updatedCount: 0,
        items: []
      };
    }
    return vendorDiffs[vId];
  };

  // 1. Check for Added and Updated
  newData.forEach(newItem => {
    const key = getItemKey(newItem);
    const oldItem = oldMap.get(key);
    const vendor = getVendorEntry(newItem);

    if (!oldItem) {
      // Added (New Order)
      vendor.addedCount++;
      vendor.items.push({ type: 'added', item: newItem });
    } else {
      // Check for Updates (Date changed)
      const oldDate = oldItem.revizeTarih || oldItem.teslimatTarihi;
      const newDate = newItem.revizeTarih || newItem.teslimatTarihi;

      if (oldDate !== newDate) {
        vendor.updatedCount++;
        vendor.items.push({ 
            type: 'updated', 
            item: newItem,
            oldDate: oldDate,
            newDate: newDate
        });
      }
    }
  });

  // 2. Check for Removed (Closed/Delivered)
  oldData.forEach(oldItem => {
    const key = getItemKey(oldItem);
    if (!newMap.has(key)) {
      const vendor = getVendorEntry(oldItem);
      vendor.removedCount++;
      vendor.items.push({ type: 'removed', item: oldItem });
    }
  });

  // 3. Summarize
  const vendors = Object.values(vendorDiffs)
    .filter(v => v.addedCount > 0 || v.removedCount > 0 || v.updatedCount > 0)
    .sort((a, b) => (b.addedCount + b.updatedCount) - (a.addedCount + a.updatedCount));

  const totalAdded = vendors.reduce((sum, v) => sum + v.addedCount, 0);
  const totalRemoved = vendors.reduce((sum, v) => sum + v.removedCount, 0);
  const totalUpdated = vendors.reduce((sum, v) => sum + v.updatedCount, 0);

  return {
    totalAdded,
    totalRemoved,
    totalUpdated,
    vendors
  };
};
