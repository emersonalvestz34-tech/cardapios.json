(function () {
  "use strict";

  // VOCE VAI DEFINIR ISSO NO HTML DO BLOGGER:
  // var PSB_FITNESS_JSON_URL = "https://raw.githubusercontent.com/.../fitness.json";

  function $(id) { return document.getElementById(id); }
  function round(n, d) { var p = Math.pow(10, d || 2); return Math.round(n * p) / p; }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  var cfg = null;
  var JSON_URL = (typeof window.PSB_FITNESS_JSON_URL === "string") ? window.PSB_FITNESS_JSON_URL : "";

  function classifyIMC(imc, faixas) {
    for (var i = 0; i < faixas.length; i++) {
      var f = faixas[i];
      if (imc >= f.min && imc <= f.max) return f;
    }
    return faixas[faixas.length - 1];
  }

  function calcIMC(peso, alturaCm) {
    var h = alturaCm / 100;
    return peso / (h * h);
  }

  function calcPesoIdealRange(alturaCm, imcMin, imcMax) {
    var h = alturaCm / 100;
    return { min: imcMin * (h * h), max: imcMax * (h * h) };
  }

  function calcAguaLitros(peso, mlPorKg) {
    return (peso * mlPorKg) / 1000;
  }

  function calcTMB(peso, alturaCm, idade, sexo) {
    // Mifflin-St Jeor
    var base = (10 * peso) + (6.25 * alturaCm) - (5 * idade);
    return (sexo === "masculino") ? (base + 5) : (base - 161);
  }

  function pickFactorByDays(dias, mapa) {
    dias = Math.max(0, Math.min(7, dias));
    for (var i = 0; i < mapa.length; i++) {
      var m = mapa[i];
      if (dias >= m.min_dias && dias <= m.max_dias) return m;
    }
    return { factor: 1.2, label: "Sedentario" };
  }

  function calcCaloriesByMET(met, peso, minutos) {
    // kcal = MET * 3.5 * peso_kg / 200 * minutos
    return met * 3.5 * peso / 200 * minutos;
  }

  function buildKPI(title, value) {
    return '<div class="psb-kpi"><b>' + title + '</b><span>' + value + '</span></div>';
  }

  function renderTreino(nivel) {
    var arr = (cfg.fitness.treinos_casa && cfg.fitness.treinos_casa[nivel]) ? cfg.fitness.treinos_casa[nivel] : [];
    var html = "<ul>";
    for (var i = 0; i < arr.length; i++) {
      var t = arr[i];
      html += "<li><b>" + t.label + ":</b> " + t.series + "x " + t.reps + "</li>";
    }
    html += "</ul>";
    return html;
  }

  function pickMotiv() {
    var m = (cfg.fitness.motivacao || []);
    if (!m.length) return "";
    return m[Math.floor(Math.random() * m.length)];
  }

  function fillActivities() {
    var sel = $("psbAtv");
    var list = (cfg.fitness.calorias_atividades && cfg.fitness.calorias_atividades.atividades) ? cfg.fitness.calorias_atividades.atividades : [];
    if (!sel) return;
    sel.innerHTML = list.map(function (a) {
      return '<option value="' + a.id + '">' + a.label + '</option>';
    }).join("");
  }

  function loadCfg() {
    if (!JSON_URL) {
      if ($("psbDesc")) $("psbDesc").textContent = "Faltou definir PSB_FITNESS_JSON_URL no HTML.";
      return Promise.resolve();
    }

    var u = JSON_URL + (JSON_URL.indexOf("?") > -1 ? "&" : "?") + "v=" + Date.now();
    return fetch(u, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("Erro ao carregar JSON"); return r.json(); })
      .then(function (data) {
        cfg = data;

        if ($("psbTitle")) $("psbTitle").textContent = data.fitness.meta.titulo || "Calculadora Fitness";
        if ($("psbDesc")) $("psbDesc").textContent = data.fitness.meta.descricao || "";

        fillActivities();
        restoreLast();
      })
      .catch(function () {
        if ($("psbDesc")) $("psbDesc").textContent = "Nao consegui carregar o JSON. Verifique o link RAW do GitHub.";
      });
  }

  function calcular() {
    if (!cfg) return;

    var peso = parseFloat($("psbPeso").value);
    var alturaCm = parseFloat($("psbAltura").value);
    var idade = parseInt($("psbIdade").value, 10);
    var sexo = $("psbSexo").value;
    var nivel = $("psbNivel").value;
    var dias = parseInt($("psbDias").value, 10);
    var tempo = parseInt($("psbTempo").value, 10);
    var objetivo = $("psbObj").value;

    if (!peso || !alturaCm || !idade) {
      alert("Preencha peso, altura e idade.");
