# 27 — Alt sekme Pusula AI: gerçek hub + fotoğraf analizi alt akışı

## Sorun

Alt menüdeki `Pusula AI` girişi bugün doğrudan `AiAnalysisScreen` akışına gidiyor. Bu ekran aynı dosyada genel tarla sentezi, fotoğraf ön analizi, eski CMS/onboarding stilleri ve büyük Pusula görsellerini birleştiriyor. Mobilde taşma, dev yazı, kırık hiyerarşi ve farklı tasarım dili oluşuyor.

Pusula AI'nın ana işi yalnız fotoğraf analizi değildir. Fotoğraf analizi Pusula'nın araçlarından yalnızca biridir.

## Ürün kararı

Alt sekmedeki `Pusula AI` butonu yeni bir **Pusula AI Hub** açacak.

Ana ekran sade olacak:

```text
PUSULA AI
[ seçili tarla ]

Pusula'dan Sana
kısa güncel değerlendirme
[Neden?] [Haritada gör] [Takvimime ekle*]

Araçlar
[ Fotoğraftan Analiz ] [ Tarla Değerlendirmesi ]
[ Geçmiş Öneriler ]    [ Görevlerim ]
```

`Takvimime ekle` yalnız zamana bağlanabilir gerçek bir aksiyon varsa görünür.

## Varsayılan Pusula çıktısı

Kalıcı ürün kararına uyulur:

- 1–2 kısa cümle.
- `Neden bunu öneriyorum?` altında 2–3 kısa kanıt.
- detay ancak kullanıcı isterse açılır.
- teknik hesap AI tarafından uydurulmaz; doğrulanmış servis/engine verisi kullanılır.
- eski veri güncelmiş gibi sunulmaz.

## Fotoğraftan analiz

Mevcut `AiAnalysisScreen` tamamen silinmek zorunda değildir; görev alanı daraltılır:

```text
Pusula AI Hub
   -> Fotoğraftan Analiz
      -> tarla seç
      -> fotoğraf çek/yükle
      -> kısa ön analiz
      -> saha kaydına ekle
      -> gerekirse Görev oluştur / Takvimime ekle
```

Fotoğraf ekranı bottom-nav'ın ana Pusula ekranı değildir.

## Eksik veri ve Görevlerim

Pusula bir değerlendirme için kullanıcıdan çözülebilir veri bekliyorsa uzun popup açmaz.

Örnek:

```text
Bu değerlendirme için son sulama tarihi eksik.
[Görevlerimde tamamla]                       +20P
```

Kurallar:

- görev `Task Engine` tarafından üretilir.
- puan miktarı server reward rule'dan gelir.
- verinin gerçekten kaydedilmesi completion şartıdır.
- aynı task tekrar puan vermez.
- consent, konum izni veya push iznini açtırmak için Pusula puanı verilmez.

## Haritada gör

Pusula Hub'daki `Haritada gör` yeni focus-mode sözleşmesini kullanır (`30-map-focus-mode.md`).

- doğrudan dağınık kontrol şeridi bindirilmez.
- ilgili alan görünür biçimde odaklanır.
- alan kanıtı yoksa sahte poligon oluşturulmaz.

## Takvimime ekle

Pusula'nın zamana bağlanabilir önerileri `CalendarActionDraft` üretir.

Örn:
- yarın sabah saha kontrolü,
- yağış sonrası drenaj kontrolü,
- uygun ilaçlama penceresi,
- 7 gün sonra tekrar fotoğraf çekimi.

Kullanıcı tarihi/saatini görür ve onaylar. Sadece reminder eklemek puan kazandırmaz.

## Tasarım dili

- Neon Cyber-Agri / Obsidian Green.
- eski `#cdb26d` altın ağırlıklı Pusula AI CSS'i kaldırılır/merkez tokenlara taşınır.
- tek tip header ve bottom nav.
- mobil viewport'ta horizontal overflow yok.
- dev Pusula görseli içerik üstüne binmez.

## Global Pusula davranışı

`GlobalPusulaBand` Pusula AI Hub'ın üzerine ikinci bir büyük Pusula UI bindirmemeli. Hub kendi Pusula kimliğini yönetir.

Öneri:
- `screen === 'pusulaAi'` iken global guide overlay kapalı.
- gerekiyorsa yalnız küçük header markası kullanılır.

## Route / dosya planı

Yeni:

```text
src/pages/PusulaAi/PusulaAiScreen.tsx
src/pages/PusulaAi/PusulaAiScreen.css
src/features/pusula-ai/components/PusulaCurrentInsight.tsx
src/features/pusula-ai/components/PusulaToolGrid.tsx
src/features/pusula-ai/hooks/usePusulaAiHub.ts
src/features/pusula-ai/types.ts
```

Değişecek:

- `src/types/index.ts` — `pusulaAi` screen eklenir; `aiAnalysis` fotoğraf alt ekranı olarak kalabilir.
- `src/App.tsx` — route ayrımı.
- bottom-nav component/data — Pusula AI hedefi `pusulaAi`.
- `src/pages/AiAnalysis/AiAnalysisScreen.tsx` — yalnız photo-analysis sorumluluğuna küçültme.
- `src/components/GlobalPusulaBand.tsx` — screen policy.

## Kabul kriterleri

- [ ] bottom nav Pusula AI, fotoğraf ekranına değil Hub'a gider.
- [ ] Hub iPhone genişliğinde taşmaz.
- [ ] seçili tarlaya ait kısa Pusula özeti görünür.
- [ ] fotoğraf analizi ayrı araç olarak açılır.
- [ ] `Neden?`, `Haritada gör`, uygun olduğunda `Takvimime ekle` çalışacak sözleşmeye sahiptir.
- [ ] eksik veri task'a yönlenebilir.
- [ ] global Pusula görseli ekranın ortasına dev biçimde binmez.
- [ ] puan, yalnız doğrulanmış task completion'da verilir.

## Bitti tanımı

Kullanıcı alt menüde `Pusula AI` dediğinde **TarlaPusula'nın akıllı rehber merkezine** girdiğini hissediyorsa; fotoğraf analizi bunun içinde ayrı bir araçsa tamamdır.
