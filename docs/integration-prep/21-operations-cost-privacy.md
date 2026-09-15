# 21 — Operasyon, maliyet ve gizlilik kapıları

Açık kaynak kod ücretsiz olabilir; çalıştırmak ücretsiz değildir. Bu dosya model servislerinin production'da beklenmedik maliyet, gecikme veya kullanıcı verisi riski yaratmasını önlemek için hazırlanmıştır.

## 1. Motor sınıfları

### Hafif / senkron adaylar
- pyfao56 küçük tarih penceresi
- OpenAgri GDD/risk formülleri
- basit model karşılaştırmaları

### Orta / cache zorunlu
- PCSE sezon simülasyonu
- AquaCrop tek/az sayıda senaryo
- OpenET dış veri sorgusu

### Ağır / async veya batch adayı
- segmentation
- multi-sensor fusion
- büyük raster işlemleri
- image ML batch
- FarmVibes ağır workflow'ları

UI açılışını ağır model run'ına bağlamamak.

---

## 2. Maliyet bütçesi

Her production adayı için şu kart doldurulur:

```text
engine:
compute_per_run:
avg_runtime:
p95_runtime:
external_api_cost_per_run:
storage_per_run:
expected_runs_per_field_day:
expected_active_fields:
estimated_monthly_cost:
max_monthly_budget:
```

Model ücretsiz repo olsa da CPU/GPU, API ve storage masrafı ayrıca hesaplanır.

## Cost guard

Server-side limitler:

```text
max runs / user / day
max runs / field / day
max concurrent runs
max raster area
max date window
max image size
max daily provider spend
```

Kullanıcı aynı kartı 10 kez açtı diye model 10 kez koşmaz.

---

## 3. Cache politikası

Cache TTL motorun veri doğasına göre belirlenir.

### pyfao56
Aynı tarih/input geçmiş hesap ise uzun süre immutable olabilir; bugün/gelecek hava girdisi değişiyorsa fingerprint değişir.

### PCSE
Input sezon verisi değişmediği sürece cache kullanılabilir. Yeni tarla operasyonu/evre gözlemi input fingerprint'i bozmalıdır.

### AquaCrop
Scenario config cache key'in parçasıdır.

### AutoGeoBound
Geometri/görüntü tarihi değişmezse candidate cache olabilir; kullanıcı onaylı final geometry candidate cache değildir.

### Pest risk
Hava ve zamanla değiştiği için TTL daha kısa.

---

## 4. Veri minimizasyonu

Bir motorun çalışması için ne gerekiyorsa yalnız o veri gönderilir.

Örnek:
- pyfao56'a kullanıcı adı gerekmez.
- PCSE'ye telefon/e-posta gerekmez.
- AutoGeoBound'a depo envanteri gerekmez.
- image modeline bütün tarla operasyon geçmişi gerekmez.

Backend domain context'ten minimum inference input çıkarır.

---

## 5. Hassas geometri/konum

Tarla poligonu iş gereği dış modele gönderilecekse:

- provider/gateway açıkça kayıtlı olmalı,
- transport encryption olmalı,
- kalıcı loga gereksiz geometri yazılmamalı,
- retention belli olmalı,
- üçüncü taraf kullanım şartı incelenmeli.

R&D notebook'a gerçek kullanıcı poligonu kopyalanmaz.

---

## 6. Fotoğraf lifecycle

Hastalık modeli için görüntü gerektiğinde ayrı lifecycle:

```text
user upload
 -> authorized storage
 -> inference input
 -> result
 -> retention policy
 -> user deletion / expiry behavior
```

Model gateway ham fotoğrafı varsayılan olarak kalıcı training datasına dönüştürmez.

Training için kullanım ayrı ürün/izin kararıdır.

---

## 7. Log politikası

Loglanabilir:
- requestId
- engine/version
- status
- latency
- error code
- input completeness
- coarse quality flags

Varsayılan loglanmaz:
- auth token
- tam kullanıcı profili
- ham fotoğraf
- tam field polygon
- bütün hava JSON'u
- tüm soil report
- AI prompt içinde gereksiz kişisel veri

Debug gerektiğinde kısa süreli, kontrollü ve redacted log tercih edilir.

---

## 8. Retention

`integration_runs` audit özeti ile ham model input aynı şey değildir.

Öneri:
- audit metadata: daha uzun saklanabilir
- ham inference payload: mümkünse hiç kalıcı saklama
- ağır raster intermediate: TTL/expiry
- temporary image: lifecycle policy
- cache: veri türüne göre TTL

Kesin süreler product/privacy politikasına göre implementasyon öncesi belirlenir.

---

## 9. Availability / circuit breaker

Dış motor çökerse TarlaPusula'nın temel uygulaması çökmemeli.

Circuit breaker mantığı:

```text
çok sayıda ardışık hata
 -> entegrasyonu geçici unhealthy işaretle
 -> yeni çağrı azalt/durdur
 -> mevcut güvenli fallback'e dön
```

Pusula bu sırada model sonucu uydurmaz.

---

## 10. Latency budget

Kullanıcı etkileşimi sınıfları:

### Anlık UI
Hedef: model çağrısı gerektirmemeli veya cache'den gelmeli.

### Detay analizi
Kullanıcı loading görebilir; birkaç saniyelik server work kabul edilebilir.

### Senaryo/simülasyon
Async job olabilir; tamamlanınca sonuç açılır. Sürekli polling yerine makul status akışı.

Bu değerler gerçek ölçümden sonra sayısal SLO'ya çevrilir; hazırlıkta rastgele p95 hedefi uydurulmaz.

---

## 11. Model failure fallback

| Motor | Fail olursa |
| --- | --- |
| pyfao56 | mevcut Irrigation Engine devam eder |
| PCSE | mevcut phenology engine devam eder |
| AquaCrop | senaryo sonucu yok; ana sulama akışı devam eder |
| AutoGeoBound | manuel çizim devam eder |
| Pest risk | risk sinyali yok; GBIF/fotoğraf/diğer özellikler çalışır |
| Disease model V2 | mevcut teşhis akışı veya kontrollü no-result |
| OpenET | mevcut ETc hesabı devam eder |
| FarmVibes modülü | mevcut satellite/decision engine devam eder |

Yeni entegrasyon temel uygulamanın single point of failure'ı olmaz.

---

## 12. Security / dependency gate

Model runner image hazırlanırken:
- dependency versions lock
- mümkünse hashes
- known vulnerability scan
- non-root runtime
- minimum network access
- read-only filesystem mümkünse
- secret env only
- no secrets in image/repo
- upstream commit recorded

GPU/runtime image de versionlanır.

---

## 13. Veri sağlayıcı terms değişikliği

Dış API'ler için `reviewedAt` metadata tutulur. Sağlayıcı terms, fiyat veya lisans değiştirirse:

1. yeni kullanım koşulları incelenir,
2. gerekiyorsa kill switch,
3. attribution/UI güncellenir,
4. maliyet budget tekrar hesaplanır.

---

## 14. Production readiness kartı

```text
Engine:
Upstream pin:
Code license:
Data/API terms:
Secrets location:
Data sent externally:
Retention:
Cache policy:
Timeout:
Retry policy:
Rate limit:
Cost budget:
Fallback:
Kill switch:
Telemetry:
Privacy reviewed:
Security reviewed:
GO / HOLD:
```

Bu kart dolmadan `production` rollout mode'a geçilmez.
