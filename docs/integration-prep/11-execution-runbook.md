# 11 — Entegrasyon uygulama runbook'u

Bu dosya, hazırlık dönemi bittikten sonra entegrasyonları çalışan TarlaPusula uygulamasına güvenli biçimde alma sırasıdır.

## Ana kural

Hiçbir dış motor doğrudan ekrana bağlanmaz.

Akış:

```text
TarlaPusula gerçek verisi
  -> input normalizer
  -> external/model adapter
  -> normalized result
  -> validation / quality gate
  -> decision engine
  -> Pusula evidence
  -> UI / notification / calendar
```

Pusula AI sayısal motor değildir. Modelin ürettiği doğrulanmış sinyali açıklar.

---

## Aşama 0 — Uygulamaya dokunmadan önce

Her entegrasyonda önce şu bilgiler hazır olmalı:

- exact upstream repo
- kullanılacak version/tag/commit
- lisans
- required inputs
- expected outputs
- timeout
- rate/cost limit
- privacy impact
- failure behavior
- acceptance metric
- feature flag
- rollback yolu

Eksikse kodlamaya başlanmaz.

---

## Aşama 1 — Offline / fixture doğrulaması

Gerçek kullanıcı akışına bağlamadan:

1. sentetik fixture,
2. açık örnek veri,
3. beklenen referans sonuç

ile motor çalıştırılır.

Amaç:
- kurulumun doğru olması,
- input/output formatının anlaşılması,
- sayısal uç değerlerin görülmesi.

Bu aşama ürün doğrulaması değildir.

---

## Aşama 2 — Gerçek veriyle SHADOW mode

Model gerçek TarlaPusula verisini okuyabilir fakat sonucu kullanıcıya gösteremez ve canlı kararı değiştiremez.

Örnek:

```text
mevcut Irrigation Engine -> kullanıcıya giden sonuç
pyfao56 shadow          -> sadece log/karşılaştırma
```

Kaydedilecekler:
- input fingerprint
- model version
- output
- mevcut motor output'u
- fark
- quality flags
- çalışma süresi
- hata

Kullanıcı verisi debug dosyası olarak GitHub'a konmaz.

---

## Aşama 3 — Karşılaştırma ve kabul kapısı

Her entegrasyon için önceden belirlenen metriğe bakılır.

Örnekler:

### pyfao56
- ET0/ETc fark dağılımı
- kök bölgesi su açığı yönü
- eksik hava verisine davranış

### PCSE
- gerçek evre tarihleri ile simüle evre farkı
- hasat zamanı sapması
- veri eksikliğinde fail-safe

### AquaCrop
- gözlenen sezon/verim ile senaryo sıralamasının tutarlılığı
- sulama senaryoları arasında beklenen yön

### AutoGeoBound
- IoU
- sınır mesafesi
- kullanıcı düzeltme miktarı

### Disease model
- precision/recall/F1
- top-1 / top-k
- yanlış yüksek güven vakaları

Kabul kriteri sağlanmazsa feature flag açılmaz.

---

## Aşama 4 — İç pilot

Model sonucu sadece test/admin görünümünde görünür.

Kullanıcıya üretim önerisi gitmez.

İç pilot ekranı için ortak alanlar:
- model adı
- version
- input completeness
- result
- confidence/quality
- existing engine comparison
- warnings

---

## Aşama 5 — Sınırlı kullanıcı pilotu

Feature flag + kullanıcı/field allowlist.

```text
ENABLE_PCSE=false
PCSE_PILOT_USER_IDS=...
```

veya server-side entitlement/feature table.

Bu aşamada:
- mevcut öneri kaldırılmaz,
- yeni motor yardımcı kanıt olur,
- hata olursa kullanıcı eski çalışan sisteme düşer.

---

## Aşama 6 — Production

Production'a çıkmak için:

- acceptance test tamam
- lisans kapısı tamam
- timeout/fallback tamam
- telemetry tamam
- maliyet limiti tamam
- rate limit tamam
- privacy review tamam
- rollback denenmiş

olmalı.

---

# Python motorlar için çalışma sınırı

TarlaPusula'nın React/Vite bundle'ına Python paketi gömülmez.

Önerilen mantıksal yapı:

```text
React UI
   |
Supabase / trusted backend
   |
Model Gateway
   |--- pyfao56 runner
   |--- PCSE runner
   |--- AquaCrop runner
   |--- geospatial ML runner
```

Model Gateway deployment sağlayıcısından bağımsız bir sözleşmedir. İlk pilotta tek servis olabilir; ölçeklenince motorlar ayrılabilir.

## Backend güvenlik kuralı

Frontend:
- model secret görmez,
- service credential görmez,
- dış motoru doğrudan çağırmaz,
- kullanıcıdan gelen fieldId ile yetki kontrolünü atlayamaz.

Trusted backend önce kullanıcı -> tarla sahipliğini doğrular, sonra gerekli minimum veriyi model servisine yollar.

---

# Ortak timeout ve fallback

Model çağrısı kritik UI açılışını bloke etmemeli.

Örnek politika:

```text
cached valid result varsa -> hemen göster
background refresh -> yeni sonucu al
refresh başarısız -> cache + stale etiketi
cache yok + model fail -> 'veri şu an hazırlanamadı'
```

Sahte sayı üretilmez.

---

# Cache anahtarı

Model output'u sadece `fieldId` ile cache'lenmez.

En az:

```text
fieldId
modelName
modelVersion
inputFingerprint
date/window
```

birlikte kullanılmalı.

Örneğin ürün veya toprak değişince eski PCSE sonucu geçersizleşmelidir.

---

# Input fingerprint

Input'un tamamını loglamak yerine deterministik fingerprint kullanılabilir.

Amaç:
- aynı input tekrar mı?
- model sonucu hangi veri setinden üretildi?
- field verisi değişince cache geçersiz mi?

Kişisel/ham kullanıcı verisi fingerprint içine geri döndürülebilir biçimde konmamalı.

---

# Model version pinleme

`latest` kullanılmaz.

Her run şunu taşımalı:

```ts
model: 'pcse-wofost'
modelVersion: 'x.y.z-or-commit'
adapterVersion: '1'
```

Upstream güncellemesi otomatik production davranışını değiştiremez.

---

# Rollback

Her entegrasyonun rollback'i feature flag ile tek hareket olmalı.

Örnek:

```text
ENABLE_AQUACROP=false
```

Rollback sonrası:
- eski çalışan motor çalışmaya devam eder,
- yeni model verisi silinmek zorunda değildir,
- UI yeni model kartını göstermeyi bırakır,
- geçmiş model run'ları audit için korunabilir.

---

# Uygulama sırası

## P0
1. pyfao56 shadow doğrulama
2. PCSE gerçek yıllık ürün pilotu

## P1
3. AquaCrop sezon/sulama senaryosu
4. AutoGeoBound öneri/düzeltme pilotu
5. OpenAgri Pest&Disease GDD/risk benchmarkı

## P2
6. AgML / disease benchmark
7. OpenET ET validation
8. FarmVibes seçili modülleri

## Research / hold
9. Asset Registry
10. eo-learn
11. sentinelhub-py
12. farmOS data-model fikirleri

---

# PR stratejisi

Her büyük motor ayrı PR olmalı.

Öneri:

```text
feat/pyfao56-shadow
feat/pcse-pilot
feat/aquacrop-scenarios
feat/autogeobound-pilot
feat/pest-risk-engine
```

Tek PR içinde 5 motor eklenmez.

Her PR:
- küçük,
- geri alınabilir,
- testli,
- feature-flagged

olmalıdır.

---

# 'Bitti' tanımı

Bir GitHub projesi clone edildiğinde entegrasyon bitmiş sayılmaz.

Bir entegrasyon ancak:

1. gerçek TarlaPusula inputunu alıyor,
2. standardize output üretiyor,
3. doğrulanmış,
4. hata/fallback davranışı var,
5. lisansı kayıtlı,
6. feature flag ile kapatılabiliyor,
7. karar motorunda yetki sınırı belli,
8. kullanıcıya doğru kaynak/veri tarihi gösteriliyor

ise `LIVE` sayılır.
