async function loadCatalog() {
  const response = await fetch("/hub/projets.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Impossible de charger projets.json");
  return response.json();
}

function renderFilters(categories, activeId, onChange) {
  const root = document.getElementById("filters");
  const items = [{ id: "all", label: "Tous" }, ...categories];
  root.innerHTML = items
    .map(
      (c) =>
        `<button type="button" data-id="${c.id}" aria-pressed="${c.id === activeId}">${c.label}</button>`
    )
    .join("");
  root.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => onChange(btn.dataset.id));
  });
}

function renderTree(data, filterId) {
  const root = document.getElementById("tree");
  const projects = data.projects.filter(
    (p) => filterId === "all" || p.category === filterId
  );

  if (!projects.length) {
    root.innerHTML = '<p class="empty">Aucun projet dans cette catégorie.</p>';
    return;
  }

  const byCat = new Map();
  for (const cat of data.categories) byCat.set(cat.id, { ...cat, projects: [] });
  for (const project of projects) {
    if (!byCat.has(project.category)) {
      byCat.set(project.category, {
        id: project.category,
        label: project.category,
        projects: [],
      });
    }
    byCat.get(project.category).projects.push(project);
  }

  root.innerHTML = [...byCat.values()]
    .filter((c) => c.projects.length)
    .map(
      (cat) => `
      <div class="category-block">
        <h2>${escapeHtml(cat.label)}</h2>
        <div class="project-grid">
          ${cat.projects
            .map(
              (p) => `
            <a class="project-card" href="${escapeAttr(p.url)}" ${
                p.url.startsWith("http") ? 'target="_blank" rel="noopener noreferrer"' : ""
              }>
              <div class="status">${escapeHtml(p.status === "online" ? "● En ligne" : p.status)}</div>
              <h3>${escapeHtml(p.name)}</h3>
              <p>${escapeHtml(p.description)}</p>
              <div class="meta">
                ${(p.tech || []).map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("")}
              </div>
            </a>`
            )
            .join("")}
        </div>
      </div>`
    )
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

async function boot() {
  const data = await loadCatalog();
  let filter = "all";

  const refresh = () => {
    renderFilters(data.categories, filter, (id) => {
      filter = id;
      refresh();
    });
    renderTree(data, filter);
  };

  refresh();
}

boot().catch((err) => {
  document.getElementById("tree").innerHTML =
    `<p class="empty">Erreur de chargement du catalogue : ${escapeHtml(err.message)}</p>`;
});
