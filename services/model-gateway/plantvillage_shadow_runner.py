from __future__ import annotations

import base64
import binascii
import json
import math
import os
from io import BytesIO
from pathlib import Path
import threading
import unicodedata
import urllib.request
from typing import Any

import numpy as np
import onnxruntime as ort
from PIL import Image
from pydantic import BaseModel, ConfigDict, Field

MAX_IMAGE_BYTES = 8_000_000
MAX_MODEL_BYTES = 64_000_000
MAX_LABEL_BYTES = 256_000
DEFAULT_MODEL_URL = "https://huggingface.co/imaflower/plantvillage-mobilenetv3/resolve/main/model.onnx"
DEFAULT_LABELS_URL = "https://huggingface.co/imaflower/plantvillage-mobilenetv3/resolve/main/class_names.json"
MODEL_REPOSITORY = "imaflower/plantvillage-mobilenetv3"
MODEL_LICENSE = "MIT"
CACHE_DIR = Path(os.getenv("PLANTVILLAGE_MODEL_CACHE", "/tmp/tarlapusula-models/plantvillage-mobilenetv3"))

_SESSION: ort.InferenceSession | None = None
_LABELS: list[str] | None = None
_LOCK = threading.Lock()


class ShadowModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PlantVillageShadowRequest(ShadowModel):
    field_id: str = Field(min_length=1, max_length=128)
    job_id: str = Field(min_length=1, max_length=128)
    crop: str | None = Field(default=None, max_length=160)
    mime_type: str = Field(default="image/jpeg", min_length=3, max_length=80)
    image_base64: str = Field(min_length=16)


def _blocked(payload: PlantVillageShadowRequest, reason: str, warning: str) -> dict[str, Any]:
    return {
        "ok": True,
        "blocked": True,
        "engine": "plantvillage-onnx-shadow",
        "mode": "disease_classification_shadow",
        "field_id": payload.field_id,
        "job_id": payload.job_id,
        "production_authority": False,
        "diagnostic_authority": False,
        "confidence_authority": False,
        "independent_model": True,
        "reason": reason,
        "top_predictions": [],
        "warnings": [warning],
    }


def _download(url: str, target: Path, max_bytes: int) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "TarlaPusula-PlantVillage-Shadow/1.0"})
    temp = target.with_suffix(target.suffix + ".part")
    total = 0
    try:
        with urllib.request.urlopen(request, timeout=35) as response, temp.open("wb") as handle:
            declared = response.headers.get("Content-Length")
            if declared and int(declared) > max_bytes:
                raise ValueError("Model varlığı güvenli boyut sınırını aşıyor.")
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > max_bytes:
                    raise ValueError("Model varlığı güvenli boyut sınırını aşıyor.")
                handle.write(chunk)
        if total <= 0:
            raise ValueError("Model varlığı boş indirildi.")
        temp.replace(target)
    finally:
        if temp.exists():
            temp.unlink(missing_ok=True)


def _labels(value: Any) -> list[str]:
    if isinstance(value, list):
        result = [str(item).strip() for item in value]
    elif isinstance(value, dict):
        nested = value.get("class_names") or value.get("labels")
        if isinstance(nested, list):
            result = [str(item).strip() for item in nested]
        else:
            try:
                result = [str(label).strip() for _, label in sorted(((int(k), v) for k, v in value.items()), key=lambda x: x[0])]
            except Exception:
                result = []
    else:
        result = []
    return [item for item in result if item]


def _runtime() -> tuple[ort.InferenceSession, list[str]]:
    global _SESSION, _LABELS
    if _SESSION is not None and _LABELS:
        return _SESSION, _LABELS
    with _LOCK:
        if _SESSION is not None and _LABELS:
            return _SESSION, _LABELS
        model_path = CACHE_DIR / "model.onnx"
        labels_path = CACHE_DIR / "class_names.json"
        if not model_path.exists():
            _download(os.getenv("PLANTVILLAGE_ONNX_URL", DEFAULT_MODEL_URL), model_path, MAX_MODEL_BYTES)
        if not labels_path.exists():
            _download(os.getenv("PLANTVILLAGE_LABELS_URL", DEFAULT_LABELS_URL), labels_path, MAX_LABEL_BYTES)
        labels = _labels(json.loads(labels_path.read_text(encoding="utf-8")))
        if not labels:
            raise ValueError("PlantVillage etiketleri okunamadı.")
        session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
        _SESSION = session
        _LABELS = labels
        return session, labels


def _image(payload: PlantVillageShadowRequest) -> Image.Image:
    try:
        raw = base64.b64decode(payload.image_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("PlantVillage fotoğraf verisi geçerli base64 değil.") from exc
    if not raw or len(raw) > MAX_IMAGE_BYTES:
        raise ValueError("PlantVillage fotoğrafı boş veya 8 MB sınırını aşıyor.")
    try:
        image = Image.open(BytesIO(raw)).convert("RGB")
        image.load()
        return image
    except Exception as exc:
        raise ValueError("PlantVillage fotoğrafı çözülemedi.") from exc


def _preprocess(image: Image.Image, session: ort.InferenceSession) -> np.ndarray:
    shape = session.get_inputs()[0].shape
    h = int(shape[2]) if len(shape) == 4 and shape[1] == 3 and isinstance(shape[2], int) else 224
    w = int(shape[3]) if len(shape) == 4 and shape[1] == 3 and isinstance(shape[3], int) else 224
    h = min(max(h, 32), 512)
    w = min(max(w, 32), 512)
    scale = max(h, w) / float(min(image.size))
    resized = image.resize((max(w, round(image.width * scale)), max(h, round(image.height * scale))), Image.Resampling.BILINEAR)
    left = max(0, (resized.width - w) // 2)
    top = max(0, (resized.height - h) // 2)
    crop = resized.crop((left, top, left + w, top + h))
    arr = np.asarray(crop, dtype=np.float32) / 255.0
    arr = (arr - np.asarray([0.485, 0.456, 0.406], dtype=np.float32)) / np.asarray([0.229, 0.224, 0.225], dtype=np.float32)
    if len(shape) == 4 and shape[1] == 3:
        arr = np.transpose(arr, (2, 0, 1))
    return np.expand_dims(arr, 0).astype(np.float32, copy=False)


def _probabilities(output: np.ndarray) -> np.ndarray:
    values = np.asarray(output, dtype=np.float64).reshape(-1)
    if not values.size or not np.all(np.isfinite(values)):
        raise ValueError("PlantVillage geçerli skor üretmedi.")
    if np.min(values) >= 0 and np.max(values) <= 1 and abs(float(np.sum(values)) - 1.0) <= 0.02:
        return values
    shifted = values - np.max(values)
    exp = np.exp(shifted)
    total = float(np.sum(exp))
    if total <= 0 or not math.isfinite(total):
        raise ValueError("PlantVillage skorları normalize edilemedi.")
    return exp / total


def _ascii(value: str | None) -> str:
    folded = unicodedata.normalize("NFKD", value or "")
    return "".join(ch for ch in folded if not unicodedata.combining(ch)).lower().strip()


ALIASES = {
    "elma": {"apple"}, "kiraz": {"cherry"}, "misir": {"corn", "maize"}, "uzum": {"grape"},
    "bag": {"grape"}, "portakal": {"orange", "citrus"}, "seftali": {"peach"}, "biber": {"pepper", "bell pepper"},
    "patates": {"potato"}, "soya": {"soybean"}, "kabak": {"squash"}, "cilek": {"strawberry"},
    "domates": {"tomato"}, "yaban mersini": {"blueberry"}, "ahududu": {"raspberry"},
}


def _crop_tokens(value: str | None) -> set[str]:
    text = _ascii(value)
    if not text:
        return set()
    result = {text}
    result.update(ALIASES.get(text, set()))
    return result


def _split_label(label: str) -> tuple[str | None, str]:
    if "___" in label:
        crop, issue = label.split("___", 1)
    elif " - " in label:
        crop, issue = label.split(" - ", 1)
    else:
        parts = label.split("_", 1)
        crop, issue = (parts[0], parts[1]) if len(parts) == 2 else ("", label)
    return (crop.replace("_", " ").strip() or None), issue.replace("_", " ").strip()


def _crop_match(requested: str | None, predicted: str | None) -> bool | None:
    req = _crop_tokens(requested)
    if not req:
        return None
    pred = _ascii(predicted)
    return any(token and (token in pred or pred in token) for token in req)


def run_plantvillage_shadow(payload: PlantVillageShadowRequest) -> dict[str, Any]:
    image = _image(payload)
    try:
        session, labels = _runtime()
    except Exception as exc:
        return _blocked(payload, "shadow_model_assets_unavailable", f"PlantVillage gölge modeli yüklenemedi: {exc}")

    tensor = _preprocess(image, session)
    input_info = session.get_inputs()[0]
    try:
        output = session.run(None, {input_info.name: tensor})[0]
    except Exception as exc:
        return _blocked(payload, "shadow_inference_failed", f"PlantVillage çıkarımı tamamlanamadı: {exc}")

    probs = _probabilities(output)
    if probs.size != len(labels):
        return _blocked(payload, "shadow_label_count_mismatch", "Model skor sayısı ile sınıf etiketi sayısı eşleşmedi.")

    top: list[dict[str, Any]] = []
    for index in np.argsort(probs)[::-1][: min(5, probs.size)]:
        label = labels[int(index)]
        crop, issue = _split_label(label)
        top.append({
            "rank": len(top) + 1,
            "label": label,
            "crop": crop,
            "issue": issue,
            "score": round(float(probs[int(index)]), 6),
            "crop_match": _crop_match(payload.crop, crop),
        })

    crop_known = bool(_crop_tokens(payload.crop))
    crop_matched = any(item["crop_match"] is True for item in top)
    return {
        "ok": True,
        "blocked": False,
        "engine": "plantvillage-onnx-shadow",
        "mode": "disease_classification_shadow",
        "field_id": payload.field_id,
        "job_id": payload.job_id,
        "production_authority": False,
        "diagnostic_authority": False,
        "confidence_authority": False,
        "independent_model": True,
        "usable_for_harmonization": bool(top) and (not crop_known or crop_matched),
        "crop_guard": {"requested_crop": payload.crop, "known_crop": crop_known, "matched_in_top_k": crop_matched if crop_known else None},
        "model": {"repository": MODEL_REPOSITORY, "license": MODEL_LICENSE, "training_dataset": "PlantVillage", "runtime": "onnxruntime-cpu", "class_count": len(labels)},
        "score_semantics": "closed_set_model_probability_not_field_diagnostic_confidence",
        "top_predictions": top,
        "warnings": [
            "PlantVillage gölge modeli bağımsız yardımcı kanıttır; tek başına teşhis veya güven puanı değildir.",
            "Model kontrollü yaprak görüntülerinde eğitildi; gerçek saha fotoğraflarında alan kayması beklenir.",
            "Kimyasal ürün, aktif madde veya doz kararı bu çıktıdan üretilemez.",
        ],
    }
