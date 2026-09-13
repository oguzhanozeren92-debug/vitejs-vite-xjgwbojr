# P2 — FarmVibes.AI + AgStack araştırma paketi

## Amaç

TarlaPusula'nın çalışan motorlarını komple değiştirmek değil; yalnızca gerçekten yeni ve ölçülebilir değer sağlayan parçaları seçmek.

## FarmVibes.AI

Resmi repo: `microsoft/farmvibes-ai`

### Repo doğrulaması

- Multi-modal geospatial ML / remote sensing / weather odaklı.
- GitHub metadata'sında MIT lisanslı.
- Repo arşivlenmiş değil.
- Büyük ve çok bileşenli bir sistem olduğu için TarlaPusula'ya komple gömülmeyecek.

### Öncelikli incelenecek parçalar

1. Sentinel-1 + Sentinel-2 füzyon yaklaşımı
2. zaman serisi üretimi ve boşluk doldurma yaklaşımları
3. crop/field segmentation örnekleri
4. hasat/gelişim evresi çıkarımı
5. su stresi / sulama ile ilişkili örnek iş akışları

### Benchmark yaklaşımı

Her modül için şu soru sorulur:

```text
Mevcut TarlaPusula sistemi aynı işi yapıyor mu?
↓
Evet → FarmVibes sonucu aynı tarla/tarih üzerinde daha doğru veya daha kararlı mı?
↓
Hayır → bağımlılık ekleme.
```

### Hedef adapter

FarmVibes tek adapter olmaz. Yalnızca seçilen modül için izole adapter açılır:

```text
src/integrations/farmvibes/<module>/
```

Örneğin:

```text
src/integrations/farmvibes/sar-optical-fusion/
src/integrations/farmvibes/field-segmentation/
```

### Feature flag

```text
VITE_ENABLE_FARMVIBES_ANALYTICS=false
ENABLE_FARMVIBES_ANALYTICS=false
```

## AgStack Asset Registry

Resmi ekosistem: `agstack`

### TarlaPusula için potansiyel değer

Asset Registry'nin asıl değeri tarla geometrisine dış sistemler arası kalıcı bir GeoID/kimlik verme fikridir.

TarlaPusula bugün Supabase `field_id` ile kendi içinde çalışabiliyorsa bu proje sırf açık kaynak diye eklenmez.

### Ne zaman gerekli olur?

Aşağıdaki ihtiyaçlardan biri doğarsa tekrar açılır:
- farklı kamu/özel tarım sistemleriyle field identity eşleme,
- veri taşınabilirliği,
- birden fazla platformda aynı polygonun kalıcı kimliği,
- tedarik/izlenebilirlik zinciri,
- dış API'lerle GeoID standardı ihtiyacı.

### Önerilen gelecekteki eşleme

```ts
type ExternalFieldIdentity = {
  fieldId: string;
  provider: 'agstack_asset_registry';
  externalId: string;
  geometryHash: string;
  createdAt: string;
};
```

Bu kayıt ana `fields.id` yerine geçmez; dış kimlik olarak tutulur.

## OpenAgri ekosistemi

AgStack altında şu projeler ayrıca göz önünde tutulacak:
- OpenAgri-IrrigationManagement
- OpenAgri-WeatherService
- OpenAgri-FarmCalendar
- OpenAgri-PestAndDiseaseManagement
- OpenAgri-ReportingService

Fakat mevcut TarlaPusula modülleri zaten bu alanların çoğunu kapsıyor. Bu nedenle yaklaşım `entegre et` değil `benchmark/reference` olacaktır.

Özellikle OpenAgri'nin ortak veri/semantik modeli, servis sözleşmelerimizi değerlendirirken referans alınabilir.

## Karar tablosu

| Bileşen | İlk karar | Neden |
|---|---|---|
| FarmVibes tamamı | RED | Fazla büyük, mevcut mimariyi gereksiz yere değiştirir |
| FarmVibes S1/S2 fusion | RESEARCH | Sentinel-1 + Sentinel-2 sentezinde ek değer olabilir |
| FarmVibes segmentation | RESEARCH | AutoGeoBound'a alternatif benchmark olabilir |
| FarmVibes crop/harvest workflows | RESEARCH | Fenoloji/hasat tespiti için karşılaştırma değeri var |
| AgStack Asset Registry | HOLD | Şimdilik iç `field_id` yeterli |
| OpenAgri Weather | HOLD | Mevcut hava sistemi var |
| OpenAgri Irrigation | HOLD | Kendi Irrigation Engine var |
| OpenAgri FarmCalendar | HOLD | Kendi takvim/operasyon sistemi var |
| OpenAgri Pest/Disease | RESEARCH | Zararlı risk modelleri açısından seçici inceleme yapılabilir |

## Sınır kalkınca ilk iş

1. FarmVibes örnek/workflow kataloğunu modül bazlı listele.
2. TarlaPusula'da karşılığı olan her modülü mevcut servisle eşleştir.
3. Sadece net ölçülebilir fark ihtimali olan 1-2 modülü pilot seç.
4. AutoGeoBound vs FarmVibes segmentation aynı benchmark setinde karşılaştır.
5. Asset Registry'yi ancak gerçek interoperability use-case çıkarsa aç.
