# 29 — Harita açılışı: dünya → tarla ve tarla → tarla geçişleri

## Kullanıcı beklentisi

Harita ilk açıldığında doğrudan tarlaya zıplamak yerine kısa bir **dünya/genel görünümden tarlaya yaklaşma** animasyonu oynasın. Bu uygulamaya hava ve kimlik katar.

Tarla seçimi değiştirildiğinde de yeni tarlaya kuru `jumpTo` yapılmasın; kısa bir geri çekilme + yeni tarlaya yaklaşma geçişi olsun.

## Mevcut kök neden

`src/features/map-opening/mapOpening.ts` içinde:

- module-level `played` flag var,
- `sessionStorage` içindeki `tarlapusula:map-opening:v1` anahtarı animasyonu aynı oturumda tekrar engelliyor,
- mevcut `flyTo` doğrudan target camera'ya gidiyor; explicit world-start camera yok.

Bu davranış yeni ürün kararına uymuyor.

## Yeni davranış

### A — uygulama / home harita ilk açılışı

Her **yeni uygulama sayfa açılışında** bir kez:

```text
world / country-scale satellite
       ↓
Türkiye / bölge
       ↓
seçili tarla bounds
```

Ama React re-render/StrictMode remount yüzünden aynı sayfa açılışında tekrar tekrar oynamaz.

### Önerilen state

SessionStorage ile kullanıcı oturumunu bastırmak yerine map instance / app-launch run token:

```ts
MapOpeningController {
  launchPlayedForMap: boolean
  lastFieldId: string | null
  transitionInFlight: boolean
}
```

İlk `map.load` sonrası ve hedef tarla geometry hazır olduğunda yalnız bir kez launch sequence çalışır.

## Başlangıç kamerası

MapLibre'da gerçek globe projection kullanılmıyorsa da dünya hissi üretilebilir:

- target tarlanın longitude'u çevresinde merkez,
- zoom yaklaşık `2.2–3.0`,
- pitch `0`, bearing `0`,
- satellite basemap hazır olduğunda target bounds'a `flyTo`.

Gerçek `globe` projection eklemek ayrı karar olur; yalnız animasyon için zorunlu dependency değildir.

## Süre

Mobilde uzun bekleme olmamalı.

Öneri:
- dünya → tarla toplam `1600–2200 ms`,
- veri gecikirse animasyon loading'i gizlemek için sonsuza uzatılmaz,
- `prefers-reduced-motion: reduce` => doğrudan target camera.

## B — tarla değişimi

Kullanıcı tarla selector'dan başka tarlaya geçtiğinde:

```text
mevcut tarla
   ↓ zoom out
bölgesel görünüm
   ↓ fly
hedef tarla
```

Tam dünyaya çıkmak her seçimde yorucu olur; alanlar çok uzaksa controller gerektiği kadar daha fazla zoom-out yapar.

Örnek süre:
- aynı il/yakın alan: 800–1100 ms,
- uzak alan: 1100–1500 ms.

Hedef camera daima gerçek target bbox/center'dan üretilir.

## Görsel detay

Geçiş sırasında:
- field outline yeni target'a varınca netleşir,
- eski NDVI raster yeni tarla üzerine yanlışlıkla taşınmaz,
- yeni katman yüklenene kadar `Güncelleniyor`/skeleton state kullanılabilir,
- sahte NDVI gösterilmez.

İstenirse çok küçük bir field-name chip geçiş sonunda 1–1.5 sn görünüp kaybolabilir.

## Harita verisi / maliyet

Kamera animasyonu dış API sorgusunu çoğaltmamalı.

- field data fetch field-id değişiminden bir kez tetiklenir,
- her animasyon frame'i API çağrısı yapmaz,
- transition yalnız presentation katmanıdır.

## Görev / puan ilişkisi

Bu geçiş yalnız UX'tir:
- görev üretmez,
- Pusula puanı vermez,
- bildirim üretmez.

## Dosya planı

Değişecek:

```text
src/features/map-opening/mapOpening.ts
src/features/map-opening/openingTarget.ts
src/features/home-map/HomeMapEngine.tsx
src/features/home-map/components/HomeMapSectionMapFirst.tsx
```

Önerilen yeni dosya:

```text
src/features/map-opening/mapTransitionController.ts
```

Opsiyonel testler:

```text
src/features/map-opening/mapOpening.test.ts
src/features/map-opening/mapTransitionController.test.ts
```

## State machine

```text
idle
 -> launch_ready
 -> launch_animating
 -> settled(field A)
 -> field_change(field B)
 -> switching
 -> settled(field B)
```

Aynı `fieldId` tekrar render edilirse transition çalışmaz.

## Kabul kriterleri

- [ ] yeni sayfa/app açılışında dünya/genel görünümden seçili tarlaya yaklaşma her seferinde oynar.
- [ ] aynı render cycle içinde StrictMode nedeniyle iki kez oynamaz.
- [ ] tarla değişiminde kısa zoom-out → yeni tarla fly geçişi vardır.
- [ ] aynı tarlayı tekrar seçmek animasyon başlatmaz.
- [ ] reduced-motion kullanıcıda animasyon atlanır.
- [ ] geçiş sırasında eski tarlanın NDVI'sı yeni tarlada gösterilmez.
- [ ] animasyon API çağrı sayısını frame bazında artırmaz.
- [ ] harita kontrolü geçiş bittikten hemen sonra kullanıcıya geri verilir.

## Bitti tanımı

TarlaPusula haritası ilk açılışta **“dünyadan benim tarlama geldim”**, tarla değişiminde ise **“bir tarladan diğerine uçtum”** hissi veriyor; ama bu efekt uygulamayı yavaşlatmıyorsa tamamdır.
