# 20 — Pusula model kanıt politikası

Amaç: yeni motorlar geldikçe Pusula'nın her şeyi aynı ağırlıkta gerçek kabul etmesini engellemek.

## Ana ilke

Pusula AI **kanıtları yorumlar**, kanıtı icat etmez.

Her motor sonucu şu sorulara cevap vermelidir:
- ne ölçüldü / modellendi?
- hangi tarihe ait?
- hangi kaynaktan geldi?
- ölçüm mü, kullanıcı kaydı mı, uzaktan algılama mı, model mi?
- ne kadar taze?
- kalite sorunu var mı?

## Kanıt sınıfları

```ts
type EvidenceMethod =
  | 'measured'
  | 'user_entered'
  | 'remote_sensing'
  | 'modeled'
  | 'external_observation';
```

### Örnekler

- laboratuvar pH: `measured`
- çiftçinin sulama kaydı: `user_entered`
- Sentinel-2 NDVI: `remote_sensing`
- PCSE gelişim evresi: `modeled`
- GBIF geçmiş gözlemi: `external_observation`

Bunlar kullanıcı dilinde aynı kesinlikte sunulmaz.

---

## Kanıt ağırlığı prensibi

Sabit bir evrensel puan tablosu yoktur; fakat genel sıralama:

1. doğru ve güncel doğrudan ölçüm/kullanıcı operasyon kaydı
2. kaliteli güncel uzaktan algılama
3. bağlama uygun doğrulanmış model sonucu
4. bölgesel/geçmiş dış gözlem

Örnek: 15 km uzakta 3 yıl önceki GBIF gözlemi, tarlada bugün çekilmiş uzman doğrulanmış fotoğraftan güçlü kanıt olamaz.

---

## Çelişen kanıt

Pusula çelişkiyi gizlemez.

Örnek:

```text
NDVI düşüş gösteriyor
ama
son toprak nemi ölçümü normal
```

Sonuç:
- “kesin su stresi” denmez,
- başka nedenler olabileceği belirtilir,
- gerekirse sahadan fotoğraf/gözlem istenir.

## Çelişki işareti

```ts
interface EvidenceConflict {
  category: string;
  evidenceIds: string[];
  reason: string;
}
```

Decision engine çelişki varsa confidence düşürür veya öneriyi gözlem isteğine dönüştürür.

---

## Model sonucu için güven dili

Kullanıcıya ham `% confidence` her zaman gösterilmez; model confidence kalibre edilmemiş olabilir.

Tercih:
- güçlü kanıt
- orta kanıt
- sınırlı kanıt
- veri yetersiz

Bu etiketler yalnız gerçek quality/evidence kurallarından türetilir.

---

## pyfao56 kanıtı

Pusula'nın görebileceği örnek:

```text
Kategori: irrigation
Kaynak: pyfao56 / FAO-56 karşılaştırması
Metod: modeled
Tarih aralığı: 7 gün
ETc: ...
Kök bölgesi su açığı: ...
Kalite: weather_complete, soil_profile_complete
```

Pusula bunu:

> “Su açığı artıyor; son sulama kaydın da eski görünüyor.”

şeklinde açıklayabilir **yalnız son sulama kaydı gerçekten varsa**.

---

## PCSE kanıtı

```text
Kategori: phenology
Kaynak: PCSE/WOFOST
Metod: modeled
Tahmini evre: ...
Model version: ...
Input completeness: ...
```

Pusula bunu kesin saha gözlemi gibi söylemez.

Doğru dil:
- “Model tarlayı çiçeklenmeye yakın değerlendiriyor.”

Yanlış dil:
- “Tarlan çiçeklenmede.”

Eğer kullanıcı sahadan evreyi doğrulamışsa güven artabilir.

---

## AquaCrop kanıtı

AquaCrop senaryosu “gelecek kesin böyle olacak” değildir.

Doğru dil:
- “Aynı sezon koşullarında model, mevcut sulama senaryosuna göre alternatif senaryoda daha az su stresi gösteriyor.”

Yanlış:
- “Bu sulamayı yaparsan 6.2 ton kesin ürün alırsın.”

Yield çıktısı model senaryosu etiketiyle kalır.

---

## AutoGeoBound kanıtı

Bu bir karar kanıtı değil, geometry candidate'dır.

Pusula:
- “Sınırı otomatik buldum” yerine
- “Bu alan için bir sınır önerisi hazırladım; kontrol eder misin?”

der.

Kullanıcı onayı gelmeden tarla geometri gerçeği sayılmaz.

---

## Pest risk kanıtı

Risk sinyalleri ayrı tutulur:

- GBIF geçmiş yakın çevre gözlemi
- hava/GDD modeli
- saha fotoğrafı
- kullanıcı gözlemi
- fenoloji uygunluğu

### Güçlü risk örneği

```text
yakın çevrede yakın tarihli gözlem
+ uygun sıcaklık/GDD
+ hassas ürün evresi
+ kullanıcının benzer belirti fotoğrafı
```

Yine de pestisit tavsiyesi için ruhsat/etiket/hava/depo ve teşhis güvenliği ayrıca kontrol edilir.

---

## Stale kanıt

Her evidence `stale` olabilir.

Pusula stale kanıtı kritik önerinin tek dayanağı yapmaz.

Örnek:
- 45 günlük NDVI son gözlemi -> güncel su stresi kanıtı değil
- geçen sezon toprak pH -> bazı bağlamlarda hâlâ faydalı olabilir

Tazelik metriğe özeldir.

---

## “Neden bunu öneriyorum?” üretimi

Ana kart:
- 1–2 kısa cümle

Altında en fazla 2–3 güçlü kanıt:

```text
Neden bunu öneriyorum?
• Son 10 günde bitki tüketimi yağıştan yüksek.
• Son sulama kaydı 6 gün önce.
• Önümüzdeki 3 gün anlamlı yağış görünmüyor.
```

Kanıtların her biri gerçek source/evidence objesine bağlanmalıdır.

Teknik model adları ana kartta zorunlu değildir; detay ekranında gösterilir.

---

## Yasak davranışlar

- model output'undan olmayan neden uydurmak
- confidence'ı yuvarlayıp daha kesin göstermek
- eski veriyi güncel gibi kullanmak
- GBIF gözlemini tarlada teşhis gibi sunmak
- PCSE evresini saha ölçümü gibi anlatmak
- AquaCrop yield tahminini garanti gibi göstermek
- AutoGeoBound sınırını kullanıcı onayı olmadan gerçek parsel kabul etmek
- “AI böyle dedi”yi tek kanıt olarak göstermek

---

## Pusula decision payload taslağı

```ts
interface PusulaDecisionPayload {
  fieldId: string;
  decisionType: string;
  recommendation: string;
  evidence: DecisionEvidence[];
  conflicts: EvidenceConflict[];
  confidenceBand: 'low' | 'medium' | 'high' | 'insufficient';
  generatedAt: string;
  expiresAt?: string;
}
```

LLM'ye gönderilen bağlam normalize ve minimum olmalıdır. Ham model dump yerine seçilmiş domain evidence gönderilir.

---

## Guardrail sırası

Pusula mesajı üretilmeden:

1. field/season doğru mu?
2. ürün hasat edilmiş mi?
3. evidence taze mi?
4. required evidence var mı?
5. evidence conflict var mı?
6. öneri güvenli aksiyon sınıfında mı?
7. inventory/label/weather gibi ek kapı gerekiyor mu?
8. ancak sonra doğal dil üret.

Bu sıra stage error ve alakasız tavsiyeleri azaltmak için korunur.
