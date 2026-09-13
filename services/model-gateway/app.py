from __future__ import annotations

from datetime import date, timedelta
import importlib
import math
import os
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from engine_registry import ENGINE_REGISTRY

app = FastAPI(title="TarlaPusula Model Gateway", version="0.1.0")


class WeatherDay(BaseModel):
    date: date
    solar_radiation_mj_m2: float
    tmax_c: float
    tmin_c: float
    rhmax_pct: float
    rhmin_pct: float
    wind_m_s: float
    rain_mm: float = 0.0


class StationInput(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    elevation_m: float
    wind_height_m: float = Field(gt=0)


class PyFao56Request(BaseModel):
    field_id: str = Field(min_length=1)
    station: StationInput
    parameters: dict[str, Any]
    days: list[WeatherDay] = Field(min_length=2)


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
    _authorize(x_model_gateway_key)

    if ENGINE_REGISTRY["pyfao56"]["rollout"] not in {"shadow", "pilot", "production"}:
        raise HTTPException(status_code=409, detail="pyfao56 rollout is disabled")

    if "theta0" not in payload.parameters:
        raise HTTPException(
            status_code=422,
            detail="theta0 is required; TarlaPusula will not invent initial soil water content",
        )

    try:
        import pyfao56 as fao

        ordered_days = sorted(payload.days, key=lambda item: item.date)
        weather = fao.Weather(comment="TarlaPusula shadow input")
        weather.rfcrp = "S"
        weather.z = payload.station.elevation_m
        weather.lat = payload.station.latitude
        weather.wndht = payload.station.wind_height_m

        keys: list[tuple[str, date]] = []
        for item in ordered_days:
            key = f"{item.date.year}-{item.date.timetuple().tm_yday:03d}"
            weather.wdata.loc[key] = [
                item.solar_radiation_mj_m2,
                item.tmax_c,
                item.tmin_c,
                math.nan,
                math.nan,
                item.rhmax_pct,
                item.rhmin_pct,
                item.wind_m_s,
                item.rain_mm,
                math.nan,
                "P",
            ]
            weather.wdata.loc[key, "ETref"] = weather.compute_etref(key)
            keys.append((key, item.date))

        parameters = fao.Parameters(**payload.parameters)
        model = fao.Model(keys[0][0], keys[-1][0], parameters, weather)
        model.run()

        days = []
        for key, iso_day in keys:
            row = model.odata.loc[key]
            days.append(
                {
                    "date": iso_day.isoformat(),
                    "reference_et_mm": round(float(row["ETref"]), 3),
                    "crop_et_mm": round(float(row["ETc"]), 3),
                    "actual_et_mm": round(float(row["ETa"]), 3),
                    "rain_mm": round(float(row["Rain"]), 3),
                    "root_zone_depletion_mm": round(float(row["Dr"]), 3),
                    "readily_available_water_mm": round(float(row["RAW"]), 3),
                }
            )

        return {
            "ok": True,
            "mode": "shadow",
            "engine": "pyfao56",
            "field_id": payload.field_id,
            "production_authority": False,
            "days": days,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"pyfao56 run failed: {exc}") from exc


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
