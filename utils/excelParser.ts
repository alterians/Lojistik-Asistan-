
import { SapOrderItem, VendorContact, Supplier } from '../types';

declare global {
  interface Window {
    XLSX: any;
  }
}

// Helper to normalize headers for comparison (remove spaces, lower case, tr chars)
const normalize = (str: string) => str.toLowerCase()
  .replace(/ı/g, 'i')
  .replace(/ş/g, 's')
  .replace(/ğ/g, 'g')
  .replace(/ü/g, 'u')
  .replace(/ö/g, 'o')
  .replace(/ç/g, 'c')
  .replace(/[^a-z0-9]/g, '');

const findHeaderIndex = (headers: string[], possibleNames: string[]): number => {
  const normalizedPossible = possibleNames.map(normalize);
  // Find the index of the first header that matches ANY of the possible names
  return headers.findIndex(h => h && normalizedPossible.includes(normalize(h.toString())));
};

// Cleaners
const cleanStr = (val: any): string => {
    if (val === undefined || val === null) return "";
    return String(val).trim();
};

const cleanPhone = (val: any): string => {
    if (!val) return "";
    let s = String(val).trim();
    // Basic cleanup, maybe remove non-printable chars
    return s.replace(/[\r\n]+/g, " ");
};

const cleanEmail = (val: any): string => {
    if (!val) return "";
    let s = String(val).trim();
    // If multiple emails separated by ; take the first or keep all? 
    // Requirement says "first or keep separate". Let's keep as string but clean up.
    return s;
};

// Excel dates are number of days since Jan 1, 1900 (mostly)
const excelDateToJSDate = (serial: number): Date => {
   return new Date(Math.round((serial - 25569) * 86400 * 1000));
};

const parseDateToDaysRemaining = (dateVal: any): number | null => {
   if (!dateVal) return null;
   let targetDate: Date | null = null;
   
   // Excel Serial Date (number)
   if (typeof dateVal === 'number') {
      targetDate = excelDateToJSDate(dateVal);
   } else if (typeof dateVal === 'string') {
      // Try DD.MM.YYYY (Turkish format common in SAP)
      const parts = dateVal.split('.');
      if (parts.length === 3) {
          targetDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      } else {
          // Try standard YYYY-MM-DD or MM/DD/YYYY
          const d = new Date(dateVal);
          if (!isNaN(d.getTime())) targetDate = d;
      }
   }

   if (targetDate && !isNaN(targetDate.getTime())) {
       const today = new Date();
       today.setHours(0,0,0,0);
       
       // Fix: Force targetDate to local midnight to avoid UTC/Timezone offsets causing +1 day error with Math.ceil
       targetDate.setHours(0,0,0,0);
       
       const diffTime = targetDate.getTime() - today.getTime();
       // Use Math.round instead of Math.ceil because we snapped both to midnight.
       return Math.round(diffTime / (1000 * 60 * 60 * 24)); 
   }
   return null;
};

const formatDisplayDate = (dateVal: any): string | undefined => {
    if (!dateVal) return undefined;
    
    // If it's an Excel serial number
    if (typeof dateVal === 'number') {
        const date = excelDateToJSDate(dateVal);
        return date.toLocaleDateString('tr-TR'); // DD.MM.YYYY
    }
    
    // If it's already a string, try to clean it up or verify it looks like a date
    if (typeof dateVal === 'string') {
        // If it looks like DD.MM.YYYY, keep it
        if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(dateVal)) return dateVal;
        // If standard ISO, convert
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) return d.toLocaleDateString('tr-TR');
        return dateVal;
    }
    
    return String(dateVal);
};

export const parseExcelData = async (file: File): Promise<{ items: SapOrderItem[], contacts: Record<string, VendorContact>, suppliers: Supplier[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!window.XLSX) {
          reject(new Error("XLSX library not loaded"));
          return;
        }
        
        const workbook = window.XLSX.read(data, { type: 'binary' });
        
        // --- 1. Parse Orders (Main Sheet) ---
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData: any[] = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });

        let mappedData: SapOrderItem[] = [];

        if (jsonData && jsonData.length > 0) {
            // Find Header Row intelligently
            let headerRowIndex = -1;
            const keyColumns = ['SA Belgesi', 'Satıcı Adı', 'Malzeme', 'Kısa Metin', 'Teslimat Tarihi'];
            
            for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
              const rowStr = JSON.stringify(jsonData[i]).toLowerCase();
              const matchCount = keyColumns.filter(k => normalize(rowStr).includes(normalize(k))).length;
              if (matchCount >= 2) {
                headerRowIndex = i;
                break;
              }
            }

            if (headerRowIndex === -1) headerRowIndex = 0;

            const headers = jsonData[headerRowIndex] as string[];
            const rows = jsonData.slice(headerRowIndex + 1);

            const idx = {
                saBelgesi: findHeaderIndex(headers, ['SA Belgesi', 'SAS Numarasi', 'Siparis No', 'Belge']),
                sasKalemNo: findHeaderIndex(headers, ['Kalem', 'Kalem No', 'SAS Kalemi', 'Siparis Kalemi']), 
                kalanGun: findHeaderIndex(headers, ['KALAN GÜN', 'Kalan Gun', 'Gun']),
                teslimatTarihi: findHeaderIndex(headers, ['Teslimat Tarihi', 'Teslim Tarihi', 'Tarih']),
                ilkTarih: findHeaderIndex(headers, ['Ilk Tarih', 'İlk Tarih', 'Ilk Teslimat', 'İlk Teslimat Tarihi']),
                saticiKodu: findHeaderIndex(headers, ['Satici', 'Satıcı', 'Satıcı Kodu']),
                saticiAdi: findHeaderIndex(headers, ['Satici Adi', 'Satıcı Adı', 'Tedarikçi', 'Tedarikçi Adı']),
                malzeme: findHeaderIndex(headers, ['Malzeme', 'Malzeme No']),
                kisaMetin: findHeaderIndex(headers, ['Kisa Metin', 'Kısa Metin', 'Malzeme Tanımı', 'Metin']),
                sasMiktari: findHeaderIndex(headers, ['SAS Miktari', 'Sipariş Miktarı', 'Miktar']),
                bakiyeMiktari: findHeaderIndex(headers, ['Bakiye Miktari', 'Bakiye', 'Acik Miktar']),
                olcuBirimi: findHeaderIndex(headers, ['Olcu Birimi', 'Ölçü Birimi', 'Birim', 'Olcu']),
                talepEden: findHeaderIndex(headers, ['Talep Eden', 'Talep']),
                olusturan: findHeaderIndex(headers, ['Olusturan', 'Oluşturan', 'Yaratan', 'Kaydeden']),
                aciklama: findHeaderIndex(headers, ['Aciklama', 'Açıklama', 'Not', 'Notlar'])
            };

            mappedData = rows.map((row: any) => {
              const getVal = (index: number) => (index !== -1 && row[index] !== undefined) ? row[index] : null;

              const saBelgesi = String(getVal(idx.saBelgesi) || '');
              const sasKalemNo = String(getVal(idx.sasKalemNo) || '');
              
              let kalanGun = 0;
              const rawKalan = getVal(idx.kalanGun);
              const rawTeslimat = getVal(idx.teslimatTarihi);
              const rawIlkTarih = getVal(idx.ilkTarih);
              
              // Priority: Calculated from Date > Excel Value
              if (rawTeslimat) {
                 const calculated = parseDateToDaysRemaining(rawTeslimat);
                 if (calculated !== null) {
                     kalanGun = calculated;
                 } else if (rawKalan !== null && rawKalan !== '' && !isNaN(parseInt(rawKalan))) {
                     kalanGun = parseInt(rawKalan, 10);
                 }
              } else if (rawKalan !== null && rawKalan !== '' && !isNaN(parseInt(rawKalan))) {
                 kalanGun = parseInt(rawKalan, 10);
              }

              const teslimatStr = formatDisplayDate(rawTeslimat);
              const ilkTarihStr = formatDisplayDate(rawIlkTarih);

              let status: 'critical' | 'warning' | 'ok' = 'ok';
              if (kalanGun < 0) {
                status = 'critical';
              } else if (kalanGun <= 10) {
                status = 'warning';
              }

              let saticiAdi = String(getVal(idx.saticiAdi) || '');
              const saticiKodu = String(getVal(idx.saticiKodu) || '');
              
              if (!saticiAdi) {
                 if (saticiKodu && saticiKodu.length > 5 && isNaN(Number(saticiKodu))) {
                     saticiAdi = saticiKodu;
                 } else if (saticiKodu) {
                     saticiAdi = `Tedarikçi (${saticiKodu})`;
                 } else {
                     saticiAdi = "Bilinmeyen Tedarikçi";
                 }
              }

              return {
                saBelgesi,
                sasKalemNo,
                kalanGun,
                saticiKodu,
                saticiAdi,
                malzeme: String(getVal(idx.malzeme) || ''),
                kisaMetin: String(getVal(idx.kisaMetin) || ''),
                sasMiktari: Number(getVal(idx.sasMiktari) || 0),
                malGirisMiktari: 0, 
                bakiyeMiktari: Number(getVal(idx.bakiyeMiktari) || 0),
                olcuBirimi: String(getVal(idx.olcuBirimi) || 'ADT'),
                teslimatTarihi: teslimatStr,
                ilkTarih: ilkTarihStr,
                status,
                talepEden: String(getVal(idx.talepEden) || ''),
                olusturan: String(getVal(idx.olusturan) || ''),
                aciklama: String(getVal(idx.aciklama) || '')
              };
            }).filter(item => {
                return item.saBelgesi && item.saBelgesi !== 'undefined' && item.saticiAdi !== 'Bilinmeyen Tedarikçi';
            });
        }

        // --- 2. Parse Suppliers (TEDARİKCİ LIST Sheet) ---
        const contacts: Record<string, VendorContact> = {};
        const suppliers: Supplier[] = [];
        
        // Find sheet with "TEDARİKCİ LIST" or similar
        const supplierSheetName = workbook.SheetNames.find((n: string) => 
            normalize(n).includes('tedarikci') && normalize(n).includes('list')
        ) || workbook.SheetNames.find((n: string) => normalize(n).includes('tedarikci'));

        if (supplierSheetName) {
            const supplierSheet = workbook.Sheets[supplierSheetName];
            const supplierJson: any[] = window.XLSX.utils.sheet_to_json(supplierSheet, { header: 1 });
            
            if (supplierJson && supplierJson.length > 0) {
                // Find Header
                let sHeaderIndex = 0;
                // Heuristic: Look for 'Satıcı' and 'Temsilci E-Mail' or 'Satınalma Uzmanı'
                for (let i = 0; i < Math.min(supplierJson.length, 10); i++) {
                    const rowStr = JSON.stringify(supplierJson[i]).toLowerCase();
                    if (rowStr.includes('satıcı') && (rowStr.includes('mail') || rowStr.includes('ad'))) {
                        sHeaderIndex = i;
                        break;
                    }
                }

                const sHeaders = supplierJson[sHeaderIndex] as string[];
                const sRows = supplierJson.slice(sHeaderIndex + 1);

                const sIdx = {
                    sellerCode: findHeaderIndex(sHeaders, ['Satıcı', 'Satici', 'Vendor']),
                    sellerName: findHeaderIndex(sHeaders, ['Satıcının adı', 'Saticinin adi', 'Tedarikçi Adı']),
                    scope: findHeaderIndex(sHeaders, ['Kapsam']),
                    subScope: findHeaderIndex(sHeaders, ['Alt Kapsam']),
                    city: findHeaderIndex(sHeaders, ['İl', 'Il', 'Sehir']),
                    region: findHeaderIndex(sHeaders, ['Bölge', 'Bolge']),
                    purchasingSpecialist: findHeaderIndex(sHeaders, ['Satınalma Uzmanı', 'Satinalma Uzmani']),
                    supplierRepName: findHeaderIndex(sHeaders, ['Tedarikçi Temsilcisi', 'Temsilci Adı', 'İlgili Kişi']),
                    supplierRepPhone: findHeaderIndex(sHeaders, ['Temsilci Tel', 'Telefon', 'Tel.']),
                    supplierRepEmail: findHeaderIndex(sHeaders, ['Temsilci E-Mail', 'Email', 'E-Posta']),
                    distribution_17_11: findHeaderIndex(sHeaders, ['17.11 DAĞILIM', '17.11 DAGILIM', 'DAGILIM']),
                    mipName: findHeaderIndex(sHeaders, ['MIP İSİM', 'MIP ISIM'])
                };

                sRows.forEach((row: any) => {
                    const getVal = (index: number) => (index !== -1 && row[index] !== undefined) ? String(row[index]).trim() : '';
                    const code = getVal(sIdx.sellerCode);
                    
                    if (code) {
                        // 1. Create Supplier Object for Firestore
                        const supplier: Supplier = {
                            sellerCode: code,
                            sellerName: cleanStr(getVal(sIdx.sellerName)),
                            scope: cleanStr(getVal(sIdx.scope)),
                            subScope: cleanStr(getVal(sIdx.subScope)),
                            city: cleanStr(getVal(sIdx.city)),
                            region: cleanStr(getVal(sIdx.region)),
                            purchasingSpecialist: cleanStr(getVal(sIdx.purchasingSpecialist)),
                            supplierRepName: cleanStr(getVal(sIdx.supplierRepName)),
                            supplierRepPhone: cleanPhone(getVal(sIdx.supplierRepPhone)),
                            supplierRepEmail: cleanEmail(getVal(sIdx.supplierRepEmail)),
                            distribution_17_11: cleanStr(getVal(sIdx.distribution_17_11)),
                            mipName: cleanStr(getVal(sIdx.mipName))
                        };
                        suppliers.push(supplier);

                        // 2. Map to existing VendorContact for UI compatibility
                        contacts[code] = {
                            vendorId: code,
                            contactName: supplier.supplierRepName,
                            contactPhone: supplier.supplierRepPhone,
                            contactEmail: supplier.supplierRepEmail
                        };
                    }
                });
            }
        }

        resolve({ items: mappedData, contacts, suppliers });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};
