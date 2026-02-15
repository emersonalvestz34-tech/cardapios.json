(function () {
  // Troque o repo/arquivo se mudar nomes
  const DATA_URL = "https://cdn.jsdelivr.net/gh/emersonalvestz34-tech/cardapios.json@main/chas.json?v=1";

  const el = (id) => document.getElementById(id);
  const pickN = (arr, n) => {
    const copy = arr.slice();
    const out = [];
    while (copy.length && out.length < n) {
      out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
    }
    return out;
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

  function isAllowed(cha, ctx) {
    const r = cha.restricoes || {};

    // Menor de 1 ano: bloqueia mel
    if (ctx.idade === "lt1" && cha.id === "mel_com_limao") return false;

    // gravidez/amamentação
    if (ctx.gravidez && r.gravidez_amamentacao === "evitar") return false;

    // pressão alta (aqui conservador: se fosse "evitar" bloquearia)
    if (ctx.pressaoAlta && r.pressao_alta === "evitar") return false;

    // antidepressivo / anticoagulante
    if (ctx.antidepressivo && r.antidepressivo === "evitar") return false;
    if (ctx.anticoagulante && r.anticoagulante === "evitar") return false;

    return true;
  }

  function cautionNotes(cha, ctx) {
    const r = cha.restricoes || {};
    const notes = [];

    if (ctx.gravidez && r.gravidez_amamentacao === "cautela") notes.push("Cautela na gravidez/amamentação.");
    if (ctx.pressaoAlta && r.pressao_alta === "cautela") notes.push("Cautela em pressão alta.");
    if (ctx.antidepressivo && r.antidepressivo === "cautela") notes.push("Cautela com antidepressivo.");
    if (ctx.anticoagulante && r.anticoagulante === "cautela") notes.push("Cautela com anticoagulante.");

    return notes;
  }

  function renderCard(cha, ctx) {
    const p = cha.preparo || {};
    const alerts = (cha.alertas || []).map(a => `<li>${escapeHtml(a)}</li>`).join("");
    const cautions = cautionNotes(cha, ctx).map(c => `<li><b>${escapeHtml(c)}</b></li>`).join("");

    return `
      <div class="cha-card">
        <div class="cha-top">
          <div>
            <h4>${escapeHtml(cha.nome)}</h4>
            ${cha.nome_cientifico ? `<div class="cha-sub">${escapeHtml(cha.nome_cientifico)}</div>` : ""}
          </div>
          <span class="cha-chip">${escapeHtml(p.tipo || "preparo")}</span>
        </div>

        <div class="cha-grid">
          <div>
            <div class="cha-label">Preparo</div>
            <ul>
              <li><b>Quantidade:</b> ${escapeHtml(p.quantidade || "—")}</li>
              <li><b>Água:</b> ${escapeHtml(String(p.agua_ml || "—"))} ml</li>
              <li><b>Tempo:</b> ${escapeHtml(String(p.tempo_min || "—"))} min</li>
              <li><b>Como fazer:</b> ${escapeHtml(p.como || "—")}</li>
            </ul>
          </div>
          <div>
            <div class="cha-label">Dose sugerida</div>
            <p>${escapeHtml(cha.dose || "—")}</p>

            <div class="cha-label">Alertas</div>
            <ul>
              ${cautions}
              ${alerts || "<li>—</li>"}
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  function buildCopy(objName, cards, meta) {
    const lines = [];
    lines.push(`🌿 Chá seguro — objetivo: ${objName}`);
    lines.push("");

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

  function generate(data) {
    const objetivoKey = el("chaObjetivo").value;
    const obj = data.objetivos[objetivoKey];

    const ctx = {
      idade: el("chaIdade").value, // lt1, kid, adult
      gravidez: el("chaGravidez").checked,
      pressaoAlta: el("chaPressao").checked,
      antidepressivo: el("chaAntiDep").checked,
      anticoagulante: el("chaAntiCoag").checked
    };

    el("chaDesc").textContent = obj?.descricao || "";

    // filtra por objetivo e restrições
    const pool = data["chás"]
      .filter(c => (c.objetivos || []).includes(objetivoKey))
      .filter(c => isAllowed(c, ctx));

    if (!pool.length) {
      el("chaResultado").innerHTML = `
        <div class="cha-empty">
          Não encontrei uma opção segura com esses filtros.
          <br><br>
          <b>Dica:</b> desmarque algum filtro (se for o caso) ou procure orientação profissional.
        </div>
      `;
      el("chaCopy").dataset.copy = "";
      return;
    }

    const picks = pickN(pool, 3);
    el("chaResultado").innerHTML = picks.map(c => renderCard(c, ctx)).join("");

    const copyText = buildCopy(obj?.nome || objetivoKey, picks, data.meta);
    el("chaCopy").dataset.copy = copyText;
  }

  async function init() {
    try {
      setStatus("Carregando…");
      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao carregar o banco de chás.");
      const data = await res.json();

      // monta selects
      const objSel = el("chaObjetivo");
      objSel.innerHTML = "";
      Object.keys(data.objetivos).forEach(k => {
        const opt = document.createElement("option");
        opt.value = k;
        opt.textContent = data.objetivos[k].nome;
        objSel.appendChild(opt);
      });

      // eventos
      el("chaGerar").addEventListener("click", () => generate(data));
      objSel.addEventListener("change", () => generate(data));

      ["chaIdade","chaGravidez","chaPressao","chaAntiDep","chaAntiCoag"].forEach(id=>{
        el(id).addEventListener("change", () => generate(data));
      });

      el("chaCopiar").addEventListener("click", async () => {
        const text = el("chaCopy").dataset.copy || "";
        if (!text) return;
        await copyToClipboard(text);
        setStatus("Copiado ✅");
        setTimeout(() => setStatus(""), 1200);
      });

      // disclaimer
      el("chaDisclaimer").textContent = data.meta?.disclaimer || "";

      // primeiro render
      generate(data);
      setStatus("");
    } catch (e) {
      console.error(e);
      setStatus("Erro: " + (e.message || e));
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
