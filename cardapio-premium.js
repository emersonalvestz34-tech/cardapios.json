(function () {
  // ======= CONFIG =======
  const DATA_URL = "https://cdn.jsdelivr.net/gh/emersonalvestz34-tech/cardapios.json@main/cardapios.json?v=1";
  const STORAGE_KEY = "psbCardapioPremium_v1";

  // ======= HELPERS =======
  const el = (id) => document.getElementById(id);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setStatus(msg) {
    const s = el("psbStatus");
    if (!s) return;
    s.textContent = msg || "";
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

  // ======= CALORIE ESTIMATOR (fallback) =======
  // Estimativa simples via palavras-chave (não é médico/nutricional).
  const KCAL_MAP = [
    { re: /\barroz\b/i, kcal: 200 },
    { re: /\bfeij[aã]o\b/i, kcal: 180 },
    { re: /\bfrango\b/i, kcal: 220 },
    { re: /\bovo(s)?\b/i, kcal: 160 },
    { re: /\btapioca\b/i, kcal: 220 },
    { re: /\bcuscuz\b/i, kcal: 180 },
    { re: /\bmacarr[aã]o\b/i, kcal: 320 },
    { re: /\bp[aã]o\b/i, kcal: 180 },
    { re: /\bqueijo\b/i, kcal: 140 },
    { re: /\biogurte\b/i, kcal: 130 },
    { re: /\bbanana\b/i, kcal: 105 },
    { re: /\bmam[aã]o\b/i, kcal: 90 },
    { re: /\bma[cç][aã]\b/i, kcal: 95 },
    { re: /\blaranja\b/i, kcal: 80 },
    { re: /\bsardinha\b/i, kcal: 190 },
    { re: /\batum\b/i, kcal: 170 },
    { re: /\bcastanh(a|as)\b|\bamendoim\b/i, kcal: 160 },
    { re: /\bpipoca\b/i, kcal: 140 },
    { re: /\bsopa\b|\bcaldo\b/i, kcal: 220 },
    { re: /\bsalada\b|\bfolhas\b|\bverdura\b|\blegume\b/i, kcal: 80 },
    { re: /\bazeite\b/i, kcal: 60 },
    { re: /\bvitamina\b/i, kcal: 240 }
  ];

  function estimateKcalFromItems(items) {
    // Se no futuro você colocar calorias no JSON:
    // - mealObj.kcal_total ou
    // - itens como objetos { nome, kcal }
    // este código já suporta.
    let total = 0;

    for (const it of items || []) {
      if (typeof it === "object" && it) {
        if (typeof it.kcal === "number") total += it.kcal;
        else if (typeof it.nome === "string") total += estimateKcalFromText(it.nome);
      } else {
        total += estimateKcalFromText(String(it));
      }
    }

    // Ajuste mínimo se ficou 0 por falta de match
    if (total <= 0 && (items || []).length) total = 250;

    return Math.round(total);
  }

  function estimateKcalFromText(text) {
    let found = 0;
    for (const rule of KCAL_MAP) {
      if (rule.re.test(text)) found += rule.kcal;
    }
    // se encontrou muita coisa no mesmo item, limita um pouco
    if (found > 650) found = 650;
    // se nada bateu, assume “leve”
    if (found === 0) found = 80;
    return found;
  }

  // ======= OBJECTIVE MULTIPLIER =======
  // "Emagrecer": reduz um pouco a estimativa exibida (e sugere porção menor)
  // "Manter": base
  // "Ganhar": aumenta um pouco (e sugere complemento)
  const OBJ = {
    emagrecer: { label: "Emagrecer", mult: 0.92, tip: "Dica: priorize salada/legumes e porção menor de carbo." },
    manter: { label: "Manter", mult: 1.0, tip: "Dica: equilíbrio — prato simples e sem exageros." },
    ganhar: { label: "Ganhar", mult: 1.12, tip: "Dica: inclua mais proteína e um carbo extra (ex.: banana/aveia)." }
  };

  // ======= STATE =======
  let dataCache = null;
  let lastGenerated = null;

  // ======= RENDER =======
  function renderMealCard(title, mealObj) {
    const itens = (mealObj.itens || []);
    const subs = (mealObj.substituicoes || []);
    const itemsHtml = itens.map(i => `<li>${escapeHtml(typeof i === "object" ? (i.nome || "") : i)}</li>`).join("");
    const subsHtml = subs.map(s => `<li>${escapeHtml(s)}</li>`).join("");

    const kcal = estimateKcalFromItems(itens);
    return `
      <div class="psb-meal">
        <div class="psb-meal-head">
          <h4>${escapeHtml(title)} <span class="psb-meal-title">${escapeHtml(mealObj.titulo || "")}</span></h4>
          <div class="psb-chip">${kcal} kcal (estim.)</div>
        </div>

        <div class="psb-cols">
          <div>
            <div class="psb-label">O que entra</div>
            <ul>${itemsHtml || "<li>—</li>"}</ul>
          </div>
          <div>
            <div class="psb-label">Substituições</div>
            <ul>${subsHtml || "<li>—</li>"}</ul>
          </div>
        </div>
      </div>
    `;
  }

  function getFormato() {
    const key = el("psbFormato").value;
    const f = dataCache.formatos[key];
    return { key, f };
  }

  function getObjective() {
    const key = el("psbObjetivo").value;
    return OBJ[key] || OBJ.manter;
  }

  function calcDayTotalKcal(day) {
    const obj = getObjective();
    const base =
      estimateKcalFromItems(day.cafe.itens) +
      estimateKcalFromItems(day.almoco.itens) +
      estimateKcalFromItems(day.lanche.itens) +
      estimateKcalFromItems(day.jantar.itens);

    return Math.round(base * obj.mult);
  }

  function buildCopyDay(f, day, totalKcal) {
    const obj = getObjective();
    const aviso = dataCache.meta?.aviso || "";

    return `🍽️ Cardápio do Dia — ${f.nome}
🎯 Objetivo: ${obj.label}
🔥 Total estimado: ${totalKcal} kcal

☕ Café: ${day.cafe.titulo}
- ${day.cafe.itens.join(", ")}

🍛 Almoço: ${day.almoco.titulo}
- ${day.almoco.itens.join(", ")}

🍌 Lanche: ${day.lanche.titulo}
- ${day.lanche.itens.join(", ")}

🌙 Jantar: ${day.jantar.titulo}
- ${day.jantar.itens.join(", ")}

${obj.tip}
Obs.: ${aviso}`.trim();
  }

  function buildCopyWeek(f, week, totals) {
    const obj = getObjective();
    const aviso = dataCache.meta?.aviso || "";
    const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

    const lines = [
      `📅 Cardápio da Semana — ${f.nome}`,
      `🎯 Objetivo: ${obj.label}`,
      ""
    ];

    week.forEach((d, i) => {
      lines.push(`${days[i]} — Total estimado: ${totals[i]} kcal`);
      lines.push(`☕ Café: ${d.cafe.titulo} — ${d.cafe.itens.join(", ")}`);
      lines.push(`🍛 Almoço: ${d.almoco.titulo} — ${d.almoco.itens.join(", ")}`);
      lines.push(`🍌 Lanche: ${d.lanche.titulo} — ${d.lanche.itens.join(", ")}`);
      lines.push(`🌙 Jantar: ${d.jantar.titulo} — ${d.jantar.itens.join(", ")}`);
      lines.push("");
    });

    lines.push(obj.tip);
    lines.push(`Obs.: ${aviso}`);

    return lines.join("\n").trim();
  }

  function generateDay() {
    const { key, f } = getFormato();
    const r = f.refeicoes;

    const day = {
      cafe: pick(r.cafe),
      almoco: pick(r.almoco),
      lanche: pick(r.lanche),
      jantar: pick(r.jantar)
    };

    const totalKcal = calcDayTotalKcal(day);

    lastGenerated = { tipo: "dia", key, conteudo: day, totalKcal };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lastGenerated));

    el("psbDesc").textContent = f.descricao || "";

    el("psbResumo").innerHTML = `
      <div class="psb-summary">
        <div><b>🎯 Objetivo:</b> ${escapeHtml(getObjective().label)}</div>
        <div><b>🔥 Total estimado:</b> ${totalKcal} kcal</div>
        <div class="psb-tip">${escapeHtml(getObjective().tip)}</div>
      </div>
    `;

    el("psbResultado").innerHTML = `
      ${renderMealCard("Café", day.cafe)}
      ${renderMealCard("Almoço", day.almoco)}
      ${renderMealCard("Lanche", day.lanche)}
      ${renderMealCard("Jantar", day.jantar)}
      <div class="psb-footnote">${escapeHtml(dataCache.meta?.aviso || "")}</div>
    `;

    el("psbMode").textContent = "Modo: Dia";
    setCopy(buildCopyDay(f, day, totalKcal));
  }

  function generateWeek() {
    const { key, f } = getFormato();
    const r = f.refeicoes;
    const days = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

    const week = Array.from({ length: 7 }).map(() => ({
      cafe: pick(r.cafe),
      almoco: pick(r.almoco),
      lanche: pick(r.lanche),
      jantar: pick(r.jantar)
    }));

    const totals = week.map(d => calcDayTotalKcal(d));
    const avg = Math.round(totals.reduce((a, b) => a + b, 0) / totals.length);

    lastGenerated = { tipo: "semana", key, conteudo: week, totals, avg };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lastGenerated));

    el("psbDesc").textContent = f.descricao || "";

    el("psbResumo").innerHTML = `
      <div class="psb-summary">
        <div><b>🎯 Objetivo:</b> ${escapeHtml(getObjective().label)}</div>
        <div><b>🔥 Média diária:</b> ${avg} kcal (estim.)</div>
        <div class="psb-tip">${escapeHtml(getObjective().tip)}</div>
      </div>
    `;

    el("psbResultado").innerHTML =
      week.map((d, i) => `
        <div class="psb-weekday">
          <div class="psb-weekday-head">
            <h4>📅 ${escapeHtml(days[i])}</h4>
            <div class="psb-chip">${totals[i]} kcal (estim.)</div>
          </div>
          <div class="psb-weekday-grid">
            ${renderMealCard("Café", d.cafe)}
            ${renderMealCard("Almoço", d.almoco)}
            ${renderMealCard("Lanche", d.lanche)}
            ${renderMealCard("Jantar", d.jantar)}
          </div>
        </div>
      `).join("") +
      `<div class="psb-footnote">${escapeHtml(dataCache.meta?.aviso || "")}</div>`;

    el("psbMode").textContent = "Modo: Semana";
    setCopy(buildCopyWeek(f, week, totals));
  }

  function shoppingList() {
    if (!lastGenerated) {
      setStatus("Gere um cardápio primeiro.");
      setTimeout(() => setStatus(""), 1500);
      return;
    }

    let items = [];

    if (lastGenerated.tipo === "dia") {
      const d = lastGenerated.conteudo;
      items = [...d.cafe.itens, ...d.almoco.itens, ...d.lanche.itens, ...d.jantar.itens];
    } else {
      lastGenerated.conteudo.forEach((d) => {
        items.push(...d.cafe.itens, ...d.almoco.itens, ...d.lanche.itens, ...d.jantar.itens);
      });
    }

    const normalized = items.map(x => {
      if (typeof x === "object" && x) return String(x.nome || "").trim();
      return String(x).trim();
    }).filter(Boolean);

    const unique = Array.from(new Set(normalized)).sort((a, b) => a.localeCompare(b, "pt-BR"));

    el("psbResumo").innerHTML = `
      <div class="psb-summary">
        <div><b>🛒 Itens únicos:</b> ${unique.length}</div>
        <div class="psb-tip">Dica: marque no mercado e risca o que já tem em casa.</div>
      </div>
    `;

    el("psbResultado").innerHTML = `
      <div class="psb-meal">
        <div class="psb-meal-head">
          <h4>🛒 Lista de Compras</h4>
          <div class="psb-chip">${unique.length} itens</div>
        </div>
        <ul class="psb-checklist">
          ${unique.map(i => `<li><label><input type="checkbox"> <span>${escapeHtml(i)}</span></label></li>`).join("")}
        </ul>
      </div>
      <div class="psb-footnote">${escapeHtml(dataCache.meta?.aviso || "")}</div>
    `;

    el("psbMode").textContent = "Modo: Lista";
    setCopy(`🛒 Lista de Compras\n\n- ${unique.join("\n- ")}\n\nObs.: ${dataCache.meta?.aviso || ""}`.trim());
  }

  function printPDF() {
    // Abre a impressão (salvar como PDF)
    window.print();
  }

  function loadSaved() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const s = JSON.parse(saved);
      if (!s || !s.tipo || !s.key) return;
      lastGenerated = s;

      // aplica objetivo salvo se existir
      if (s.objetivo && el("psbObjetivo")) el("psbObjetivo").value = s.objetivo;

      // re-render
      if (s.tipo === "dia") generateDay();
      else if (s.tipo === "semana") generateWeek();
      else if (s.tipo === "lista") shoppingList();
    } catch (_) {}
  }

  function saveObjective() {
    if (!lastGenerated) return;
    lastGenerated.objetivo = el("psbObjetivo").value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lastGenerated));
  }

  function bind() {
    el("psbGerar").addEventListener("click", () => { generateDay(); saveObjective(); });
    el("psbSemana").addEventListener("click", () => { generateWeek(); saveObjective(); });
    el("psbLista").addEventListener("click", () => { shoppingList(); saveObjective(); });

    el("psbCopiar").addEventListener("click", async () => {
      const text = el("psbCopy").dataset.copy || "";
      await copyToClipboard(text);
      setStatus("Copiado ✅");
      setTimeout(() => setStatus(""), 1400);
    });

    el("psbPDF").addEventListener("click", () => { printPDF(); });

    el("psbFormato").addEventListener("change", () => { generateDay(); saveObjective(); });
    el("psbObjetivo").addEventListener("change", () => { 
      // re-render no modo atual
      if (!lastGenerated) { generateDay(); return; }
      saveObjective();
      if (lastGenerated.tipo === "dia") generateDay();
      else if (lastGenerated.tipo === "semana") generateWeek();
      else if (lastGenerated.tipo === "lista") shoppingList();
    });
  }

  async function init() {
    try {
      setStatus("Carregando…");

      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao carregar JSON.");
      dataCache = await res.json();

      // select formatos
      const select = el("psbFormato");
      select.innerHTML = "";
      Object.keys(dataCache.formatos).forEach((k) => {
        const opt = document.createElement("option");
        opt.value = k;
        opt.textContent = dataCache.formatos[k].nome;
        select.appendChild(opt);
      });

      // select objetivos
      const objSel = el("psbObjetivo");
      objSel.innerHTML = "";
      Object.keys(OBJ).forEach((k) => {
        const opt = document.createElement("option");
        opt.value = k;
        opt.textContent = OBJ[k].label;
        objSel.appendChild(opt);
      });

      bind();
      loadSaved();

      if (!lastGenerated) generateDay();

      setStatus("");
    } catch (e) {
      setStatus("Erro: " + (e.message || e));
      console.error(e);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
