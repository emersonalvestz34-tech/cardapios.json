(function () {
  const DATA_URL = "https://cdn.jsdelivr.net/gh/emersonalvestz34-tech/cardapios.json@main/cardapios.json?v=7";
  const el = (id) => document.getElementById(id);
  let lastGenerated = null;
  let dataCache = null;

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function renderDay(f, day) {
    el("psbDesc").textContent = f.descricao || "";
    el("psbResultado").innerHTML = `
      <div class="psb-meal"><h4>☕ Café: <span>${day.cafe.titulo}</span></h4><ul>${day.cafe.itens.map(i=>`<li>${i}</li>`).join("")}</ul></div>
      <div class="psb-meal"><h4>🍛 Almoço: <span>${day.almoco.titulo}</span></h4><ul>${day.almoco.itens.map(i=>`<li>${i}</li>`).join("")}</ul></div>
      <div class="psb-meal"><h4>🍌 Lanche: <span>${day.lanche.titulo}</span></h4><ul>${day.lanche.itens.map(i=>`<li>${i}</li>`).join("")}</ul></div>
      <div class="psb-meal"><h4>🌙 Jantar: <span>${day.jantar.titulo}</span></h4><ul>${day.jantar.itens.map(i=>`<li>${i}</li>`).join("")}</ul></div>
      <div class="psb-footnote">${dataCache?.meta?.aviso || ""}</div>
    `;
  }

  function generateDay() {
    const key = el("psbFormato").value;
    const f = dataCache.formatos[key];
    const r = f.refeicoes;

    const day = { cafe: pick(r.cafe), almoco: pick(r.almoco), lanche: pick(r.lanche), jantar: pick(r.jantar) };
    lastGenerated = { tipo: "dia", key, conteudo: day };
    localStorage.setItem("psbCardapio", JSON.stringify(lastGenerated));
    renderDay(f, day);
  }

  function generateWeek() {
    const key = el("psbFormato").value;
    const f = dataCache.formatos[key];
    const r = f.refeicoes;

    const week = Array.from({ length: 7 }).map(() => ({
      cafe: pick(r.cafe), almoco: pick(r.almoco), lanche: pick(r.lanche), jantar: pick(r.jantar)
    }));

    lastGenerated = { tipo: "semana", key, conteudo: week };
    localStorage.setItem("psbCardapio", JSON.stringify(lastGenerated));

    el("psbDesc").textContent = f.descricao || "";
    el("psbResultado").innerHTML = week.map((d,i)=>`
      <div class="psb-meal" style="border-style:dashed">
        <h4>📅 Dia ${i+1}</h4>
        <p><b>☕ Café:</b> ${d.cafe.titulo}</p>
        <p><b>🍛 Almoço:</b> ${d.almoco.titulo}</p>
        <p><b>🍌 Lanche:</b> ${d.lanche.titulo}</p>
        <p><b>🌙 Jantar:</b> ${d.jantar.titulo}</p>
      </div>
    `).join("") + `<div class="psb-footnote">${dataCache?.meta?.aviso || ""}</div>`;
  }

  function shoppingList() {
    if (!lastGenerated) return;

    let items = [];
    if (lastGenerated.tipo === "dia") {
      const d = lastGenerated.conteudo;
      items = [...d.cafe.itens, ...d.almoco.itens, ...d.lanche.itens, ...d.jantar.itens];
    } else {
      lastGenerated.conteudo.forEach(d => {
        items.push(...d.cafe.itens, ...d.almoco.itens, ...d.lanche.itens, ...d.jantar.itens);
      });
    }
    const unique = Array.from(new Set(items.map(x => String(x).trim()).filter(Boolean)));

    el("psbResultado").innerHTML = `
      <div class="psb-meal">
        <h4>🛒 Lista de Compras</h4>
        <ul>${unique.map(i=>`<li>${i}</li>`).join("")}</ul>
      </div>
      <div class="psb-footnote">${dataCache?.meta?.aviso || ""}</div>
    `;
  }

  async function init() {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    dataCache = await res.json();

    const select = el("psbFormato");
    select.innerHTML = "";
    Object.keys(dataCache.formatos).forEach(k => {
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = dataCache.formatos[k].nome;
      select.appendChild(opt);
    });

    el("psbGerar").addEventListener("click", generateDay);
    el("psbSemana").addEventListener("click", generateWeek);
    el("psbLista").addEventListener("click", shoppingList);

    generateDay();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
