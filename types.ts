
export interface SapOrderItem {
  saBelgesi: string;      // SA Belgesi (PO Number)
  kalanGun: number;       // KALAN GÜN
  saticiKodu: string;     // Satıcı
  saticiAdi: string;      // Satıcı Adı
  malzeme: string;        // Malzeme
  kisaMetin: string;      // Kısa Metin
  sasMiktari: number;     // SAS Miktarı
  malGirisMiktari: number;// Mal Giriş Miktarı
  bakiyeMiktari: number;  // Bakiye Miktarı
  olcuBirimi: string;     // Ölçü Birimi
  teslimatTarihi?: string;// Teslimat Tarihi (Display)
  ilkTarih?: string;      // İlk Teslimat Tarihi (Original Promise Date)
  
  // New fields for Item tracking and Updates
  sasKalemNo?: string;    // SAS Kalem No (Item Number)
  revizeTarih?: string;   // Manually updated date
  aciklama?: string;      // User notes/remarks
  
  // New fields requested
  talepEden?: string;     // Talep Eden
  olusturan?: string;     // Oluşturan

  // Optional / Computed
  status?: 'critical' | 'warning' | 'ok'; 
}

export interface VendorContact {
  vendorId: string;
  contactName?: string; // Tedarikçi Temsilcisi
  contactPhone?: string; // Temsilci Tel
  contactEmail?: string; // Temsilci E-Mail
}

// Firestore Model for Suppliers
export interface Supplier {
  sellerCode: string;          // Satıcı (Unique Key for Upsert logic)
  sellerName?: string;         // Satıcının adı
  scope?: string;              // Kapsam
  subScope?: string;           // Alt Kapsam
  city?: string;               // İl
  region?: string;             // Bölge
  purchasingSpecialist?: string; // Satınalma Uzmanı
  supplierRepName?: string;    // Tedarikçi Temsilcisi
  supplierRepPhone?: string;   // Temsilci Tel.
  supplierRepEmail?: string;   // Temsilci E-Mail
  distribution_17_11?: string; // 17.11 DAĞILIM
  mipName?: string;            // MIP İSİM
  
  // Metadata
  source?: string;
  sourceFileName?: string;
  updatedAt?: any;
  createdAt?: any;
}

export interface VendorSummary {
  vendorId: string;
  vendorName: string;
  itemCount: number;
  criticalCount: number;
  warningCount: number; // Added for Approaching deadlines
  items: SapOrderItem[];
  contact?: VendorContact; // New field for contact details
}

export enum AppState {
  UPLOAD = 'UPLOAD',
  DASHBOARD = 'DASHBOARD',
  GENERATOR = 'GENERATOR',
  COMPARISON = 'COMPARISON' // New State
}

export type TabType = 'email' | 'orders' | 'analysis';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  image?: string; // Base64 string for uploaded images
}

export interface OrderUpdateResult {
  saBelgesi: string;
  sasKalemNo: string;
  newDate: string; // DD.MM.YYYY
}

// --- Comparison Types ---

export type DiffType = 'added' | 'removed' | 'updated' | 'unchanged';

export interface DiffItem {
  type: DiffType;
  item: SapOrderItem;
  oldDate?: string; // For updates
  newDate?: string; // For updates
}

export interface VendorComparison {
  vendorId: string;
  vendorName: string;
  addedCount: number;
  removedCount: number;
  updatedCount: number;
  items: DiffItem[];
}

export interface ComparisonReportData {
  totalAdded: number;
  totalRemoved: number;
  totalUpdated: number;
  vendors: VendorComparison[];
}
