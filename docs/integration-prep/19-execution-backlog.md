# 19 — Uygulama backlog'u

Bu backlog sınır/uygulama zamanı geldiğinde sırayla yürütülecek işlerdir. Her kart başka bir motorun hazırlığını bozmadan, küçük ve geri alınabilir PR olmalıdır.

## Bağımlılık anahtarı

- `BLOCKED`: veri/altyapı eksik, başlamamalı.
- `READY`: hazırlık dokümanları yeterli, implementation başlayabilir.
- `SHADOW FIRST`: canlı kullanıcı kararına dokunmadan kıyas yapılır.

---

## TP-INT-001 — Ortak integration contracts çekirdeği

**Durum:** READY — ilk motor PR'ı içinde yapılır.

### Kapsam
- `IntegrationResult<T>`
- `IntegrationQuality`
- `IntegrationEvidence`
- ortak error/status tipleri
- model version / adapter version metadata

### Kabul
- provider'a özel type component katmanına sızmıyor
- `no_data` gerçek bir first-class state
- unit test var

### Bitti tanımı
Ortak contract pyfao56 adapter tarafından kullanılıyor; gereksiz generic framework şişmesi yok.

---

## TP-INT-002 — Model Gateway minimum contract

**Durum:** READY

### Kapsam
- health
- version
- run endpoint sözleşmesi
- service auth
- timeout/error mapping
- idempotency/input fingerprint

### Kabul
- frontend gateway secret görmüyor
- model version runtime response'ta var
- timeout sahte sonuç üretmiyor
- exact upstream pin kaydediliyor

### Bağımlılık
TP-INT-001 ile aynı PR veya hemen öncesi.

---

## TP-INT-010 — pyfao56 shadow pilotu

**Durum:** READY FOR IMPLEMENTATION, fakat gerçek sulama doğrulaması ground truth verisine bağlı.

### Branch
`feat/pyfao56-shadow`

### Kapsam
- pin: `1d242ee985be0edbc4946f06e7e94a487d4bc0c9`
- adapter + validation
- mevcut ET/Kc output ile aynı gün karşılaştırma
- shadow run kaydı
- telemetry
- feature flag default off/shadow

### Kesinlikle yok
- mevcut irrigation decision replacement
- kullanıcıya otomatik sulama emri
- HomeScreen servis çağrısı

### Kabul
- aynı input tekrarında deterministik sonuç
- eksik günlük veri => no-data/invalid input
- ET farkı kaydediliyor ve açıklanabilir
- rollback = flag off

### Sonraki kapı
Gerçek sulama miktarı doğrulaması için tarih+miktar+toprak/kök bağlamı.

---

## TP-INT-020 — PCSE gerçek yıllık ürün pilotu

**Durum:** READY tasarım / DATA BLOCKED olabilir.

### Branch
`feat/pcse-pilot`

### Pin
`67a28e56b0e34655f8d60b0b4a254a7c81efbb2f`

### Önkoşul
Tek bir yıllık ürün tarlası için:
- ekim tarihi
- tam sezon günlük hava
- toprak/site
- crop parameter set
- en az birkaç saha evre gözlemi

### Kapsam
- season input mapper
- PCSE runner
- kendi phenology engine ile comparison
- admin/internal pilot output

### Kabul
- gerçek evre tarih hatası ölçülüyor
- missing soil/weather fail-safe
- model sonucu ana fenoloji otoritesini hemen değiştirmiyor

---

## TP-INT-030 — AquaCrop sezon senaryosu

**Durum:** PREP COMPLETE / DATA BLOCKED olabilir.

### Branch
`feat/aquacrop-scenarios`

### Pin
`36cc20e44644ed1704398889312435c85e04a2f3`

### Önkoşul
- yıllık ürün
- tam sezon hava
- soil profile
- irrigation records
- gerçek sezon yield mümkünse

### İlk senaryolar
- S0 rainfed
- S1 recorded irrigation
- S2 controlled alternative

### Kabul
- repeatable
- scenario ordering agronomically plausible
- missing data => no yield promise
- ana sulama motoru replacement değil

---

## TP-INT-040 — AutoGeoBound benchmark

**Durum:** PREP COMPLETE

### Branch
`feat/autogeobound-pilot`

### Pin
`7087b59e51438ec370b698186805751be9296ec2`

### Kapsam
- boundary candidate adapter
- test polygon cohort
- IoU / area error / boundary distance
- TerraDraw review flow
- explicit confirm before save

### Kabul
- low quality öneri saklanabiliyor/hiç gösterilmeyebiliyor
- auto-save yok
- kullanıcı manuel çizime her zaman dönebiliyor
- model failure tarla eklemeyi engellemiyor

---

## TP-INT-050 — Pest risk / GDD benchmark

**Durum:** PREP COMPLETE

### Branch
`feat/pest-risk-engine`

### Pin
`3aa67a9ad3de6ff8a772dc635db041ec53845aa4`

### Kapsam
- GDD/risk modelini kendi hava inputumuzla test
- `PestRiskSignal` normalize output
- GBIF + phenology + weather evidence birleşimi
- fotoğraf/gözlem varsa confidence context

### Kabul
- risk != diagnosis
- GBIF != field presence
- high risk != spray command
- model tarihi ve source açık

---

## TP-INT-060 — Disease model benchmark

**Durum:** RESEARCH READY

### AgML snapshot
`c3343fc3b3f8abd89983927da3fc8319cb019d49`

### Kapsam
- dataset/model shortlist
- public benchmark + real-field holdout
- confusion matrix
- high-confidence wrong rate
- abstention quality

### Kabul
Mevcut teşhis akışından ölçülebilir fayda göstermeden production modeli değiştirme.

---

## TP-INT-070 — OpenET validation

**Durum:** RESEARCH

### Ön araştırma
- Türkiye coverage
- data latency
- API/terms
- spatial/temporal resolution

### Kapsam
Aynı dönem:
- OpenET
- app ET0/ETc
- rain
- irrigation record
- soil moisture if available

### Kabul
Yalnız yardımcı ET evidence olarak başlar.

---

## TP-INT-080 — FarmVibes module benchmark

**Durum:** RESEARCH

### Snapshot
`d10670e18742d05aec50f73e4695d47978908994`

### İlk bakılacak modüller
1. Sentinel-1/2 fusion
2. NDVI/time-series processing
3. growth/harvest detection
4. irrigation/water-stress analysis
5. crop segmentation

### Kural
Full stack kurmak yok. Her yetenek mevcut TarlaPusula motoruna karşı ayrı benchmark.

---

## TP-INT-090 — GeoID / Asset Registry

**Durum:** HOLD/RESEARCH

### Başlama şartı
Gerçek dış sistem interoperability ihtiyacı.

### Kural
`fields.id` değişmez. GeoID yalnız `field_external_ids` gibi ikinci kimlik olur.

### Ek kapı
Repo lisansı manuel doğrulanmadan production kullanım yok.

---

# Veri backlog'u

## TP-DATA-001 — Sezon ground-truth kayıtlarını güçlendir

Toplanacak:
- planting date
- emergence/critical stage observations
- harvest date
- actual yield

PCSE + AquaCrop + Pusula için ortak değer.

## TP-DATA-002 — Sulama ground truth

Toplanacak:
- irrigation timestamp
- amount mm veya hacim+alan dönüşümü
- method
- optional duration

pyfao56 + AquaCrop + Irrigation Engine validation için kritik.

## TP-DATA-003 — Soil water profile

- texture
- field capacity
- wilting point
- rootable depth
- source/method

Lab verisi ile model-türevi veri ayrı etiketlenir.

## TP-DATA-004 — Real-field disease test set

Kullanıcı gizliliği korunarak uzman etiketli saha örneği gerekir. GitHub'a ham kullanıcı fotoğrafı fixture olarak commit edilmez.

---

# Platform backlog'u

## TP-PLAT-001 — Server-side rollout registry

Motor bazlı:
- off
- shadow
- internal
- pilot
- production

## TP-PLAT-002 — Integration telemetry

- latency
- status
- engine version
- cache hit
- quality flags
- no raw personal data

## TP-PLAT-003 — Model run audit

Model çıktısının hangi version/input fingerprint ile üretildiğini sonradan gösterebilme.

## TP-PLAT-004 — Kill switch test

Her motoru deploy yapmadan kapatabilme.

---

# İş sıralaması

```text
TP-INT-001 + TP-INT-002
        |
TP-INT-010 pyfao56 shadow
        |
TP-DATA-001/002/003 güçlendirme paralel
        |
TP-INT-020 PCSE
        |
TP-INT-030 AquaCrop
        |
TP-INT-040 AutoGeoBound
        |
TP-INT-050 Pest Risk
        |
P2 araştırmalar
```

AutoGeoBound ve Pest Risk, veri/kapasite uygunsa PCSE/AquaCrop'tan bağımsız paralel yürütülebilir; fakat aynı anda çok motoru live akışa sokmayacağız.
