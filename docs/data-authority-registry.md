# TarlaPusula Veri Otoritesi Sözleşmesi

Amaç: Kullanıcı aynı gerçeği iki farklı menüde tekrar girmesin; farklı ekranlar aynı veriyi farklı tablo/service/motorlara yazmasın. Dış veri tarafında ise birden fazla güvenilir kaynak kullanılabilir, fakat karar motorları tek kanonik bağlam tüketir.

## Temel kural

1. **Kullanıcı girdisi:** bir kanonik form/komut + bir kanonik write service + bir kanonik persistence modeli.
2. **Çok kaynaklı dış veri:** birden fazla provider → normalizasyon → kalite/tarih kontrolü → fusion → tek kanonik snapshot.
3. **Ekranlar veri sahibi değildir.** Ekran yalnızca kanonik komutu açar veya kanonik snapshot'ı gösterir.
4. **Türetilen kayıt ikinci kullanıcı girdisi değildir.** Örn. Gübreleme işlemi kaydedilince depo stok hareketi aynı server transaction'ından türetilir.
5. **Plan ≠ gerçekleşen işlem.** Takvim bir plan/hint'tir. Kullanıcı “Yaptım” dediğinde gerçek işlem ortak Tarla İşlemi kapısından kaydedilir; sonra plan tamamlanır.
6. **Kaynak/provenance kaybolmaz.** Birleşik veride sources, observedAt/generatedAt, confidence/agreement ve fusionMethod korunur.

## Kanonik alanlar

| Domain | Kullanıcı giriş kapısı | Kanonik service / motor | Kanonik veri | Durum |
|---|---|---|---|---|
| Tarla | `src/pages/AddFieldScreen.tsx` | `fieldService.createUserField` | `fields` | ✅ Tek aktif ekran; eski Calendar kopyası kaldırıldı |
| Tarla işlemi | `FieldOperationModal` | `fieldOperation.service` → `tp_create_field_operation` | `activities` | ✅ Server write gate |
| Sürme / Toprak İşleme / Sürüm | Aynı Tarla İşlemi formu | `normalizeFieldOperationType` | `activities.activity_type='Sürme'` | ✅ Normalize |
| Gübre/ilaç kullanımı | Tarla İşlemi formu | `tp_create_field_operation` | `activities` + türetilmiş `farm_inventory_products.remaining_amount` | 🟡 Server atomik; UI exact inventory selection tamamlanacak |
| Depo ürün kartı | Depo ekranı | `pestStoreService` | `farm_inventory_products` | 🟡 Yeni kullanıcı yazısında offline-alternate-truth kaldırılacak |
| Sulama işlemi | Tarla İşlemi formu | `fieldOperation.service` | `activities` | ✅ Tek write gate; karar motorları buradan okur |
| Takvim | Calendar formu / `Takvimime ekle` bridge | calendar controller | `calendar_reminders` | 🟡 Plan tamamlanınca gerçek işlem formuna köprü kurulacak |
| Eksik veri görevleri | Görevlerim | verified task RPC | ilgili gerçek tarla kolonu + `field_todos` | ✅ Puan server doğrulamalı |
| Pusula puanı | gerçek eylemin completion'ı | gamification RPC | server ledger/state | ✅ Dedupe; izin/takvim eklemeye puan yok |
| Toprak laboratuvar raporu | Toprak Analizi | `soilAnalysisService` + `soil-analysis` Edge | `soil_analyses` | ✅ Canonical |
| Eski lab analiz tablosu | — | — | `field_lab_analyses` | ⚠️ 0 kayıt; legacy kilitlenecek |
| Pusula harita hafızası | harita motoru | `unified-map-ai` | `field_ai_observations` | ✅ 964+ kayıt, canonical |
| Eski AI tabloları | — | — | `field_ai_analyses`, `map_ai_analyses` | ⚠️ 0 kayıt; legacy kilitlenecek |
| Kısa vadeli hava | otomatik | `weather-compare` | ECMWF + GFS + DWD ICON → canonical forecast | ✅ Multi-source fusion |
| 3 hava kaynağı karşılaştırması | Hava ekranı | aynı `weather-compare` cevabı | provider forecasts | ✅ Kullanıcıya görünür kalır |
| İlaçlama havası | otomatik | aynı `weather-compare.sprayDecision` | 3 modelden ihtiyatlı saatlik context | ✅ Ayrı best-match yolu kaldırıldı |
| Yakın dönem iklim | otomatik | climate context | ERA5/ERA5-Land + NASA POWER → canonical context | 🟡 Basit ortalamadan metrik-bazlı fusion'a evrilecek |
| NDVI/Sentinel-2 | otomatik | satellite/data bridge | canonical snapshot + source date | ✅ cache/in-flight tekliği |
| Sentinel-1 | otomatik | satellite/data bridge | canonical radar snapshot | ✅ |
| SoilGrids | otomatik | data bridge | model snapshot; gerçek lab daha üst otorite | ✅ |
| Yeni NDVI sahnesi bildirimi | otomatik | tek push motoru | last-notified scene state | 🟡 Uçtan uca doğrulama bekliyor |

## Yasak desenler

- Component içinde doğrudan aynı domain tablosuna ikinci `insert/update` yolu açmak.
- Aynı tarımsal işlemi farklı Türkçe etiketlerle farklı kayıt tiplerine çevirmek.
- Server kaydı başarısız olduğunda yeni kullanıcı girdisini localStorage'a “gerçek kayıt” olarak yazmak.
- Hava/uydu/toprak için ekran bazlı ayrı karar motoru çalıştırmak.
- Bir modelde risk sinyali varken kritik operasyon kararını kör aritmetik ortalamayla güvenli göstermeye çalışmak.
- Kullanıcının planı tamamlandı diye gerçek saha işlemini varsaymak; gerçekleşen işlem kullanıcı onayıyla kaydedilir.

## Fusion ilkeleri

- Sıcaklık: robust median / doğrulanmış ağırlık.
- Yağış: model uzlaşması + olasılık + miktar; risk kararında ihtiyatlılık.
- Rüzgâr/ilaçlama: yüksek-risk değerleri bastırılmaz; konservatif birleşim.
- Toprak: laboratuvar > saha sensörü/kullanıcı ölçümü > model/grid.
- Uydu: farklı sensörler ortalanmaz; sensör rolüne göre fusion yapılır.
- Kaynak anlaşmazlığı kullanıcıya “güven” ve “Neden?” kanıtında yansıtılır.
