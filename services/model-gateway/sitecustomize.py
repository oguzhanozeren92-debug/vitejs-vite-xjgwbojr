"""Render deployment shim for the legacy mirror branch.

The canonical model-gateway source lives in new2. Render's connected service still
starts `uvicorn app:app` from this mirror branch and the current Render connector
cannot edit that start command/repository binding. With PYTHONPATH=. Python loads
this module at startup; importing dual_app registers the canonical dual-Kc route
onto the existing FastAPI app without changing secrets or the legacy start command.
"""

import dual_app  # noqa: F401,E402
