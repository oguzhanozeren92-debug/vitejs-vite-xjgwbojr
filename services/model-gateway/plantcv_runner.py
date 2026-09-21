from __future__ import annotations

import base64
import binascii
from typing import Any

import cv2
import numpy as np
from plantcv import plantcv as pcv
from pydantic import BaseModel, ConfigDict, Field

MAX_IMAGE_BYTES = 8_000_000
MAX_IMAGE_SIDE = 1600


class PlantCVModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PlantCVPhotoEvidenceRequest(PlantCVModel):
    field_id: str = Field(min_length=1, max_length=128)
    job_id: str = Field(min_length=1, max_length=128)
    mime_type: str = Field(default="image/jpeg", min_length=3, max_length=80)
    image_base64: str = Field(min_length=16)


def _decode(payload: PlantCVPhotoEvidenceRequest) -> np.ndarray:
    try:
        raw = base64.b64decode(payload.image_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("PlantCV fotoğraf verisi geçerli base64 değil.") from exc
    if not raw or len(raw) > MAX_IMAGE_BYTES:
        raise ValueError("PlantCV fotoğrafı boş veya 8 MB sınırını aşıyor.")
    image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("PlantCV fotoğrafı çözülemedi.")
    h, w = image.shape[:2]
    longest = max(h, w)
    if longest > MAX_IMAGE_SIDE:
        scale = MAX_IMAGE_SIDE / float(longest)
        image = cv2.resize(image, (max(1, round(w * scale)), max(1, round(h * scale))), interpolation=cv2.INTER_AREA)
    return image


def _mask_plant(bgr: np.ndarray) -> tuple[np.ndarray | None, dict[str, Any]]:
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    h, s, v = cv2.split(hsv)
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    exg = 2 * g - r - b
    raw = (((h >= 20) & (h <= 105) & (s >= 30) & (v >= 20)) | (exg >= 18)).astype(np.uint8) * 255
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    raw = cv2.morphologyEx(raw, cv2.MORPH_CLOSE, kernel)
    raw = cv2.morphologyEx(raw, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    count, labels, stats, _ = cv2.connectedComponentsWithStats(raw, connectivity=8)
    if count <= 1:
        return None, {"quality": "blocked", "reason": "plant_like_component_not_found"}
    idx = max(range(1, count), key=lambda i: int(stats[i, cv2.CC_STAT_AREA]))
    area = int(stats[idx, cv2.CC_STAT_AREA])
    fraction = area / float(raw.shape[0] * raw.shape[1])
    if fraction < 0.01 or fraction > 0.88:
        return None, {"quality": "blocked", "reason": "plant_mask_unreliable", "mask_fraction": round(fraction, 4)}
    mask = np.where(labels == idx, 255, 0).astype(np.uint8)
    ys, xs = np.where(mask > 0)
    touches = bool(xs.size and (xs.min() <= 1 or ys.min() <= 1 or xs.max() >= mask.shape[1]-2 or ys.max() >= mask.shape[0]-2))
    return mask, {
        "quality": "medium" if touches else "high",
        "mask_fraction": round(fraction, 4),
        "touches_frame": touches,
        "segmentation_method": "hsv_excess_green_largest_component_v1",
    }


def _value(sample: dict[str, Any], name: str) -> Any:
    item = sample.get(name)
    return item.get("value") if isinstance(item, dict) else None


def _num(value: Any, digits: int = 3) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return round(number, digits) if np.isfinite(number) else None


def _blocked(payload: PlantCVPhotoEvidenceRequest, reason: str, segmentation: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "ok": True,
        "blocked": True,
        "engine": "plantcv",
        "mode": "photo_evidence",
        "field_id": payload.field_id,
        "job_id": payload.job_id,
        "production_authority": False,
        "diagnostic_authority": False,
        "reason": reason,
        "segmentation": segmentation or {},
        "evidence": [],
        "warnings": ["PlantCV yardımcı sayısal kanıttır; hastalık veya zararlı teşhisi değildir."],
    }


def run_plantcv_photo_evidence(payload: PlantCVPhotoEvidenceRequest) -> dict[str, Any]:
    bgr = _decode(payload)
    mask, segmentation = _mask_plant(bgr)
    if mask is None:
        return _blocked(payload, str(segmentation.get("reason") or "plant_mask_unreliable"), segmentation)

    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    labels = np.zeros(mask.shape, dtype=np.int32)
    labels[mask > 0] = 1
    pcv.outputs.clear()
    pcv.params.debug = None
    pcv.params.sample_label = "plantcv"
    try:
        pcv.analyze.size(img=rgb, labeled_mask=labels, n_labels=1, label="plantcv")
        pcv.analyze.color(rgb_img=rgb, labeled_mask=labels, n_labels=1, colorspaces="hsv", label="plantcv")
    except Exception as exc:
        return _blocked(payload, f"plantcv_analysis_failed:{exc}", segmentation)

    observations = pcv.outputs.observations
    sample_key = next((key for key in observations if key.startswith("plantcv")), next(iter(observations), None))
    sample = observations.get(sample_key, {}) if sample_key else {}

    shape = {
        "area_px": _num(_value(sample, "area"), 1),
        "convex_hull_area_px": _num(_value(sample, "convex_hull_area"), 1),
        "solidity": _num(_value(sample, "solidity"), 4),
        "perimeter_px": _num(_value(sample, "perimeter"), 2),
        "width_px": _num(_value(sample, "width"), 2),
        "height_px": _num(_value(sample, "height"), 2),
        "longest_path_px": _num(_value(sample, "longest_path"), 2),
    }
    color = {
        "hue_circular_mean": _num(_value(sample, "hue_circular_mean"), 3),
        "hue_median": _num(_value(sample, "hue_median"), 3),
        "saturation_mean": _num(_value(sample, "saturation_mean"), 3),
        "value_mean": _num(_value(sample, "value_mean"), 3),
    }

    return {
        "ok": True,
        "blocked": False,
        "engine": "plantcv",
        "mode": "photo_evidence",
        "engine_version": getattr(pcv, "__version__", None),
        "field_id": payload.field_id,
        "job_id": payload.job_id,
        "production_authority": False,
        "diagnostic_authority": False,
        "segmentation": segmentation,
        "shape": shape,
        "color": color,
        "evidence": [
            "PlantCV analyze.size ile şekil özellikleri çıkarıldı.",
            "PlantCV analyze.color ile HSV renk dağılımı özetlendi.",
        ],
        "warnings": [
            "PlantCV ölçümleri yardımcı görüntü kanıtıdır; tek başına teşhis değildir.",
            "Boyutlar kalibrasyon olmadığı için piksel birimindedir.",
        ],
    }
