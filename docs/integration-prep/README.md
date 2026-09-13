# TarlaPusula Entegrasyon ve UX Hazırlık Merkezi

Bu klasör, TarlaPusula'da sınır/uygulama zamanı geldiğinde araştırmaya geri dönmeden doğrudan implementasyona geçebilmek için tutulur. **Çalışan `main` uygulama kodu bu hazırlık dokümanları yüzünden değiştirilmez.**

Hazırlık iki hattı birlikte yönetir:

1. açık kaynak/model entegrasyonları,
2. bu motorların ve Pusula'nın ihtiyaç duyduğu gerçek veriyi güvenli biçimde toplayan ürün/UX altyapısı.

## Ana kurallar

- mevcut çalışan özellik gereksiz yere yeniden yazılmaz.
- üçüncü taraf motor önce PoC/shadow/validation kapılarından geçer.
- eksik veri uydurulmaz; `no_data/not_ready` gerçek durumdur.
- Pusula AI hesap motoru değildir; doğrulanmış kanıtları açıklar/birleştirir.
- Supabase/API çağrıları component içine dağılmaz; service sınırı korunur.
- secret hiçbir zaman Vite frontend bundle'a konmaz.
- kullanıcı verisi GitHub fixture'ı yapılmaz.
- Görev, Bildirim, Takvim ve Pusula insight birbirinin yerine kullanılmaz.
- puan client'ın yazdığı rakama göre değil server-authoritative rule/completion'a göre verilir.
- aynı iş için reward idempotent/deduped olur.
- push/konum/AI consent gibi izinleri açtırmak için Pusula puanı verilmez.

## Hazırlık dosyaları

| Dosya | İçerik |
| --- | --- |
| `01-pyfao56.md` | FAO-56/su dengesi doğrulama pilotu |
| `02-pcse.md` | PCSE/WOFOST gerçek yıllık ürün pilotu |
| `03-aquacrop.md` | AquaCrop su-verim/sulama senaryosu |
| `04-autogeobound.md` | otomatik tarla sınırı önerisi |
| `05-disease-models.md` | AgML/PlantVillage hastalık modeli benchmarkı |
| `06-farmvibes-agstack.md` | FarmVibes + AgStack seçici araştırma |
| `07-satellite-data-stack.md` | sentinelhub-py, eo-learn, custom scripts, OpenET, geemap |
| `08-openagri-services.md` | OpenAgri servisleri + Asset Registry |
| `09-remaining-candidates.md` | farmOS ve belirsiz/eski adayların temizliği |
| `10-license-matrix.md` | kod/model/dataset/API lisans matrisi |
| `11-execution-runbook.md` | shadow → pilot → production runbook |
| `12-common-contracts-and-schema.md` | ortak adapter contractları + schema taslağı |
| `13-validation-test-matrix.md` | fixture/benchmark/kabul testleri |
| `14-feature-flags-and-env.md` | feature flag, secret, timeout, cache, kill switch |
| `15-data-readiness.md` | motor bazlı minimum gerçek veri |
| `16-upstream-pins.md` | exact upstream commit snapshot'ları |
| `17-model-gateway-api.md` | private model gateway sözleşmesi |
| `18-implementation-file-map.md` | motor bazlı exact dosya haritası |
| `19-execution-backlog.md` | motor iş kartları ve bağımlılıklar |
| `20-pusula-evidence-policy.md` | Pusula evidence/kanıt politikası |
| `21-operations-cost-privacy.md` | compute/API maliyet, privacy, retention, fallback |
| `22-map-fullscreen-history-ux.md` | map-tap tam ekran + history preview gallery |
| `23-field-tasks-and-pusula-points.md` | Görevlerim + eksik veri + Pusula puanı |
| `24-notification-vs-task-routing.md` | Task/Notification/Pusula ayrımı |
| `25-map-tasks-implementation-plan.md` | harita/Görevlerim exact uygulama sırası |
| `26-map-footer-date-real-compass.md` | normal haritada görünür veri tarihi + gerçek pusula |
| `27-pusula-ai-hub-rebuild.md` | bottom-nav Pusula AI'yı gerçek hub'a dönüştürme |
| `28-notifications-settings-real-screens.md` | Bildirimler ve Ayarlar'ı placeholder'dan çıkarma |
| `29-map-opening-field-switch-transitions.md` | dünya→tarla ve tarla→tarla kamera geçişleri |
| `30-map-focus-mode.md` | `Haritada gör` için çakışmasız Focus Mode |
| `31-calendar-action-today-push-pipeline.md` | Takvimime ekle → Today → Push zinciri |
| `32-ux-polish-execution-plan.md` | 2026-09-13 UX incelemesinin exact PR/backlog sırası |
| `STATUS.md` | tek bakışta motor readiness durumu |

## Ortak teknik mimari

```text
TarlaPusula gerçek verisi
  -> input normalizer
  -> feature/domain service
  -> integration adapter / model runner (gerekiyorsa)
  -> normalized result + quality/evidence
  -> decision layer
  -> Pusula / Task / Calendar / Notification router
  -> UI
```

Python motorlar React/Vite bundle'a gömülmez:

```text
React UI
   |
trusted auth/backend boundary
   |
Model Gateway
   |--- pyfao56
   |--- PCSE
   |--- AquaCrop
   |--- geospatial / ML runners
```

## Task / Notification / Calendar / Pusula ayrımı

```text
Görev
= kullanıcının yapacağı ve completion kriteri olan iş

Bildirim
= kullanıcının haberdar olması gereken olay/değişiklik

Takvim
= kullanıcının belirli gün/saatte yapmayı planladığı iş

Pusula insight
= kanıtlardan üretilen kısa yorum/öneri
```

Örnek:

```text
"Sulama durumunu tamamla"          -> Görev (+P completion'da)
"Bu gece don riski var"            -> Bildirim
"Yarın 09:00 batı alanını kontrol" -> Takvim
"Batı alanı çevresine göre zayıf"  -> Pusula insight
```

Task takvime planlanabilir; ancak reminder eklemek task'ı tamamlamaz ve puan vermez.

## Eksik veri → Görevlerim

```text
engine / Pusula data readiness
   -> deterministic TaskCandidate
   -> Görevlerim
   -> kullanıcı ilgili gerçek feature'da veriyi kaydeder
   -> server completion doğrulaması
   -> bir kez Pusula reward
   -> task aktif listeden kalkar
   -> veri karar/model katmanına açılır
```

API arızası, provider gecikmesi veya kullanıcının çözemeyeceği sistem sorunu task yapılmaz.

## Harita ürün kararı

Harita ilk bakışta sade, dokundukça derinleşen yapıdadır.

Normal durumda:
- veri tarihi görünür,
- gerçek bearing pusulası görünür,
- map tap tam ekran yapar,
- ayrı fullscreen ikonu yoktur; o slot Görevlerim'e ayrılır,
- history ikonunda sabit `Geçmiş` yazısı yoktur,
- geçmiş Sentinel-2 arşivi thumbnail gallery olarak açılır.

`Haritada gör` ayrı Focus Mode açar; üst üste binen action/icon şeritleri göstermez.

## Pusula AI ürün kararı

Bottom-nav `Pusula AI` doğrudan fotoğraf analizine gitmez. Yeni Hub:

```text
Pusula AI Hub
  -> güncel kısa değerlendirme
  -> Neden?
  -> Haritada gör
  -> gerektiğinde Takvimime ekle
  -> Fotoğraftan Analiz
  -> geçmiş / görev bağlantıları
```

Fotoğraf analizi ayrı alt araçtır. Hub'ın üzerine GlobalPusulaBand dev overlay bindirmez.

## Bildirimler ve Ayarlar

`notificationsHub` ve `settingsHub` artık ürün planında placeholder değildir.

- Bildirimler: gerçek inbox, read/unread, filter, deep-link; Task tekrarları yok.
- Ayarlar: hesap, notification preferences, Pusula AI consent, theme/app, konum/privacy.
- consent/permission açmak reward değildir.

## Harita açılış hareketi

Mevcut bir-kez/session bastırma kuralı kaldırılacak.

- her yeni app/page açılışında world/general → selected field,
- aynı render içinde double-play yok,
- field switch'te kısa regional zoom-out → target field,
- reduced-motion tercihinde animasyon atlanır,
- animasyon API sorgu sayısını artırmaz.

## Takvim pipeline

Mevcut Calendar + push altyapısı yeniden kullanılacak:

```text
Pusula / Weather / Irrigation / Focus action
        -> CalendarActionDraft
        -> prefilled "Takvimime ekle" sheet
        -> calendar_reminders
        -> günü gelince Today
        -> izin varsa due push
```

Reminder oluşturmak = 0P. Task ile bağlıysa puan gerçek task completion'da gelir.

## Motor önceliği

| Öncelik | Motor | Karar |
| --- | --- | --- |
| P0 | pyfao56 | mevcut PoC'yi aynı gün/konum/veriyle shadow doğrula |
| P0 | PCSE/WOFOST | gerçek yıllık ürün + saha evreleriyle pilot |
| P1 | AquaCrop-OSPy | sezon su/verim senaryosu |
| P1 | AutoGeoBound | candidate boundary + TerraDraw + kullanıcı onayı |
| P1 | Pest&Disease | risk/GDD benchmark; teşhis değil risk sinyali |
| P2 | AgML/PlantVillage | gerçek saha benchmarkı |
| P2 | FarmVibes.AI | yalnız ölçülebilir faydalı modüller |
| HOLD | sentinelhub-py / eo-learn | mevcut Copernicus hattını geçmedikçe yok |
| REFERENCE | OpenET | Türkiye live adapter planı yok |

## Başlangıç upstream pinleri

```text
pyfao56       1d242ee985be0edbc4946f06e7e94a487d4bc0c9
PCSE           67a28e56b0e34655f8d60b0b4a254a7c81efbb2f
AquaCrop       36cc20e44644ed1704398889312435c85e04a2f3
AutoGeoBound   7087b59e51438ec370b698186805751be9296ec2
Pest&Disease   3aa67a9ad3de6ff8a772dc635db041ec53845aa4
AgML           c3343fc3b3f8abd89983927da3fc8319cb019d49
FarmVibes.AI   d10670e18742d05aec50f73e4695d47978908994
```

Implementation PR'ında upstream tekrar kontrol edilir; `latest` körlemesine kullanılmaz.

## Uygulama sırası — UX

```text
mevcut 22–25 harita/history/task epic'i
        |
TP-UX-100 map footer/date/real compass
TP-UX-110 world→field + field switch transition
TP-UX-120 map focus mode
TP-UX-130 calendar action pipeline
TP-SHELL-140 notifications inbox
TP-SHELL-150 settings screen
TP-AI-160 Pusula AI hub
TP-TASK-170 cross-feature task/points wiring
```

Ayrıntı `32-ux-polish-execution-plan.md` içinde.

## READY_FOR_IMPLEMENTATION kuralı

Bir iş implementation'a geçmeden önce uygun olan maddeler hazır olmalı:

- exact mevcut dosya sınırı,
- domain/input/output contract,
- veri readiness,
- no-fake/no-data davranışı,
- server auth/RLS ihtiyacı,
- task/notification/calendar routing,
- reward completion + dedupe,
- mobile overlap/safe-area planı,
- test/kabul kriteri,
- fallback/rollback,
- Pusula evidence davranışı,
- privacy/consent sınırı.

Motorlar için detay `11`, `13`, `15`, `16`, `19`; yeni UX için `22`–`32` dosyaları kullanılır.
