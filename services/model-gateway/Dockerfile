FROM python:3.12-slim

ARG INSTALL_PILOT=0

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MODEL_GATEWAY_ENV=production

WORKDIR /app

COPY requirements.txt requirements-pilot.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && if [ "$INSTALL_PILOT" = "1" ]; then pip install --no-cache-dir -r requirements-pilot.txt; fi

COPY app.py engine_registry.py aquacrop_runner.py ./

RUN useradd --create-home --uid 10001 gateway \
    && chown -R gateway:gateway /app
USER gateway

EXPOSE 8080

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers"]
