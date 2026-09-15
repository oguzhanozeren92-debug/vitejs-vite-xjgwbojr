from __future__ import annotations

from fastapi import Header, HTTPException

from app import _authorize, app
from engine_registry import ENGINE_REGISTRY
from pyfao56_dual_runner import (
    PyFao56DualKcShadowRequest,
    run_pyfao56_dual_kc_shadow as run_dual_shadow,
)


app.version = "0.5.0"


@app.post("/v1/irrigation/pyfao56/dual-kc-shadow")
def run_pyfao56_dual_kc_shadow(
    payload: PyFao56DualKcShadowRequest,
    x_model_gateway_key: str | None = Header(default=None),
):
    _authorize(x_model_gateway_key)

    if ENGINE_REGISTRY["pyfao56"]["rollout"] not in {"shadow", "pilot", "production"}:
        raise HTTPException(status_code=409, detail="pyfao56 rollout is disabled")

    try:
        return run_dual_shadow(payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"pyfao56 dual-Kc shadow failed: {exc}") from exc
