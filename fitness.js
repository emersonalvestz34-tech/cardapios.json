(function () {
  "use strict";

  // VOCE VAI DEFINIR ISSO NO HTML DO BLOGGER:
  // var PSB_FITNESS_JSON_URL = "https://raw.githubusercontent.com/.../fitness.json";

  function $(id) { return document.getElementById(id); }
  function round(n, d) {   if (typeof n !== "number" || !isFinite(n)) return null;   var p = Math.pow(10, d || 2);   return Math.round(n * p) / p; }{ var p = Math.pow(10, d || 2); return Math.round(n * p) / p; }
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
      return;
    }

    dias = isNaN(dias) ? 0 : dias;
    tempo = isNaN(tempo) ? 0 : tempo;

    var imc = calcIMC(peso, alturaCm);
    var faixa = classifyIMC(imc, cfg.fitness.imc.faixas);

    var pi = calcPesoIdealRange(alturaCm, cfg.fitness.peso_ideal.imc_min, cfg.fitness.peso_ideal.imc_max);

    var aguaL = calcAguaLitros(peso, cfg.fitness.agua.ml_por_kg);

    var tmb = calcTMB(peso, alturaCm, idade, sexo);
    var fatorObj = pickFactorByDays(dias, cfg.fitness.tdee.mapa_por_dias_treino);
    var tdee = tmb * fatorObj.factor;

    var regra = cfg.fitness.objetivo_kcal.regras[objetivo] || cfg.fitness.objetivo_kcal.regras.manter;
    var metaKcal = tdee + regra.ajuste_kcal_dia;

    // deficit positivo = emagrecimento
    var deficitDia = tdee - metaKcal;
    deficitDia = clamp(deficitDia, cfg.fitness.objetivo_kcal.limites_deficit_dia.min, cfg.fitness.objetivo_kcal.limites_deficit_dia.max);

    var kgSemana = (deficitDia * 7) / cfg.fitness.objetivo_kcal.kcal_por_kg;
    var kgMes = kgSemana * 4.3;

    // estimativa treino semanal usando MET medio (nao e regra, e so informativo)
    var metMedioTreino = 5.0;
    var kcalTreinoSemana = Math.round(calcCaloriesByMET(metMedioTreino, peso, Math.max(0, tempo) * Math.max(0, dias)));

    $("psbKpis").innerHTML =
      buildKPI("IMC", round(imc, 2)) +
      buildKPI("Classificacao", faixa.titulo) +
      buildKPI("Peso ideal", round(pi.min, 1) + " a " + round(pi.max, 1) + " kg") +
      buildKPI("Agua/dia", round(aguaL, 2) + " L") +
      buildKPI("TMB", Math.round(tmb) + " kcal") +
      buildKPI("Gasto diario", Math.round(tdee) + " kcal (" + fatorObj.label + ")") +
      buildKPI("Deficit/dia", Math.round(deficitDia) + " kcal") +
      buildKPI("Est. kg/mes", round(kgMes, 2) + " kg");

    $("psbRecom").textContent = faixa.recomendacao + " " + (regra.texto || "");
    $("psbTreino").innerHTML = renderTreino(nivel);

    var h = cfg.fitness.habitos_diarios || [];
    $("psbHabitos").innerHTML = h.map(function (x) { return "<li>" + x + "</li>"; }).join("");

    var d = cfg.fitness.desafio_7_dias || [];
    $("psbDesafio").innerHTML = d.map(function (x) { return "<li><b>Dia " + x.dia + ":</b> " + x.tarefa + "</li>"; }).join("");

    $("psbMotiv").textContent = pickMotiv();

    var a = (cfg.fitness.avisos && cfg.fitness.avisos.texto) ? cfg.fitness.avisos.texto : [];
    $("psbWarn").innerHTML = "<b>Avisos</b><ul style='margin:8px 0 0 18px'>" + a.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>";

    $("psbResults").style.display = "block";

    try {
      localStorage.setItem("psb_fitness_last", JSON.stringify({
        peso: peso, alturaCm: alturaCm, idade: idade, sexo: sexo, nivel: nivel, dias: dias, tempo: tempo, objetivo: objetivo
      }));
    } catch (e) { }
  }

  function metaMensal() {
    if (!cfg) return;

    var peso = parseFloat($("psbPeso").value);
    var alturaCm = parseFloat($("psbAltura").value);
    var idade = parseInt($("psbIdade").value, 10);
    var sexo = $("psbSexo").value;
    var dias = parseInt($("psbDias").value, 10);

    if (!peso || !alturaCm || !idade) {
      alert("Preencha peso, altura e idade primeiro.");
      return;
    }

    var kg = parseFloat($("psbMetaKg").value);
    var meses = parseInt($("psbMetaMeses").value, 10);

    var lim = cfg.fitness.meta_mensal.limites;
    kg = clamp(kg, lim.kg_min, lim.kg_max);
    meses = clamp(meses, lim.meses_min, lim.meses_max);

    var tmb = calcTMB(peso, alturaCm, idade, sexo);
    var fatorObj = pickFactorByDays(isNaN(dias) ? 0 : dias, cfg.fitness.tdee.mapa_por_dias_treino);
    var tdee = tmb * fatorObj.factor;

    var kcalTotal = kg * cfg.fitness.objetivo_kcal.kcal_por_kg;
    var diasTot = meses * 30;
    var deficitDia = kcalTotal / diasTot;

    deficitDia = clamp(deficitDia, 100, 900);
    var metaKcalDia = tdee - deficitDia;

    $("psbMetaOut").innerHTML =
      "Para perder <b>" + round(kg, 1) + "kg</b> em <b>" + meses + " meses</b>: deficit de <b>" + Math.round(deficitDia) + " kcal/dia</b>.<br>" +
      "Meta aproximada: <b>" + Math.round(metaKcalDia) + " kcal/dia</b> (estimativa).";
  }

  function caloriasAtividade() {
    if (!cfg) return;

    var peso = parseFloat($("psbPeso").value);
    if (!peso) {
      alert("Preencha o peso para calcular calorias corretamente.");
      return;
    }

    var atvId = $("psbAtv").value;
    var min = parseInt($("psbAtvMin").value, 10);

    var list = (cfg.fitness.calorias_atividades && cfg.fitness.calorias_atividades.atividades) ? cfg.fitness.calorias_atividades.atividades : [];
    var atv = null;
    for (var i = 0; i < list.length; i++) { if (list[i].id === atvId) { atv = list[i]; break; } }
    var met = atv ? atv.met : 0;

    var total = Math.round(calcCaloriesByMET(met, peso, Math.max(1, min)));
    $("psbAtvOut").innerHTML = "Estimativa: <b>" + total + " kcal</b> em " + min + " min (MET " + met + ").";
  }

  function restoreLast() {
    try {
      var raw = localStorage.getItem("psb_fitness_last");
      if (!raw) return;
      var v = JSON.parse(raw);
      $("psbPeso").value = v.peso || "";
      $("psbAltura").value = v.alturaCm || "";
      $("psbIdade").value = v.idade || "";
      $("psbSexo").value = v.sexo || "masculino";
      $("psbNivel").value = v.nivel || "iniciante";
      $("psbDias").value = (v.dias != null ? v.dias : 4);
      $("psbTempo").value = (v.tempo != null ? v.tempo : 25);
      $("psbObj").value = v.objetivo || "perder_peso";
    } catch (e) { }
  }

  function reset() {
    $("psbPeso").value = "";
    $("psbAltura").value = "";
    $("psbIdade").value = "";
    $("psbSexo").value = "masculino";
    $("psbNivel").value = "iniciante";
    $("psbDias").value = 4;
    $("psbTempo").value = 25;
    $("psbObj").value = "perder_peso";
    $("psbResults").style.display = "none";
    $("psbMetaOut").textContent = "";
    $("psbAtvOut").textContent = "";
    try { localStorage.removeItem("psb_fitness_last"); } catch (e) { }
  }

  function bind() {
    if ($("psbCalc")) $("psbCalc").addEventListener("click", calcular);
    if ($("psbMetaCalc")) $("psbMetaCalc").addEventListener("click", metaMensal);
    if ($("psbAtvCalc")) $("psbAtvCalc").addEventListener("click", caloriasAtividade);
    if ($("psbReset")) $("psbReset").addEventListener("click", reset);
  }

  // init
  document.addEventListener("DOMContentLoaded", function () {
    bind();
    loadCfg();
  });
})();
