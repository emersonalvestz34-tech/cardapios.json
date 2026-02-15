(function () {
  const DATA_URL = "https://cdn.jsdelivr.net/gh/emersonalvestz34-tech/cardapios.json@main/chas-br.json?v=4";

  const el = (id) => document.getElementById(id);
  const uniq = (arr) => Array.from(new Set(arr));
  const pickN = (arr, n) => {
    const copy = arr.slice();
    const out = [];
    while (copy.length && out.length < n) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
    return out;
  };

  const ICONS = {
    leaf: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4s-6.5 0-11 4.5S4.5 20 4.5 20 11 20 15.5 15.5 20 4 20 4Z"></path><path d="M4.5 20c2-6 8-10 15.5-12"></path></svg>`,
    clock: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v5l3 2"></path><circle cx="12" cy="12" r="9"></circle></svg>`,
    droplet: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13Z"></path></svg>`,
    shield: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4Z"></path></svg>`,
    alert: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v4"></path><path d="M12 17h.01"></path><path d="M10.3 3.6 2.3 18a2 2 0 0 0 1.7 3h16a2 2 0 0 0 1.7-3l-8-14.4a2 2 0 0 0-3.4 0Z"></path></svg>`,
    copy: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"></rect><rect x="2" y="2" width="13" height="13" rx="2"></rect></svg>`,
    refresh: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"></path><path d="M21 3v6h-6"></path></svg>`,
    info: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>`
  };

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setStatus(msg) {
    const s = el("chaStatus");
    if (!s) return;
    s.textContent = msg || "";
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
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

  function ctxFromUI() {
    return {
      idade: el("chaIdade").value, // adult, kid, lt1
      gravidez: el("chaGravidez").checked,
      pressaoAlta: el("chaPressao").checked,
      diabetes: el("chaDiabetes").checked,
      antidepressivo: el("chaAntiDep").checked,
      anticoagulante: el("chaAntiCoag").checked,
      antiHipertensivo: el("chaAntiHip").checked,
      antidiabetico: el("chaAntiDiab").checked
    };
  }

  function statusBadge(type, text) {
    const map = { ok: "ok", cautela: "warn", evitar: "bad" };
    const cls = map[type] || "muted";
    return `<span class="cha-badge ${cls}">${ICONS.shield}<span>${escapeHtml(text)}</span></span>`;
  }

  function allowTea(cha, ctx) {
    const r = cha.restricoes || {};

    // bebê < 1 ano: bloqueia mel
    if (ctx.idade === "lt1" && cha.id === "mel_limao") return false;

    // restrições hard
    if (ctx.gravidez && r.gravidez_amamentacao === "evitar") return false;
    if (ctx.pressaoAlta && r.pressao_alta === "evitar") return false;
    if (ctx.diabetes && r.diabetes === "evitar") return false;

    if (ctx.antidepressivo && r.antidepressivo === "evitar") return false;
    if (ctx.anticoagulante && r.anticoagulante === "evitar") return false;

    if (ctx.antiHipertensivo && r.anti_hipertensivo === "evitar") return false;
    if (ctx.antidiabetico && r.antidiabetico === "evitar") return false;

    return true;
  }

  function cautionNotes(cha, ctx) {
    const r = cha.restricoes || {};
    const notes = [];

    const add = (cond, key, label) => {
      if (!cond) return;
      if (r[key] === "cautela") notes.push(label);
      if (r[key] === "evitar") notes.push("Evitar: " + label);
    };

    add(ctx.gravidez, "gravidez_amamentacao", "gravidez/amamentação");
    add(ctx.pressaoAlta, "pressao_alta", "pressão alta");
    add(ctx.diabetes, "diabetes", "diabetes");
    add(ctx.antidepressivo, "antidepressivo", "uso de antidepressivo");
    add(ctx.anticoagulante, "anticoagulante", "uso de anticoagulante");
    add(ctx.antiHipertensivo, "anti_hipertensivo", "uso de anti-hipertensivo");
    add(ctx.antidiabetico, "antidiabetico", "uso de antidiabético");

    return uniq(notes);
  }

  function goalChips(goals, objetivosMap) {
    const nice = (g) => objetivosMap[g]?.nome || g;
    return (goals || []).slice(0, 3).map(g => `<span class="cha-chip">${escapeHtml(nice(g))}</span>`).join("");
  }

  function renderTeaCard(cha, ctx, objetivosMap) {
    const p = cha.preparo || {};
    const alerts = (cha.alertas || []);
    const cautions = cautionNotes(cha, ctx);

    const cautionHtml = cautions.length
      ? `<div class="cha-callout warn">${ICONS.alert}<span><b>Atenção:</b> ${escapeHtml(cautions.join(" • "))}</span></div>`
      : "";

    const alertsHtml = alerts.length
      ? `<ul class="cha-list">${alerts.map(a => `<li>${ICONS.alert}<span>${escapeHtml(a)}</span></li>`).join("")}</ul>`
      : `<div class="cha-muted">Sem alertas extras cadastrados.</div>`;

    return `
      <article class="cha-card">
        <header class="cha-card-top">
          <div class="cha-title">
            <div class="cha-icon">${ICONS.leaf}</div>
            <div>
              <h4>${escapeHtml(cha.nome)}</h4>
              ${cha.nome_cientifico ? `<div class="cha-sub">${escapeHtml(cha.nome_cientifico)}</div>` : ""}
              <div class="cha-goals">${goalChips(cha.objetivos, objetivosMap)}</div>
            </div>
          </div>
          <div class="cha-meta">
            <span class="cha-badge muted">${ICONS.info}<span>${escapeHtml(p.tipo || "preparo")}</span></span>
          </div>
        </header>

        ${cautionHtml}

        <div class="cha-grid">
          <div class="cha-box">
            <div class="cha-box-title">${ICONS.clock}<span>Preparo</span></div>
            <div class="cha-lines">
              <div><b>Quantidade:</b> ${escapeHtml(p.quantidade || "—")}</div>
              <div><b>Água:</b> ${escapeHtml(String(p.agua_ml ?? "—"))} ml</div>
              <div><b>Tempo:</b> ${escapeHtml(String(p.tempo_min ?? "—"))} min</div>
              <div><b>Como:</b> ${escapeHtml(p.como || "—")}</div>
            </div>
          </div>

          <div class="cha-box">
            <div class="cha-box-title">${ICONS.droplet}<span>Como tomar</span></div>
            <div class="cha-lines">
              <div><b>Dose:</b> ${escapeHtml(cha.dose || "—")}</div>
            </div>
            <div class="cha-box-title" style="margin-top:10px">${ICONS.alert}<span>Alertas</span></div>
            ${alertsHtml}
          </div>
        </div>
      </article>
    `;
  }

  function buildCopy(objName, cards, meta, ctx) {
    const lines = [];
    lines.push(`🌿 Gerador de Chá Seguro — objetivo: ${objName}`);
    lines.push("");

    const flags = [];
    if (ctx.gravidez) flags.push("Grávida/amamentando");
    if (ctx.pressaoAlta) flags.push("Pressão alta");
    if (ctx.diabetes) flags.push("Diabetes");
    if (ctx.antidepressivo) flags.push("Antidepressivo");
    if (ctx.anticoagulante) flags.push("Anticoagulante");
    if (ctx.antiHipertensivo) flags.push("Anti-hipertensivo");
    if (ctx.antidiabetico) flags.push("Antidiabético");
    if (flags.length) lines.push(`Perfil: ${flags.join(" | ")}\n`);

    cards.forEach((c, i) => {
      const p = c.preparo || {};
      lines.push(`${i + 1}) ${c.nome}${c.nome_cientifico ? " (" + c.nome_cientifico + ")" : ""}`);
      lines.push(`Preparo: ${p.tipo || ""} — ${p.quantidade || ""} em ${p.agua_ml || ""}ml por ${p.tempo_min || ""}min`);
      lines.push(`Dose: ${c.dose || ""}`);
      if ((c.alertas || []).length) lines.push(`Alertas: ${c.alertas.join(" | ")}`);
      lines.push("");
    });

    lines.push(`⚠️ ${meta?.disclaimer || ""}`.trim());
    return lines.join("\n").trim();
  }

  function filterPool(data, objetivoKey, ctx) {
    const pool = (data.chas || [])
      .filter(c => (c.objetivos || []).includes(objetivoKey))
      .filter(c => allowTea(c, ctx));

    // se usuário marcou pressão/diabetes, prioriza chás que também tenham essas tags
    const boostTag = (key) => (ctx[key] ? 1 : 0);
    const score = (c) => {
      let s = 0;
      if (ctx.pressaoAlta && (c.objetivos || []).includes("pressao")) s += 2;
      if (ctx.diabetes && (c.objetivos || []).includes("diabetes")) s += 2;
      s += Math.random(); // desempate
      return s;
    };

    return pool.sort((a, b) => score(b) - score(a));
  }

  function render(data) {
    const objetivoKey = el("chaObjetivo").value;
    const obj = data.objetivos[objetivoKey];
    const ctx = ctxFromUI();

    el("chaDesc").textContent = obj?.descricao || "";

    const pool = filterPool(data, objetivoKey, ctx);

    if (!pool.length) {
      el("chaResultado").innerHTML = `
        <div class="cha-empty">
          <b>Não encontrei uma opção segura</b> com esses filtros.
          <div class="cha-muted" style="margin-top:8px">
            Dica: desmarque algum filtro (se for o caso) ou procure orientação profissional.
          </div>
        </div>
      `;
      el("chaCopy").dataset.copy = "";
      return;
    }

    const picks = pickN(pool.slice(0, 12), 4); // 4 sugestões premium
    el("chaResultado").innerHTML = picks.map(c => renderTeaCard(c, ctx, data.objetivos)).join("");

    el("chaCopy").dataset.copy = buildCopy(obj?.nome || objetivoKey, picks, data.meta, ctx);
  }

  async function init() {
    try {
      setStatus("Carregando…");
      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao carregar o banco de chás.");
      const data = await res.json();

      // select objetivos
      const objSel = el("chaObjetivo");
      objSel.innerHTML = "";
      Object.keys(data.objetivos).forEach(k => {
        const opt = document.createElement("option");
        opt.value = k;
        opt.textContent = data.objetivos[k].nome;
        objSel.appendChild(opt);
      });

      // disclaimer
      el("chaDisclaimer").textContent = data.meta?.disclaimer || "";

      // eventos
      el("chaGerar").addEventListener("click", () => render(data));
      objSel.addEventListener("change", () => render(data));

      [
        "chaIdade","chaGravidez","chaPressao","chaDiabetes",
        "chaAntiDep","chaAntiCoag","chaAntiHip","chaAntiDiab"
      ].forEach(id => el(id).addEventListener("change", () => render(data)));

      el("chaCopiar").addEventListener("click", async () => {
        const text = el("chaCopy").dataset.copy || "";
        if (!text) return;
        await copyToClipboard(text);
        setStatus("Copiado ✅");
        setTimeout(() => setStatus(""), 1200);
      });

      // primeira renderização
      render(data);
      setStatus("");
    } catch (e) {
      console.error(e);
      setStatus("Erro: " + (e.message || e));
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
