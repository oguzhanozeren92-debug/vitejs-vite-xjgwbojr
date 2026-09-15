# 10 — Lisans ve kullanım matrisi

Bu dosya hukuki görüş değildir; entegrasyon öncesi teknik lisans envanteridir. Production dağıtımı öncesi özellikle copyleft / share-alike / lisans metadata'sı belirsiz projeler yeniden kontrol edilir.

## Durum anahtarı

- **LOW FRICTION**: permissive/public-domain karakterli; yine notice/attribution ve bağımlılık lisansları kontrol edilir.
- **REVIEW**: copyleft/share-alike veya özel koşul nedeniyle kaynak kod, dataset, model türevi veya dağıtım biçimi ayrıca incelenir.
- **UNKNOWN**: metadata yeterli değil; kesin lisans bulunmadan production kullanımı yok.

| Proje / veri | Doğrulanan lisans | Teknik karar | Lisans riski |
| --- | --- | --- | --- |
| `kthorp/pyfao56` | CC0 1.0 / public-domain dedication | P0 pilot ve gerektiğinde backend model | LOW FRICTION |
| `ajwdewit/pcse` | EUPL 1.1 veya sonraki onaylı EUPL sürümleri (repo LICENSE) | ayrı model servisi/pilot | REVIEW |
| `aquacropos/aquacrop` | Apache-2.0 | P1 sezon/sulama senaryosu | LOW FRICTION |
| `agstack/autogeobound` | Apache-2.0 | P1 sınır öneri benchmarkı | LOW FRICTION |
| `Project-AgML/AgML` | Apache-2.0 | benchmark/R&D | LOW FRICTION |
| PlantVillage dataset (`spMohanty/PlantVillage-Dataset` HF metadata) | CC BY-SA 3.0 | benchmark dataset adayı | REVIEW |
| `microsoft/farmvibes-ai` | MIT | modül bazlı R&D | LOW FRICTION |
| `sentinel-hub/sentinelhub-py` | MIT | HOLD/research | LOW FRICTION |
| `sentinel-hub/eo-learn` | MIT | zaman serisi benchmarkı | LOW FRICTION |
| `sentinel-hub/custom-scripts` | CC-BY-SA-4.0 | formül/görsel referans; kopyalama dikkatli | REVIEW |
| `gee-community/geemap` | MIT | sadece R&D/notebook | LOW FRICTION |
| `agstack/OpenAgri-WeatherService` | Apache-2.0 | HOLD/data-model referansı | LOW FRICTION |
| `agstack/OpenAgri-IrrigationManagement` | EUPL-1.2 | benchmark/reference | REVIEW |
| `agstack/OpenAgri-FarmCalendar` | Apache-2.0 | data-model reference | LOW FRICTION |
| `agstack/OpenAgri-PestAndDiseaseManagement` | EUPL-1.2 | GDD/risk benchmark | REVIEW |
| `agstack/asset-registry` | GitHub metadata'sında lisans yok | research only | UNKNOWN |
| `farmOS/farmOS` | GPL-2.0 | mimari/veri modeli referansı; kod dependency değil | REVIEW |
| YieldStack | exact upstream doğrulanmadı | aktif kuyruktan çıkarıldı | UNKNOWN |
| AgriGuard | exact upstream belirsiz | aktif kuyruktan çıkarıldı | UNKNOWN |
| agro-gis | exact upstream/fayda belirsiz | hold | UNKNOWN |

---

## pyfao56 özel notu

`LICENSE.md` içeriği projeyi ABD içinde public domain olarak tanımlıyor ve dünya çapında CC0 1.0 ile telif/bağlantılı haklardan feragat edildiğini belirtiyor. Ticari kullanım dahil kopyalama/değiştirme/dağıtma izni açıkça ifade ediliyor.

Bu, pyfao56'yı lisans açısından P0 pilot için güçlü aday yapar. Yine de:
- üçüncü taraf bağımlılıkların lisansları,
- veri kaynaklarının kullanım koşulları,
- model çıktısının doğruluğu

ayrı konulardır.

---

## PCSE özel notu

GitHub repository metadata'sı lisansı otomatik tanıyamıyor (`NOASSERTION`), fakat repo `LICENSE` dosyası açıkça EUPL Version 1.1 veya uygun sonraki sürümleri belirtiyor.

Karar:
- PCSE'yi mobil bundle'a gömmek yok.
- Python model servisi olarak izole tutulacak.
- Kaynak kodda değişiklik/dağıtım yapılacaksa EUPL yükümlülükleri release öncesi kontrol edilecek.

---

## PlantVillage özel notu

`spMohanty/PlantVillage-Dataset` kök dizininde bağımsız LICENSE dosyası görünmüyor; ancak repository'nin Hugging Face dataset metadata'sı `license: cc-by-sa-3.0` olarak yayınlanmış.

Bu nedenle production öncesi:
- attribution metni hazırlanır,
- kullanılan exact dataset dağıtımı/version'u kayıt altına alınır,
- dataset ile **model ağırlığının** lisansı ayrı incelenir,
- share-alike şartının eğitilmiş model/dağıtım biçimine etkisi ayrıca değerlendirilir,
- farklı mirror/repack veri setlerinin lisansı otomatik olarak bu lisans sayılmaz.

TarlaPusula için ilk kullanım `benchmark_only` olmalıdır.

---

## CC-BY-SA Custom Scripts notu

Sentinel Hub custom-scripts arşivi CC-BY-SA-4.0.

Bu yüzden:
- formül fikrini bilimsel kaynaktan bağımsız yeniden uygulamak ile,
- scripti doğrudan kopyalamak

aynı şey değildir.

Doğrudan script kopyalanacaksa attribution ve share-alike etkisi incelenir. TarlaPusula için tercih: indeks formüllerini resmi/bilimsel tanımdan kendi kodumuzla uygulamak ve script reposunu görsel/formül doğrulama referansı olarak kullanmak.

---

## EUPL / GPL projelerde genel kural

EUPL/GPL proje gördüğümüzde otomatik olarak 'kullanamayız' demiyoruz. Ancak şu ayrımı zorunlu tutuyoruz:

1. **API ile dış servis kullanımı**
2. **ayrı backend servis olarak çalıştırma**
3. **kaynak kodu değiştirme**
4. **kaynak kodu TarlaPusula repository'sine kopyalama**
5. **binary/package dağıtımı**

Bu senaryoların lisans etkileri aynı olmayabilir. Production kararı verilmeden önce kullanım şekli net yazılmalıdır.

---

## Veri/API lisansı ayrı tutulmalı

Kod lisansı uygun olsa bile veri ve hizmet koşulları farklı olabilir.

Örnek kontrol listesi:
- uydu sağlayıcısı kullanım şartları,
- Google Earth Engine hesap/kota/terms,
- hava sağlayıcısı redistribüsyon şartları,
- GBIF occurrence veri seti bazlı lisans/attribution,
- PlantVillage gibi eğitim datasetleri,
- model ağırlıklarının datasetten farklı lisansa sahip olması.

OpenET metodoloji referansı olarak izlenebilir; mevcut resmi kapsam Türkiye uygulama entegrasyonu için uygun görünmediğinden aktif API lisans işi açılmaz.

Bu nedenle her production adapter için şu metadata tutulmalı:

```ts
interface ExternalSourcePolicy {
  codeLicense?: string;
  dataLicense?: string;
  termsUrl?: string;
  attributionRequired: boolean;
  redistributionAllowed?: boolean;
  commercialUseReviewed: boolean;
  reviewedAt: string;
}
```

## Production lisans kapısı

Bir entegrasyon `LIVE` olmadan önce:

- [ ] exact upstream repo sabit
- [ ] kullanılan tag/commit kaydedildi
- [ ] kod lisansı kaydedildi
- [ ] model/dataset lisansı kaydedildi
- [ ] harici API terms kontrol edildi
- [ ] gerekiyorsa NOTICE/attribution hazır
- [ ] copyleft/share-alike etkisi değerlendirilmiş
- [ ] secrets/credentials dağıtıma girmiyor
- [ ] bağımlılıkların lisans listesi alınmış

Bu kutular tamamlanmadan `ENABLE_*` feature flag production'da açılmaz.
