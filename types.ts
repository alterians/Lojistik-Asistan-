
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
  
  // New fields for Item tracking and Updates
  sasKalemNo?: string;    // SAS Kalem No (Item Number)
  revizeTarih?: string;   // Manually updated date
  
  // New fields requested
  talepEden?: string;     // Talep Eden
  olusturan?: string;     // Oluşturan

  // Optional / Computed
  status?: 'critical' | 'warning' | 'ok'; 
}

export interface VendorSummary {
  vendorId: string;
  vendorName: string;
  itemCount: number;
  criticalCount: number;
  items: SapOrderItem[];
}

export enum AppState {
  UPLOAD = 'UPLOAD',
  DASHBOARD = 'DASHBOARD',
  GENERATOR = 'GENERATOR'
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
