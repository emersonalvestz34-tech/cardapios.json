console.log("CARDAPIO TURBINADO v7 carregou ✅");
(function () {

  const DATA_URL = "https://cdn.jsdelivr.net/gh/emersonalvestz34-tech/cardapios.json@main/cardapios.json";

  const el = (id) => document.getElementById(id);
  let lastGenerated = null;

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function renderMeal(title, mealObj) {
    return `
      <div class="psb-meal">
        <h4>${title}: <span>${mealObj.titulo}</span></h4>
        <ul>${mealObj.itens.map(i => `<li>${i}</li>`).join("")}</ul>
      </div>
    `;
  }

  function generateDay(data) {
    const key = el("psbFormato").value;
    const f = data.formatos[key];
    const r = f.refeicoes;

    const day = {
      nome: f.nome,
      cafe: pickRandom(r.cafe),
      almoco: pickRandom(r.almoco),
      lanche: pickRandom(r.lanche),
      jantar: pickRandom(r.jantar)
    };

    lastGenerated = { tipo: "dia", conteudo: day };
    localStorage.setItem("psbCardapio", JSON.stringify(lastGenerated));

    renderDay(day);
  }

  function renderDay(day) {
    el("psbResultado").innerHTML = `
      ${renderMeal("☕ Café", day.cafe)}
      ${renderMeal("🍛 Almoço", day.almoco)}
      ${renderMeal("🍌 Lanche", day.lanche)}
      ${renderMeal("🌙 Jantar", day.jantar)}
    `;
  }

  function generateWeek(data) {
    const key = el("psbFormato").value;
    const f = data.formatos[key];
    const r = f.refeicoes;

    const week = [];

    for (let i = 0; i < 7; i++) {
      week.push({
        cafe: pickRandom(r.cafe),
        almoco: pickRandom(r.almoco),
        lanche: pickRandom(r.lanche),
        jantar: pickRandom(r.jantar)
      });
    }

    lastGenerated = { tipo: "semana", conteudo: week };
    localStorage.setItem("psbCardapio", JSON.stringify(lastGenerated));

    renderWeek(week);
  }

  function renderWeek(week) {
    el("psbResultado").innerHTML = week.map((day, i) => `
      <div class="psb-week">
        <h3>📅 Dia ${i + 1}</h3>
        ${renderMeal("☕ Café", day.cafe)}
        ${renderMeal("🍛 Almoço", day.almoco)}
        ${renderMeal("🍌 Lanche", day.lanche)}
        ${renderMeal("🌙 Jantar", day.jantar)}
      </div>
    `).join("");
  }

  function generateShoppingList() {
    if (!lastGenerated) return;

    let items = [];

    if (lastGenerated.tipo === "dia") {
      Object.values(lastGenerated.conteudo).forEach(meal => {
        if (meal.itens) items.push(...meal.itens);
      });
    } else {
      lastGenerated.conteudo.forEach(day => {
        Object.values(day).forEach(meal => {
          items.push(...meal.itens);
        });
      });
    }

    const unique = [...new Set(items)];

    el("psbResultado").innerHTML = `
      <div class="psb-shopping">
        <h3>🛒 Lista de Compras</h3>
        <ul>${unique.map(i => `<li>${i}</li>`).join("")}</ul>
      </div>
    `;
  }

  function loadSaved() {
    const saved = localStorage.getItem("psbCardapio");
    if (!saved) return;

    const data = JSON.parse(saved);
    lastGenerated = data;

    if (data.tipo === "dia") renderDay(data.conteudo);
    if (data.tipo === "semana") renderWeek(data.conteudo);
  }

  async function init() {
    const res = await fetch(DATA_URL);
    const data = await res.json();

    const select = el("psbFormato");
    Object.keys(data.formatos).forEach(key => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = data.formatos[key].nome;
      select.appendChild(opt);
    });

    el("psbGerar").onclick = () => generateDay(data);
    el("psbSemana").onclick = () => generateWeek(data);
    el("psbLista").onclick = () => generateShoppingList();

    loadSaved();
  }

  document.addEventListener("DOMContentLoaded", init);

})();

