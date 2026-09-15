# 16 — Upstream sürüm / commit sabitleme snapshot'ı

Snapshot tarihi: **2026-09-13**

Amaç: entegrasyon günü `latest` kullanıp upstream davranışını farkında olmadan değiştirmemek. Buradaki SHA'lar **bugünkü araştırma başlangıç pinleri**dir; implementasyona başlarken upstream tekrar kontrol edilir ve pin güncellenecekse bilinçli PR ile güncellenir.

## Kural

- `latest`, `main`, `master` gibi hareketli referanslar production model runner'a verilmez.
- Model registry'de exact upstream repo + commit/tag + adapter version kaydedilir.
- Upstream güncellemesi ayrı benchmark gerektirir.
- Güvenlik açığı nedeniyle acil güncelleme gerekirse de yeni pin test edilmeden production'a alınmaz.

| Motor | Upstream | Snapshot branch | Başlangıç pin SHA | Lisans | Not |
| --- | --- | --- | --- | --- | --- |
| pyfao56 | `kthorp/pyfao56` | `main` | `1d242ee985be0edbc4946f06e7e94a487d4bc0c9` | CC0 1.0 / public domain dedication | commit mesajı `v1.4.3` dalından merge olduğunu gösteriyor; release endpoint yerine SHA pinlenecek |
| PCSE / WOFOST | `ajwdewit/pcse` | `master` | `67a28e56b0e34655f8d60b0b4a254a7c81efbb2f` | EUPL 1.1 veya uygun sonraki sürümler | ParameterProvider iterator fix merge'i; gerçek pilot başlamadan package version ayrıca kaydedilecek |
| AquaCrop-OSPy | `aquacropos/aquacrop` | `master` | `36cc20e44644ed1704398889312435c85e04a2f3` | Apache-2.0 | commit mesajı v3.1.0 değişikliklerini tarif ediyor; SHA asıl reproducibility referansı |
| AutoGeoBound | `agstack/autogeobound` | `main` | `7087b59e51438ec370b698186805751be9296ec2` | Apache-2.0 | son commit 2025-02-20; benchmark/PoC gözüyle değerlendirilecek, kör production dependency değil |
| OpenAgri Pest&Disease | `agstack/OpenAgri-PestAndDiseaseManagement` | `main` | `3aa67a9ad3de6ff8a772dc635db041ec53845aa4` | EUPL-1.2 | usage examples/documentation/bug fixes merge'i; risk/GDD benchmark adayı |
| AgML | `Project-AgML/AgML` | `main` | `c3343fc3b3f8abd89983927da3fc8319cb019d49` | Apache-2.0 | 2026-09-12 `updating version number`; yalnız benchmark/R&D başlangıç snapshot'ı |
| FarmVibes.AI | `microsoft/farmvibes-ai` | `main` | `d10670e18742d05aec50f73e4695d47978908994` | MIT | 2026-09-09 güvenlik/reproducibility amaçlı GitHub Actions SHA pinleme commit'i; full-stack deploy planlanmıyor |

## İkinci seviye adaylar

Aşağıdakiler için bugün exact pin üretmek gerekmiyor; çünkü aktif implementasyon sırası henüz gelmedi:

- `sentinel-hub/sentinelhub-py`
- `sentinel-hub/eo-learn`
- `gee-community/geemap`
- `agstack/OpenAgri-WeatherService`
- `agstack/OpenAgri-IrrigationManagement`
- `agstack/OpenAgri-FarmCalendar`
- `agstack/asset-registry`
- `farmOS/farmOS`

Bu projeler için pin **ancak ilgili pilot gerçekten açılacağı PR'da** alınır. Böylece aylar öncesinin gereksiz snapshot'ını production adayı gibi taşımayız.

## Model registry örneği

```json
{
  "engine": "pyfao56",
  "upstreamRepo": "kthorp/pyfao56",
  "upstreamCommit": "1d242ee985be0edbc4946f06e7e94a487d4bc0c9",
  "adapterVersion": "1",
  "rolloutMode": "shadow",
  "license": "CC0-1.0",
  "reviewedAt": "2026-09-13"
}
```

## Güncelleme prosedürü

Bir pin yükseltilirken:

1. upstream diff/release notes incelenir,
2. lisans değişmiş mi bakılır,
3. fixture regression çalışır,
4. shadow cohort aynı girdilerde eski ve yeni pin ile kıyaslanır,
5. output farkları belgelenir,
6. kabul kriteri geçerse registry pin'i güncellenir,
7. eski pin rollback için kısa süre erişilebilir tutulur.

## Neden commit SHA?

Tarım karar motorunda reproducibility önemlidir. Kullanıcıya 10 Eylül'de verilen bir model sonucunun hangi kod sürümüyle üretildiğini sonradan açıklayabilmeliyiz. Sadece `v3` veya `main` kaydı bunu garanti etmez.

## Güvenlik notu

Upstream commit SHA'yı pinlemek tek başına supply-chain güvenliği sağlamaz. Ayrıca:
- Python dependency lock/hash,
- container/image digest,
- model ağırlığı checksum,
- dataset/version metadata,
- CI action pinleri

gerektiğinde kaydedilir.
