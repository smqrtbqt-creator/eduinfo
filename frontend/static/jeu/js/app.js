/**
 * Interface du jeu : progression, panneau latéral, sources TIM, alerte, bilan.
 */

import { createEngine } from "./engine.js";
import { renderScene } from "./scene.js";

const SCENARIO_URL = "/static/jeu/scenarios/cour-effondrement.json";

const els = {
  stepLabel: document.getElementById("step-label"),
  stepList: document.getElementById("step-list"),
  objectiveList: document.getElementById("objective-list"),
  clueList: document.getElementById("clue-list"),
  sceneRoot: document.getElementById("scene-root"),
  feedback: document.getElementById("feedback"),
  selectionPanel: document.getElementById("selection-panel"),
  actionsPanel: document.getElementById("actions-panel"),
  sourcesPanel: document.getElementById("sources-panel"),
  sourcesList: document.getElementById("sources-list"),
  bilanPanel: document.getElementById("bilan-panel"),
  bilanContent: document.getElementById("bilan-content"),
  sceneHint: document.getElementById("scene-hint"),
  btnRestart: document.getElementById("btn-restart"),
  btnRestartBilan: document.getElementById("btn-restart-bilan"),
};

let engine = null;
let scenario = null;
let bilanShown = false;

async function boot() {
  const response = await fetch(SCENARIO_URL);
  if (!response.ok) {
    showFeedback("Impossible de charger le scénario.", "bad");
    return;
  }
  scenario = await response.json();
  engine = createEngine(scenario);
  bindGlobal();
  refresh();
  showFeedback(scenario.disclaimer, "warn");
}

function bindGlobal() {
  els.btnRestart?.addEventListener("click", restart);
  els.btnRestartBilan?.addEventListener("click", restart);
}

function restart() {
  engine.reset();
  bilanShown = false;
  els.bilanPanel.hidden = true;
  refresh();
  showFeedback("Mission recommencée. Observez la cour et identifiez les dangers.", "ok");
}

function refresh() {
  const state = engine.getPublicState();
  renderProgress(state);
  renderScene(els.sceneRoot, scenario.entities, {
    selectedId: state.selectedEntityId,
    flags: state.flags,
    onSelect: (id) => {
      const result = engine.selectEntity(id);
      if (result.ok) {
        showFeedback(`Sélectionné : ${result.entity.label}`, "ok");
        refresh();
      }
    },
  });
  renderSelection(state);
  renderSources(state);
  els.sceneHint.textContent = hintForStep(state.stepId);

  if (state.finished && !bilanShown) {
    showBilan();
  }
}

function hintForStep(stepId) {
  const hints = {
    A: "Étape A — Explorez la cour, cliquez sur les dangers et sécurisez la zone.",
    B: "Étape B — Interrogez les témoins sur place. Les sources en ligne = exercice TIM seulement (pas une étape réelle avant l'appel).",
    C: "Étape C — Approchez en sécurité et évaluez l'état (simulation pédagogique).",
    D: "Étape D — Alertez avec les faits constatés. En vrai, on n'ouvre pas Internet avant d'appeler les secours.",
    E: "Étape E — Consultez le bilan : procédure d'urgence ≠ recherche d'informations TIM.",
  };
  return hints[stepId] || "Explorez la scène.";
}

function renderProgress(state) {
  els.stepLabel.textContent = `Étape ${state.stepId} — ${state.stepName}`;
  els.stepList.innerHTML = state.steps
    .map(
      (s) => `
      <li class="${s.status}">
        <span class="badge" aria-hidden="true">${s.id}</span>
        <span>${s.name}</span>
      </li>`
    )
    .join("");

  els.objectiveList.innerHTML = state.objectives
    .map((o) => `<li class="${o.done ? "done" : ""}">${escapeHtml(o.text)}</li>`)
    .join("");

  if (state.clues.length) {
    els.clueList.innerHTML = state.clues.map((c) => `<li>${escapeHtml(c)}</li>`).join("");
  } else {
    els.clueList.innerHTML = '<li class="muted">Aucun pour l’instant</li>';
  }
}

function renderSelection(state) {
  const entity = state.selectedEntityId
    ? scenario.entities.find((e) => e.id === state.selectedEntityId)
    : null;

  if (!entity) {
    els.selectionPanel.innerHTML =
      '<p class="muted">Sélectionnez un personnage, un objet ou une zone de la cour.</p>';
    els.actionsPanel.innerHTML = "";
    return;
  }

  els.selectionPanel.innerHTML = `
    <h3 class="selection-title">${escapeHtml(entity.label)}</h3>
    <p class="selection-desc">${escapeHtml(entity.description)}</p>
  `;

  const actions = engine.getAvailableActions(entity.id);
  if (!actions.length) {
    els.actionsPanel.innerHTML = '<p class="muted">Aucune action disponible à cette étape pour cet élément.</p>';
    return;
  }

  els.actionsPanel.innerHTML = actions
    .map((a) => {
      const cls = a.done ? "btn btn-secondary is-done" : a.blocked ? "btn btn-secondary is-disabled" : "btn btn-primary";
      const disabled = a.done || a.blocked ? "disabled" : "";
      return `<button type="button" class="${cls}" data-action="${a.id}" ${disabled}>${escapeHtml(a.label)}</button>`;
    })
    .join("");

  els.actionsPanel.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => onAction(btn.getAttribute("data-action")));
  });

  if (state.showAlertForm) {
    renderAlertForm();
  }
}

function onAction(actionId) {
  const result = engine.performAction(actionId);
  showFeedback(result.message, result.level || (result.ok ? "ok" : "bad"));
  refresh();
  if (result.opensAlertForm || engine.getPublicState().showAlertForm) {
    renderAlertForm();
  }
}

function renderAlertForm() {
  const form = engine.getAlertForm();
  if (!form) return;

  const box = document.createElement("div");
  box.className = "source-card";
  box.innerHTML = `<h4>${escapeHtml(form.title)}</h4>`;
  if (form.intro) {
    box.innerHTML += `<p class="source-meta">${escapeHtml(form.intro)}</p>`;
  }

  const fieldsHtml = form.fields
    .map((field) => {
      const options = field.options
        .map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`)
        .join("");
      return `
        <div class="form-group" style="margin:0.5rem 0">
          <label for="alert-${field.id}"><strong>${escapeHtml(field.label)}</strong></label>
          <select id="alert-${field.id}" name="${field.id}" style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid #c9d8d1">
            ${options}
          </select>
        </div>`;
    })
    .join("");

  box.innerHTML += fieldsHtml;
  box.innerHTML += `<button type="button" class="btn btn-primary" id="btn-send-alert">Envoyer l'alerte (simulation)</button>`;
  els.actionsPanel.appendChild(box);

  box.querySelector("#btn-send-alert").addEventListener("click", () => {
    const answers = {};
    form.fields.forEach((field) => {
      answers[field.id] = box.querySelector(`#alert-${field.id}`).value;
    });
    const result = engine.submitAlert(answers);
    showFeedback(result.message, result.level);
    refresh();
  });
}

function renderSources(state) {
  if (!state.sourcesAvailable) {
    els.sourcesPanel.hidden = true;
    els.sourcesList.innerHTML = "";
    return;
  }

  els.sourcesPanel.hidden = false;
  const sources = engine.getSources();
  const realNote =
    scenario.realProcedureNote ||
    "En temps normal, l'appel des secours ne passe pas par la consultation d'informations en ligne.";
  els.sourcesList.innerHTML =
    `<div class="source-card" style="border-color:#e2a84a;background:#fff4e0">
      <h4>Rappel procédure réelle</h4>
      <p>${escapeHtml(realNote)}</p>
    </div>` +
    sources
    .map((s) => {
      const examined = state.examinedSources[s.id];
      return `
        <article class="source-card" data-source="${s.id}">
          <h4>${escapeHtml(s.title)}</h4>
          <div class="source-meta">
            Auteur : ${escapeHtml(s.author)} · Date : ${escapeHtml(s.date)}<br>
            Objectif : ${escapeHtml(s.goal)}
          </div>
          <p><strong>Preuves :</strong> ${escapeHtml(s.evidence)}</p>
          <p><strong>Références :</strong> ${escapeHtml(s.references)}</p>
          ${s.url ? `<p><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">Ouvrir la source officielle</a></p>` : ""}
          ${
            examined
              ? `<div class="source-verdict ${examined.correct ? "reliable" : "unreliable"}">
                  Votre jugement : ${examined.verdict === "reliable" ? "plutôt fiable" : "peu fiable"}
                  ${examined.correct ? "(cohérent avec l'analyse pédagogique)" : "(à reconsidérer)"}
                </div>`
              : `<button type="button" class="btn btn-secondary btn-small" data-judge="reliable">Plutôt fiable</button>
                 <button type="button" class="btn btn-secondary btn-small" data-judge="unreliable">Peu fiable / à vérifier</button>`
          }
        </article>`;
    })
    .join("");

  els.sourcesList.querySelectorAll("article[data-source]").forEach((card) => {
    const id = card.getAttribute("data-source");
    card.querySelectorAll("button[data-judge]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const result = engine.examineSource(id, btn.getAttribute("data-judge"));
        showFeedback(result.message, result.level);
        refresh();
      });
    });
  });
}

function showBilan() {
  const bilan = engine.openBilan();
  bilanShown = true;
  els.bilanPanel.hidden = false;

  const scoreCards = Object.entries(bilan.scores)
    .map(
      ([key, val]) => `
      <div class="bilan-score">
        <strong>${val.pct}%</strong>
        ${labelScore(key)}
      </div>`
    )
    .join("");

  const timeline = bilan.history
    .map((h) => {
      const cls = h.level === "bad" ? "bad" : h.ok ? "ok" : "info";
      return `<li class="timeline-item ${cls}">${escapeHtml(h.label)}${h.message ? " — " + escapeHtml(h.message) : ""}</li>`;
    })
    .join("");

  const facts = bilan.facts
    .map((f) => `<li><strong>${escapeHtml(f.type)}</strong> : ${escapeHtml(f.text)}</li>`)
    .join("");

  const refs = (bilan.officialRefs || [])
    .map((r) => `<li><a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.title)}</a></li>`)
    .join("");

  const numbers = (bilan.emergencyNumbers || [])
    .map((n) => `<li><strong>${escapeHtml(n.number)}</strong> — ${escapeHtml(n.label)}</li>`)
    .join("");

  const realNote =
    scenario.realProcedureNote ||
    "En temps normal, l'appel des secours ne passe pas par la consultation d'informations en ligne.";

  els.bilanContent.innerHTML = `
    <p>${escapeHtml(bilan.disclaimer)}</p>
    <div class="source-card" style="border-color:#e2a84a;background:#fff4e0;margin:0.75rem 0">
      <h4>Procédure réelle vs exercice TIM</h4>
      <p>${escapeHtml(realNote)}</p>
    </div>
    <div class="bilan-scores">${scoreCards}</div>
    <h3>Actions réalisées</h3>
    <ul class="bilan-list">${timeline || "<li>Aucune action enregistrée</li>"}</ul>
    <h3>Faits / témoignages / suppositions</h3>
    <ul class="bilan-list">${facts || "<li>Aucun élément classé</li>"}</ul>
    <h3>Numéros d'urgence (France)</h3>
    <ul class="bilan-list">${numbers}</ul>
    <h3>Références institutionnelles</h3>
    <ul class="bilan-list">${refs}</ul>
    <p><em>Une décision correcte et réfléchie vaut mieux qu'une réaction précipitée. Prendre le temps de vérifier une source est valorisé.</em></p>
  `;
}

function labelScore(key) {
  const map = {
    securite: "Sécurité de l'intervention",
    pertinence: "Pertinence des actions",
    alerte: "Qualité de l'alerte",
    fiabilite: "Fiabilité des infos retenues",
    info: "Recueil d'informations",
  };
  return map[key] || key;
}

function showFeedback(message, level) {
  els.feedback.textContent = message;
  els.feedback.className = "jeu-feedback";
  if (level) els.feedback.classList.add(`is-${level}`);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

boot().catch((err) => {
  console.error(err);
  showFeedback("Erreur au démarrage du jeu.", "bad");
});
