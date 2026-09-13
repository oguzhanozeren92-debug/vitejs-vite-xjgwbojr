# Entegrasyon Hazırlık Durumu

Bu tablo **uygulamada çalışıyor mu?** değil, **entegrasyona ne kadar hazırız?** sorusunu izler.

Durumlar:
- `LIVE` — TarlaPusula akışında gerçekten kullanılıyor.
- `PILOT_READY` — Çalışan bağımsız PoC var, canlı akışa bağlı değil.
- `PREP` — Entegrasyon tasarımı/veri hazırlığı var, çalışan üçüncü taraf model yok.
- `HOLD` — Mevcut sistem aynı işi yaptığı için şimdilik eklenmeyecek.
- `RESEARCH` — Değer ve lisans/teknik uygunluk araştırılacak.

| Motor / Kaynak | Ürün amacı | Bugünkü gerçek durum | Hazırlık durumu | Canlıya geçmeden gereken ana kanıt |
|---|---|---|---|---|
| GBIF Occurrence API | Yakındaki geçmiş zararlı/tür gözlemleri | `field-biodiversity-context` üzerinden canlı kullanım var | LIVE | Veri yaşı/mesafe/koordinat belirsizliğini kullanıcıya doğru aktarmaya devam et |
| pyfao56 | Referans ET ve su dengesi karşılaştırması | Bağımsız PoC var | PILOT_READY | Aynı gün/konum/hava/Kc ile uygulama ET₀ karşılaştırması + gerçek sulama geçmişi |
| PCSE / WOFOST | Fenoloji, büyüme ve sezon modelleme | Resmi demo veriyle çalışan PoC var | PILOT_READY | Aynı yıllık ürün için tam sezon hava + toprak/site + agromanagement + saha evre gözlemleri |
| AquaCrop-OSPy | Su-verim / sulama senaryosu | Çalışan model hattı yok | PREP | Yıllık ürün tam sezon veri seti + en az iki sulama senaryosu + ölçülmüş sezon sonucu |
| Copernicus Data Space Sentinel-2 | NDVI/zaman serisi | Kendi Edge akışımız canlı | LIVE | Bulut maskesi, tarih tazeliği, parsel piksel yeterliliği izlenmeli |
| sentinelhub-py | Uydu istemci kütüphanesi | Kurulu değil | HOLD | Mevcut Copernicus akışına ölçülebilir kalite/operasyon avantajı göstermeli |
| eo-learn | EO zaman serisi/ML pipeline | Kurulu değil | HOLD | Mevcut TS/Edge zaman serisine karşı ölçülebilir üstünlük göstermeli |
| OpenAgri Irrigation | Sulama karar altyapısı | Paket bağlı değil; kendi motorumuz var | HOLD | Kendi Irrigation Engine'e karşı benchmark üstünlüğü göstermeli |
| OpenAgri Weather | Hava altyapısı | Paket bağlı değil; kendi hava katmanımız var | HOLD | Mevcut sağlayıcılara göre veri/kararlılık üstünlüğü göstermeli |
| OpenAgri FarmCalendar | Operasyon/takvim | Paket bağlı değil; kendi takvim/plan yapımız var | HOLD | Gerçek eksikliği çözmeli; yalnızca benzerlik yetmez |
| AgStack Asset Registry | Tarla kimliği/interoperability | Entegrasyon yok | RESEARCH | Dış sistemlerle kalıcı kimlik ihtiyacı ve lisans/operasyon faydası |
| AutoGeoBound benzeri sınır modeli | Otomatik parsel sınırı önerisi | Entegrasyon yok | PREP | Türkiye örneklerinde IoU/Boundary-F1 + kullanıcı onaylı düzeltme akışı |
| AgML | Tarımsal ML veri/model araçları | Eğitim/çıkarım hattı yok | RESEARCH | Hastalık teşhisinde mevcut AI akışından daha iyi doğrulanmış benchmark |
| PlantVillage | Hastalık veri seti | Repo/model entegrasyonu yok | RESEARCH | Kullanım lisansı + Türkiye bitki/hastalık kapsaması + domain-shift testi |
| FarmVibes.AI | Çok kaynaklı tarımsal analiz | Entegrasyon yok | RESEARCH | Tekil modüllerin mevcut motorlara ek değer göstermesi |
| OpenET | ET veri kaynağı | Doğrudan entegrasyon yok | RESEARCH | Türkiye kapsaması, veri gecikmesi ve mevcut ET hattına fayda |
| geemap | EO/GEE yardımcı araçları | Entegrasyon yok | HOLD | Üretim hattında gerçekten gerekli kullanım alanı çıkmalı |
| farmOS | Veri modeli/farm management referansı | Kod entegrasyonu yok | HOLD | Sadece ihtiyaç duyulan şema fikirleri alınabilir; komple sistem gerekmez |
| agro-gis | GIS referansı | Entegrasyon izi yok | RESEARCH | Somut modül ve lisans doğrulaması |
| YieldStack | Verim modelleme adayı | Entegrasyon izi yok | RESEARCH | Repo kimliği, bakım durumu, lisans ve benchmark |
| AgriGuard | Hastalık/risk adayı | Entegrasyon izi yok | RESEARCH | Repo kimliği, bakım durumu, lisans ve benchmark |

## Uygulama sırası

1. pyfao56 doğrulaması
2. PCSE gerçek tarla pilotu
3. AquaCrop yıllık ürün pilotu
4. Otomatik tarla sınırı benchmarkı
5. Hastalık modeli benchmarkı (AgML/PlantVillage veya daha uygun model)
6. FarmVibes modül bazlı değerlendirme
7. AgStack yalnızca interoperability ihtiyacı doğarsa

## HOLD listesini neden koruyoruz?

`HOLD` başarısız demek değildir. TarlaPusula'nın zaten çalışan bir sistemi varsa yeni bağımlılık eklemek bakım, lisans, maliyet ve hata yüzeyini artırır. Yeni araç yalnızca ölçülebilir fayda sağlıyorsa alınır.
