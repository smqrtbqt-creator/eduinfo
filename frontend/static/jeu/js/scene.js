/**
 * Rendu SVG de la cour de lycée et gestion des interactions souris / clavier / tactile.
 */

const ENTITY_COLORS = {
  person: "#2f6f5e",
  danger: "#b45309",
  object: "#1f4a6b",
  zone: "#64748b",
};

export function renderScene(container, entities, { onSelect, selectedId, flags }) {
  const NS = "http://www.w3.org/2000/svg";
  container.innerHTML = "";

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 800 500");
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", "Cour de lycée vue de dessus, scène interactive");

  svg.appendChild(drawRect(NS, 0, 0, 800, 500, "#c5ddd2"));
  svg.appendChild(drawRect(NS, 0, 0, 800, 90, "#8fad9f"));
  svg.appendChild(drawText(NS, 24, 40, "Préau", "#33584b", 18, 700));
  svg.appendChild(drawRect(NS, 40, 110, 720, 340, "#b9d4c6"));
  svg.appendChild(drawRect(NS, 40, 170, 220, 50, "#d9e5de"));
  svg.appendChild(drawText(NS, 55, 200, "Circulation", "#4a6358", 12, 600));
  svg.appendChild(drawRect(NS, 560, 40, 160, 80, "#6d8f7f"));
  svg.appendChild(drawText(NS, 580, 85, "Bâtiment A", "#e8f5ef", 14, 700));

  entities.forEach((entity) => {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "jeu-entity");
    g.setAttribute("tabindex", "0");
    g.setAttribute("role", "button");
    g.setAttribute("data-entity-id", entity.id);
    g.setAttribute("aria-label", `${entity.label}. ${entity.description}`);
    if (selectedId === entity.id) g.classList.add("is-selected");

    const { x, y, w, h } = entity.svg;
    const color = ENTITY_COLORS[entity.type] || "#333";

    const hit = document.createElementNS(NS, "rect");
    hit.setAttribute("class", "hit-area");
    hit.setAttribute("x", String(x - 8));
    hit.setAttribute("y", String(y - 8));
    hit.setAttribute("width", String(Math.max(w + 16, 56)));
    hit.setAttribute("height", String(Math.max(h + 16, 56)));
    hit.setAttribute("rx", "10");
    g.appendChild(hit);

    if (entity.type === "person") {
      g.appendChild(drawPerson(NS, x, y, color, entity.id === "victim"));
    } else if (entity.type === "danger") {
      g.appendChild(drawDanger(NS, x, y, w, h, entity.id));
    } else if (entity.id === "backpack") {
      g.appendChild(drawBackpack(NS, x, y));
    } else if (entity.id === "bench") {
      g.appendChild(drawBench(NS, x, y, w, h));
    } else if (entity.id === "phone") {
      g.appendChild(drawPhone(NS, x, y));
    } else if (entity.type === "zone") {
      const zone = drawRect(NS, x, y, w, h, "rgba(100,116,139,0.25)");
      zone.setAttribute("class", "entity-marker");
      zone.setAttribute("stroke", color);
      zone.setAttribute("stroke-width", "2");
      zone.setAttribute("stroke-dasharray", "6 4");
      zone.setAttribute("rx", "8");
      g.appendChild(zone);
    } else {
      const fallback = drawRect(NS, x, y, w, h, color);
      fallback.setAttribute("class", "entity-marker");
      g.appendChild(fallback);
    }

    g.appendChild(drawText(NS, x, y + h + 14, entity.label, "#1a2e28", 11, 700));

    if (entity.id === "danger_trottinette" && flags.trottinette_ecarte) {
      g.classList.add("is-done");
      g.setAttribute("transform", "translate(-40, 30)");
    }
    if (entity.id === "danger_sol" && flags.zone_securisee) {
      g.classList.add("is-done");
    }

    const activate = (event) => {
      event.preventDefault();
      onSelect(entity.id);
    };
    g.addEventListener("click", activate);
    g.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") activate(event);
    });

    svg.appendChild(g);
  });

  container.appendChild(svg);
}

function drawRect(NS, x, y, w, h, fill) {
  const el = document.createElementNS(NS, "rect");
  el.setAttribute("x", x);
  el.setAttribute("y", y);
  el.setAttribute("width", w);
  el.setAttribute("height", h);
  el.setAttribute("fill", fill);
  return el;
}

function drawText(NS, x, y, text, fill, size, weight) {
  const el = document.createElementNS(NS, "text");
  el.setAttribute("x", x);
  el.setAttribute("y", y);
  el.setAttribute("fill", fill);
  el.setAttribute("font-size", String(size));
  el.setAttribute("font-weight", String(weight));
  el.setAttribute("font-family", "Source Sans 3, Segoe UI, sans-serif");
  el.textContent = text;
  return el;
}

function drawPerson(NS, x, y, color, lying) {
  const g = document.createElementNS(NS, "g");
  g.setAttribute("class", "entity-marker");
  if (lying) {
    const body = document.createElementNS(NS, "ellipse");
    body.setAttribute("cx", x + 40);
    body.setAttribute("cy", y + 30);
    body.setAttribute("rx", "36");
    body.setAttribute("ry", "16");
    body.setAttribute("fill", color);
    const head = document.createElementNS(NS, "circle");
    head.setAttribute("cx", x + 12);
    head.setAttribute("cy", y + 28);
    head.setAttribute("r", "12");
    head.setAttribute("fill", "#e8c4a8");
    g.appendChild(body);
    g.appendChild(head);
  } else {
    const head = document.createElementNS(NS, "circle");
    head.setAttribute("cx", x + 28);
    head.setAttribute("cy", y + 16);
    head.setAttribute("r", "12");
    head.setAttribute("fill", "#e8c4a8");
    const body = document.createElementNS(NS, "rect");
    body.setAttribute("x", x + 14);
    body.setAttribute("y", y + 30);
    body.setAttribute("width", "28");
    body.setAttribute("height", "40");
    body.setAttribute("rx", "8");
    body.setAttribute("fill", color);
    g.appendChild(body);
    g.appendChild(head);
  }
  return g;
}

function drawDanger(NS, x, y, w, h, id) {
  const g = document.createElementNS(NS, "g");
  g.setAttribute("class", "entity-marker");
  if (id === "danger_sol") {
    const puddle = document.createElementNS(NS, "ellipse");
    puddle.setAttribute("cx", x + w / 2);
    puddle.setAttribute("cy", y + h / 2);
    puddle.setAttribute("rx", w / 2);
    puddle.setAttribute("ry", h / 2.5);
    puddle.setAttribute("fill", "rgba(56, 120, 180, 0.45)");
    puddle.setAttribute("stroke", "#1d4f7a");
    g.appendChild(puddle);
  } else {
    const scooter = document.createElementNS(NS, "rect");
    scooter.setAttribute("x", x);
    scooter.setAttribute("y", y + 10);
    scooter.setAttribute("width", w);
    scooter.setAttribute("height", 18);
    scooter.setAttribute("rx", 6);
    scooter.setAttribute("fill", "#b45309");
    const wheel1 = document.createElementNS(NS, "circle");
    wheel1.setAttribute("cx", x + 12);
    wheel1.setAttribute("cy", y + 32);
    wheel1.setAttribute("r", 8);
    wheel1.setAttribute("fill", "#1a2e28");
    const wheel2 = document.createElementNS(NS, "circle");
    wheel2.setAttribute("cx", x + w - 12);
    wheel2.setAttribute("cy", y + 32);
    wheel2.setAttribute("r", 8);
    wheel2.setAttribute("fill", "#1a2e28");
    g.appendChild(scooter);
    g.appendChild(wheel1);
    g.appendChild(wheel2);
  }
  return g;
}

function drawBackpack(NS, x, y) {
  const g = document.createElementNS(NS, "g");
  g.setAttribute("class", "entity-marker");
  const bag = document.createElementNS(NS, "rect");
  bag.setAttribute("x", x);
  bag.setAttribute("y", y);
  bag.setAttribute("width", 40);
  bag.setAttribute("height", 36);
  bag.setAttribute("rx", 8);
  bag.setAttribute("fill", "#1f4a6b");
  g.appendChild(bag);
  return g;
}

function drawBench(NS, x, y, w, h) {
  const g = document.createElementNS(NS, "g");
  g.setAttribute("class", "entity-marker");
  const seat = document.createElementNS(NS, "rect");
  seat.setAttribute("x", x);
  seat.setAttribute("y", y);
  seat.setAttribute("width", w);
  seat.setAttribute("height", h);
  seat.setAttribute("rx", 6);
  seat.setAttribute("fill", "#6b4f2a");
  g.appendChild(seat);
  return g;
}

function drawPhone(NS, x, y) {
  const g = document.createElementNS(NS, "g");
  g.setAttribute("class", "entity-marker");
  const phone = document.createElementNS(NS, "rect");
  phone.setAttribute("x", x);
  phone.setAttribute("y", y);
  phone.setAttribute("width", 22);
  phone.setAttribute("height", 36);
  phone.setAttribute("rx", 4);
  phone.setAttribute("fill", "#111827");
  const screen = document.createElementNS(NS, "rect");
  screen.setAttribute("x", x + 3);
  screen.setAttribute("y", y + 5);
  screen.setAttribute("width", 16);
  screen.setAttribute("height", 24);
  screen.setAttribute("rx", 2);
  screen.setAttribute("fill", "#93c5fd");
  g.appendChild(phone);
  g.appendChild(screen);
  return g;
}
