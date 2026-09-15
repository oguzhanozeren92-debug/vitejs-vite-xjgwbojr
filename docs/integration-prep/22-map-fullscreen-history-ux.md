# 22 — Harita tam ekran + uydu geçmişi UX hazırlığı

Bu belge çalışan uygulamayı değiştirmez. Amaç, sınır kalktığında harita PR'ının kararlarını yeniden tartışmadan doğrudan uygulanabilmesidir.

## Kullanıcı kararı

1. Harita alanına kısa dokunuş mobilde tam ekran haritayı açar.
2. Tam ekran harita **uygulama viewport'unun tamamını** kaplar; kart gibi kenar boşluğu, radius veya alt/üst boşluk kalmaz.
3. Mevcut ayrı `Tam ekran` / `Maximize` butonu kaldırılır. Haritaya dokunma zaten bu işi yaptığı için ikinci giriş noktası gereksizdir.
4. Bu boşalan üst aksiyonun yerine `Görevlerim` butonu gelir.
5. Tam ekrandan çıkış için tek bir geri/kapat kontrolü korunur. Tam ekran toggle butonu geri gelmez.
6. Harita kontrolündeki NDVI takip noktaları ile uydu geçmişi aynı `History` ikonunu kullanmaz.
   - Uydu geçmişi: `History` / saat-geri ikonu korunur.
   - Takip noktaları: `MapPinned` benzeri konum/takip ikonu kullanır.
7. Uydu geçmişi ikonunun altında `Geçmiş` yazısı gösterilmez. İkon-only; `aria-label` ve `title` açıklaması korunur.
8. Uydu geçmişi metin listesi değil, yatay kaydırılan **görsel önizleme kartları** olarak gösterilir.
9. Haritada aktif veri tarihi her zaman görünür kalır.
10. Uydu geçmişi kullanıcının uygulamayı kurduğu tarihten başlamaz. Copernicus/Sentinel-2 arşivinden uygun eski çekimler doğrudan sorgulanır.

---

## Mevcut kodda doğrulanan durum

### Tam ekran

`src/features/home-map/components/HomeMapSectionMapFirst.tsx`

- Harita canvas'ına kısa dokunma `setPortraitExpanded(true)` yapıyor.
- `portraitExpanded` aktifken `.tp-map-stage` sınıfına `tp-map-portrait-fullscreen` ekleniyor.
- mevcut CSS `position: fixed`, `inset: 0`, `width: 100vw`, `height: 100vh` kullanıyor.
- ayrıca `HomeMapSection.tsx` içinde `Maximize` ikonlu `.tp-map-fullscreen-btn` ve Native Fullscreen API çağrısı var.

Sonuç: iki ayrı tam ekran mekanizması var. Yeni tasarımda yalnız **map-tap -> portrait fullscreen** kalacak.

### Uydu geçmişi

`src/features/map-data/components/SatelliteHistorySheet.tsx`

Mevcut görünüm:
- `Ölçüm tarihi seç`
- `Son ölçüme dön`
- tarihlerin altında `History` ikonlu metin satırları

Bu kullanıcı kararına uymuyor ve yeniden tasarlanacak.

`src/features/map-data/services/satelliteHistory.ts`

- `listSatelliteDates()` Edge Function'a `{ listScenes: true, daysBack: 180 }` gönderiyor.
- `fetchHistoricalSatellite()` seçilen gün için gerçek NDVI verisini istiyor.

`supabase/functions/satellite-field-analysis/index.ts`

- Copernicus Data Space Catalog `/catalog/v1/search` kullanılıyor.
- `sentinel-2-l2a` arşivi sorgulanıyor.
- `daysBack` list-scenes modunda 180 güne kadar çalışıyor.
- katalogdan gelen sahneler tarih ve `eo:cloud_cover` ile sıralanabiliyor.

Dolayısıyla ürün davranışı **kurulum sonrası geçmiş değil, gerçek uydu arşivi** olmalıdır. Bugünkü `Uydu tarih listesi alınamadı` hatası arşiv mantığının yanlış olduğu anlamına gelmez; Catalog çağrısının neden başarısız olduğunun bulunması gereken ayrı bir bug'dır.

---

# A — Tam ekran harita final davranışı

## Mobil

Kısa dokunuş:

```text
home map canvas
   -> portraitExpanded = true
   -> map stage fixed viewport
   -> body/root scroll lock
   -> MapLibre resize
```

### CSS hedefi

`100vh` yerine modern mobil viewport için önce `100dvh`, fallback olarak `100vh`:

```css
.tp-map-stage.tp-map-portrait-fullscreen {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  width: 100dvw !important;
  height: 100vh !important;
  height: 100dvh !important;
  max-width: none !important;
  max-height: none !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
}
```

Not: Web uygulaması Safari/Opera/Chrome tarayıcı kabuğunun URL çubuğunu zorla kapatamaz. Buradaki “tam ekran”, **tarayıcının uygulamaya verdiği viewport'un tamamıdır**. PWA kurulumu ayrı bir konu.

### Safe area

Haritanın kendisi `inset: 0` kaplar. Kapat/geri, Görevlerim, katman gibi overlay kontrolleri:

```css
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
```

ile çentik/home-indicator altında kalmaz.

### Tam ekran açılmaması gereken dokunuşlar

Map canvas üzerinde gerçek harita dokunuşu tam ekranı açar. Şunlara basınca tam ekran tetiklenmez:
- zoom + / -
- katmanlar
- geçmiş
- görevler
- Pusula
- takip noktaları
- popup/bottom sheet
- marker / işlem aksiyonu

Mevcut pointer-threshold mantığı (drag > 10 px ise açma) korunur; haritayı sürüklemek tam ekran tetiklemez.

---

# B — Fullscreen butonunun yerine Görevlerim

## Değiştirilecek mevcut buton

`src/features/home-map/components/HomeMapSection.tsx`

Bugün:

```text
Maximize -> .tp-map-fullscreen-btn -> requestFullscreen()
```

Yeni:

```text
ListChecks / ClipboardCheck -> .tp-map-tasks-btn -> TaskSheet aç
```

Görsel:
- icon-only
- metin yazmaz
- `aria-label="Görevlerim"`
- `title="Görevlerim"`
- aktif görev varsa sağ üstte küçük sayı badge'i (`3` gibi)
- puan toplamı toolbar ikonunun üstüne yığılmaz

`Maximize` importu ve `requestFullscreen/exitFullscreen` kodu kaldırılır.

`HomeMapSectionMapFirst.tsx` içindeki `.tp-map-fullscreen-btn` click-capture toggle yolu da kaldırılır; map-tap portrait mekanizması tek otorite olur.

---

# C — Sağ kontrol rayı ikonları

Mevcut `HomeMapEngine.tsx` kontrol sırası yaklaşık:

```text
Crosshair
NDVI takip noktaları -> History (yanlış/karışıyor)
+
-
Uydu geçmişi -> History + "Geçmiş"
Katmanlar
```

Yeni:

```text
Crosshair
NDVI takip noktaları -> MapPinned (veya eşdeğer konum/takip sembolü)
+
-
Uydu geçmişi -> History (yalnız ikon)
Katmanlar
```

`tp-map-history-label` içindeki `<span>Geçmiş</span>` kaldırılır. Kontrol rayı tüm butonlarda aynı ölçüde kalır.

---

# D — Aktif veri tarihi

`MapDataDate` zaten mevcut ve `latestImageDate` üzerinden `NDVI · GG.AA.YYYY` gösterebiliyor. Bu yeniden yazılmayacak; görünürlüğü ve konumu güçlendirilecek.

Final kural:
- Güncel görüntü: `NDVI · 12.09.2026`
- Eski tarih seçildiğinde: `NDVI · 04.09.2026`
- tarihi bilinmeyen veri güncelmiş gibi sunulmaz
- history kartındaki seçili tarih ile haritada yazan tarih aynı kaynaktan gelir

Tam ekranda tarih alt/üst kontrol kalabalığına girmeden, harita üzerinde okunabilir ama küçük bir badge olarak görünür.

---

# E — Uydu Geçmişi bottom sheet final tasarımı

## Başlık

```text
Uydu Geçmişi
<Tarla adı> · NDVI
```

Başlığın altında tekrar uzun açıklama zorunlu değil. Gerekirse bir satır:

`Son 6 aydaki uygun Sentinel-2 ölçümleri`

## Yatay preview rail

İlk kart her zaman **Güncel**:

```text
[ thumbnail ] [ thumbnail ] [ thumbnail ] ...
  Güncel         04 Eyl       28 Ağu
  12 Eyl
```

Kart alanları:

```ts
type SatelliteHistoryItem = {
  date: string;
  isCurrent: boolean;
  cloudCoverage: number | null;
  previewUrl: string | null;
  previewStatus: 'idle' | 'loading' | 'ready' | 'error';
  selected: boolean;
};
```

### Kart görsel kuralları

- 16:10 / yaklaşık 120–150px genişliğinde yatay küçük kart.
- Önizleme gerçek o tarihin NDVI raster'ından üretilir.
- Kartın altındaki tarih görünür.
- Güncel karta küçük `Güncel` badge'i.
- Seçili kart emerald border/glow ile hafif vurgulanır.
- bulut oranı varsa çok küçük ikincil metin; ana bilgi değildir.
- preview yüklenmezse kart kaybolmaz; nötr skeleton/error thumbnail görünür.

### Dokunma

Bir preview'a dokununca:
1. seçilen tarihin full-resolution NDVI sonucu istenir/cache'ten alınır,
2. harita o raster'a geçer,
3. `MapDataDate` seçilen tarihi gösterir,
4. sheet kapanabilir veya kullanıcı isterse açık kalabilir; ilk sürümde dokununca kapanması daha temizdir.

`Güncel` kartına dokunmak history override'ını temizler ve en son canlı `satelliteData`ya döner.

---

# F — Preview performans planı

6 aylık bütün tarihler için 768x768 tam raster'ı ilk açılışta indirmek yasak. API ve mobil veri israfı olur.

Plan:

1. `listScenes` cevabını backward-compatible şekilde zenginleştir:

```json
{
  "success": true,
  "dates": ["2026-09-12", "2026-09-04"],
  "scenes": [
    { "date": "2026-09-12", "cloudCoverage": 4.2 },
    { "date": "2026-09-04", "cloudCoverage": 11.7 }
  ]
}
```

2. Preview için `previewOnly: true` veya ayrı internal action kullan.
3. Preview Process API output 256x256 civarında tutulur.
4. İlk görünür 4–6 kart lazy-load edilir.
5. Kullanıcı yatay scroll ettikçe sıradakiler yüklenir.
6. Seçilen tarihin 768x768/full raster'ı ancak karta basınca yüklenir.
7. preview cache: `fieldId + date + layer + version`.

Gerçek kullanıcı poligonu GitHub fixture'a yazılmaz.

---

# G — `Uydu tarih listesi alınamadı` bug hazırlığı

Sınır kalkınca bu hata UI redesign'dan önce/aynı PR'da doğrulanacak.

Kontrol sırası:

1. `COPERNICUS_CLIENT_ID` / `COPERNICUS_CLIENT_SECRET` Edge Function env mevcut mu?
2. token endpoint başarılı mı?
3. `CATALOG_URL = https://sh.dataspace.copernicus.eu/catalog/v1/search` HTTP status/body nedir?
4. test polygon `intersects` kabul ediliyor mu?
5. 180 günlük query limit/response size sorunu var mı?
6. Catalog `features` geliyor ama `eo:cloud_cover` filtrelemesi tüm sahneleri eliyor mu?
7. aynı geometriyle 30 günlük ve 180 günlük test karşılaştır.
8. Edge log'da secret/geometry raw olarak loglama.

Mevcut `supabase/functions/satellite-field-analysis/history.test.mjs` genişletilecek:
- scene list success
- duplicate date dedupe
- cloud metadata
- invalid date
- empty archive
- upstream 4xx/5xx -> kullanıcıya anlaşılır error

---

# H — Dosya planı

## Değişecek

```text
src/features/home-map/components/HomeMapSection.tsx
src/features/home-map/components/HomeMapSectionMapFirst.tsx
src/features/home-map/HomeMapEngine.tsx
src/features/map-data/components/SatelliteHistorySheet.tsx
src/features/map-data/components/SatelliteHistorySheet.css
src/features/map-data/components/MapDataDate.tsx        (yalnız gerekirse label/state)
src/features/map-data/components/MapDataDate.css
src/features/map-data/hooks/useSatelliteHistory.ts
src/features/map-data/services/satelliteHistory.ts
supabase/functions/satellite-field-analysis/index.ts
supabase/functions/satellite-field-analysis/history.test.mjs
```

## Yeni oluşturulabilir

```text
src/features/map-data/types/satelliteHistory.ts
src/features/map-data/components/SatelliteHistoryCard.tsx
src/features/map-data/services/satellitePreviewCache.ts
```

Component içine Copernicus çağrısı eklenmez; service/Edge sınırı korunur.

---

# I — Kabul kriterleri

- [ ] mobilde map canvas'a kısa tap -> viewport'u tamamen dolduran harita
- [ ] drag/zoom/control tap yanlışlıkla fullscreen açmıyor
- [ ] ayrı Maximize butonu yok
- [ ] onun yerinde Görevlerim butonu var
- [ ] tracking ve history farklı ikon
- [ ] history kontrolünde `Geçmiş` yazısı yok
- [ ] aktif NDVI tarihi haritada görünür
- [ ] history sheet yatay preview kartları gösterir
- [ ] ilk kart Güncel
- [ ] eski tarihler app kurulumundan bağımsız Copernicus arşivinden gelir
- [ ] karta basınca doğru tarih raster'ı açılır
- [ ] full raster bütün kartlar için peşinen indirilmez
- [ ] history error gerçek upstream sebebi log/telemetry ile ayırt edilebilir
- [ ] eski çalışan map layer/zoom/field selection akışı bozulmaz

## Önerilen implementation branch

`feat/map-fullscreen-history-tasks-shell`

Görev motorunun backend/puan kısmı ayrı PR olmalıdır; bu branch yalnız map shell + history UX + TaskSheet giriş noktasını açabilir.
