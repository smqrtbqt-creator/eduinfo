"""Smoke tests : pages existantes + /jeu sans régression."""

from pathlib import Path
import sys

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from main import app  # noqa: E402

client = TestClient(app)


def test_home_ok():
    response = client.get("/")
    assert response.status_code == 200
    assert "Aide" in response.text


def test_securite_ok():
    response = client.get("/securite")
    assert response.status_code == 200
    assert "HTTPS" in response.text or "TLS" in response.text


def test_register_ok():
    response = client.get("/register")
    assert response.status_code == 200
    assert "démonstration" in response.text.lower()


def test_jeu_ok():
    response = client.get("/jeu")
    assert response.status_code == 200
    assert "Simulation" in response.text
    assert "/static/jeu/js/app.js" in response.text


def test_nav_contains_jeu_link():
    response = client.get("/")
    assert 'href="/jeu"' in response.text


def test_scenario_json_served():
    response = client.get("/static/jeu/scenarios/cour-effondrement.json")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "cour-effondrement"


def test_engine_js_served():
    response = client.get("/static/jeu/js/engine.js")
    assert response.status_code == 200
    assert "ScenarioEngine" in response.text or "createEngine" in response.text


def test_health_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
