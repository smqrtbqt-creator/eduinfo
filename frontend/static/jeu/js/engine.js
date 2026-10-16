/**
 * Moteur de scénario TIM / PSC1 — logique séparée du rendu.
 * Toute action valide modifie l'état ; les actions invalides renvoient une explication.
 */

export function createEngine(scenario) {
  return new ScenarioEngine(scenario);
}

class ScenarioEngine {
  constructor(scenario) {
    this.scenario = scenario;
    this.reset();
  }

  reset() {
    this.state = {
      stepIndex: 0,
      flags: { ...(this.scenario.initialFlags || {}) },
      selectedEntityId: null,
      clues: [],
      facts: [],
      history: [],
      scores: {
        securite: 0,
        pertinence: 0,
        alerte: 0,
        fiabilite: 0,
        info: 0,
      },
      examinedSources: {},
      completedActions: {},
      finished: false,
      alertResult: null,
    };
    return this.getPublicState();
  }

  get step() {
    return this.scenario.steps[this.state.stepIndex];
  }

  getPublicState() {
    const step = this.step;
    return {
      stepId: step.id,
      stepName: step.name,
      stepIndex: this.state.stepIndex,
      steps: this.scenario.steps.map((s, i) => ({
        id: s.id,
        name: s.name,
        status: i < this.state.stepIndex ? "done" : i === this.state.stepIndex ? "current" : "todo",
      })),
      objectives: step.objectives.map((text) => ({
        text,
        done: this._objectiveLikelyDone(text),
      })),
      flags: { ...this.state.flags },
      selectedEntityId: this.state.selectedEntityId,
      clues: [...this.state.clues],
      facts: [...this.state.facts],
      history: [...this.state.history],
      scores: { ...this.state.scores },
      examinedSources: { ...this.state.examinedSources },
      finished: this.state.finished,
      alertResult: this.state.alertResult,
      sourcesAvailable: Boolean(this.state.flags.sources_disponibles || this.state.flags.sources_ouvertes),
      showAlertForm: Boolean(this.state.flags.ui_alerte) && !this.state.flags.alerte_envoyee,
      disclaimer: this.scenario.disclaimer,
      title: this.scenario.title,
    };
  }

  _objectiveLikelyDone(text) {
    const t = text.toLowerCase();
    const f = this.state.flags;
    if (t.includes("danger") && f.danger_trottinette_identifie && f.sol_glissant_identifie) return true;
    if (t.includes("sécuriser") && f.zone_securisee) return true;
    if (t.includes("témoin") && f.temoin_lea_interroge && f.temoin_marcus_interroge) return true;
    if (t.includes("distinguer") && f.temoin_lea_interroge && f.temoin_marcus_interroge) return true;
    if (t.includes("source") && f.source_evaluee) return true;
    if (t.includes("approcher") && f.approche_securisee) return true;
    if (t.includes("état") && f.conscience_evaluee && f.respiration_evaluee) return true;
    if (t.includes("numéro") && f.alerte_envoyee) return true;
    if (t.includes("message") && f.alerte_envoyee) return true;
    if (t.includes("revoir") && f.bilan_vu) return true;
    return false;
  }

  getEntity(id) {
    return this.scenario.entities.find((e) => e.id === id) || null;
  }

  getAction(id) {
    return this.scenario.actions.find((a) => a.id === id) || null;
  }

  selectEntity(entityId) {
    const entity = this.getEntity(entityId);
    if (!entity) {
      return { ok: false, message: "Élément inconnu.", level: "bad" };
    }
    this.state.selectedEntityId = entityId;
    this.state.history.push({
      type: "select",
      entityId,
      stepId: this.step.id,
      ok: true,
      label: `Sélection : ${entity.label}`,
    });
    return { ok: true, entity, state: this.getPublicState() };
  }

  getAvailableActions(entityId = this.state.selectedEntityId) {
    const entity = this.getEntity(entityId);
    if (!entity) return [];
    const stepId = this.step.id;
    const actionIds = entity.actionsByStep?.[stepId] || [];
    return actionIds
      .map((id) => this.getAction(id))
      .filter(Boolean)
      .map((action) => {
        const done = Boolean(this.state.completedActions[action.id]);
        const blocked = !this._requirementsMet(action);
        return {
          id: action.id,
          label: action.label,
          done,
          blocked,
          opensAlertForm: Boolean(action.opensAlertForm),
        };
      });
  }

  _requirementsMet(action) {
    if (action.requiresFlags) {
      for (const flag of action.requiresFlags) {
        if (!this.state.flags[flag]) return false;
      }
    }
    if (action.requiresFlagsAny) {
      if (!action.requiresFlagsAny.some((flag) => this.state.flags[flag])) return false;
    }
    return true;
  }

  performAction(actionId) {
    if (this.state.finished) {
      return { ok: false, message: "La mission est terminée. Recommencez pour rejouer.", level: "warn" };
    }

    const action = this.getAction(actionId);
    if (!action) {
      return { ok: false, message: "Action inconnue.", level: "bad" };
    }

    const entity = this.getEntity(this.state.selectedEntityId);
    const allowed = entity?.actionsByStep?.[this.step.id] || [];
    if (!allowed.includes(actionId)) {
      return {
        ok: false,
        message: "Cette action n'est pas disponible pour cet élément à cette étape.",
        level: "warn",
        state: this.getPublicState(),
      };
    }

    if (!this._requirementsMet(action)) {
      return {
        ok: false,
        message: "Conditions non réunies. Explorez davantage la scène (dangers, zone, approche…).",
        level: "warn",
        state: this.getPublicState(),
      };
    }

    if (this.state.completedActions[actionId] && !action.opensAlertForm) {
      return {
        ok: false,
        message: "Action déjà réalisée.",
        level: "warn",
        state: this.getPublicState(),
      };
    }

    const feedback = action.feedback || {};
    let level = "ok";
    let message = feedback.ok || "Action effectuée.";
    if (feedback.bad) {
      level = "bad";
      message = feedback.bad;
    } else if (feedback.warn) {
      level = "warn";
      message = feedback.warn;
    }

    this._applyEffects(action.effects || {});
    this._applyScore(action.score || {});
    this.state.completedActions[actionId] = true;
    this.state.history.push({
      type: "action",
      actionId,
      label: action.label,
      ok: level !== "bad",
      level,
      stepId: this.step.id,
      message,
    });

    if (action.opensAlertForm) {
      this.state.flags.ui_alerte = true;
    }

    this._advanceStepsIfNeeded();

    return {
      ok: true,
      level,
      message,
      opensAlertForm: Boolean(action.opensAlertForm),
      state: this.getPublicState(),
    };
  }

  examineSource(sourceId, verdict) {
    const source = this.scenario.sources.find((s) => s.id === sourceId);
    if (!source) {
      return { ok: false, message: "Source introuvable.", level: "bad" };
    }

    const correct =
      (verdict === "reliable" && source.reliability === "high") ||
      (verdict === "unreliable" && source.reliability === "low");

    this.state.examinedSources[sourceId] = { verdict, correct };
    this.state.flags.source_evaluee = true;
    this.state.flags.sources_disponibles = true;

    if (correct) {
      this.state.scores.fiabilite += 2;
      this.state.clues.push(`Source évaluée correctement : ${source.title}`);
    } else {
      this.state.scores.fiabilite -= 1;
      this.state.clues.push(`Évaluation discutable de : ${source.title}`);
    }

    this.state.history.push({
      type: "source",
      sourceId,
      label: `Évaluation source : ${source.title}`,
      ok: correct,
      level: correct ? "ok" : "warn",
      stepId: this.step.id,
    });

    this._advanceStepsIfNeeded();

    return {
      ok: true,
      level: correct ? "ok" : "warn",
      message: correct
        ? `Bonne analyse : ${source.summary}`
        : `Attention : ${source.summary} Relisez auteur, date, preuves et objectif.`,
      source,
      state: this.getPublicState(),
    };
  }

  submitAlert(answers) {
    const form = this.scenario.alertForm;
    if (!form) {
      return { ok: false, message: "Formulaire d'alerte indisponible.", level: "bad" };
    }

    let points = 0;
    const details = [];
    for (const [field, table] of Object.entries(form.scoring)) {
      const value = answers[field];
      const gained = table[value] ?? -1;
      points += gained;
      details.push({ field, value, gained });
    }

    this.state.scores.alerte += points;
    this.state.flags.alerte_envoyee = true;
    this.state.flags.ui_alerte = false;
    this.state.alertResult = { answers, points, details };

    let level = "ok";
    let message =
      "Message transmis (simulation). Les secours vous demanderont de rester en ligne et de suivre leurs instructions.";
    if (points < 4) {
      level = "bad";
      message =
        "Alerte trop imprécise ou influencée par une rumeur. En situation réelle, donnez le lieu exact, les faits constatés, l'état et les risques — pas les rumeurs.";
    } else if (points < 8) {
      level = "warn";
      message =
        "Alerte partiellement correcte. Un message clair accélère l'intervention : lieu précis, situation, état, environnement.";
    }

    if (answers.situation === "rumor") {
      this.state.scores.fiabilite -= 2;
    }

    this.state.history.push({
      type: "alert",
      label: "Alerte aux secours",
      ok: points >= 4,
      level,
      stepId: this.step.id,
      message,
    });

    this._advanceStepsIfNeeded();

    // Passage automatique au bilan
    if (this.step.id === "E" || this.state.flags.alerte_envoyee) {
      this._ensureBilanStep();
    }

    return { ok: true, level, message, points, state: this.getPublicState() };
  }

  _ensureBilanStep() {
    const eIndex = this.scenario.steps.findIndex((s) => s.id === "E");
    if (eIndex >= 0 && this.state.stepIndex < eIndex && this.state.flags.alerte_envoyee) {
      // wait until D completeWhen advances naturally
    }
    if (this.step.id === "E" && !this.state.flags.bilan_vu) {
      this.state.flags.bilan_vu = true;
      this.state.finished = true;
    }
  }

  openBilan() {
    if (!this.state.flags.bilan_vu) {
      this.state.history.push({
        type: "bilan",
        label: "Consultation du bilan",
        ok: true,
        level: "info",
        stepId: "E",
      });
    }
    this.state.flags.bilan_vu = true;
    this.state.finished = true;
    return this.getBilan();
  }

  getBilan() {
    const s = this.state.scores;
    const maxHint = 12;
    const clamp = (n) => Math.max(0, Math.min(100, Math.round(((n + 3) / (maxHint + 3)) * 100)));

    return {
      scores: {
        securite: { raw: s.securite, pct: clamp(s.securite) },
        pertinence: { raw: s.pertinence, pct: clamp(s.pertinence) },
        alerte: { raw: s.alerte, pct: clamp(s.alerte) },
        fiabilite: { raw: s.fiabilite, pct: clamp(s.fiabilite) },
        info: { raw: s.info, pct: clamp(s.info) },
      },
      history: this.state.history.filter((h) => h.type === "action" || h.type === "alert" || h.type === "source"),
      facts: this.state.facts,
      clues: this.state.clues,
      examinedSources: this.state.examinedSources,
      sources: this.scenario.sources,
      alertResult: this.state.alertResult,
      disclaimer: this.scenario.disclaimer,
      officialRefs: this.scenario.officialRefs || [],
      emergencyNumbers: this.scenario.emergencyNumbers || [],
    };
  }

  getSources() {
    return this.scenario.sources;
  }

  getAlertForm() {
    return this.scenario.alertForm;
  }

  _applyEffects(effects) {
    if (effects.setFlags) {
      Object.assign(this.state.flags, effects.setFlags);
    }
    if (effects.addClue && !this.state.clues.includes(effects.addClue)) {
      this.state.clues.push(effects.addClue);
    }
    if (effects.addFact) {
      this.state.facts.push(effects.addFact);
    }
  }

  _applyScore(score) {
    for (const [key, value] of Object.entries(score)) {
      if (key in this.state.scores) {
        this.state.scores[key] += value;
      }
    }
  }

  _advanceStepsIfNeeded() {
    let guard = 0;
    while (guard < 5 && this._stepComplete(this.step) && this.state.stepIndex < this.scenario.steps.length - 1) {
      this.state.stepIndex += 1;
      this.state.history.push({
        type: "step",
        label: `Étape suivante : ${this.step.name}`,
        ok: true,
        level: "info",
        stepId: this.step.id,
      });
      guard += 1;
    }

    if (this.step.id === "E" && this.state.flags.alerte_envoyee) {
      this.state.flags.bilan_vu = true;
      this.state.finished = true;
    }
  }

  _stepComplete(step) {
    const rule = step.completeWhen || {};
    if (rule.allFlags) {
      return rule.allFlags.every((f) => this.state.flags[f]);
    }
    return false;
  }
}
