# GitHub kaynaklı araçlar: uygulama durumu

Bu belge, planlanan açık kaynak projeler ile TarlaPusula reposunda çalışan kodu birbirinden ayırır. Bir yöntemi kendi kodumuzda kullanmamız, ilgili Python paketinin kurulduğu anlamına gelmez. Vercel'de çalışan uygulama Vite/React ön yüzüdür.

| Planlanan araç | Amaç | Bu repodaki durum |
| --- | --- | --- |
| [pyfao56](https://github.com/kthorp/pyfao56) | FAO-56 referans ET ve günlük su dengesi karşılaştırması | `tools/pyfao56-poc` içinde sentetik verili, bağımsız çalıştırılabilir pilot. Uygulama akışına bağlı değil. Ön yüzde mevcut `cropWaterUse.service.ts` ve `rootZoneWater.service.ts` kendi hesabını yapıyor. |
| [sentinelhub-py](https://github.com/sentinel-hub/sentinelhub-py) + [eo-learn](https://github.com/sentinel-hub/eo-learn) | Uydu zaman serisi ve sapma analizi | Paketler repoda yok. Ön yüz `satellite-ndvi-timeseries` adlı Supabase Edge işlevini çağırıyor; işlevin kaynak kodu bu repoda bulunmadığı için uydu sağlayıcısı ve arka uç işleyişi buradan doğrulanamıyor. |
| [PCSE](https://github.com/ajwdewit/pcse) | Bitki gelişimi/fenoloji araştırması | Paket repoda yok. `phenologyEngine.ts` kendi TypeScript fenoloji kurallarını uyguluyor. |
| [AgStack](https://github.com/agstack) OpenAgri / Asset Registry / AutoGeoBound | Tarla kimliği, sınır ve olay mimarisi | Uygulama entegrasyonu yok; araştırma aşamasında. |
| [AquaCrop-OSPy](https://github.com/aquacropos/aquacrop) | Su/verim senaryoları | Repo bağımlılığı ve çalışan senaryo akışı yok. |
| [AgML](https://github.com/Project-AgML/AgML) | Hastalık verisi ve model denemeleri | Repo bağımlılığı ve çalışan eğitim/çıkarım hattı yok. |
| [FarmVibes.AI](https://github.com/microsoft/farmvibes-ai) | Ayrı analiz katmanı | Bu repoda entegrasyon yok; mevcut servislerin yerine geçmesi planlanmıyor. |

## Sonraki doğrulanabilir adımlar

1. pyfao56 pilotunu gerçek saha önerisinden ayrı tutarak aynı günlere ait doğrulanmış hava, toprak, ürün evresi ve sulama girdileriyle mevcut hesapla yan yana ölçmek. ASCE referans ET ile Open-Meteo FAO ET₀ metodolojisini çıktıda ayrı etiketlemek. Farkların kaynağı anlaşılmadan canlı sulama kararı üretmemek.
2. `satellite-ndvi-timeseries` Edge işlevinin kaynak kodunu ve veri sağlayıcısını bulup gerçek zaman serisinin kapsamını doğrulamak. Ardından Sentinel Hub / eo-learn gerekip gerekmediğine karar vermek.
3. PCSE ve AquaCrop için veri gereksinimlerini ve çıktıları küçük karşılaştırmalarla doğrulamak. Saha verisi, gerekli servis ve işletme maliyeti belirlenmeden Vercel ön yüzüne bağımlılık eklememek.
4. AgStack, AgML ve FarmVibes.AI'yi ayrı araştırma/analiz işleri olarak değerlendirmek; yalnızca doğrulanan çıktıları mevcut karar katmanına taşımak.

Görünür uygulama değişikliği ancak pilot doğrulandıktan ve gerçekten bir ürün akışına bağlandıktan sonra Vercel'de görülecek. Bu belge ve pyfao56 örneği uygulamanın mevcut ekranlarını değiştirmez.
