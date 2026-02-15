(function () {
  const DATA_URL = "https://cdn.jsdelivr.net/gh/emersonalvestz34-tech/cardapios.json@main/cardapios.json?v=2";
  const STORAGE_KEY = "psbCardapioPremium_v2";

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

  // ===== fallback estimator (caso você deixe alguma refeição sem kcal_total) =====
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

  function estimateKcalFromText(text) {
    let found = 0;
    for (const rule of KCAL_MAP) if (rule.re.test(text)) found += rule.kcal;
    if (found > 650) found = 650;
    if (found === 0) found = 120;
    return found;
  }

  // ✅ usa kcal_total se existir, senão estima por itens
  function kcalMeal(mealObj) {
    if (mealObj && typeof mealObj.kcal_total === "number") return Math.round(mealObj.kcal_total);

    const items = (mealObj && mealObj.itens) ? mealObj.itens : [];
    let total = 0;

    for (const it of items) {
      if (typeof it === "object" && it) {
        if (typeof it.kcal === "number") total += it.kcal;
        else if (typeof it.nome === "string") total += estimateKcalFromText(it.nome);
      } else {
        total += estimateKcalFromText(String(it));
      }
    }

    if (total <= 0 && items.length) total = 250;
    return Math.round(total);
  }

  const OBJ = {
    emagrecer: { label: "Emagrecer", mult: 0.92, tip: "Dica: priorize salada/legumes e porção menor de carbo." },
    manter: { label: "Manter", mult: 1.0, tip: "Dica: equilíbrio — prato simples e sem exageros." },
    ganhar: { label: "Ganhar", mult: 1.12, tip: "Dica: inclua mais proteína e um carbo extra (ex.: banana/aveia)." }
  };

  let dataCache = null;
  let lastGenerated = null;

  function getFormato() {
    const key = el("psbFormato").value;
    const f = dataCache.formatos[key];
    return { key, f };
  }

  function getObjective() {
    const key = el("psbObjetivo").value;
    return OBJ[key] || OBJ.manter;
  }

  function renderMealCard(title, mealObj) {
    const itens = (mealObj.itens || []);
    const subs = (mealObj.substituicoes || []);
    const itemsHtml = itens.map(i => `<li>${escapeHtml(typeof i === "object" ? (i.nome || "") : i)}</li>`).join("");
    const subsHtml = subs.map(s => `<li>${escapeHtml(s)}</li>`).join("");
    const kcal = kcalMeal(mealObj);

    return `
      <div class="psb-meal">
        <div class="psb-meal-head">
          <h4>${escapeHtml(title)} <span class="psb-meal-title">${escapeHtml(mealObj.titulo || "")}</span></h4>
          <div class="psb-chip">${kcal} kcal</div>
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

  function dayTotal(day) {
    const obj = getObjective();
    const base = kcalMeal(day.cafe) + kcalMeal(day.almoco) + kcalMeal(day.lanche) + kcalMeal(day.jantar);
    return Math.round(base * obj.mult);
  }

  function setCopy(text) {
    el("psbCopy").dataset.copy = text || "";
  }

  function buildCopyDay(f, day, totalKcal) {
    const obj = getObjective();
    const aviso = dataCache.meta?.aviso || "";

    return `🍽️ Cardápio do Dia — ${f.nome}
🎯 Objetivo: ${obj.label}
🔥 Total: ${totalKcal} kcal

☕ Café: ${day.cafe.titulo} (${kcalMeal(day.cafe)} kcal)
- ${day.cafe.itens.join(", ")}

🍛 Almoço: ${day.almoco.titulo} (${kcalMeal(day.almoco)} kcal)
- ${day.almoco.itens.join(", ")}

🍌 Lanche: ${day.lanche.titulo} (${kcalMeal(day.lanche)} kcal)
- ${day.lanche.itens.join(", ")}

🌙 Jantar: ${day.jantar.titulo} (${kcalMeal(day.jantar)} kcal)
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
      lines.push(`${days[i]} — Total: ${totals[i]} kcal`);
      lines.push(`☕ Café: ${d.cafe.titulo} (${kcalMeal(d.cafe)} kcal)`);
      lines.push(`🍛 Almoço: ${d.almoco.titulo} (${kcalMeal(d.almoco)} kcal)`);
      lines.push(`🍌 Lanche: ${d.lanche.titulo} (${kcalMeal(d.lanche)} kcal)`);
      lines.push(`🌙 Jantar: ${d.jantar.titulo} (${kcalMeal(d.jantar)} kcal)`);
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

    const totalKcal = dayTotal(day);

    lastGenerated = { tipo: "dia", key, objetivo: el("psbObjetivo").value, conteudo: day, totalKcal };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lastGenerated));

    el("psbDesc").textContent = f.descricao || "";
    el("psbResumo").innerHTML = `
      <div class="psb-summary">
        <div><b>🎯 Objetivo:</b> ${escapeHtml(getObjective().label)}</div>
        <div><b>🔥 Total:</b> ${totalKcal} kcal</div>
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

    const totals = week.map(d => dayTotal(d));
    const avg = Math.round(totals.reduce((a, b) => a + b, 0) / totals.length);

    lastGenerated = { tipo: "semana", key, objetivo: el("psbObjetivo").value, conteudo: week, totals, avg };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lastGenerated));

    el("psbDesc").textContent = f.descricao || "";
    el("psbResumo").innerHTML = `
      <div class="psb-summary">
        <div><b>🎯 Objetivo:</b> ${escapeHtml(getObjective().label)}</div>
        <div><b>🔥 Média diária:</b> ${avg} kcal</div>
        <div class="psb-tip">${escapeHtml(getObjective().tip)}</div>
      </div>
    `;

    el("psbResultado").innerHTML =
      week.map((d, i) => `
        <div class="psb-weekday">
          <div class="psb-weekday-head">
            <h4>📅 ${escapeHtml(days[i])}</h4>
            <div class="psb-chip">${totals[i]} kcal</div>
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

    const normalized = items.map(x => (typeof x === "object" && x) ? String(x.nome || "").trim() : String(x).trim()).filter(Boolean);
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
    window.print();
  }

  function loadSaved() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const s = JSON.parse(saved);
      if (!s || !s.tipo || !s.key) return;

      if (s.objetivo && el("psbObjetivo")) el("psbObjetivo").value = s.objetivo;

      lastGenerated = s;
      if (s.tipo === "dia") generateDay();
      else if (s.tipo === "semana") generateWeek();
      else if (s.tipo === "lista") shoppingList();
    } catch (_) {}
  }

  function bind() {
    el("psbGerar").addEventListener("click", generateDay);
    el("psbSemana").addEventListener("click", generateWeek);
    el("psbLista").addEventListener("click", shoppingList);

    el("psbCopiar").addEventListener("click", async () => {
      const text = el("psbCopy").dataset.copy || "";
      await copyToClipboard(text);
      setStatus("Copiado ✅");
      setTimeout(() => setStatus(""), 1400);
    });

    el("psbPDF").addEventListener("click", printPDF);

    el("psbFormato").addEventListener("change", generateDay);
    el("psbObjetivo").addEventListener("change", () => {
      if (!lastGenerated) return generateDay();
      if (lastGenerated.tipo === "dia") generateDay();
      else if (lastGenerated.tipo === "semana") generateWeek();
      else shoppingList();
    });
  }

  async function init() {
    try {
      setStatus("Carregando…");

      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao carregar JSON.");
      dataCache = await res.json();

      const select = el("psbFormato");
      select.innerHTML = "";
      Object.keys(dataCache.formatos).forEach((k) => {
        const opt = document.createElement("option");
        opt.value = k;
        opt.textContent = dataCache.formatos[k].nome;
        select.appendChild(opt);
      });

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
