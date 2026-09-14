from __future__ import annotations

from datetime import date, timedelta
import os

from fastapi import HTTPException
from pydantic import ValidationError

from app import (
    MAX_SHADOW_DAYS,
    EngineReadinessRequest,
    PyFao56Request,
    StationInput,
    WeatherDay,
    app,
    aquacrop_readiness,
    health,
    pcse_readiness,
    run_pyfao56_shadow,
)


def assert_close(actual: float, expected: float, tolerance: float = 0.01) -> None:
    if abs(actual - expected) > tolerance:
        raise AssertionError(f"{actual} != {expected} within {tolerance}")


def weather_day(day: date) -> WeatherDay:
    return WeatherDay(
        date=day,
        solar_radiation_mj_m2=20.0,
        tmax_c=30.0,
        tmin_c=15.0,
        dew_point_c=10.0,
        wind_m_s=2.0,
        rain_mm=0.0,
        kc=0.8,
    )


def main() -> None:
    # Fail-closed security: deploy-style/default production mode must never allow
    # an empty shared key and must report itself as not ready.
    os.environ.pop("MODEL_GATEWAY_ENV", None)
    os.environ.pop("MODEL_GATEWAY_SHARED_KEY", None)

    production_health = health()
    assert production_health["ok"] is False
    assert production_health["ready"] is False
    assert production_health["environment"] == "production"
    assert production_health["auth_required"] is True
    assert production_health["auth_configured"] is False
    assert production_health["production_authority"] is False

    # Import-time default is production, therefore interactive API discovery is
    # not exposed unless the process is explicitly started in development mode.
    assert app.docs_url is None
    assert app.redoc_url is None
    assert app.openapi_url is None

    secure_payload = PyFao56Request(
        field_id="smoke-field",
        station=StationInput(latitude=39.0, elevation_m=1000.0, wind_height_m=2.0),
        days=[weather_day(date(2026, 9, 1))],
    )

    try:
        run_pyfao56_shadow(secure_payload, None)
        raise AssertionError("Production-default gateway accepted an unauthenticated request")
    except HTTPException as exc:
        if exc.status_code != 401:
            raise

    # Request caps must reject oversized batches before any engine work starts.
    try:
        PyFao56Request(
            field_id="smoke-field",
            station=StationInput(latitude=39.0, elevation_m=1000.0),
            days=[
                weather_day(date(2026, 9, 1) + timedelta(days=index))
                for index in range(MAX_SHADOW_DAYS + 1)
            ],
        )
        raise AssertionError("Oversized pyfao56 shadow batch was accepted")
    except ValidationError:
        pass

    # Explicit development mode may run without a key for local/CI smoke tests.
    os.environ["MODEL_GATEWAY_ENV"] = "development"
    result = run_pyfao56_shadow(secure_payload, None)

    assert result["ok"] is True
    assert result["mode"] == "shadow"
    assert result["shadow_scope"] == "reference_et_and_single_kc"
    assert result["production_authority"] is False
    assert result["full_water_balance_ready"] is False
    assert len(result["days"]) == 1

    day = result["days"][0]
    assert day["reference_et_mm"] > 0
    assert day["crop_et_mm"] > 0
    assert_close(day["crop_et_mm"], day["reference_et_mm"] * 0.8, tolerance=0.02)

    duplicate_payload = PyFao56Request(
        field_id="smoke-field",
        station=StationInput(latitude=39.0, elevation_m=1000.0),
        days=[weather_day(date(2026, 9, 1)), weather_day(date(2026, 9, 1))],
    )
    try:
        run_pyfao56_shadow(duplicate_payload, None)
        raise AssertionError("Duplicate shadow weather dates were accepted")
    except HTTPException as exc:
        if exc.status_code != 422:
            raise

    development_health = health()
    assert development_health["ok"] is True
    assert development_health["ready"] is True
    assert development_health["auth_required"] is False
    assert development_health["auth_configured"] is True
    assert development_health["production_authority"] is False
    assert development_health["engines"]["pyfao56"]["available"] is True

    pcse = pcse_readiness(
        EngineReadinessRequest(field_id="smoke-field", available_inputs=[]),
        None,
    )
    assert pcse["ready"] is False
    assert "daily_weather" in pcse["missing_inputs"]

    aquacrop = aquacrop_readiness(
        EngineReadinessRequest(field_id="smoke-field", available_inputs=[]),
        None,
    )
    assert aquacrop["ready"] is False
    assert "soil_profile" in aquacrop["missing_inputs"]

    print(
        "model-gateway smoke ok",
        {
            "pyfao56_version": result.get("engine_version"),
            "reference_et_mm": day["reference_et_mm"],
            "crop_et_mm": day["crop_et_mm"],
            "max_shadow_days": MAX_SHADOW_DAYS,
        },
    )


if __name__ == "__main__":
    main()
