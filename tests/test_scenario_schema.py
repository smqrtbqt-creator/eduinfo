"""Validation du schéma JSON du scénario et parcours logique minimal."""

from __future__ import annotations

import json
from pathlib import Path

SCENARIO_PATH = (
    Path(__file__).resolve().parents[1]
    / "frontend"
    / "static"
    / "jeu"
    / "scenarios"
    / "cour-effondrement.json"
)


def load_scenario():
    with SCENARIO_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


def test_scenario_file_exists():
    assert SCENARIO_PATH.is_file()


def test_scenario_required_keys():
    data = load_scenario()
    for key in ("id", "title", "steps", "entities", "actions", "sources", "alertForm", "disclaimer"):
        assert key in data, f"clé manquante: {key}"


def test_steps_a_to_e():
    data = load_scenario()
    ids = [step["id"] for step in data["steps"]]
    assert ids == ["A", "B", "C", "D", "E"]
    for step in data["steps"]:
        assert "name" in step
        assert "objectives" in step
        assert "completeWhen" in step
        assert "allFlags" in step["completeWhen"]


def test_entities_have_svg_and_actions():
    data = load_scenario()
    assert len(data["entities"]) >= 8
    action_ids = {a["id"] for a in data["actions"]}
    for entity in data["entities"]:
        assert "id" in entity
        assert "label" in entity
        assert "svg" in entity
        for axis in ("x", "y", "w", "h"):
            assert axis in entity["svg"]
        assert "actionsByStep" in entity
        for step_id, actions in entity["actionsByStep"].items():
            for action_id in actions:
                assert action_id in action_ids, f"{action_id} référencé par {entity['id']} mais absent"


def test_actions_have_feedback_and_effects():
    data = load_scenario()
    for action in data["actions"]:
        assert "id" in action
        assert "label" in action
        assert "feedback" in action
        assert any(k in action["feedback"] for k in ("ok", "warn", "bad"))


def test_sources_tim_present():
    data = load_scenario()
    assert len(data["sources"]) >= 4
    reliabilities = {s["reliability"] for s in data["sources"]}
    assert "high" in reliabilities
    assert "low" in reliabilities
    official = [s for s in data["sources"] if s.get("url")]
    assert official, "au moins une source avec URL officielle attendue"
    for source in data["sources"]:
        for key in ("author", "date", "goal", "evidence", "references", "summary"):
            assert key in source


def test_alert_form_scoring():
    data = load_scenario()
    form = data["alertForm"]
    assert "fields" in form
    assert "scoring" in form
    field_ids = {f["id"] for f in form["fields"]}
    assert field_ids >= {"number", "location", "situation", "state", "risks"}


def test_dangerous_drink_action_penalized():
    data = load_scenario()
    drink = next(a for a in data["actions"] if a["id"] == "donner_a_boire")
    assert "bad" in drink["feedback"]
    assert drink["score"]["pertinence"] < 0


def test_complete_flag_chain_is_satisfiable():
    """Vérifie qu'il existe un chemin de flags permettant de terminer A→D."""
    data = load_scenario()
    all_set_flags = set()
    for action in data["actions"]:
        flags = (action.get("effects") or {}).get("setFlags") or {}
        all_set_flags.update(flags.keys())
    # Flags produits par le moteur JS (pas uniquement via effects JSON)
    all_set_flags.update({"alerte_envoyee", "bilan_vu", "source_evaluee"})

    for step in data["steps"]:
        for flag in step["completeWhen"]["allFlags"]:
            assert flag in all_set_flags, f"flag {flag} requis par étape {step['id']} jamais produit"
