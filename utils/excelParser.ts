
import { SapOrderItem } from '../types';

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
       const diffTime = targetDate.getTime() - today.getTime();
       return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
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

export const parseExcelData = async (file: File): Promise<SapOrderItem[]> => {
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
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Read with header:1 to get array of arrays
        const jsonData: any[] = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (!jsonData || jsonData.length === 0) {
           resolve([]);
           return;
        }

        // Find Header Row intelligently
        let headerRowIndex = -1;
        // Look for key columns to identify the header row
        const keyColumns = ['SA Belgesi', 'Satıcı Adı', 'Malzeme', 'Kısa Metin', 'Teslimat Tarihi'];
        
        for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
          const rowStr = JSON.stringify(jsonData[i]).toLowerCase();
          // Check if row contains at least 2 of our key columns
          const matchCount = keyColumns.filter(k => normalize(rowStr).includes(normalize(k))).length;
          if (matchCount >= 2) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
            // Fallback: assume first row
            headerRowIndex = 0;
        }

        const headers = jsonData[headerRowIndex] as string[];
        const rows = jsonData.slice(headerRowIndex + 1);

        // Map known columns to indices
        // CRITICAL: Removed 'SA Talebi' from saBelgesi aliases to ensures we get the PO number (starts with 45 usually)
        // We specifically look for 'SA Belgesi' or 'SAS Numarası'
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
            // New Columns
            talepEden: findHeaderIndex(headers, ['Talep Eden', 'Talep']),
            olusturan: findHeaderIndex(headers, ['Olusturan', 'Oluşturan', 'Yaratan', 'Kaydeden']),
            aciklama: findHeaderIndex(headers, ['Aciklama', 'Açıklama', 'Not', 'Notlar'])
        };

        const mappedData: SapOrderItem[] = rows.map((row: any) => {
          const getVal = (index: number) => (index !== -1 && row[index] !== undefined) ? row[index] : null;

          const saBelgesi = String(getVal(idx.saBelgesi) || '');
          const sasKalemNo = String(getVal(idx.sasKalemNo) || '');
          
          // Logic for Remaining Days (Kalan Gün)
          let kalanGun = 0;
          const rawKalan = getVal(idx.kalanGun);
          const rawTeslimat = getVal(idx.teslimatTarihi);
          const rawIlkTarih = getVal(idx.ilkTarih);
          
          // Calculate logic
          if (rawKalan !== null && rawKalan !== '' && !isNaN(parseInt(rawKalan))) {
             kalanGun = parseInt(rawKalan, 10);
          } else if (rawTeslimat) {
             // If KALAN GÜN is missing, calculate from Delivery Date
             const calculated = parseDateToDaysRemaining(rawTeslimat);
             if (calculated !== null) kalanGun = calculated;
          }

          // Format display date string
          const teslimatStr = formatDisplayDate(rawTeslimat);
          const ilkTarihStr = formatDisplayDate(rawIlkTarih);

          // Determine Status
          let status: 'critical' | 'warning' | 'ok' = 'ok';
          if (kalanGun < 0) {
            status = 'critical';
          } else if (kalanGun <= 10) {
            // Changed from 7 to 10 days for "Yaklaşan" warning
            status = 'warning';
          }

          // Vendor identification
          let saticiAdi = String(getVal(idx.saticiAdi) || '');
          const saticiKodu = String(getVal(idx.saticiKodu) || '');
          
          // If Vendor Name is missing but Code exists and looks like a name (or fallback)
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
            sasKalemNo, // Include item number
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
            ilkTarih: ilkTarihStr, // Added parsed Initial Date
            status,
            // New columns
            talepEden: String(getVal(idx.talepEden) || ''),
            olusturan: String(getVal(idx.olusturan) || ''),
            aciklama: String(getVal(idx.aciklama) || '')
          };
        }).filter(item => {
            // Filter out empty or invalid rows
            return item.saBelgesi && item.saBelgesi !== 'undefined' && item.saticiAdi !== 'Bilinmeyen Tedarikçi';
        });

        resolve(mappedData);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};
