from __future__ import annotations

import re
import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PY_REGISTRY_PATH = ROOT / "services/model-gateway/engine_registry.py"
TS_REGISTRY_PATH = ROOT / "src/features/model-engines/modelRegistry.ts"
GATEWAY_PATH = ROOT / "services/model-gateway/app.py"
EDGE_PATH = ROOT / "supabase/functions/model-engine-shadow/index.ts"


def fail(message: str) -> None:
    raise SystemExit(f"model-engine contract guard failed: {message}")


def ts_block(source: str, key: str) -> str:
    key_pattern = rf"(?:'{re.escape(key)}'|{re.escape(key)}):\s*\{{"
    match = re.search(key_pattern, source)
    if not match:
        fail(f"frontend registry entry missing: {key}")

    start = match.end()
    depth = 1
    index = start
    while index < len(source) and depth:
        char = source[index]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
        index += 1

    if depth:
        fail(f"frontend registry entry is not closed: {key}")
    return source[start : index - 1]


def ts_string(block: str, field: str) -> str:
    match = re.search(rf"\b{re.escape(field)}:\s*'([^']+)'", block)
    if not match:
        fail(f"frontend registry field missing: {field}")
    return match.group(1)


def ts_bool(block: str, field: str) -> bool:
    match = re.search(rf"\b{re.escape(field)}:\s*(true|false)\b", block)
    if not match:
        fail(f"frontend registry boolean missing: {field}")
    return match.group(1) == "true"


def main() -> None:
    python_namespace = runpy.run_path(str(PY_REGISTRY_PATH))
    python_registry = python_namespace.get("ENGINE_REGISTRY")
    if not isinstance(python_registry, dict) or not python_registry:
        fail("gateway ENGINE_REGISTRY is empty or invalid")

    ts_source = TS_REGISTRY_PATH.read_text(encoding="utf-8")
    gateway_source = GATEWAY_PATH.read_text(encoding="utf-8")
    edge_source = EDGE_PATH.read_text(encoding="utf-8")

    union_match = re.search(
        r"export type ModelEngineKey\s*=\s*(.*?);",
        ts_source,
        flags=re.S,
    )
    if not union_match:
        fail("ModelEngineKey union not found")
    frontend_keys = set(re.findall(r"'([^']+)'", union_match.group(1)))
    gateway_keys = set(python_registry)

    if frontend_keys != gateway_keys:
        fail(
            "registry key drift: "
            f"frontend-only={sorted(frontend_keys - gateway_keys)}, "
            f"gateway-only={sorted(gateway_keys - frontend_keys)}"
        )

    comparable_fields = {
        "role": "role",
        "rollout": "rollout",
        "upstream_commit": "upstreamCommit",
        "license": "license",
    }

    for key in sorted(gateway_keys):
        py_entry = python_registry[key]
        if not isinstance(py_entry, dict):
            fail(f"gateway registry entry is invalid: {key}")

        block = ts_block(ts_source, key)
        if ts_string(block, "key") != key:
            fail(f"frontend key field mismatch for {key}")

        for py_field, ts_field in comparable_fields.items():
            py_value = str(py_entry.get(py_field, ""))
            ts_value = ts_string(block, ts_field)
            if py_value != ts_value:
                fail(
                    f"{key}.{py_field} drift: gateway={py_value!r}, frontend={ts_value!r}"
                )

        py_authority = bool(py_entry.get("production_authority"))
        ts_authority = ts_bool(block, "productionAuthority")
        if py_authority != ts_authority:
            fail(f"{key}.production_authority drift")
        if py_authority:
            fail(f"{key} unexpectedly has production authority")

    expected_rollouts = {
        "pyfao56": "shadow",
        "pcse": "pilot",
        "aquacrop": "pilot",
        "autogeobound": "off",
        "openagri-pest-disease": "off",
        "agml": "off",
        "farmvibes-ai": "off",
    }
    actual_rollouts = {
        key: str(python_registry[key].get("rollout", "")) for key in gateway_keys
    }
    if actual_rollouts != expected_rollouts:
        fail(f"rollout safety contract changed: {actual_rollouts}")

    for path, source in ((GATEWAY_PATH, gateway_source), (EDGE_PATH, edge_source)):
        if "VITE_" in source:
            fail(f"frontend-style secret name found in server code: {path.relative_to(ROOT)}")

    required_gateway_guards = (
        '"production_authority": False',
        'ENGINE_REGISTRY["pyfao56"]["rollout"]',
        "MODEL_GATEWAY_SHARED_KEY",
    )
    for marker in required_gateway_guards:
        if marker not in gateway_source:
            fail(f"gateway safety marker missing: {marker}")

    required_edge_guards = (
        "MODEL_GATEWAY_URL",
        "MODEL_GATEWAY_SHARED_KEY",
        "field_id",
    )
    for marker in required_edge_guards:
        if marker not in edge_source:
            fail(f"edge safety marker missing: {marker}")

    print(
        "model-engine contract guard ok: "
        f"{len(gateway_keys)} engines synchronized; production authority unchanged"
    )


if __name__ == "__main__":
    main()
