from __future__ import annotations

from datetime import date
import math
from typing import Any, Literal

import pandas as pd
from pydantic import BaseModel, ConfigDict, Field, model_validator


class PilotModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AquaCropWeatherDay(PilotModel):
    date: date
    tmin_c: float = Field(ge=-80, le=70)
    tmax_c: float = Field(ge=-80, le=70)
    precipitation_mm: float = Field(ge=0, le=1000)
    reference_et_mm: float = Field(ge=0, le=50)

    @model_validator(mode="after")
    def validate_temperatures(self):
        if self.tmax_c < self.tmin_c:
            raise ValueError("tmax_c must be greater than or equal to tmin_c")
        return self


class AquaCropSoilLayer(PilotModel):
    from_cm: float = Field(ge=0, le=300)
    to_cm: float = Field(gt=0, le=300)
    th_wp: float = Field(gt=0, lt=1)
    th_fc: float = Field(gt=0, lt=1)
    th_s: float = Field(gt=0, lt=1)
    ksat_mm_day: float = Field(gt=0, le=100000)
    penetrability_percent: float = Field(default=100, ge=0, le=100)

    @model_validator(mode="after")
    def validate_layer(self):
        if self.to_cm <= self.from_cm:
            raise ValueError("soil layer to_cm must be greater than from_cm")
        if not self.th_wp < self.th_fc < self.th_s:
            raise ValueError("soil hydraulic values must satisfy th_wp < th_fc < th_s")
        return self


class AquaCropInitialWaterLayer(PilotModel):
    from_cm: float = Field(ge=0, le=300)
    to_cm: float = Field(gt=0, le=300)
    volumetric_water_content: float = Field(gt=0, lt=1)

    @model_validator(mode="after")
    def validate_layer(self):
        if self.to_cm <= self.from_cm:
            raise ValueError("water layer to_cm must be greater than from_cm")
        return self


class AquaCropManagement(PilotModel):
    mode: Literal["rainfed", "soil_moisture_target", "recorded_schedule", "manual_schedule"]
    settings: dict[str, Any] = Field(default_factory=dict)


class AquaCropPilotRequest(PilotModel):
    field_id: str = Field(min_length=1, max_length=128)
    simulation_start: date
    simulation_end: date
    planting_date: date
    crop_model_key: Literal["Wheat", "Barley", "Maize", "Cotton", "Potato"]
    weather: list[AquaCropWeatherDay] = Field(min_length=2, max_length=400)
    soil_layers: list[AquaCropSoilLayer] = Field(min_length=1, max_length=20)
    initial_water_layers: list[AquaCropInitialWaterLayer] = Field(min_length=1, max_length=20)
    irrigation_management: AquaCropManagement

    @model_validator(mode="after")
    def validate_contract(self):
        if self.simulation_end < self.simulation_start:
            raise ValueError("simulation_end must not precede simulation_start")
        if not (self.simulation_start <= self.planting_date <= self.simulation_end):
            raise ValueError("planting_date must fall inside simulation range")

        weather_dates = [item.date for item in self.weather]
        if len(weather_dates) != len(set(weather_dates)):
            raise ValueError("duplicate weather dates are not allowed")
        ordered_dates = sorted(weather_dates)
        if ordered_dates[0] > self.simulation_start or ordered_dates[-1] < self.simulation_end:
            raise ValueError("weather must cover the entire simulation range")

        _validate_contiguous_depth(self.soil_layers, required_depth_cm=200, label="soil")
        _validate_contiguous_depth(self.initial_water_layers, required_depth_cm=200, label="initial water")
        return self


def _validate_contiguous_depth(layers: list[Any], required_depth_cm: float, label: str) -> None:
    ordered = sorted(layers, key=lambda item: (item.from_cm, item.to_cm))
    cursor = 0.0
    for item in ordered:
        if abs(item.from_cm - cursor) > 1e-6:
            raise ValueError(f"{label} profile has a depth gap or overlap at {cursor:g} cm")
        cursor = item.to_cm
    if cursor + 1e-6 < required_depth_cm:
        raise ValueError(f"{label} profile must cover at least {required_depth_cm:g} cm")


def _split_compartments(layers: list[AquaCropSoilLayer], max_dz_m: float = 0.1) -> list[float]:
    compartments: list[float] = []
    for layer in sorted(layers, key=lambda item: item.from_cm):
        remaining = (layer.to_cm - layer.from_cm) / 100.0
        while remaining > 1e-9:
            piece = min(max_dz_m, remaining)
            compartments.append(round(piece, 6))
            remaining -= piece
    return compartments


def _build_soil(payload: AquaCropPilotRequest):
    from aquacrop import Soil

    ordered = sorted(payload.soil_layers, key=lambda item: item.from_cm)
    soil = Soil(soil_type="custom", dz=_split_compartments(ordered))
    for layer in ordered:
        thickness_m = (layer.to_cm - layer.from_cm) / 100.0
        soil.add_layer(
            thickness_m,
            float(layer.th_wp),
            float(layer.th_fc),
            float(layer.th_s),
            float(layer.ksat_mm_day),
            float(layer.penetrability_percent),
        )
    soil.fill_nan()
    return soil


def _build_initial_water(payload: AquaCropPilotRequest):
    from aquacrop import InitialWaterContent

    ordered = sorted(payload.initial_water_layers, key=lambda item: item.from_cm)
    return InitialWaterContent(
        wc_type="Num",
        method="Layer",
        depth_layer=list(range(1, len(ordered) + 1)),
        value=[float(item.volumetric_water_content) for item in ordered],
    )


def _build_management(payload: AquaCropPilotRequest):
    from aquacrop import IrrigationManagement

    management = payload.irrigation_management
    if management.mode == "rainfed":
        return IrrigationManagement(irrigation_method=0)

    if management.mode == "soil_moisture_target":
        smt = management.settings.get("smt")
        if not isinstance(smt, list) or len(smt) != 4:
            raise ValueError("soil_moisture_target requires settings.smt with four stage percentages")
        parsed = [float(value) for value in smt]
        if any(not math.isfinite(value) or value < 0 or value > 100 for value in parsed):
            raise ValueError("settings.smt values must be between 0 and 100")
        return IrrigationManagement(irrigation_method=1, SMT=parsed)

    schedule = management.settings.get("schedule")
    if not isinstance(schedule, list) or not schedule:
        raise ValueError("schedule irrigation mode requires settings.schedule")

    rows: list[dict[str, Any]] = []
    for item in schedule:
        if not isinstance(item, dict):
            raise ValueError("each irrigation schedule item must be an object")
        raw_date = item.get("date")
        raw_depth = item.get("depth_mm")
        parsed_date = pd.to_datetime(raw_date, errors="coerce")
        try:
            depth = float(raw_depth)
        except (TypeError, ValueError) as exc:
            raise ValueError("irrigation schedule depth_mm must be numeric") from exc
        if pd.isna(parsed_date) or not math.isfinite(depth) or depth <= 0 or depth > 500:
            raise ValueError("irrigation schedule item is invalid")
        rows.append({"Date": parsed_date, "Depth": depth})

    schedule_df = pd.DataFrame(rows).sort_values("Date")
    return IrrigationManagement(irrigation_method=3, Schedule=schedule_df)


def _records_last_row(frame: Any) -> dict[str, Any] | None:
    if frame is None or getattr(frame, "empty", True):
        return None
    row = frame.iloc[-1]
    output: dict[str, Any] = {}
    for key, value in row.items():
        if hasattr(value, "isoformat"):
            output[str(key)] = value.isoformat()
        elif isinstance(value, (int, float)) and math.isfinite(float(value)):
            output[str(key)] = round(float(value), 6)
        elif pd.isna(value):
            output[str(key)] = None
        else:
            output[str(key)] = str(value)
    return output


def run_aquacrop_pilot(payload: AquaCropPilotRequest) -> dict[str, Any]:
    from aquacrop import AquaCropModel, Crop
    import aquacrop

    weather_df = pd.DataFrame(
        [
            {
                "Date": pd.Timestamp(item.date),
                "MinTemp": float(item.tmin_c),
                "MaxTemp": float(item.tmax_c),
                "Precipitation": float(item.precipitation_mm),
                "ReferenceET": float(item.reference_et_mm),
            }
            for item in sorted(payload.weather, key=lambda item: item.date)
        ]
    )

    soil = _build_soil(payload)
    crop = Crop(payload.crop_model_key, planting_date=payload.planting_date.strftime("%m/%d"))
    initial_water = _build_initial_water(payload)
    irrigation = _build_management(payload)

    model = AquaCropModel(
        sim_start_time=payload.simulation_start.isoformat(),
        sim_end_time=payload.simulation_end.isoformat(),
        weather_df=weather_df,
        soil=soil,
        crop=crop,
        initial_water_content=initial_water,
        irrigation_management=irrigation,
    )
    model.run_model(till_termination=True)

    simulation_results = model.get_simulation_results()
    water_flux = model.get_water_flux()
    water_storage = model.get_water_storage()
    crop_growth = model.get_crop_growth()

    return {
        "ok": True,
        "mode": "pilot",
        "engine": "aquacrop",
        "engine_version": getattr(aquacrop, "__version__", None),
        "field_id": payload.field_id,
        "production_authority": False,
        "simulation": {
            "start": payload.simulation_start.isoformat(),
            "end": payload.simulation_end.isoformat(),
            "planting_date": payload.planting_date.isoformat(),
            "crop_model_key": payload.crop_model_key,
            "weather_days": len(payload.weather),
            "soil_layers": len(payload.soil_layers),
            "initial_water_layers": len(payload.initial_water_layers),
            "irrigation_mode": payload.irrigation_management.mode,
        },
        "outputs": {
            "simulation_result_rows": int(len(simulation_results)),
            "last_simulation_result": _records_last_row(simulation_results),
            "last_water_flux": _records_last_row(water_flux),
            "last_water_storage": _records_last_row(water_storage),
            "last_crop_growth": _records_last_row(crop_growth),
        },
        "note": "Pilot output only; TarlaPusula Irrigation Engine remains production authority.",
    }
