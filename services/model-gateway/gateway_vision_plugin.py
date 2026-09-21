from __future__ import annotations

import importlib.metadata
from typing import Any

from fastapi import FastAPI, Header, HTTPException

from plantcv_runner import PlantCVPhotoEvidenceRequest, run_plantcv_photo_evidence
from plantvillage_shadow_runner import PlantVillageShadowRequest, run_plantvillage_shadow

_INSTALLED = False


def _authorize(shared_key: str | None) -> None:
    # app.py defines the real auth helper after the FastAPI instance is created.
    # Resolve it lazily when a request arrives to avoid circular-import issues.
    import app as core_app

    core_app._authorize(shared_key)


def _package_version(name: str) -> str | None:
    try:
        return importlib.metadata.version(name)
    except Exception:
        return None


def _register_routes(app: FastAPI, registry: dict[str, Any]) -> None:
    if getattr(app.state, "tarlapusula_vision_routes_installed", False):
        return
    app.state.tarlapusula_vision_routes_installed = True

    @app.get("/v1/vision/plantcv/health")
    def plantcv_health(x_model_gateway_key: str | None = Header(default=None)):
        _authorize(x_model_gateway_key)
        item = registry.get("plantcv", {})
        version = _package_version("plantcv")
        ready = bool(version) and item.get("rollout") in {"shadow", "pilot", "production"}
        return {
            "ok": ready,
            "ready": ready,
            "engine": "plantcv",
            "engine_version": version,
            "rollout": item.get("rollout", "off"),
            "production_authority": False,
            "diagnostic_authority": False,
        }

    @app.post("/v1/vision/plantcv/evidence")
    def plantcv_evidence(
        payload: PlantCVPhotoEvidenceRequest,
        x_model_gateway_key: str | None = Header(default=None),
    ):
        _authorize(x_model_gateway_key)
        if registry.get("plantcv", {}).get("rollout") not in {"shadow", "pilot", "production"}:
            raise HTTPException(status_code=409, detail="PlantCV rollout is disabled")
        try:
            return run_plantcv_photo_evidence(payload)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"PlantCV photo evidence failed: {exc}") from exc

    @app.get("/v1/vision/plantvillage/health")
    def plantvillage_health(x_model_gateway_key: str | None = Header(default=None)):
        _authorize(x_model_gateway_key)
        item = registry.get("plantvillage-shadow", {})
        version = _package_version("onnxruntime")
        ready = bool(version) and item.get("rollout") in {"shadow", "pilot", "production"}
        return {
            "ok": ready,
            "ready": ready,
            "engine": "plantvillage-onnx-shadow",
            "runtime_version": version,
            "rollout": item.get("rollout", "off"),
            "production_authority": False,
            "diagnostic_authority": False,
            "confidence_authority": False,
        }

    @app.post("/v1/vision/plantvillage/shadow")
    def plantvillage_shadow(
        payload: PlantVillageShadowRequest,
        x_model_gateway_key: str | None = Header(default=None),
    ):
        _authorize(x_model_gateway_key)
        if registry.get("plantvillage-shadow", {}).get("rollout") not in {"shadow", "pilot", "production"}:
            raise HTTPException(status_code=409, detail="PlantVillage shadow rollout is disabled")
        try:
            return run_plantvillage_shadow(payload)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"PlantVillage shadow failed: {exc}") from exc


def install_vision_routes(registry: dict[str, Any]) -> None:
    """Attach vision routes to the legacy Render app without changing its start command."""
    global _INSTALLED
    if _INSTALLED:
        return

    original_init = FastAPI.__init__

    def patched_init(self: FastAPI, *args: Any, **kwargs: Any) -> None:
        original_init(self, *args, **kwargs)
        _register_routes(self, registry)

    FastAPI.__init__ = patched_init  # type: ignore[assignment]
    _INSTALLED = True
