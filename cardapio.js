(function () {
  // 1) COLE AQUI o link RAW do seu JSON no GitHub:
  // Exemplo:
  // const DATA_URL = "https://raw.githubusercontent.com/SEU_USUARIO/SEU_REPO/main/cardapios.json";
  const DATA_URL = "https://raw.githubusercontent.com/emersonalvestz34-tech/cardapios.json/refs/heads/main/cardapios.json";

  const el = (id) => document.getElementById(id);

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
    const subs = (mealObj.substituicoes || []).map((x) => `<li>${escapeHtml(x)}</li>`).join("");

    return `
      <div class="psb-meal">
        <h4>${escapeHtml(title)}: <span>${escapeHtml(mealObj.titulo || "")}</span></h4>
        <div class="psb-cols">
          <div>
            <div class="psb-label">O que entra</div>
            <ul>${items}</ul>
          </div>
          <div>
            <div class="psb-label">Substituições</div>
            <ul>${subs || "<li>—</li>"}</ul>
          </div>
        </div>
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

  function generateCardapio(data) {
    const formatos = data.formatos;
    const key = el("psbFormato").value;
    const f = formatos[key];

    el("psbDesc").textContent = f.descricao || "";

    const r = f.refeicoes;
    const cafe = pickRandom(r.cafe);
    const almoco = pickRandom(r.almoco);
    const lanche = pickRandom(r.lanche);
    const jantar = pickRandom(r.jantar);

    const html = `
      ${renderMeal("Café", cafe)}
      ${renderMeal("Almoço", almoco)}
      ${renderMeal("Lanche", lanche)}
      ${renderMeal("Jantar", jantar)}
      <div class="psb-footnote">${escapeHtml(data.meta?.aviso || "")}</div>
    `;

    el("psbResultado").innerHTML = html;

    // Texto para copiar
    const copyText =
`🍽️ Cardápio do Dia — ${f.nome}

☕ Café: ${cafe.titulo}
- ${cafe.itens.join(", ")}

🍛 Almoço: ${almoco.titulo}
- ${almoco.itens.join(", ")}

🍌 Lanche: ${lanche.titulo}
- ${lanche.itens.join(", ")}

🌙 Jantar: ${jantar.titulo}
- ${jantar.itens.join(", ")}

Obs.: ${data.meta?.aviso || ""}`.trim();

    el("psbCopy").dataset.copy = copyText;
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    // fallback
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

  async function init() {
    try {
      el("psbStatus").textContent = "Carregando…";

      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao baixar JSON. Confira o link RAW.");
      const data = await res.json();

      buildSelect(data.formatos);

      el("psbGerar").addEventListener("click", () => generateCardapio(data));
      el("psbFormato").addEventListener("change", () => generateCardapio(data));
      el("psbCopiar").addEventListener("click", async () => {
        const text = el("psbCopy").dataset.copy || "";
        await copyToClipboard(text);
        el("psbStatus").textContent = "Copiado ✅";
        setTimeout(() => (el("psbStatus").textContent = ""), 1500);
      });

      generateCardapio(data);
      el("psbStatus").textContent = "";
    } catch (e) {
      el("psbStatus").textContent = "Erro: " + (e.message || e);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();

