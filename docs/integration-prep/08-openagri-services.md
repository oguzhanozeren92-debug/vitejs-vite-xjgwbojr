# 08 — OpenAgri / AgStack servis hazırlığı

## Amaç

OpenAgri ve AgStack servislerini komple bir platform olarak kurmak yerine, TarlaPusula'nın mevcut mimarisine gerçekten değer katan parçaları seçmek. Mevcut Supabase + feature/service yapısı korunur.

---

## 1. OpenAgri WeatherService

Repo: `agstack/OpenAgri-WeatherService`

### Doğrulanan durum

- Python/FastAPI servisi.
- Lisans: Apache-2.0.
- 5 günlük tahmin, güncel hava, geçmiş hava, THI, ilaçlama koşulu ve UAV uçuş koşulu gibi çıktılar sunuyor.
- Kendi README'si projenin bazı bölümlerinin hâlâ erken aşamada/refactor ihtiyacında olduğunu belirtiyor.
- Bazı işlevlerde OpenWeatherMap anahtarı kullanıyor; geçmiş veri tarafında Open-Meteo seçeneği bulunuyor.

### TarlaPusula kararı

**Durum: HOLD / kod ve veri modeli referansı.**

Sebep: TarlaPusula'da zaten hava servisleri, 5 günlük tahmin ve ilaçlama uygunluğu mantığı var. Tüm WeatherService'i deploy etmek mükerrer altyapı yaratır.

### Alınabilecek fikirler

- spray condition sınıflandırması,
- sıcaklık-nem temelli THI göstergesi,
- forecast/cache sözleşmesi,
- hava olayı -> Farm Calendar/event bağlantı yaklaşımı.

### Pilot şartı

Sadece mevcut hava motorumuza göre yeni ve ölçülebilir bir sinyal sağlıyorsa adapter yapılır. Örneğin mevcut ilaçlama uygunluğu modelimizden anlamlı derecede daha doğru bir screening modeli.

---

## 2. OpenAgri IrrigationManagement

Repo: `agstack/OpenAgri-IrrigationManagement`

### Doğrulanan durum

- Python.
- Lisans: EUPL-1.2.
- Açıklamasına göre ETo hesapları ve toprak nemi analizi yapıyor.

### TarlaPusula kararı

**Durum: REFERENCE / BENCHMARK.**

Bizde halihazırda:
- crop coefficient,
- crop water use,
- root zone water,
- soil water profile,
- irrigation climate,
- irrigation decision

servisleri var. Bu nedenle IRM mevcut motorun yerine geçirilmez.

### Kullanım planı

1. IRM'nin ETo ve soil-moisture yaklaşımını dokümante et.
2. Aynı test fixture'ında kendi Irrigation Engine ile karşılaştır.
3. Farkın kaynağını belirle.
4. Sadece doğrulanan formül veya kalite kontrol yaklaşımı faydalıysa kendi adapter/service katmanımıza taşınır.

### Lisans kapısı

EUPL-1.2 olduğu için doğrudan kaynak kod kopyalama/dağıtım kararı verilmeden önce lisans etkisi ayrıca incelenir. Formül ve mimari fikir ile kod kopyalamayı birbirinden ayır.

---

## 3. OpenAgri FarmCalendar

Repo: `agstack/OpenAgri-FarmCalendar`

### Doğrulanan durum

- Python.
- Lisans: Apache-2.0.
- Çiftçi operasyonları, gözlemler, parsel özellikleri ve çiftlik varlıklarının kaydı için tasarlanmış.

### TarlaPusula kararı

**Durum: DATA-MODEL REFERENCE.**

TarlaPusula'da zaten:
- field operations,
- calendar,
- field observations,
- weekly field plan,
- notifications

özellikleri mevcut.

Tüm FarmCalendar servisinin kurulması yerine event/veri modeli karşılaştırılacak.

### Özellikle incelenecek kavramlar

- operation / observation ayrımı,
- parcel-event bağlama,
- varlık kayıtları,
- dış servislerin takvime uyarı bırakma yöntemi,
- geçmiş kayıtların audit edilebilirliği.

### Hedef veri sözleşmesi

TarlaPusula içinde tüm motorların takvime olay bırakabilmesi için ortak yapı:

```ts
interface FarmEventCandidate {
  fieldId: string;
  source: 'user' | 'weather' | 'irrigation' | 'satellite' | 'pest' | 'pusula';
  type: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  severity?: 'info' | 'warning' | 'critical';
  evidenceRefs?: string[];
  autoCreated: boolean;
}
```

Pusula AI burada event'in sahibi değildir; kaynak motoru açıkça korunur.

---

## 4. OpenAgri PestAndDiseaseManagement

Repo: `agstack/OpenAgri-PestAndDiseaseManagement`

### Doğrulanan durum

- Python/FastAPI tabanlı.
- Lisans: EUPL-1.2.
- GDD (Growing Degree Days) ve hastalık/risk index hesaplarını destekleyen bir servis yaklaşımı var.

### TarlaPusula kararı

**Durum: P1 FORMULA/MODEL BENCHMARK.**

Bu servis, görüntüden hastalık teşhisinin yerine geçmez. Farklı rol oynar:

`hava + ürün + zararlı/hastalık modeli -> risk/GDD -> Pusula kanıtı`

### TarlaPusula'da olası değer

Örnek:
- GBIF yakın çevrede geçmiş zararlı gözlemi bulur.
- Hava servisi uygun sıcaklık/nem penceresini verir.
- GDD/risk motoru biyolojik risk seviyesini hesaplar.
- Kullanıcının fotoğraf gözlemi varsa kanıt güçlenir.
- Pusula sonucu kısa dille açıklar.

### Önerilen standart çıktı

```ts
interface PestRiskSignal {
  fieldId: string;
  pestOrDiseaseId: string;
  riskScore: number | null;
  riskBand: 'low' | 'medium' | 'high' | 'unknown';
  growingDegreeDays?: number;
  windowStart: string;
  windowEnd: string;
  evidence: string[];
  sourceModel: string;
  qualityFlags: string[];
}
```

### Güvenlik kuralı

Risk modeli doğrudan 'ilaç at' önerisi üretmez. Uygulama şu ayrımı korur:

- risk sinyali,
- gözlem/fotoğraf teşhisi,
- ruhsat/etiket bilgisi,
- depo envanteri,
- hava uygunluğu

birlikte değerlendirilmeden kimyasal uygulama kararı verilmez.

---

## 5. AgStack Asset Registry / GeoID

Repo: `agstack/asset-registry`

### Doğrulanan durum

- Geometrik varlığı/poligonu kaydedip GeoID üretmeye yönelik servis.
- Repo metadata'sında standart GitHub lisans alanı boş görünüyor; bu yüzden **lisans durumu production kullanımdan önce manuel doğrulanmalıdır**.

### TarlaPusula kararı

**Durum: RESEARCH.**

Bizim Supabase `field.id` ana kimlik olmaya devam eder. GeoID ancak dış sistemler arası taşınabilir kimlik gerçekten fayda sağlarsa ikinci kimlik olur.

Önerilen veri alanı:

```ts
external_ids: {
  agstack_geoid?: string;
}
```

### Kullanım senaryosu

- aynı sınırı farklı açık tarım servisleri arasında referanslamak,
- veri sağlayıcıları arasında alan eşleştirmek,
- dış ekosistem interoperabilitesi.

### Kullanılmama senaryosu

Sadece 'bir ID daha olsun' diye eklenmeyecek. TarlaPusula'nın mevcut field ID'sini değiştirmeyecek.

---

## 6. AgStack AutoGeoBound

Detaylı hazırlık: `04-autogeobound.md`.

Buradaki mimari karar değişmiyor:

`önerilen sınır -> kullanıcı görür/düzeltir -> kullanıcı onayı -> field geometry`

AI sınırı otomatik ve sessizce kaydedemez.

---

## OpenAgri servisleri için ortak adapter sınırı

Harici servisin kendi veri modellerini UI'ya taşımayacağız.

Önerilen klasör yapısı:

```text
src/integrations/openagri/
  weather.adapter.ts
  irrigation.adapter.ts
  pestRisk.adapter.ts
  types.ts
```

Fakat bu dosyalar yalnızca ilgili pilot gerçekten başlatıldığında oluşturulur. Hazırlık aşamasında çalışan uygulamaya eklenmez.

## Genel karar

| Servis | Karar | Neden |
| --- | --- | --- |
| WeatherService | HOLD | mevcut hava sistemiyle büyük ölçüde çakışıyor |
| IrrigationManagement | BENCHMARK | mevcut Irrigation Engine zaten güçlü |
| FarmCalendar | DATA MODEL REFERENCE | kendi calendar/operation altyapımız var |
| Pest&DiseaseManagement | P1 BENCHMARK | GDD/risk index bize yeni sinyal katabilir |
| Asset Registry | RESEARCH | interoperabilite varsa değerli |
| AutoGeoBound | P1 | kullanıcı deneyimine doğrudan yeni özellik kazandırıyor |

## Sınır kalkınca uygulanacak sıra

1. Pest&Disease GDD/risk formülleri için test fixture çıkar.
2. Kendi hava verimizle aynı girdiyi besle.
3. Risk output'unu `PestRiskSignal` formatına normalize et.
4. GBIF + risk signal + field observation bağını yalnızca karar motorunda test et.
5. FarmCalendar veri modeliyle mevcut event yapımızı karşılaştır; gerekiyorsa sadece schema iyileştirmesi al.
6. IrrigationManagement'i sadece referans kıyası olarak çalıştır.
7. Asset Registry'yi lisans ve gerçek interoperabilite ihtiyacı netleşmeden canlıya alma.
