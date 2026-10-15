FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY frontend /frontend

ENV FRONTEND_DIR=/frontend
ENV DATA_DIR=/database
ENV CERTS_DIR=/certs

EXPOSE 8443

CMD ["python", "run.py"]
