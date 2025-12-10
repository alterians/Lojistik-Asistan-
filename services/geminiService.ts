
import { GoogleGenAI, SchemaType } from "@google/genai";
import { SapOrderItem, OrderUpdateResult } from '../types';

const getAiClient = () => {
  // Check LocalStorage first (User Setting), then Environment Variable
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;
  const apiKey = localKey || process.env.API_KEY;

  if (!apiKey) {
    console.error("API Key not found");
    throw new Error("API Anahtarı eksik. Lütfen ayarlardan geçerli bir anahtar girin.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateEmailDraft = async (
  vendorName: string, 
  items: SapOrderItem[], 
  extraInstructions: string = ""
): Promise<string> => {
  const ai = getAiClient();
  const modelId = "gemini-2.5-flash"; 

  // Pre-sort items: Critical (delayed) first, then Warning, then OK
  const sortedItems = [...items].sort((a, b) => a.kalanGun - b.kalanGun);

  const dataContext = JSON.stringify(sortedItems.map(item => ({
    PO: item.saBelgesi,
    ItemNo: item.sasKalemNo || "",
    Material: item.kisaMetin,
    Qty: `${item.bakiyeMiktari} ${item.olcuBirimi}`,
    Date: item.revizeTarih || item.teslimatTarihi || "Belirtilmemiş",
    DaysRemaining: item.kalanGun
  })), null, 2);

  const prompt = `
    Sen profesyonel bir Lojistik ve Tedarik Zinciri Asistanısın.
    Görevin: Tedarikçi "${vendorName}" için, açık siparişlerin durumunu soran ve termin teyidi isteyen net, anlaşılır bir e-posta oluşturmak.

    Veri Seti (Sadece referans için, tabloyu sen çizme):
    ${dataContext}

    E-posta Yazım Kuralları:
    1. **Format:** Markdown kullanma, düz metin gibi davran ancak paragrafları ayır.
    2. **Konu:** "Acil: Açık Sipariş Listesi ve Termin Durumu - ${vendorName}" gibi dikkat çekici bir konu önerisi ile başla (Konu: ... şeklinde).
    3. **Giriş:** Kısa ve profesyonel bir giriş yap.
    
    4. **Sipariş Tablosu:**
       - **ÖNEMLİ:** Sipariş tablosunu kendin oluşturma. Tablonun gelmesi gereken yere tam olarak şu ifadeyi yaz: {{SIPARIS_TABLOSU}}
       - Ben bu ifadeyi daha sonra özel bir Excel formatlı tablo ile değiştireceğim.
       
    5. **Kapanış:** "Yukarıdaki tabloda belirtilen siparişler için güncel terminlerinizi ivedilikle tarafımıza iletmenizi rica ederiz." minvalinde net bir çağrı yap.
    6. **Ekstra Notlar:** ${extraInstructions}

    Çıktı sadece e-posta metni olsun. Sohbet cümlesi kurma. {{SIPARIS_TABLOSU}} yer tutucusunu mutlaka kullan.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });
    return response.text || "E-posta oluşturulamadı.";
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    return "Bir hata oluştu. Lütfen API anahtarınızı kontrol edin.";
  }
};

export const refineEmail = async (
  currentEmail: string,
  userInstruction: string
): Promise<string> => {
  const ai = getAiClient();
  const modelId = "gemini-2.5-flash";

  const prompt = `
    Aşağıdaki e-posta taslağını kullanıcının yeni talimatına göre revize et.
    {{SIPARIS_TABLOSU}} yer tutucusunu KESİNLİKLE koru, silme veya değiştirme.
    
    Mevcut Taslak:
    ${currentEmail}

    Kullanıcı Talimatı:
    "${userInstruction}"

    Sadece revize edilmiş içeriği döndür.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });
    return response.text || "Revize edilemedi.";
  } catch (error) {
    console.error("Gemini Refinement Error:", error);
    return "Bağlantı hatası.";
  }
};

export const processOrderUpdates = async (
  currentItems: SapOrderItem[],
  userInstruction: string,
  imageBase64?: string
): Promise<{ text: string, updates: OrderUpdateResult[] }> => {
  const ai = getAiClient();
  // Using gemini-2.0-flash which is good for multimodal tasks (images + text)
  const modelId = "gemini-2.0-flash-exp"; 

  const simplifiedList = currentItems.map(i => 
    `${i.saBelgesi}${i.sasKalemNo ? '/' + i.sasKalemNo : ''} - ${i.malzeme} (${i.kisaMetin})`
  ).join('\n');

  const systemPrompt = `
    Sen bir Lojistik Operasyon Asistanısın. Görevin, kullanıcının metin veya görsel olarak verdiği bilgileri analiz ederek, mevcut sipariş listesindeki tarihleri güncellemektir.

    Mevcut Sipariş Listesi (Referans):
    ${simplifiedList}

    Kurallar:
    1. Kullanıcının mesajında veya yüklediği görselde geçen tarih güncellemelerini tespit et.
    2. Eğer görselde bir tablo varsa, ilgili Sipariş Numarası (SA Belgesi) ve Kalem Numarası ile eşleşen satırları bul.
    3. Tarih formatını mutlaka "DD.MM.YYYY" (Örn: 15.05.2025) formatına çevir.
    4. Sadece kesin emin olduğun eşleşmeleri JSON formatında döndür.
    5. Ayrıca kullanıcıya ne yaptığını açıklayan kısa bir metin yanıtı ver.

    Döndürmen gereken JSON şeması:
    {
       "responseMessage": "Kullanıcıya açıklama metni",
       "updates": [
          { "saBelgesi": "450012345", "sasKalemNo": "10", "newDate": "15.05.2025" }
       ]
    }
    
    Not: sasKalemNo yoksa boş string olabilir ama eşleşme için SA Belgesi şarttır.
  `;

  const parts: any[] = [{ text: systemPrompt }];
  
  if (imageBase64) {
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: imageBase64
      }
    });
  }

  parts.push({ text: `Kullanıcı Girdisi: ${userInstruction}` });

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts },
      config: {
        responseMimeType: "application/json"
      }
    });

    const jsonStr = response.text || "{}";
    const parsed = JSON.parse(jsonStr);

    return {
      text: parsed.responseMessage || "İşlem tamamlandı.",
      updates: parsed.updates || []
    };

  } catch (error) {
    console.error("Gemini Order Update Error:", error);
    return { text: "Güncelleme sırasında bir hata oluştu.", updates: [] };
  }
};
