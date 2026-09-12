# pyfao56 bağımsız deneme

Bu klasör, [pyfao56](https://github.com/kthorp/pyfao56) ile yedi günlük **sentetik** hava verisinden referans ET, bitki ET ve kök bölgesi su açığı hesaplar. Uygulamanın sulama kararlarına veya Vercel build'ine bağlı değildir; burada görülen sayılar gerçek tarlaya öneri değildir.

```bash
python -m venv /tmp/tarlapusula-pyfao56-venv
/tmp/tarlapusula-pyfao56-venv/bin/python -m pip install -r tools/pyfao56-poc/requirements.txt
/tmp/tarlapusula-pyfao56-venv/bin/python tools/pyfao56-poc/run.py
```

Çıktı, `data_type: synthetic` etiketiyle yedi günlük JSON üretir. pyfao56 referans ET için ASCE standart denklemini kullanır; uygulamadaki Open-Meteo `et0_fao_evapotranspiration` ile farklılıklar beklenebilir. Gerçek karşılaştırma için aynı tarih, koordinat, hava girdileri, ürün evresi, toprak parametreleri ve sulama kayıtlarının doğrulanıp eşleştirilmesi gerekir.
