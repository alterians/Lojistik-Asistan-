
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  writeBatch, 
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { SapOrderItem, VendorContact, Supplier } from "../types";

const firebaseConfig = {
  apiKey: "AIzaSyDWH0DxKMiF5F4Mv4n-4mldbSc0N54Q7nw",
  authDomain: "koluman-tedarik.firebaseapp.com",
  projectId: "koluman-tedarik",
  storageBucket: "koluman-tedarik.firebasestorage.app",
  messagingSenderId: "258091911762",
  appId: "1:258091911762:web:ac6a9f0f2176b389b5ed8b",
  measurementId: "G-KLD7FM064X"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

// --- Vendor Contacts (Legacy UI support via Suppliers) ---

// Helper to get SellerCode -> DocumentID map
export async function getSupplierIndexBySellerCode(): Promise<Map<string, string>> {
  const suppliersCol = collection(db, "suppliers");
  const snap = await getDocs(suppliersCol);
  const m = new Map<string, string>();
  snap.forEach((d) => {
    const data = d.data();
    if (data?.sellerCode) m.set(String(data.sellerCode).trim(), d.id);
  });
  return m;
}

// Main Sync Function for Excel Upload
export const upsertSuppliersFromExcel = async (rows: Supplier[], sourceFileName?: string) => {
  if (rows.length === 0) return { inserted: 0, updated: 0 };
  
  // 1. Get existing map to decide update vs create
  const index = await getSupplierIndexBySellerCode();
  
  // 2. Chunk array (Firestore batch limit is 500)
  const chunkArray = <T>(array: T[], size: number): T[][] => {
      const chunked: T[][] = [];
      for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
      }
      return chunked;
  };
  const chunks = chunkArray(rows, 500);

  let inserted = 0;
  let updated = 0;

  for (const chunk of chunks) {
    const batch = writeBatch(db);

    for (const r of chunk) {
      const sellerCode = String(r.sellerCode || "").trim();
      if (!sellerCode) continue;

      const existingId = index.get(sellerCode);

      // Clean undefined values for Firestore
      const cleanPayload = JSON.parse(JSON.stringify(r));

      const payload = {
        ...cleanPayload,
        sellerCode, // Ensure it's set
        source: "excel",
        sourceFileName: sourceFileName || "",
        updatedAt: serverTimestamp(),
      };

      if (existingId) {
        // Update existing doc
        batch.set(doc(db, "suppliers", existingId), payload, { merge: true });
        updated++;
      } else {
        // Create new doc
        const newRef = doc(collection(db, "suppliers"));
        batch.set(newRef, { ...payload, createdAt: serverTimestamp() }, { merge: true });
        inserted++;
      }
    }

    await batch.commit();
  }

  console.log(`Supplier Sync: ${inserted} inserted, ${updated} updated.`);
  return { inserted, updated };
};

// Fetch all suppliers and convert to VendorContact map for UI
export const getContactsFromFirebase = async (): Promise<Record<string, VendorContact>> => {
  const suppliersCol = collection(db, "suppliers");
  const snapshot = await getDocs(suppliersCol);
  
  const contacts: Record<string, VendorContact> = {};
  snapshot.forEach(doc => {
    const data = doc.data() as Supplier;
    if (data.sellerCode) {
        contacts[data.sellerCode] = {
            vendorId: data.sellerCode,
            contactName: data.supplierRepName,
            contactPhone: data.supplierRepPhone,
            contactEmail: data.supplierRepEmail
        };
    }
  });
  
  return contacts;
};

// --- Orders Operations (unchanged logic) ---

export const saveOrdersToFirebase = async (orders: SapOrderItem[]) => {
  if (orders.length === 0) return;
  
  const ordersRef = collection(db, "orders");
  const chunkArray = <T>(array: T[], size: number): T[][] => {
      const chunked: T[][] = [];
      for (let i = 0; i < array.length; i += size) chunked.push(array.slice(i, i + size));
      return chunked;
  };
  const chunks = chunkArray(orders, 450);

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach(item => {
      const docId = `${item.saBelgesi}_${item.sasKalemNo || item.malzeme}`;
      const docRef = doc(ordersRef, docId);
      // Ensure no undefined values
      const cleanItem = JSON.parse(JSON.stringify(item));
      batch.set(docRef, cleanItem);
    });
    await batch.commit();
  }
  console.log(`${orders.length} orders synced to Firebase.`);
};

export const getOrdersFromFirebase = async (): Promise<SapOrderItem[]> => {
  const ordersRef = collection(db, "orders");
  const snapshot = await getDocs(ordersRef);
  
  const orders: SapOrderItem[] = [];
  snapshot.forEach(doc => {
    orders.push(doc.data() as SapOrderItem);
  });
  
  return orders;
};

export const saveContactsToFirebase = async (contacts: Record<string, VendorContact>) => {
    // Deprecated for direct use, prefer upsertSuppliersFromExcel for full data
    // Keeping for compatibility with legacy calls if any
    console.warn("saveContactsToFirebase is deprecated. Use upsertSuppliersFromExcel.");
};

export { db };
