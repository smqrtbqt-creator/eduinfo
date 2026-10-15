#!/usr/bin/env python3
"""Point d'entrée : génère les certificats si besoin puis démarre uvicorn en HTTPS."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

CERTS_DIR = Path(os.getenv("CERTS_DIR", str(Path(__file__).resolve().parent.parent / "certs")))
CERT_FILE = CERTS_DIR / "server.crt"
KEY_FILE = CERTS_DIR / "server.key"
HOST = os.getenv("HOST", "0.0.0.0")
PORT = os.getenv("PORT", "8443")


def main() -> int:
    backend_dir = Path(__file__).resolve().parent
    os.chdir(backend_dir)

    data_dir = Path(os.getenv("DATA_DIR", str(backend_dir.parent / "database")))
    data_dir.mkdir(parents=True, exist_ok=True)
    CERTS_DIR.mkdir(parents=True, exist_ok=True)

    if not CERT_FILE.exists() or not KEY_FILE.exists():
        print("Génération du certificat auto-signé pédagogique...")
        env = os.environ.copy()
        env["CERTS_DIR"] = str(CERTS_DIR)
        subprocess.check_call([sys.executable, str(backend_dir / "generate_certs.py")], env=env)

    print(f"Démarrage HTTPS pédagogique sur https://localhost:{PORT}")
    return subprocess.call(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "main:app",
            "--host",
            HOST,
            "--port",
            PORT,
            "--ssl-certfile",
            str(CERT_FILE),
            "--ssl-keyfile",
            str(KEY_FILE),
        ]
    )


if __name__ == "__main__":
    raise SystemExit(main())
