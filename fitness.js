(function () {
  "use strict";

  // DEBUG (se precisar, descomente)
  // console.log("PSB Fitness JS carregou!");
  // console.log("JSON URL:", window.PSB_FITNESS_JSON_URL);

  function $(id) { return document.getElementById(id); }

  function round(n, d) {
    if (typeof n !== "number" || !isFinite(n)) return null;
    var p = Math.pow(10, d || 2);
    return Math.round(n * p) / p;
  }

  function clamp(n, min, max) {
    n = Number(n);
    if (!isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  var cfg = null;
  var JSON_URL = (typeof window.PSB_FITNESS_JSON_URL === "string") ? window.PSB_FITNESS_JSON_URL : "";

  function safeGet(obj, path, fallback) {
    try {
      var cur = obj;
      for (var i = 0; i < path.length; i++) {
        if (cur == null) return fallback;
        cur = cur[path[i]];
      }
      return (cur == null ? fallback : cur);
    } catch (e) {
      return fallback;
    }
  }

  function classifyIMC(imc, faixas) {
    if (!Array.isArray(faixas) || !faixas.length) {
      return { titulo: "—", recomendacao: "" };
    }
    for (var i = 0; i < faixas.length; i++) {
      var f = faixas[i];
      if (imc >= f.min && imc <= f.max) return f;
    }
    return faixas[faixas.length - 1];
  }

  function calcIMC(peso, alturaCm) {
    var h = Number(alturaCm) / 100;
    return Number(peso) / (h * h);
  }

  function calcPesoIdealRange(alturaCm, imcMin, imcMax) {
    var alturaNum = Number(alturaCm);
    if (!isFinite(alturaNum) || alturaNum <= 0) return null;

    var min = (isFinite(Number(imcMin)) && Number(imcMin) > 0) ? Number(imcMin) : 18.5;
    var max = (isFinite(Number(imcMax)) && Number(imcMax) > 0) ? Number(imcMax) : 24.9;

    var h = alturaNum / 100;
    return { min: min * (h * h), max: max * (h * h) };
  }

  function calcAguaLitros(peso, mlPorKg) {
    var p = Number(peso);
    var ml = Number(mlPorKg);
    if (!isFinite(p) || !isFinite(ml)) return null;
    return (p * ml) / 1000;
  }

  function calcTMB(peso, alturaCm, idade, sexo) {
    // Mifflin-St Jeor
    var w = Number(peso), h = Number(alturaCm), a = Number(idade);
    if (!isFinite(w) || !isFinite(h) || !isFinite(a)) return null;

    var base = (10 * w) + (6.25 * h) - (5 * a);
    return (sexo === "masculino") ? (base + 5) : (base - 161);
  }

  function pickFactorByDays(dias, mapa) {
    dias = clamp(dias, 0, 7);
    if (Array.isArray(mapa)) {
      for (var i = 0; i < mapa.length; i++) {
        var m = mapa[i];
        if (dias >= m.min_dias && dias <= m.max_dias) return m;
      }
    }
    return { factor: 1.2, label: "Sedentario" };
  }

  function calcCaloriesByMET(met, peso, minutos) {
    var M = Number(met), W = Number(peso), T = Number(minutos);
    if (!isFinite(M) || !isFinite(W) || !isFinite(T)) return null;
    // kcal = MET * 3.5 * peso_kg / 200 * minutos
    return M * 3.5 * W / 200 * T;
  }

  function buildKPI(title, value) {
    return '<div class="psb-kpi"><b>' + title + '</b><span>' + value + '</span></div>';
  }

  function renderTreino(nivel) {
    var arr = safeGet(cfg, ["fitness", "treinos_casa", nivel], []);
    if (!Array.isArray(arr) || !arr.length) return "<p>—</p>";

    var html = "<ul>";
    for (var i = 0; i < arr.length; i++) {
      var t = arr[i] || {};
      html += "<li><b>" + (t.label || "Exercicio") + ":</b> " + (t.series || 1) + "x " + (t.reps || "—") + "</li>";
    }
    html += "</ul>";
    return html;
  }

  function pickMotiv() {
    var m = safeGet(cfg, ["fitness", "motivacao"], []);
    if (!Array.isArray(m) || !m.length) return "";
    return m[Math.floor(Math.random() * m.length)];
  }

  function fillActivities() {
    var sel = $("psbAtv");
    if (!sel) return;

    var list = safeGet(cfg, ["fitness", "calorias_atividades", "atividades"], []);
    if (!Array.isArray(list) || !list.length) {
      sel.innerHTML = '<option value="">—</option>';
      return;
    }

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

        if ($("psbTitle")) $("psbTitle").textContent = safeGet(data, ["fitness", "meta", "titulo"], "Calculadora Fitness");
        if ($("psbDesc")) $("psbDesc").textContent = safeGet(data, ["fitness", "meta", "descricao"], "");

        fillActivities();
        restoreLast();
      })
      .catch(function (e) {
        if ($("psbDesc")) $("psbDesc").textContent = "Nao consegui carregar o JSON. Verifique o link RAW do GitHub.";
        // console.error(e);
      });
  }

  function calcular() {
    if (!cfg) return;

    var peso = Number($("psbPeso").value);
    var alturaCm = Number($("psbAltura").value);
    var idade = Number($("psbIdade").value);
    var sexo = $("psbSexo").value;
    var nivel = $("psbNivel").value;
    var dias = Number($("psbDias").value);
    var tempo = Number($("psbTempo").value);
    var objetivo = $("psbObj").value;

    if (!isFinite(peso) || !isFinite(alturaCm) || !isFinite(idade) || peso <= 0 || alturaCm <= 0 || idade <= 0) {
      alert("Preencha peso, altura e idade.");
      return;
    }

    // validações firmes (evita cm vs metros)
    if (alturaCm < 80 || alturaCm > 250) {
      alert("Altura invalida. Use cm (ex: 172).");
      return;
    }
    if (peso < 20 || peso > 400) {
      alert("Peso invalido. Ex: 78.5");
      return;
    }
    if (idade < 10 || idade > 90) {
      alert("Idade invalida.");
      return;
    }

    dias = clamp(dias, 0, 7);
    tempo = clamp(tempo, 0, 180);

    // IMC
    var imc = calcIMC(peso, alturaCm);
    var imcFaixas = safeGet(cfg, ["fitness", "imc", "faixas"], []);
    var faixa = classifyIMC(imc, imcFaixas);

    // Peso ideal (com fallback)
    var pesoIdealCfg = safeGet(cfg, ["fitness", "peso_ideal"], {});
    var pi = calcPesoIdealRange(alturaCm, pesoIdealCfg.imc_min, pesoIdealCfg.imc_max);

    // Agua
    var mlPorKg = safeGet(cfg, ["fitness", "agua", "ml_por_kg"], 35);
    var aguaL = calcAguaLitros(peso, mlPorKg);

    // TMB / TDEE
    var tmb = calcTMB(peso, alturaCm, idade, sexo);
    var mapa = safeGet(cfg, ["fitness", "tdee", "mapa_por_dias_treino"], []);
    var fatorObj = pickFactorByDays(dias, mapa);
    var tdee = (tmb != null) ? (tmb * Number(fatorObj.factor || 1.2)) : null;

    // Objetivo kcal
    var regras = safeGet(cfg, ["fitness", "objetivo_kcal", "regras"], {});
    var regra = regras[objetivo] || regras.manter || { ajuste_kcal_dia: 0, texto: "" };
    var ajuste = Number(regra.ajuste_kcal_dia || 0);

    var metaKcal = (tdee != null) ? (tdee + ajuste) : null;

    // deficit positivo = emagrecimento
    var limites = safeGet(cfg, ["fitness", "objetivo_kcal", "limites_deficit_dia"], { min: -900, max: 900 });
    var kcalPorKg = safeGet(cfg, ["fitness", "objetivo_kcal", "kcal_por_kg"], 7700);

    var deficitDia = (tdee != null && metaKcal != null) ? (tdee - metaKcal) : null;
    if (deficitDia != null) deficitDia = clamp(deficitDia, Number(limites.min || -900), Number(limites.max || 900));

    var kgMes = (deficitDia != null) ? ((deficitDia * 7) / kcalPorKg) * 4.3 : null;

    // KPIs (sem mostrar 0 quando invalido)
    var imcR = round(imc, 2);
    var aguaR = (aguaL != null) ? round(aguaL, 2) : null;
    var tmbR = (tmb != null) ? Math.round(tmb) : null;
    var tdeeR = (tdee != null) ? Math.round(tdee) : null;
    var defR = (deficitDia != null) ? Math.round(deficitDia) : null;
    var kgMesR = (kgMes != null) ? round(kgMes, 2) : null;

    var pesoIdealText = "—";
    if (pi) {
      var pimin = round(pi.min, 1);
      var pimax = round(pi.max, 1);
      if (pimin != null && pimax != null && pimin > 0 && pimax > 0) {
        pesoIdealText = pimin + " a " + pimax + " kg";
      }
    }

    var kpisHtml =
      buildKPI("IMC", (imcR != null ? imcR : "—")) +
      buildKPI("Classificacao", (faixa && faixa.titulo ? faixa.titulo : "—")) +
      buildKPI("Peso ideal", pesoIdealText) +
      buildKPI("Agua/dia", (aguaR != null ? (aguaR + " L") : "—")) +
      buildKPI("TMB", (tmbR != null ? (tmbR + " kcal") : "—")) +
      buildKPI("Gasto diario", (tdeeR != null ? (tdeeR + " kcal (" + (fatorObj.label || "—") + ")") : "—")) +
      buildKPI("Deficit/dia", (defR != null ? (defR + " kcal") : "—")) +
      buildKPI("Est. kg/mes", (kgMesR != null ? (kgMesR + " kg") : "—"));

    if ($("psbKpis")) $("psbKpis").innerHTML = kpisHtml;

    // recomendacao
    var rec = (faixa && faixa.recomendacao) ? faixa.recomendacao : "";
    var rec2 = (regra && regra.texto) ? regra.texto : "";
    if ($("psbRecom")) $("psbRecom").textContent = (rec + " " + rec2).trim();

    // treino / habitos / desafio / motivacao / avisos
    if ($("psbTreino")) $("psbTreino").innerHTML = renderTreino(nivel);

    var habitos = safeGet(cfg, ["fitness", "habitos_diarios"], []);
    if ($("psbHabitos")) $("psbHabitos").innerHTML = (Array.isArray(habitos) ? habitos : []).map(function (x) { return "<li>" + x + "</li>"; }).join("");

    var desafio = safeGet(cfg, ["fitness", "desafio_7_dias"], []);
    if ($("psbDesafio")) $("psbDesafio").innerHTML = (Array.isArray(desafio) ? desafio : []).map(function (x) {
      return "<li><b>Dia " + x.dia + ":</b> " + x.tarefa + "</li>";
    }).join("");

    if ($("psbMotiv")) $("psbMotiv").textContent = pickMotiv();

    var avisos = safeGet(cfg, ["fitness", "avisos", "texto"], []);
    if ($("psbWarn")) $("psbWarn").innerHTML =
      "<b>Avisos</b><ul style='margin:8px 0 0 18px'>" +
      (Array.isArray(avisos) ? avisos : []).map(function (x) { return "<li>" + x + "</li>"; }).join("") +
      "</ul>";

    if ($("psbResults")) $("psbResults").style.display = "block";

    // salvar
    try {
      localStorage.setItem("psb_fitness_last", JSON.stringify({
        peso: peso,
        alturaCm: alturaCm,
        idade: idade,
        sexo: sexo,
        nivel: nivel,
        dias: dias,
        tempo: tempo,
        objetivo: objetivo
      }));
    } catch (e) { }
  }

  function metaMensal() {
    if (!cfg) return;

    var peso = Number($("psbPeso").value);
    var alturaCm = Number($("psbAltura").value);
    var idade = Number($("psbIdade").value);
    var sexo = $("psbSexo").value;
    var dias = Number($("psbDias").value);

    if (!isFinite(peso) || !isFinite(alturaCm) || !isFinite(idade) || peso <= 0 || alturaCm <= 0 || idade <= 0) {
      alert("Preencha peso, altura e idade primeiro.");
      return;
    }

    if (alturaCm < 80 || alturaCm > 250) { alert("Altura invalida. Use cm (ex: 172)."); return; }
    if (peso < 20 || peso > 400) { alert("Peso invalido."); return; }

    var kg = Number($("psbMetaKg").value);
    var meses = Number($("psbMetaMeses").value);

    var lim = safeGet(cfg, ["fitness", "meta_mensal", "limites"], { kg_min: 1, kg_max: 40, meses_min: 1, meses_max: 24 });
    kg = clamp(kg, lim.kg_min, lim.kg_max);
    meses = clamp(meses, lim.meses_min, lim.meses_max);

    var tmb = calcTMB(peso, alturaCm, idade, sexo);
    var mapa = safeGet(cfg, ["fitness", "tdee", "mapa_por_dias_treino"], []);
    var fatorObj = pickFactorByDays(isNaN(dias) ? 0 : dias, mapa);
    var tdee = (tmb != null) ? (tmb * Number(fatorObj.factor || 1.2)) : null;

    var kcalPorKg = safeGet(cfg, ["fitness", "objetivo_kcal", "kcal_por_kg"], 7700);
    var kcalTotal = kg * kcalPorKg;
    var diasTot = meses * 30;

    var deficitDia = kcalTotal / diasTot;
    deficitDia = clamp(deficitDia, 100, 900);

    var metaKcalDia = (tdee != null) ? (tdee - deficitDia) : null;

    if ($("psbMetaOut")) {
      $("psbMetaOut").innerHTML =
        "Para perder <b>" + round(kg, 1) + "kg</b> em <b>" + meses + " meses</b>: deficit de <b>" + Math.round(deficitDia) + " kcal/dia</b>.<br>" +
        "Meta aproximada: <b>" + (metaKcalDia != null ? Math.round(metaKcalDia) : "—") + " kcal/dia</b> (estimativa).";
    }
  }

  function caloriasAtividade() {
    if (!cfg) return;

    var peso = Number($("psbPeso").value);
    if (!isFinite(peso) || peso <= 0) {
      alert("Preencha o peso para calcular calorias corretamente.");
      return;
    }

    var atvId = $("psbAtv").value;
    var min = Number($("psbAtvMin").value);
    min = clamp(min, 1, 240);

    var list = safeGet(cfg, ["fitness", "calorias_atividades", "atividades"], []);
    var atv = null;

    if (Array.isArray(list)) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === atvId) { atv = list[i]; break; }
      }
    }

    var met = atv ? Number(atv.met) : null;
    var total = (met != null) ? calcCaloriesByMET(met, peso, min) : null;

    if ($("psbAtvOut")) {
      $("psbAtvOut").innerHTML = (total != null)
        ? ("Estimativa: <b>" + Math.round(total) + " kcal</b> em " + min + " min (MET " + met + ").")
        : "—";
    }
  }

  function restoreLast() {
    try {
      var raw = localStorage.getItem("psb_fitness_last");
      if (!raw) return;
      var v = JSON.parse(raw);

      if ($("psbPeso")) $("psbPeso").value = (v.peso != null ? v.peso : "");
      if ($("psbAltura")) $("psbAltura").value = (v.alturaCm != null ? v.alturaCm : "");
      if ($("psbIdade")) $("psbIdade").value = (v.idade != null ? v.idade : "");
      if ($("psbSexo")) $("psbSexo").value = v.sexo || "masculino";
      if ($("psbNivel")) $("psbNivel").value = v.nivel || "iniciante";
      if ($("psbDias")) $("psbDias").value = (v.dias != null ? v.dias : 4);
      if ($("psbTempo")) $("psbTempo").value = (v.tempo != null ? v.tempo : 25);
      if ($("psbObj")) $("psbObj").value = v.objetivo || "perder_peso";
    } catch (e) { }
  }

  function reset() {
    if ($("psbPeso")) $("psbPeso").value = "";
    if ($("psbAltura")) $("psbAltura").value = "";
    if ($("psbIdade")) $("psbIdade").value = "";
    if ($("psbSexo")) $("psbSexo").value = "masculino";
    if ($("psbNivel")) $("psbNivel").value = "iniciante";
    if ($("psbDias")) $("psbDias").value = 4;
    if ($("psbTempo")) $("psbTempo").value = 25;
    if ($("psbObj")) $("psbObj").value = "perder_peso";

    if ($("psbResults")) $("psbResults").style.display = "none";
    if ($("psbMetaOut")) $("psbMetaOut").textContent = "";
    if ($("psbAtvOut")) $("psbAtvOut").textContent = "";

    try { localStorage.removeItem("psb_fitness_last"); } catch (e) { }
  }

  function bind() {
    if ($("psbCalc")) $("psbCalc").addEventListener("click", calcular);
    if ($("psbMetaCalc")) $("psbMetaCalc").addEventListener("click", metaMensal);
    if ($("psbAtvCalc")) $("psbAtvCalc").addEventListener("click", caloriasAtividade);
    if ($("psbReset")) $("psbReset").addEventListener("click", reset);
  }

  document.addEventListener("DOMContentLoaded", function () {
    bind();
    loadCfg();
  });
})();
