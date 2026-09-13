# Entegrasyon Hazırlık Durumu

Bu tablo iki şeyi ayırır:

1. **Uygulamada gerçekten çalışıyor mu?**
2. **Entegrasyona ne kadar hazırız?**

Durumlar:
- `LIVE` — TarlaPusula akışında gerçekten kullanılıyor.
- `PILOT_READY` — bağımsız çalışan PoC var; canlı karara bağlı değil.
- `PREP` — adapter/veri/test/uygulama planı hazır; çalışan üçüncü taraf model hattı henüz yok.
- `RESEARCH` — değer/kapsama/teknik uygunluk ayrıca doğrulanacak.
- `HOLD` — mevcut TarlaPusula sistemi aynı işi yaptığı için ölçülebilir üstünlük olmadan eklenmeyecek.
- `REFERENCE` — kod bağımlılığı değil; veri modeli/mimari/formül/metodoloji referansı.
- `REMOVED` — exact upstream, coğrafi uygunluk veya somut katkı doğrulanmadığı için aktif kuyrukta değil.

| Motor / Kaynak | Ürün amacı | Gerçek uygulama durumu | Hazırlık | Canlıya geçmeden ana kanıt |
| --- | --- | --- | --- | --- |
| GBIF Occurrence API | geçmiş zararlı/tür gözlemleri | canlı | `LIVE` | veri yaşı/mesafe/koordinat belirsizliğini doğru taşımaya devam et |
| Copernicus Sentinel-2 | NDVI/zaman serisi | kendi Edge hattımız canlı | `LIVE` | tarih, bulut/valid pixel ve tazelik kalite kontrolünü koru |
| pyfao56 | FAO-56 ET/su dengesi doğrulaması | bağımsız PoC var | `PILOT_READY` | aynı input ile shadow benchmark + gerçek sulama kaydı |
| PCSE/WOFOST | fenoloji/büyüme/sezon modeli | resmi demo ile PoC var | `PILOT_READY` | gerçek yıllık ürün: tam sezon hava + toprak/site + saha evreleri |
| AquaCrop-OSPy | su-verim/sulama senaryosu | canlı model hattı yok | `PREP` | gerçek sezon + sulama kayıtları + ölçülen sonuç |
| AutoGeoBound | otomatik parsel sınırı önerisi | entegrasyon yok | `PREP` | Türkiye örneklerinde IoU/area error + kullanıcı düzeltme UX'i |
| OpenAgri Pest&Disease | GDD/risk index | entegrasyon yok | `PREP` | kendi hava girdimizle benchmark + GBIF/fotoğraf bağlamında güvenli yorum |
| AgML / PlantVillage | hastalık görüntü modeli | eğitim/çıkarım hattı yok | `RESEARCH` | gerçek saha fotoğraflarında mevcut AI'dan daha iyi benchmark + dataset/model lisansı |
| OpenET | uydu tabanlı ET metodolojisi | Türkiye için canlı kaynak değil | `REFERENCE` | resmi Türkiye/global kapsama oluşmadan adapter yazma |
| FarmVibes.AI | çok kaynaklı geospatial analiz | entegrasyon yok | `RESEARCH` | tekil modül mevcut motorlardan daha iyi sonuç göstermeli |
| AgStack Asset Registry | dış GeoID/interoperability | entegrasyon yok | `RESEARCH` | gerçek dış sistem ihtiyacı + lisans/operasyon doğrulaması |
| sentinelhub-py | uydu sağlayıcı istemcisi | kurulu değil | `HOLD` | mevcut Copernicus hattına kalite/operasyon üstünlüğü |
| eo-learn | EO zaman serisi/ML pipeline | kurulu değil | `HOLD` | anomali/multi-sensor işinde ölçülebilir üstünlük |
| Sentinel Hub custom-scripts | indeks/görselleştirme referansı | kurulu değil | `REFERENCE` | doğrudan kopyalanırsa CC-BY-SA-4.0 etkisi ayrıca incelenir |
| OpenAgri WeatherService | hava/ilaçlama/THI | bağlı değil; kendi hava sistemimiz var | `HOLD` | mevcut sistemde çözülemeyen somut yetenek |
| OpenAgri IrrigationManagement | ETo/toprak nemi | bağlı değil; kendi Irrigation Engine var | `REFERENCE` | kendi motorumuza karşı benchmark faydası |
| OpenAgri FarmCalendar | operasyon/takvim modeli | bağlı değil; kendi calendar/operations var | `REFERENCE` | sadece şema/event fikirleri gerekirse alınır |
| geemap | GEE/EO araştırma aracı | production'da yok | `REFERENCE` | notebook/R&D için; mobil runtime'a eklenmez |
| farmOS | farm record/data model | kod entegrasyonu yok | `REFERENCE` | yalnızca veri modeli/audit fikirleri |
| agro-gis | belirsiz GIS adayı | exact hedef repo net değil | `REMOVED` | exact URL + yeni yetenek + lisans olmadan geri gelmez |
| YieldStack | verim modeli adayı | güvenilir tekil upstream doğrulanmadı | `REMOVED` | exact repo olmadan aktif kuyruk yok |
| AgriGuard | risk/hastalık adayı | aynı isimde çok sayıda bağımsız demo var | `REMOVED` | exact upstream olmadan aktif kuyruk yok |
| Crop AI / CropGuard-like demos | UX/model fikirleri | production dependency değil | `REFERENCE` | sadece fikir/benchmark; lisansı belirsiz kod/model alınmaz |

## Hazır dokümanlar

- `01-pyfao56.md`
- `02-pcse.md`
- `03-aquacrop.md`
- `04-autogeobound.md`
- `05-disease-models.md`
- `06-farmvibes-agstack.md`
- `07-satellite-data-stack.md`
- `08-openagri-services.md`
- `09-remaining-candidates.md`
- `10-license-matrix.md`
- `11-execution-runbook.md`
- `12-common-contracts-and-schema.md`
- `13-validation-test-matrix.md`
- `14-feature-flags-and-env.md`
- `15-data-readiness.md`
- `16-upstream-pins.md`
- `17-model-gateway-api.md`
- `18-implementation-file-map.md`
- `19-execution-backlog.md`
- `20-pusula-evidence-policy.md`
- `21-operations-cost-privacy.md`

## Uygulama sırası

### P0
1. pyfao56 shadow doğrulaması
2. PCSE gerçek tarla/yıllık ürün pilotu

### P1
3. AquaCrop sezon/sulama senaryosu
4. AutoGeoBound öneri/düzeltme pilotu
5. OpenAgri Pest&Disease GDD/risk benchmarkı

### P2
6. AgML / hastalık modeli benchmarkı
7. FarmVibes seçili modüller

### İhtiyaç doğarsa
8. Asset Registry / GeoID
9. eo-learn
10. sentinelhub-py

### Referans olarak izlenecek
- OpenET — mevcut resmi kullanım kapsamı Batı ABD odaklı; Türkiye adapter'ı açılmaz.
- farmOS — data model/audit fikirleri.
- Sentinel Hub Custom Scripts — formül/görsel referansı ve lisans kontrollü kullanım.

## Hazırlık döneminde yapılmayacaklar

- çalışan `main` ürün akışına üçüncü taraf motor bağlamak
- sırf repo popüler diye mevcut çalışan servisi değiştirmek
- model sonuçlarını doğrudan React component'te hesaplamak/çağırmak
- gerçek kullanıcı verisini fixture olarak commit etmek
- eksik veriyi mock/fallback rakamla doldurmak
- Pusula AI'ı sayısal hesap otoritesi yapmak
- lisans/terms belirsiz kodu production'a almak
- Türkiye kapsamı olmayan veri kaynağına sırf adı güçlü diye adapter yazmak

## Bir sonraki gerçek kodlama başlangıç noktası

Sınır kalktığında ilk uygulama PR'ı `feat/pyfao56-shadow` olmalıdır. Bu PR canlı sulama kararını değiştirmeden yalnızca aynı veride karşılaştırmalı run, kalite kaydı ve telemetry üretmelidir.
