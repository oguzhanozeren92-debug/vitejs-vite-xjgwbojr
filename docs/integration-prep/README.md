# TarlaPusula Entegrasyon Hazırlık Merkezi

Bu klasör, açık kaynak ve harici tarım motorlarını **çalışan uygulamaya dokunmadan** entegrasyona hazır hale getirmek için kullanılır.

## Kural

Bir proje doğrudan `main` uygulama akışına alınmaz. Önce şu kapılardan geçer:

1. **İhtiyaç doğrulama** — Mevcut TarlaPusula servisi aynı işi zaten yapıyor mu?
2. **Lisans kontrolü** — Ticari dağıtım, türev çalışma, attribution ve bağımlılık lisansları.
3. **Veri yeterliliği** — Modeli besleyecek gerçek ve tarihli girdi var mı?
4. **Bağımsız pilot** — Kullanıcı verisini canlı akışa bağlamadan örnek/veri setiyle çalıştırma.
5. **Karşılaştırmalı doğrulama** — Mevcut TarlaPusula sonucu ile aday motor aynı veri üzerinde karşılaştırılır.
6. **Adapter sözleşmesi** — TarlaPusula iç veri tipleri ile üçüncü taraf model arasına izolasyon katmanı.
7. **Feature flag** — Üretimde kapalı başlayacak; geri dönüş mümkün olacak.
8. **Pusula kanıt şeması** — Model çıktısı ham tavsiye olarak değil, kaynak + tarih + güven + kanıt ile Pusula'ya taşınacak.
9. **Kabul kriteri** — Hangi ölçümle başarılı sayılacağı önceden tanımlanır.
10. **Canlıya geçiş** — Ancak doğrulama tamamlanınca `main` üzerinde ürün akışına bağlanır.

## Standart adapter sözleşmesi

Her motor mümkün olduğunca aynı üst sözleşmeye çevrilir:

```ts
export type EngineEvidence = {
  source: string;
  observedAt?: string;
  fieldId?: string;
  metric: string;
  value: number | string | null;
  unit?: string;
  confidence?: number;
  note?: string;
};

export type EngineResult<T> = {
  engine: string;
  version?: string;
  generatedAt: string;
  validFor?: { fieldId?: string; from?: string; to?: string };
  status: 'ok' | 'insufficient_data' | 'error';
  result: T | null;
  evidence: EngineEvidence[];
  warnings: string[];
};
```

Bu tip **tasarım sözleşmesidir**; çalışan uygulamaya henüz eklenmiş değildir.

## Önerilen izolasyon yapısı

Canlı entegrasyon zamanı geldiğinde hedef yapı:

```text
src/integrations/<engine>/
  adapter.ts
  types.ts
  mapper.ts
  validation.ts
  featureFlag.ts

supabase/functions/<engine>-bridge/
  index.ts

tools/<engine>-poc/
  README.md
  fixtures/
  run.*
```

Python ağırlıklı motorlar Vercel ön yüzüne paketlenmez. Önce bağımsız iş/servis veya kontrollü backend katmanı olarak ele alınır.

## Öncelik sırası

| Öncelik | Motor | Karar |
|---|---|---|
| P0 | pyfao56 | Mevcut PoC'yi gerçek eş tarihli veriyle doğrula; sulama kararına hemen bağlama. |
| P0 | PCSE / WOFOST | Mevcut demo pilotunu gerçek yıllık ürün sezon verisiyle doğrula. |
| P1 | AquaCrop-OSPy | Su-verim ve sulama senaryosu için yıllık ürün pilotu hazırla. |
| P1 | AutoGeoBound / alan sınırı | Elle çizilen sınırın yanında öneri sınırı üret; kullanıcı onayı olmadan kaydetme. |
| P1 | AgML / PlantVillage hattı | Hastalık modeli araştırması; mevcut AI teşhis akışına doğrudan bağlanmadan benchmark yap. |
| P2 | FarmVibes.AI | Tek tek faydalı analiz parçalarını benchmark et; mevcut motorları komple değiştirme. |
| P2 | AgStack Asset Registry | Tarla kimliği/interoperability ihtiyacı oluşursa değerlendir. |
| HOLD | sentinelhub-py / eo-learn | Mevcut Copernicus NDVI hattı ihtiyacı karşılıyor; ölçülebilir üstünlük yoksa ekleme. |
| HOLD | OpenAgri Weather | Mevcut hava altyapısı varken tekrar etme. |
| HOLD | OpenAgri Irrigation | Mevcut Irrigation Engine'i doğrulamada referans olabilir; körlemesine değiştirme. |

## Feature flag isimleri

Canlı entegrasyon aşamasında önerilen env/flag adları:

```text
VITE_ENABLE_ENGINE_PYFAO56=false
VITE_ENABLE_ENGINE_PCSE=false
VITE_ENABLE_ENGINE_AQUACROP=false
VITE_ENABLE_AUTO_FIELD_BOUNDARY=false
VITE_ENABLE_AGML_DISEASE_MODEL=false
VITE_ENABLE_FARMVIBES_ANALYTICS=false
```

Sunucu tarafı gizli anahtarlar `VITE_` ile başlamaz ve ön yüze açılmaz.

## Güvenlik ve veri prensipleri

- Özel tarla koordinatı harici servise yalnızca ürün akışı gerçekten gerektiriyorsa gönderilir.
- Gerçek kullanıcı verisi PoC fixture olarak repoya commit edilmez.
- Eksik veri model tarafından uydurulmaz; `insufficient_data` döner.
- Model çıktısı tek başına ilaçlama, gübreleme veya sulama emri sayılmaz.
- Her kritik öneride kaynak tarihi ve kullanılan girdiler saklanabilir olmalıdır.
- Aynı tarla ve aynı tarih için eski/yeni motor karşılaştırılmadan varsayılan motor değiştirilmez.

## Hazırlık tamamlandı ne demek?

Bir entegrasyon ancak şu maddeler hazırsa `READY_FOR_IMPLEMENTATION` sayılır:

- [ ] Repo ve resmi dokümantasyon doğrulandı
- [ ] Lisans ve attribution notu yazıldı
- [ ] Girdi şeması kesin
- [ ] Çıktı şeması kesin
- [ ] TarlaPusula adapter haritası kesin
- [ ] Gerekli Supabase tablo/Edge Function taslağı kesin
- [ ] Feature flag kesin
- [ ] Fixture/test senaryosu kesin
- [ ] Başarı ölçütü kesin
- [ ] Fallback/rollback yolu kesin
- [ ] Pusula'ya gidecek kanıt formatı kesin

Detaylı durum: `STATUS.md`.
