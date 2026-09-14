# TarlaPusula Field Data Bridge

Bu klasör harita ve saha verileri için **tek otorite / tek snapshot** kuralını uygular.

## Değişmez kurallar

1. Aynı metrik için yalnız bir otoriter provider/Edge Function bulunur.
2. React ekranları provider seçmez; service/repository katmanı üzerinden veri ister.
3. Aynı request body aynı kullanıcı için tek cache key ve tek in-flight istek üretir.
4. Ekran veya katman değişimi tek başına yeniden ağ sorgusu başlatmaz.
5. Son başarılı snapshot hata veya refresh sırasında silinmez.
6. Snapshot stale ise önce eski doğru veri gösterilir; freshness kontrolü arka planda yapılır.
7. Kaynağın `sourceVersion` değeri değişmemişse UI snapshot'ı değiştirilmez.
8. Yeni kaynak geldiğinde veri ve görsel tamamen hazırlandıktan sonra swap yapılır.
9. Görsel cache ikinci veri kaynağı değildir; aynı snapshot'ın render çıktısıdır.
10. Harita iklim verisinde browser `best_match` fallback yasaktır; iklim otoritesi `era5-map`tir.

## Otoriteler

| Metrik | Tek otorite |
| --- | --- |
| NDVI / Sentinel-2 | `satellite-field-analysis` |
| Sentinel-1 radar | `sentinel1-radar` |
| Toprak modeli | `soilgrids` |
| Toprak nemi / sıcaklık / hava sıcaklığı | `era5-map` → ERA5-Land |
| Yağış reanalysis | `era5-map` → ERA5 |
| Yakın tür / zararlı bağlamı | `field-biodiversity-context` → GBIF |
| S1+S2 fusion | `field-satellite-fusion` |

Hava tahmini bu tablodan ayrıdır: tahmin ile geçmiş/reanalysis farklı metriklerdir ve birbirinin fallback'i olarak kullanılmaz.

## Cache davranışı

`edgeFunctionDataBridge.ts` RAM + IndexedDB kullanır. Persist edilen son başarılı snapshot uygulama yeniden açıldığında da okunabilir. TTL dolması snapshot'ı ekrandan silmez; yalnız arka planda freshness kontrolü yapılmasına izin verir. Ağ hatasında son başarılı snapshot korunur.

## Renk / render davranışı

`mapRuntime.ts` image source güncellemelerini `remove -> add` yerine mümkün olduğunda `updateImage` ile yapar. Farklı image source'a geçişte eski tamamlanmış raster, yeni source yüklenene kadar korunur. Böylece katman geçişinde renksiz ara kare oluşması azaltılır ve yarım yüklenmiş raster gösterilmez.
