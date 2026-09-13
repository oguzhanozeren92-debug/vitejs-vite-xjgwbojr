# TarlaPusula Entegrasyon Hazırlık Merkezi

Bu klasör, açık kaynak ve harici tarım motorlarını **çalışan uygulamaya dokunmadan** entegrasyona hazır hale getirmek için kullanılır.

## Ana kural

Bir proje doğrudan `main` uygulama akışına alınmaz. Önce şu kapılardan geçer:

1. ihtiyaç doğrulama — mevcut TarlaPusula servisi aynı işi zaten yapıyor mu?
2. lisans kontrolü — kod, model, dataset ve harici API şartları.
3. veri yeterliliği — gerçek ve tarihli input var mı?
4. bağımsız pilot — fixture/açık veri üzerinde çalışma.
5. shadow mode — gerçek TarlaPusula verisiyle ama kullanıcı kararını değiştirmeden kıyas.
6. adapter sözleşmesi — üçüncü taraf formatı domain içine sızmaz.
7. kalite kapısı — kabul metriği önceden tanımlıdır.
8. feature flag / kill switch — üretimde varsayılan kapalı ve geri alınabilir.
9. Pusula kanıt şeması — sonuç kaynak+tarih+kalite ile taşınır.
10. sınırlı pilot — allowlist/field cohort.
11. production — ancak doğrulama, lisans, privacy, fallback ve rollback tamamlanınca.

## Hazırlık dosyaları

| Dosya | İçerik |
| --- | --- |
| `01-pyfao56.md` | FAO-56/su dengesi doğrulama pilotu |
| `02-pcse.md` | PCSE/WOFOST gerçek yıllık ürün pilotu |
| `03-aquacrop.md` | AquaCrop su-verim/sulama senaryosu |
| `04-autogeobound.md` | otomatik tarla sınırı önerisi |
| `05-disease-models.md` | AgML/PlantVillage ve hastalık modeli benchmarkı |
| `06-farmvibes-agstack.md` | FarmVibes ve AgStack seçici araştırma |
| `07-satellite-data-stack.md` | sentinelhub-py, eo-learn, custom scripts, OpenET, geemap |
| `08-openagri-services.md` | OpenAgri Weather/Irrigation/FarmCalendar/Pest&Disease + Asset Registry |
| `09-remaining-candidates.md` | farmOS ve belirsiz/eski adayların temizliği |
| `10-license-matrix.md` | kod/veri/API lisans ve production kapısı |
| `11-execution-runbook.md` | shadow -> pilot -> production uygulama runbook'u |
| `12-common-contracts-and-schema.md` | ortak adapter tipleri ve Supabase schema taslağı |
| `13-validation-test-matrix.md` | motor bazlı fixture, benchmark ve kabul testleri |
| `14-feature-flags-and-env.md` | feature flag, secrets, timeout, cache, kill switch |
| `15-data-readiness.md` | model bazlı minimum gerçek veri gereksinimleri |
| `STATUS.md` | tek bakışta hazırlık ve canlılık durumu |

## Ortak mimari

```text
TarlaPusula gerçek verisi
  -> input normalizer
  -> integration adapter
  -> external/model runner
  -> normalized IntegrationResult
  -> quality / validation gate
  -> decision engine
  -> Pusula evidence
  -> UI / bildirim / takvim
```

**Pusula AI hesap motoru değildir.** Sayısal/teknik motorların doğrulanmış sonucunu kullanıcıya açıklar ve birden fazla kanıtı bağlama göre birleştirir.

## Python motorların sınırı

PCSE, pyfao56, AquaCrop, AgML ve benzeri Python paketleri React/Vite bundle'a gömülmez.

Mantıksal hedef:

```text
React UI
   |
trusted backend / Supabase auth boundary
   |
Model Gateway
   |--- pyfao56 runner
   |--- PCSE runner
   |--- AquaCrop runner
   |--- geospatial / ML runner
```

Deployment sağlayıcısı daha sonra seçilebilir; uygulama sözleşmesi sağlayıcıdan bağımsız tutulur.

## Öncelik sırası

| Öncelik | Motor | Karar |
| --- | --- | --- |
| P0 | pyfao56 | mevcut PoC'yi aynı gün/konum/veriyle shadow doğrula |
| P0 | PCSE/WOFOST | gerçek yıllık ürün ve saha evre gözlemleriyle pilot |
| P1 | AquaCrop-OSPy | sezon su/verim ve sulama senaryosu |
| P1 | AutoGeoBound | öneri sınırı + TerraDraw düzenleme + kullanıcı onayı |
| P1 | OpenAgri Pest&Disease | GDD/risk modeli benchmarkı; teşhis değil risk sinyali |
| P2 | AgML/PlantVillage | mevcut hastalık AI'a karşı gerçek saha benchmarkı |
| P2 | OpenET | ET validation / yardımcı uzaktan algılama sinyali |
| P2 | FarmVibes.AI | yalnızca ölçülebilir değer sağlayan modüller |
| RESEARCH | AgStack Asset Registry | gerçek interoperability ihtiyacı varsa |
| HOLD | sentinelhub-py / eo-learn | mevcut Copernicus hattına üstünlük göstermedikçe eklenmez |
| HOLD | OpenAgri Weather/Irrigation/FarmCalendar | mevcut sistemlerle büyük ölçüde çakışıyor; referans/benchmark |
| HOLD | geemap | R&D/notebook aracı, production dependency değil |
| REFERENCE | farmOS | veri modeli/işlem günlüğü fikirleri; full sistem değil |

## Aktif kuyruktan çıkarılan belirsiz isimler

- `YieldStack` — güvenilir tekil upstream doğrulanmadı.
- `AgriGuard` — aynı isimde çok sayıda bağımsız demo var; exact upstream yok.
- `agro-gis` — hangi repo ve hangi somut faydanın kastedildiği doğrulanmadı.
- `Crop AI / CropGuard-like` — üretim bağımlılığı değil, UX/model fikir referansı.

Exact URL + lisans + somut ürün katkısı olmadan yeniden aktif kuyruğa alınmazlar.

## Feature flag kuralı

Motorlar production'da varsayılan `off` başlar. Mantıksal isimler:

```text
ENABLE_PYFAO56=false
ENABLE_PCSE=false
ENABLE_AQUACROP=false
ENABLE_AUTOGEOBOUND=false
ENABLE_PEST_RISK_ENGINE=false
ENABLE_DISEASE_MODEL_V2=false
ENABLE_OPENET=false
ENABLE_FARMVIBES_EXPERIMENT=false
ENABLE_AGSTACK_GEOID=false
```

Bunların server-side uygulanması tercih edilir. **Secret/API credential için `VITE_*` kullanılmaz**; Vite frontend değişkenleri istemci bundle'ına girebilir.

## Güvenlik ve veri prensipleri

- gerçek kullanıcı verisi PoC fixture olarak GitHub'a commit edilmez.
- özel tarla koordinatı yalnızca gereken servise ve minimum kapsamda gönderilir.
- eksik veri model tarafından uydurulmaz; `no_data/not_ready` döner.
- eski cache güncelmiş gibi gösterilmez.
- model çıktısı tek başına ilaçlama/gübreleme/sulama emri değildir.
- kritik sonuçlarda veri tarihi, kaynak ve model sürümü izlenebilir olmalıdır.
- dış motor doğrudan React component'ten çağrılmaz.
- frontend secret görmez.
- her motor tek hareketle kapatılabilir olmalıdır.

## Lisans özeti

Tam matris `10-license-matrix.md` içinde.

Öne çıkanlar:
- pyfao56: CC0 1.0 / public-domain dedication.
- AquaCrop-OSPy: Apache-2.0.
- AutoGeoBound: Apache-2.0.
- AgML: Apache-2.0.
- FarmVibes.AI: MIT.
- sentinelhub-py / eo-learn: MIT.
- Sentinel Hub custom-scripts: CC-BY-SA-4.0 — doğrudan kopyalama ayrı değerlendirilir.
- PCSE: repo LICENSE dosyasında EUPL 1.1 veya uygun sonraki sürümler.
- OpenAgri Irrigation/Pest&Disease: EUPL-1.2.
- farmOS: GPL-2.0.
- AgStack Asset Registry: GitHub metadata'sında lisans görünmüyor; production öncesi manuel doğrulama zorunlu.

## `READY_FOR_IMPLEMENTATION` tanımı

Bir entegrasyon ancak şu maddeler hazırsa uygulama PR'ına geçebilir:

- [ ] exact upstream repo ve pinned version/commit
- [ ] kod/model/dataset/API lisans notları
- [ ] girdi şeması
- [ ] çıktı şeması
- [ ] adapter sınırı
- [ ] gerekli backend/model-runner planı
- [ ] veri readiness kontrolü
- [ ] feature flag + kill switch
- [ ] timeout/cache/rate/cost guard
- [ ] fixture/test senaryoları
- [ ] kabul metriği
- [ ] fallback/rollback
- [ ] Pusula evidence formatı
- [ ] privacy ve authorization sınırı

Detaylı durum için `STATUS.md`, uygulama sırası için `11-execution-runbook.md` kullanılır.
