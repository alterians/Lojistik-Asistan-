import { GoogleGenAI } from "@google/genai";
import { SapOrderItem } from '../types';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API Key not found in environment variables");
    throw new Error("API Key is missing. Please select a valid API key.");
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

  // Filter for critical items to highlight in prompt logic if needed
  const criticalItems = items.filter(i => i.status === 'critical');

  const dataContext = JSON.stringify(items.map(item => ({
    PO: item.saBelgesi,
    Material: item.malzeme,
    Description: item.kisaMetin,
    RemainingDays: item.kalanGun,
    DeliveryDate: item.teslimatTarihi || "Belirtilmemiş",
    OpenQty: item.bakiyeMiktari,
    Unit: item.olcuBirimi
  })), null, 2);

  const prompt = `
    Sen profesyonel bir Lojistik ve Tedarik Zinciri Asistanısın.
    Görevin: Aşağıdaki SAP sipariş verilerini kullanarak tedarikçi "${vendorName}" için net, kurumsal ve sonuç odaklı bir e-posta metni oluşturmak.
    
    Sipariş Verileri (JSON):
    ${dataContext}

    E-posta Yazım Kuralları:
    1. Format: Markdown.
    2. Konu Satırı: Sipariş numaralarını veya genel durumu özetleyen dikkat çekici bir konu. (Örn: "Acil: Geciken Siparişler ve Termin Talebi")
    3. Giriş: Nazikçe selamla ve açık siparişlerin durumunu sormak için yazıldığını belirt.
    
    4. Gecikme Özeti Tablosu (ÖNEMLİ):
       - Ana malzeme listesinden önce, *sadece* geciken (Kalan Gün < 0) siparişleri içeren özel bir özet tablo oluştur.
       - Bu tabloyu en fazla gecikmesi olandan (Kalan Gün değeri en düşük/negatif sayıdan) en aza doğru sırala.
       - Bu tablonun başlıkları tam olarak şu şekilde olmalı: | SA Belgesi | KALAN GÜN |
       - Eğer geciken sipariş yoksa bu tabloyu oluşturma.

    5. Detaylı Malzeme Listesi: 
       - Tüm açık siparişlerin detaylarını içeren ana tabloyu oluştur. 
       - Tablo Kolonları: | Sipariş No | Malzeme Tanımı | Termin Tarihi | Kalan Gün | Miktar |
       - Geciken satırları vurgula (Markdown bold).

    6. Vurgu: Metin içinde gecikmelerin operasyona etkisinden kısaca bahset.
    7. Call to Action: "Lütfen açık siparişleriniz için güncel termin bilgisini en kısa sürede iletiniz." mesajını ekle.
    8. Ekstra Notlar: ${extraInstructions}

    Sadece e-posta içeriğini (Markdown) döndür. Giriş/Çıkış konuşması yapma.
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
    
    Mevcut Taslak (Markdown):
    ${currentEmail}

    Kullanıcı Talimatı:
    "${userInstruction}"

    Sadece revize edilmiş Markdown içeriğini döndür.
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