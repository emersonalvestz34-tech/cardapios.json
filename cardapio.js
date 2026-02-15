(function () {

  // ✅ JSON via jsDelivr (Blogger friendly)
  const DATA_URL = "https://cdn.jsdelivr.net/gh/emersonalvestz34-tech/cardapios.json@main/cardapios.json?v=7";

  console.log("CARDAPIO TURBINADO v7 carregou ✅");

  const el = (id) => document.getElementById(id);
  let lastGenerated = null;
  let dataCache = null;

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderMeal(title, mealObj) {
    const items = (mealObj.itens || []).map((x) => `<li>${escapeHtml(x)}</li>`).join("");
    return `
      <div class="psb-meal">
        <h4>${escapeHtml(title)}: <span>${escapeHtml(mealObj.titulo || "")}</span></h4>
        <ul>${items}</ul>
      </div>
    `;
  }

  function buildSelect(formatos) {
    const select = el("psbFormato");
    select.innerHTML = "";
    Object.keys(formatos).forEach((key) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = formatos[key].nome;
      select.appendChild(opt);
    });
  }

  function buildCopyTextDay(nomeFormato, day, aviso) {
    return `🍽️ Cardápio — ${nomeFormato}

☕ Café: ${day.cafe.titulo}
- ${day.cafe.itens.join(", ")}

🍛 Almoço: ${day.almoco.titulo}
- ${day.almoco.itens.join(", ")}

🍌 Lanche: ${day.lanche.titulo}
- ${day.lanche.itens.join(", ")}

🌙 Jantar: ${day.jantar.titulo}
- ${day.jantar.itens.join(", ")}

Obs.: ${aviso || ""}`.trim();
  }

  function buildCopyTextWeek(nomeFormato, week, aviso) {
    const lines = [`📅 Cardápio da Semana — ${nomeFormato}`, ""];
    week.forEach((d, idx) => {
      lines.push(`Dia ${idx + 1}`);
      lines.push(`☕ Café: ${d.cafe.titulo} — ${d.cafe.itens.join(", ")}`);
      lines.push(`🍛 Almoço: ${d.almoco.titulo} — ${d.almoco.itens.join(", ")}`);
      lines.push(`🍌 Lanche: ${d.lanche.titulo} — ${d.lanche.itens.join(", ")}`);
      lines.push(`🌙 Jantar: ${d.jantar.titulo} — ${d.jantar.itens.join(", ")}`);
      lines.push("");
    });
    lines.push(`Obs.: ${aviso || ""}`);
    return lines.join("\n").trim();
  }

  function setCopy(text) {
    el("psbCopy").dataset.copy = text;
  }

  function renderDay(nomeFormato, desc, day, aviso) {
    el("psbDesc").textContent = desc || "";
    el("psbResultado").innerHTML = `
      ${renderMeal("Café", day.cafe)}
      ${renderMeal("Almoço", day.almoco)}
      ${renderMeal("Lanche", day.lanche)}
      ${renderMeal("Jantar", day.jantar)}
      <div class="psb-footnote">${escapeHtml(aviso || "")}</div>
    `;
    setCopy(buildCopyTextDay(nomeFormato, day, aviso));
  }

  function renderWeek(nomeFormato, desc, week, aviso) {
    el("psbDesc").textContent = desc || "";
    el("psbResultado").innerHTML = week.map((d, i) => `
      <div class="psb-meal" style="border-style:dashed">
        <h4>📅 Dia ${i + 1}</h4>
        ${renderMeal("Café", d.cafe)}
        ${renderMeal("Almoço", d.almoco)}
        ${renderMeal("Lanche", d.lanche)}
        ${renderMeal("Jantar", d.jantar)}
      </div>
    `).join("") + `<div class="psb-footnote">${escapeHtml(aviso || "")}</div>`;

    setCopy(buildCopyTextWeek(nomeFormato, week, aviso));
  }

  function generateDay() {
    const formatos = dataCache.formatos;
    const key = el("psbFormato").value;
    const f = formatos[key];
    const r = f.refeicoes;

    const day = {
      cafe: pickRandom(r.cafe),
      almoco: pickRandom(r.almoco),
      lanche: pickRandom(r.lanche),
      jantar: pickRandom(r.jantar)
    };

    lastGenerated = { tipo: "dia", formatoKey: key, conteudo: day };
    localStorage.setItem("psbCardapio", JSON.stringify(lastGenerated));

    renderDay(f.nome, f.descricao, day, dataCache.meta?.aviso);
  }

  function generateWeek() {
    const formatos = dataCache.formatos;
    const key = el("psbFormato").value;
    const f = formatos[key];
    const r = f.refeicoes;

    const week = Array.from({ length: 7 }).map(() => ({
      cafe: pickRandom(r.cafe),
      almoco: pickRandom(r.almoco),
      lanche: pickRandom(r.lanche),
      jantar: pickRandom(r.jantar)
    }));

    lastGenerated = { tipo: "semana", formatoKey: key, conteudo: week };
    localStorage.setItem("psbCardapio", JSON.stringify(lastGenerated));

    renderWeek(f.nome, f.descricao, week, dataCache.meta?.aviso);
  }

  function generateShoppingList() {
    if (!lastGenerated) {
      el("psbStatus").textContent = "Gere um cardápio primeiro.";
      setTimeout(() => (el("psbStatus").textContent = ""), 1500);
      return;
    }

    let items = [];

    if (lastGenerated.tipo === "dia") {
      const d = lastGenerated.conteudo;
      [d.cafe, d.almoco, d.lanche, d.jantar].forEach(m => items.push(...(m.itens || [])));
    } else {
      lastGenerated.conteudo.forEach((d) => {
        [d.cafe, d.almoco, d.lanche, d.jantar].forEach(m => items.push(...(m.itens || [])));
      });
    }

    // normaliza e remove duplicados
    const unique = Array.from(new Set(items.map(x => String(x).trim()).filter(Boolean)));

    el("psbResultado").innerHTML = `
      <div class="psb-meal">
        <h4>🛒 Lista de Compras</h4>
        <ul>${unique.map(i => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
      </div>
      <div class="psb-footnote">${escapeHtml(dataCache.meta?.aviso || "")}</div>
    `;

    setCopy(`🛒 Lista de Compras\n\n- ${unique.join("\n- ")}\n\nObs.: ${dataCache.meta?.aviso || ""}`.trim());
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return Promise.resolve();
  }

  function bindButtons() {
    // Evita erro se o Blogger por algum motivo mexer no HTML
    const btnGerar = el("psbGerar");
    const btnSemana = el("psbSemana");
    const btnLista = el("psbLista");
    const btnCopiar = el("psbCopiar");

    if (btnGerar) btnGerar.addEventListener("click", generateDay);
    if (btnSemana) btnSemana.addEventListener("click", generateWeek);
    if (btnLista) btnLista.addEventListener("click", generateShoppingList);

    if (btnCopiar) {
      btnCopiar.addEventListener("click", async () => {
        const text = el("psbCopy").dataset.copy || "";
        await copyToClipboard(text);
        el("psbStatus").textContent = "Copiado ✅";
        setTimeout(() => (el("psbStatus").textContent = ""), 1500);
      });
    }

    el("psbFormato").addEventListener("change", generateDay);
  }

  function loadSaved() {
    try {
      const saved = localStorage.getItem("psbCardapio");
      if (!saved) return;

      const s = JSON.parse(saved);
      if (!s || !s.tipo || !s.formatoKey) return;

      const f = dataCache.formatos[s.formatoKey];
      if (!f) return;

      lastGenerated = s;

      if (s.tipo === "dia") {
        renderDay(f.nome, f.descricao, s.conteudo, dataCache.meta?.aviso);
      } else if (s.tipo === "semana") {
        renderWeek(f.nome, f.descricao, s.conteudo, dataCache.meta?.aviso);
      }
    } catch (_) {}
  }

  async function init() {
    try {
      el("psbStatus").textContent = "Carregando…";

      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao baixar JSON.");
      dataCache = await res.json();

      buildSelect(dataCache.formatos);
      bindButtons();
      loadSaved();

      // Se não tinha nada salvo, gera um dia inicial
      if (!lastGenerated) generateDay();

      el("psbStatus").textContent = "";
    } catch (e) {
      el("psbStatus").textContent = "Erro: " + (e.message || e);
      console.error(e);
    }
  }

  document.addEventListener("DOMContentLoaded", init);

})();
