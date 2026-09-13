from __future__ import annotations

from datetime import date
import importlib
import math
import os
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from engine_registry import ENGINE_REGISTRY

app = FastAPI(title="TarlaPusula Model Gateway", version="0.2.0")


class WeatherDay(BaseModel):
    date: date
    solar_radiation_mj_m2: float = Field(ge=0)
    tmax_c: float
    tmin_c: float
    dew_point_c: float
    wind_m_s: float = Field(ge=0)
    rain_mm: float = Field(default=0.0, ge=0)
    kc: float = Field(gt=0, le=3)


class StationInput(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    elevation_m: float
    wind_height_m: float = Field(default=2.0, gt=0)


class PyFao56Request(BaseModel):
    field_id: str = Field(min_length=1)
    station: StationInput
    days: list[WeatherDay] = Field(min_length=1)


class EngineReadinessRequest(BaseModel):
    field_id: str = Field(min_length=1)
    available_inputs: list[str] = []


REQUIRED_PCSE_INPUTS = {
    "daily_weather",
    "crop_parameters",
    "soil_parameters",
    "site_parameters",
    "agromanagement",
}

REQUIRED_AQUACROP_INPUTS = {
    "daily_weather",
    "crop_parameters",
    "soil_profile",
    "planting_date",
    "initial_water_content",
    "irrigation_management",
}


def _authorize(shared_key: str | None) -> None:
    expected = os.getenv("MODEL_GATEWAY_SHARED_KEY", "").strip()
    environment = os.getenv("MODEL_GATEWAY_ENV", "development").strip().lower()
    if environment == "development" and not expected:
        return
    if not expected or shared_key != expected:
        raise HTTPException(status_code=401, detail="Model gateway authorization failed")


def _module_status(module_name: str) -> dict[str, Any]:
    try:
        module = importlib.import_module(module_name)
        return {
            "available": True,
            "version": getattr(module, "__version__", None),
        }
    except Exception as exc:
        return {"available": False, "error": str(exc)}


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "tarlapusula-model-gateway",
        "engines": {
            "pyfao56": _module_status("pyfao56"),
            "pcse": _module_status("pcse"),
            "aquacrop": _module_status("aquacrop"),
        },
    }


@app.get("/v1/registry")
def registry(x_model_gateway_key: str | None = Header(default=None)) -> dict[str, Any]:
    _authorize(x_model_gateway_key)
    return {"engines": ENGINE_REGISTRY}


@app.post("/v1/irrigation/pyfao56/shadow")
def run_pyfao56_shadow(
    payload: PyFao56Request,
    x_model_gateway_key: str | None = Header(default=None),
) -> dict[str, Any]:
    """Compare pyfao56 reference ET with TarlaPusula's validated daily Kc.

    This first shadow scope intentionally does NOT execute pyfao56.Model. The
    upstream model has crop/soil defaults that would create synthetic farm
    assumptions when Kcb, evaporation layer and current soil water are missing.
    Full root-zone water balance stays blocked until those explicit inputs exist.
    """
    _authorize(x_model_gateway_key)

    if ENGINE_REGISTRY["pyfao56"]["rollout"] not in {"shadow", "pilot", "production"}:
        raise HTTPException(status_code=409, detail="pyfao56 rollout is disabled")

    try:
        import pyfao56 as fao

        ordered_days = sorted(payload.days, key=lambda item: item.date)
        weather = fao.Weather(comment="TarlaPusula ET0 shadow input")
        weather.rfcrp = "S"
        weather.z = payload.station.elevation_m
        weather.lat = payload.station.latitude
        weather.wndht = payload.station.wind_height_m

        results: list[dict[str, Any]] = []
        for item in ordered_days:
            if item.tmax_c < item.tmin_c:
                raise HTTPException(
                    status_code=422,
                    detail=f"Invalid temperature range for {item.date.isoformat()}",
                )

            key = f"{item.date.year}-{item.date.timetuple().tm_yday:03d}"
            weather.wdata.loc[key] = [
                item.solar_radiation_mj_m2,
                item.tmax_c,
                item.tmin_c,
                math.nan,
                item.dew_point_c,
                math.nan,
                math.nan,
                item.wind_m_s,
                item.rain_mm,
                math.nan,
                "M",
            ]

            et0 = float(weather.compute_etref(key))
            if not math.isfinite(et0):
                raise HTTPException(
                    status_code=422,
                    detail=f"pyfao56 could not compute ET0 for {item.date.isoformat()}",
                )

            results.append(
                {
                    "date": item.date.isoformat(),
                    "reference_et_mm": round(et0, 3),
                    "kc": round(float(item.kc), 4),
                    "crop_et_mm": round(et0 * float(item.kc), 3),
                    "rain_mm": round(float(item.rain_mm), 3),
                }
            )

        return {
            "ok": True,
            "mode": "shadow",
            "shadow_scope": "reference_et_and_single_kc",
            "engine": "pyfao56",
            "field_id": payload.field_id,
            "production_authority": False,
            "full_water_balance_ready": False,
            "blocked_full_water_balance_inputs": [
                "validated_basal_kcb",
                "surface_evaporation_layer",
                "current_soil_water_state",
            ],
            "days": results,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"pyfao56 ET0 shadow failed: {exc}") from exc


def _readiness(
    engine: str,
    payload: EngineReadinessRequest,
    required: set[str],
) -> dict[str, Any]:
    supplied = {item.strip() for item in payload.available_inputs if item.strip()}
    missing = sorted(required - supplied)
    return {
        "ok": True,
        "engine": engine,
        "field_id": payload.field_id,
        "ready": not missing,
        "missing_inputs": missing,
        "rollout": ENGINE_REGISTRY[engine]["rollout"],
        "production_authority": False,
        "note": (
            "Input contract is complete; the field-specific runner can be enabled for pilot validation."
            if not missing
            else "No synthetic values are filled. Complete the missing real field inputs before model execution."
        ),
    }


@app.post("/v1/phenology/pcse/readiness")
def pcse_readiness(
    payload: EngineReadinessRequest,
    x_model_gateway_key: str | None = Header(default=None),
) -> dict[str, Any]:
    _authorize(x_model_gateway_key)
    return _readiness("pcse", payload, REQUIRED_PCSE_INPUTS)


@app.post("/v1/scenario/aquacrop/readiness")
def aquacrop_readiness(
    payload: EngineReadinessRequest,
    x_model_gateway_key: str | None = Header(default=None),
) -> dict[str, Any]:
    _authorize(x_model_gateway_key)
    return _readiness("aquacrop", payload, REQUIRED_AQUACROP_INPUTS)
