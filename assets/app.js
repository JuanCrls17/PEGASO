/* =========================================================
   app.js — PEGASO · SENAMHI · Escenarios de Cambio Climático
   Leaflet standalone, sin Streamlit
   ========================================================= */
"use strict";

// ─── Paletas de colores ────────────────────────────────────
const PREC_BINS   = [-999,-90,-75,-60,-45,-30,-15,0,15,30,45,60,75,90,999];
const PREC_COLORS = [
  "#663300","#7b4d1b","#916836","#a68351","#bc9d6d","#d2b888","#e7d3a3",
  "#c1f4db","#a1d4bf","#80b3a3","#609387","#40736b","#20534f","#003333"
];
const TEMP_BINS   = [-999,0.2,0.4,0.6,0.8,1.0,1.2,1.4,1.6,1.8,2.0,2.2,
                     2.4,2.6,2.8,3.0,3.2,3.4,3.6,3.8,999];
const TEMP_COLORS = [
  "#ffffcc","#fff7b9","#fff0a7","#ffe895","#fee983","#fed572","#fec460",
  "#feb44e","#fea446","#fd953f","#fd8038","#fc6531","#fb4b29","#f03523",
  "#e61f1d","#d7121f","#c70723","#b30026","#9a0026","#800026"
];

const NOMBRE_VARIABLE = {
  pr: "Precipitación", tasmax: "T° Máxima", tasmin: "T° Mínima", imc: "Índice Multipeligro",
};

const NOMBRE_REFERENCIA = {
  departamentos: "departamentos", provincias: "provincias", cuencas: "cuencas hidrográficas",
};

const IMC_COLORS = {
  "Muy Alto": "#d7191c",
  "Alto":     "#f7941d",
  "Medio":    "#f1dd00",
  "Bajo":     "#9bc68b",
};

// El amarillo y el verde del mapa no tienen contraste suficiente como
// texto sobre el fondo claro de la ficha: allí se usa una versión oscura.
const IMC_COLORS_TEXTO = {
  "Muy Alto": "#c0141a",
  "Alto":     "#c47410",
  "Medio":    "#8a7a00",
  "Bajo":     "#3f7d46",
};

const IMC_DESC = {
  "Muy Alto": "Este territorio tiene <strong>exposición crítica</strong> a múltiples peligros climáticos simultáneos. Se recomienda planificación urgente de adaptación.",
  "Alto":     "Alta concurrencia de amenazas climáticas. Requiere <strong>medidas de adaptación</strong> en los sectores más vulnerables.",
  "Medio":    "Exposición <strong>moderada</strong> a peligros climáticos. Monitoreo continuo y planificación preventiva recomendados.",
  "Bajo":     "Baja exposición relativa a peligros climáticos en comparación con otras zonas del país.",
};

// ─── Estado de la aplicación ──────────────────────────────
const state = {
  variable:  "pr",     // "pr" | "tasmax" | "tasmin" | "imc"
  estacion:  "anual",
  imcActive: false,
  imcTipo:   "agricola",
  refLayer:  "departamentos",
};

// ─── Capas Leaflet activas ────────────────────────────────
let climateLayer    = null;
let imcLayer        = null;
let refGeoLayer     = null;
let searchMarker    = null;
let selectedFeature = null;

const mapContainer = document.querySelector(".map-container");

// ─── Ámbito geográfico: Perú ──────────────────────────────
const PERU_BOUNDS = L.latLngBounds([-18.60, -81.60], [-0.02, -68.60]);

// ─── Inicializar mapa ─────────────────────────────────────
const map = L.map("map", {
  center: [-9.2, -75.1],
  zoom: 5,
  zoomControl: false,
  attributionControl: false,
  maxBoundsViscosity: 1.0,   // borde firme: no se puede arrastrar fuera del ámbito
  minZoom: 4,
  maxZoom: 14,
  zoomSnap: 0.25,            // el encuadre se ajusta con precisión a cada pantalla
  zoomDelta: 0.5,
  bounceAtZoomLimits: false,
});

const baseOSM = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 14,
  crossOrigin: true,
}).addTo(map);

// OpenStreetMap rechaza las peticiones sin Referer —abrir el archivo desde
// el disco—: en ese caso se cambia a una base equivalente.
let fallosBase = 0;
baseOSM.on("tileerror", () => {
  if (++fallosBase < 5 || map.hasLayer(baseOSM) === false) return;
  map.removeLayer(baseOSM);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd",
    maxZoom: 14,
    detectRetina: true,
    crossOrigin: true,
  }).addTo(map).bringToBack();
  const attr = document.querySelector(".footer-attr");
  if (attr) attr.textContent = "Base cartográfica © OpenStreetMap · © CARTO";
});

// El encuadre se recalcula según el tamaño real del contenedor para que el
// Perú se vea siempre completo. En relieve la perspectiva acerca la imagen
// y se compensa alejando un nivel, lo que además contiene las descargas.
function enRelieve() {
  return mapContainer.classList.contains("relieve");
}

function compensacionRelieve() {
  return enRelieve() ? 1 : 0;
}

function ajustarAmbito(reencuadrar) {
  map.invalidateSize({ animate: false });

  map.setMaxBounds(null);                       // se liberan los límites para medir
  const margen = window.innerWidth <= 768 ? 14 : 26;
  const compensa = compensacionRelieve();
  const zMin = map.getBoundsZoom(PERU_BOUNDS, false, [margen, margen]) - compensa - 0.5;

  map.setMinZoom(zMin);
  if (reencuadrar || map.getZoom() < zMin) {
    map.fitBounds(PERU_BOUNDS, { padding: [margen, margen], animate: false });
    if (compensa) map.setZoom(map.getZoom() - compensa, { animate: false });
  }

  aplicarLimitesNavegacion();
}

// Margen de desplazamiento: mayor en relieve, donde la inclinación reduce
// la superficie útil. Siempre incluye la vista actual.
function aplicarLimitesNavegacion() {
  const holgura = enRelieve() ? 1.6 : 0.7;
  const limites = PERU_BOUNDS.pad(holgura).extend(map.getBounds().pad(0.2));
  map.setMaxBounds(limites);
}

ajustarAmbito(true);

let resizeTimer = null;
function onViewportChange() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => ajustarAmbito(true), 180);
}
window.addEventListener("resize", onViewportChange);
window.addEventListener("orientationchange", () => setTimeout(onViewportChange, 250));

// ─── Zoom personalizado ───────────────────────────────────
document.getElementById("zoomIn").addEventListener("click",  () => map.zoomIn());
document.getElementById("zoomOut").addEventListener("click", () => map.zoomOut());

// ─── Indicador de carga ───────────────────────────────────
const loader     = document.getElementById("mapLoader");
const loaderText = document.getElementById("loaderTexto");

let cargasEnCurso = 0;

function showLoader(mensaje) {
  cargasEnCurso++;
  if (mensaje) loaderText.textContent = mensaje;
  loader.style.display = "flex";
}

function hideLoader() {
  cargasEnCurso = Math.max(0, cargasEnCurso - 1);
  if (!cargasEnCurso) loader.style.display = "none";
}

// ─── Helpers de color ─────────────────────────────────────
function getClimateColor(value, variable) {
  if (value == null) return "#cccccc";
  const v = parseFloat(value);
  if (isNaN(v)) return "#cccccc";
  const bins   = variable === "pr" ? PREC_BINS   : TEMP_BINS;
  const colors = variable === "pr" ? PREC_COLORS : TEMP_COLORS;
  for (let i = 0; i < bins.length - 1; i++) {
    if (v > bins[i] && v <= bins[i + 1]) return colors[i];
  }
  return "#cccccc";
}

function getImcColor(value) {
  if (value == null) return "#cccccc";
  const v = parseFloat(value);
  if (isNaN(v)) return "#cccccc";
  if (v >= 0.75) return IMC_COLORS["Muy Alto"];
  if (v >= 0.50) return IMC_COLORS["Alto"];
  if (v >= 0.25) return IMC_COLORS["Medio"];
  return IMC_COLORS["Bajo"];
}

function imcLabel(value) {
  const v = parseFloat(value);
  if (isNaN(v)) return "Sin dato";
  if (v >= 0.75) return "Muy Alto";
  if (v >= 0.50) return "Alto";
  if (v >= 0.25) return "Medio";
  return "Bajo";
}

// ─── Nombre de archivo GeoJSON ────────────────────────────
function climateFilename(variable, estacion) {
  const est = estacion === "anual" ? "anual" : estacion.toUpperCase();
  return `data/distritos_cambio_${variable}_${est}_cmip6_2036_2065_5km.geojson`;
}

function imcFilename(tipo) {
  return `data/indice_multipeligro_${tipo}_2036_2065.geojson`;
}

function refFilename(layer) {
  return `data/${layer}.geojson`;
}

// ─── Carga de GeoJSON con fetch ───────────────────────────
async function fetchGeoJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`No se encontró: ${path}`);
  return res.json();
}

// ─── Interpretaciones textuales ───────────────────────────
const VAR_INFO = {
  pr: {
    title: "Precipitación",
    desc: "Muestra el cambio porcentual proyectado en las lluvias para 2036–2065 respecto al período de referencia 1981–2010. Valores negativos indican reducción de lluvias; positivos, aumento.",
    sectores: ["Agua", "Agricultura", "Energía hidráulica", "Gestión de riesgos"],
  },
  tasmax: {
    title: "Temperatura Máxima",
    desc: "Cambio proyectado en la temperatura máxima diaria (°C). Refleja cuánto más calurosos serán los días más cálidos del año en el futuro.",
    sectores: ["Salud", "Agricultura", "Infraestructura", "Biodiversidad"],
  },
  tasmin: {
    title: "Temperatura Mínima",
    desc: "Cambio proyectado en la temperatura mínima diaria (°C). Afecta principalmente las heladas, la biodiversidad altoandina y los ciclos agrícolas.",
    sectores: ["Agricultura", "Ganadería", "Biodiversidad", "Energía"],
  },
  imc: {
    title: "Índice Multipeligro Climático",
    desc: "Combina múltiples amenazas climáticas (lluvias extremas, sequías, temperaturas) en un índice normalizado de 0 a 1. A mayor valor, mayor exposición simultánea a peligros.",
    sectores: ["Planificación territorial", "Gestión de riesgos", "Todos los sectores"],
  },
};

function climateInterpret(variable, valor) {
  if (valor == null) return null;
  const v = parseFloat(valor);
  if (isNaN(v)) return null;

  if (variable === "pr") {
    if (v <= -30) return { text: `Reducción <strong>severa</strong> de lluvias (${v.toFixed(1)}%). Alto riesgo de sequías prolongadas.`, color: "#a04000" };
    if (v <= -15) return { text: `Reducción <strong>moderada</strong> de lluvias (${v.toFixed(1)}%). Impacto relevante en disponibilidad hídrica.`, color: "#c07030" };
    if (v <    0) return { text: `Leve reducción de lluvias (${v.toFixed(1)}%). Monitoreo recomendado.`, color: "#888" };
    if (v <   15) return { text: `Leve aumento de lluvias (${v.toFixed(1)}%). Puede intensificar eventos locales.`, color: "#2a7a4a" };
    if (v <   30) return { text: `Aumento <strong>moderado</strong> de lluvias (${v.toFixed(1)}%). Mayor riesgo de inundaciones locales.`, color: "#1a5e35" };
    return { text: `Aumento <strong>significativo</strong> de lluvias (${v.toFixed(1)}%). Riesgo elevado de inundaciones y deslizamientos.`, color: "#003320" };
  }

  if (variable === "tasmax" || variable === "tasmin") {
    const lbl = variable === "tasmax" ? "días más cálidos" : "noches más frías";
    if (v < 0.5)  return { text: `Calentamiento leve (+${v.toFixed(1)}°C en ${lbl}). Cambio dentro de variabilidad natural.`, color: "#f0a020" };
    if (v < 1.0)  return { text: `Calentamiento <strong>moderado</strong> (+${v.toFixed(1)}°C en ${lbl}). Impactos perceptibles en agricultura y salud.`, color: "#e07010" };
    if (v < 1.5)  return { text: `Calentamiento <strong>alto</strong> (+${v.toFixed(1)}°C en ${lbl}). Estrés hídrico y térmico significativo.`, color: "#c84000" };
    if (v < 2.0)  return { text: `Calentamiento <strong>muy alto</strong> (+${v.toFixed(1)}°C en ${lbl}). Riesgo serio para ecosistemas y población.`, color: "#a02000" };
    return { text: `Calentamiento <strong>crítico</strong> (+${v.toFixed(1)}°C en ${lbl}). Zona entre las más afectadas del país.`, color: "#800010" };
  }

  return null;
}

// El signo positivo se explicita en temperatura, donde un aumento es la
// lectura relevante; el negativo ya lo pone el propio número.
function signo(valor, variable) {
  return variable !== "pr" && parseFloat(valor) >= 0 ? "+" : "";
}

// La barra describe el cambio, no una magnitud absoluta. En precipitación
// el cambio tiene dos sentidos: el cero está en el centro y el trazo crece
// hacia el lado que corresponde, de modo que su largo sea la magnitud real.
// En temperatura, donde toda la escala es aumento, crece desde el origen.
function climateBarConfig(variable, valor) {
  if (valor == null) return null;
  const v = parseFloat(valor);
  if (isNaN(v)) return null;

  if (variable === "pr") {
    const tope = 100;
    const largo = Math.min(50, (Math.abs(v) / tope) * 50);
    return {
      inicio: v < 0 ? 50 - largo : 50,
      largo,
      cero: 50,
      color: v < 0 ? "#b85c00" : "#2a8a50",
      minLabel: "−100%", maxLabel: "+100%", midLabel: "0%",
    };
  }
  if (variable === "tasmax" || variable === "tasmin") {
    const largo = Math.min(100, Math.max(0, (v / 4.0) * 100));
    return {
      inicio: 0,
      largo,
      cero: null,
      color: v < 1.0 ? "#f0a020" : v < 2.0 ? "#e05010" : "#a01010",
      minLabel: "0°C", maxLabel: "+4°C", midLabel: "+2°C",
    };
  }
  return null;
}

// ─── Ortografía de los topónimos ──────────────────────────
// Los datos de origen vienen sin tildes.
const TILDES = {
  // Departamentos
  "ANCASH": "ÁNCASH", "APURIMAC": "APURÍMAC", "HUANUCO": "HUÁNUCO",
  "JUNIN": "JUNÍN", "SAN MARTIN": "SAN MARTÍN",
  // Provincias
  "ASUNCION": "ASUNCIÓN", "AZANGARO": "AZÁNGARO", "BOLIVAR": "BOLÍVAR",
  "BONGARA": "BONGARÁ", "CAMANA": "CAMANÁ", "CARAVELI": "CARAVELÍ",
  "CARLOS FERMIN FITZCARRALD": "CARLOS FERMÍN FITZCARRALD",
  "CELENDIN": "CELENDÍN", "CHEPEN": "CHEPÉN", "CONCEPCION": "CONCEPCIÓN",
  "CONTUMAZA": "CONTUMAZÁ", "DANIEL ALCIDES CARRION": "DANIEL ALCIDES CARRIÓN",
  "DATEM DEL MARAÑON": "DATEM DEL MARAÑÓN",
  "GENERAL SANCHEZ CERRO": "GENERAL SÁNCHEZ CERRO", "GRAN CHIMU": "GRAN CHIMÚ",
  "HUAMALIES": "HUAMALÍES", "HUANCANE": "HUANCANÉ", "HUAROCHIRI": "HUAROCHIRÍ",
  "HUAYTARA": "HUAYTARÁ", "JAEN": "JAÉN", "JULCAN": "JULCÁN",
  "LA CONVENCION": "LA CONVENCIÓN", "MARAÑON": "MARAÑÓN",
  "MARISCAL CACERES": "MARISCAL CÁCERES",
  "MARISCAL RAMON CASTILLA": "MARISCAL RAMÓN CASTILLA",
  "MORROPON": "MORROPÓN", "OYON": "OYÓN",
  "PAUCAR DEL SARA SARA": "PÁUCAR DEL SARA SARA", "PURUS": "PURÚS",
  "RODRIGUEZ DE MENDOZA": "RODRÍGUEZ DE MENDOZA", "SAN ROMAN": "SAN ROMÁN",
  "SANCHEZ CARRION": "SÁNCHEZ CARRIÓN", "VICTOR FAJARDO": "VÍCTOR FAJARDO",
  "VILCAS HUAMAN": "VILCAS HUAMÁN", "VIRU": "VIRÚ",
  // Distritos
  "SAN SILVESTRE DE COCHAN": "SAN SILVESTRE DE COCHÁN",
  "TAHUANIA": "TAHUANÍA", "MAQUIA": "MAQUÍA",
};

function conTildes(nombre) {
  if (!nombre) return nombre;
  const clave = String(nombre).trim().toUpperCase();
  return TILDES[clave] || String(nombre).replace(/Hidrografica/g, "Hidrográfica");
}

// ─── Contexto territorial ─────────────────────────────────
function puntoEnAnillo(lat, lon, anillo) {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const xi = anillo[i][0], yi = anillo[i][1];
    const xj = anillo[j][0], yj = anillo[j][1];
    if ((yi > lat) !== (yj > lat) &&
        lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      dentro = !dentro;
    }
  }
  return dentro;
}

function puntoEnGeometria(lat, lon, geom) {
  const poligonos = geom.type === "Polygon" ? [geom.coordinates]
                  : geom.type === "MultiPolygon" ? geom.coordinates
                  : [];
  for (const poly of poligonos) {
    if (!poly.length || !puntoEnAnillo(lat, lon, poly[0])) continue;
    let enHueco = false;
    for (let k = 1; k < poly.length; k++) {
      if (puntoEnAnillo(lat, lon, poly[k])) { enHueco = true; break; }
    }
    if (!enHueco) return true;
  }
  return false;
}

function unidadDeReferencia(punto) {
  const unidad = localizarUnidad(refGeoLayer, punto);
  return unidad ? unidad.feature.properties : null;
}

function describirReferencia(props) {
  if (!props) return null;
  if (state.refLayer === "departamentos") {
    return { etiqueta: "Departamento", valor: conTildes(props.DEPARTAMEN) || "—" };
  }
  if (state.refLayer === "provincias") {
    return {
      etiqueta: "Provincia",
      valor: conTildes(props.PROVINCIA) || "—",
      extra: props.DEPARTAMEN ? `Departamento de ${conTildes(props.DEPARTAMEN)}` : "",
    };
  }
  if (state.refLayer === "cuencas") {
    const nombre = props.NOMB_UH_N7 || props.NOMB_UH_N6 || props.NOMB_UH_N5 ||
                   props.NOMB_UH_N4 || props.NOMB_UH_N3 || props.NOMB_UH_N2 ||
                   props.NOMB_UH_N1 || props.NOMBRE || "—";
    const region = props.NOMB_UH_N1 && props.NOMB_UH_N1 !== nombre ? props.NOMB_UH_N1 : "";
    return {
      etiqueta: "Unidad hidrográfica",
      valor: conTildes(nombre),
      extra: conTildes(region),
    };
  }
  return null;
}

function construirInfoHTML(props, variable, isImc, punto) {
  const distrito = conTildes(props.DISTRITO || props.NOMBRE) || "—";
  const valor    = props.valor != null ? props.valor : null;

  const rows = [{ k: "Distrito", v: distrito }];

  const ref = describirReferencia(unidadDeReferencia(punto));
  if (ref) {
    rows.push({
      k: ref.etiqueta,
      v: ref.extra ? `${ref.valor}<br><small style="color:#8a94a6">${ref.extra}</small>` : ref.valor,
    });
  }

  let barHtml = "";
  let interpretHtml = "";

  if (isImc) {
    const lbl = valor != null ? imcLabel(valor) : "Sin dato";
    const fmt = valor != null ? parseFloat(valor).toFixed(3) : "—";
    const tinte  = IMC_COLORS_TEXTO[lbl] || "#888";
    const imcPct = valor != null ? Math.min(100, parseFloat(valor) * 100) : 0;
    rows.push({ k: "Categoría", v: `<span style="font-weight:700;color:${tinte}">${lbl}</span>` });
    rows.push({ k: "Valor IMC", v: fmt, highlight: true });
    barHtml = `
      <div class="info-value-bar-wrap">
        <div class="info-value-bar-label"><span>Nivel de peligro</span><span>${fmt}</span></div>
        <div class="info-value-bar-track">
          <div class="info-value-bar-fill" style="left:0;width:${imcPct}%;background:${IMC_COLORS[lbl] || "#888"}"></div>
        </div>
      </div>`;
    interpretHtml = `<div class="info-interpret">${IMC_DESC[lbl] || ""}</div>`;
  } else {
    const unit = variable === "pr" ? "%" : "°C";
    const fmt  = valor != null ? `${signo(valor, variable)}${parseFloat(valor).toFixed(1)} ${unit}` : "Sin dato";
    rows.push({ k: "Variable", v: NOMBRE_VARIABLE[variable] || variable });
    rows.push({ k: "Estación", v: seasonLabel(state.estacion) });
    rows.push({ k: "Período",  v: "2036–2065 vs 1981–2010" });
    rows.push({ k: "Cambio",   v: fmt, highlight: true });

    const bar = climateBarConfig(variable, valor);
    if (bar) {
      barHtml = `
        <div class="info-value-bar-wrap">
          <div class="info-value-bar-label">
            <span>${bar.minLabel}</span>
            <span>${bar.midLabel}</span>
            <span>${bar.maxLabel}</span>
          </div>
          <div class="info-value-bar-track">
            ${bar.cero != null ? `<span class="info-value-bar-cero" style="left:${bar.cero}%"></span>` : ""}
            <div class="info-value-bar-fill" style="left:${bar.inicio}%;width:${bar.largo}%;background:${bar.color}"></div>
          </div>
        </div>`;
    }
    const interp = climateInterpret(variable, valor);
    if (interp) interpretHtml = `<div class="info-interpret">${interp.text}</div>`;
  }

  return rows.map(r =>
      `<div class="info-row">
        <span class="info-key">${r.k}</span>
        <span class="info-val${r.highlight ? " highlight" : ""}">${r.v}</span>
      </div>`
    ).join("") + barHtml + interpretHtml;
}


// Centro del polígono si cae dentro; si no, el promedio de sus vértices.
function puntoRepresentativo(layer) {
  const b = layer.getBounds();
  const c = b.getCenter();
  const geom = layer.feature && layer.feature.geometry;
  if (geom && puntoEnGeometria(c.lat, c.lng, geom)) return c;
  if (geom) {
    const poly = geom.type === "Polygon" ? geom.coordinates
               : geom.type === "MultiPolygon" ? geom.coordinates[0]
               : null;
    if (poly && poly[0] && poly[0].length) {
      let sx = 0, sy = 0;
      for (const [x, y] of poly[0]) { sx += x; sy += y; }
      const n = poly[0].length;
      const m = L.latLng(sy / n, sx / n);
      if (puntoEnGeometria(m.lat, m.lng, geom)) return m;
    }
  }
  return c;
}


// Márgenes que el globo debe respetar para no quedar bajo los flotantes.
function margenesLibres() {
  const cont = mapContainer.getBoundingClientRect();
  const visible = el => el && el.offsetParent !== null &&
                        getComputedStyle(el).visibility !== "hidden";

  let izq = 24, arriba = 24, der = 24, abajo = 24;

  const buscador = document.getElementById("mapSearchFloat");
  if (visible(buscador)) {
    const r = buscador.getBoundingClientRect();
    izq = Math.max(izq, r.right - cont.left + 18);
  }

  const leyenda = document.getElementById("mapLegend");
  if (visible(leyenda)) {
    const r = leyenda.getBoundingClientRect();
    der = Math.max(der, cont.right - r.left + 18);
  }

  const zoom = document.getElementById("zoomCtrl");
  if (visible(zoom)) {
    const r = zoom.getBoundingClientRect();
    der = Math.max(der, cont.right - r.left + 18);
  }

  return { topLeft: [izq, arriba + 40], bottomRight: [der, abajo] };
}



// Versión compacta para teléfono: destaca el valor y resume el resto.
function construirInfoCompacto(props, variable, isImc, punto) {
  const distrito = conTildes(props.DISTRITO || props.NOMBRE) || "—";
  const valor = props.valor != null ? props.valor : null;
  const ref = describirReferencia(unidadDeReferencia(punto));

  let cifra, etiqueta, color, barra = "", texto = "";

  if (isImc) {
    const lbl = valor != null ? imcLabel(valor) : "Sin dato";
    color = IMC_COLORS_TEXTO[lbl] || "#888";
    cifra = valor != null ? parseFloat(valor).toFixed(3) : "—";
    etiqueta = `Índice Multipeligro · ${lbl}`;
    const pct = valor != null ? Math.min(100, parseFloat(valor) * 100) : 0;
    barra = `<div class="ic-barra"><div style="left:0;width:${pct}%;background:${IMC_COLORS[lbl] || "#888"}"></div></div>`;
  } else {
    const unidad = variable === "pr" ? "%" : "°C";
    cifra = valor != null
      ? `${signo(valor, variable)}${parseFloat(valor).toFixed(1)} ${unidad}`
      : "Sin dato";
    etiqueta = `${NOMBRE_VARIABLE[variable] || variable} · ${seasonLabel(state.estacion)}`;
    const cfg = climateBarConfig(variable, valor);
    color = cfg ? cfg.color : "#888";
    if (cfg) barra = `<div class="ic-barra">
      ${cfg.cero != null ? `<span class="ic-barra-cero" style="left:${cfg.cero}%"></span>` : ""}
      <div style="left:${cfg.inicio}%;width:${cfg.largo}%;background:${cfg.color}"></div></div>`;
    const interp = climateInterpret(variable, valor);
    if (interp) texto = interp.text;
  }

  const ubica = ref ? `${ref.etiqueta}: ${ref.valor}` : "";

  return `<button class="ic-manija" id="icManija" aria-label="Extender la ficha"></button>
          <div class="ic-cabecera">
            <span class="ic-lugar">${distrito}</span>
            ${ubica ? `<span class="ic-ubica">${ubica}</span>` : ""}
          </div>
          <div class="ic-cifra" style="color:${color}">${cifra}</div>
          <div class="ic-meta">${etiqueta}</div>
          ${barra}
          <div class="ic-periodo">2036–2065 respecto a 1981–2010</div>
          ${texto ? `<div class="ic-texto">${texto}</div>` : ""}`;
}


let pulsoActivo = null;

function pulsoEn(punto) {
  if (!punto) return;
  if (pulsoActivo) { map.removeLayer(pulsoActivo); pulsoActivo = null; }
  const marca = L.marker(punto, {
    icon: L.divIcon({ className: "pulso-seleccion", html: "<span></span><span></span>", iconSize: [0, 0] }),
    interactive: false,
    keyboard: false,
    zIndexOffset: 900,
  }).addTo(map);
  pulsoActivo = marca;
  setTimeout(() => {
    if (pulsoActivo === marca) { map.removeLayer(marca); pulsoActivo = null; }
  }, 950);
}

// ─── Indicador de procedencia ─────────────────────────────
// Con el mapa inclinado, la perspectiva deforma cualquier marcador según
// su latitud. El terreno guarda un ancla sin dimensión y el indicador se
// dibuja fuera del plano, siguiendo su posición proyectada.
let marcadorSeleccion = null;
let pinFijo = null;
let pinSeguimiento = null;

const PIN_SVG =
  '<svg viewBox="0 0 24 34" width="29" height="41" aria-hidden="true">' +
  '<path d="M12 1.6c5.2 0 9.4 4.2 9.4 9.4 0 6.9-9.4 21.4-9.4 21.4S2.6 17.9 2.6 11c0-5.2 4.2-9.4 9.4-9.4z" ' +
  'fill="#2f7fe0" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round"/>' +
  '<circle cx="12" cy="11" r="3.7" fill="#ffffff"/></svg>';

function marcarSeleccion(punto) {
  if (pinSeguimiento) { cancelAnimationFrame(pinSeguimiento); pinSeguimiento = null; }
  if (marcadorSeleccion) { map.removeLayer(marcadorSeleccion); marcadorSeleccion = null; }
  if (pinFijo) { pinFijo.remove(); pinFijo = null; }
  if (!punto) return;

  marcadorSeleccion = L.marker(punto, {
    icon: L.divIcon({ className: "pin-ancla", html: "", iconSize: [0, 0], iconAnchor: [0, 0] }),
    interactive: false,
    keyboard: false,
    zIndexOffset: 1000,
  }).addTo(map);

  pinFijo = document.createElement("div");
  pinFijo.className = "pin-fijo";
  pinFijo.innerHTML = '<span class="pin-fijo-cuerpo">' + PIN_SVG + "</span>";
  mapContainer.appendChild(pinFijo);
  seguirAncla();
}

function seguirAncla() {
  if (!pinFijo || !marcadorSeleccion) { pinSeguimiento = null; return; }
  pinSeguimiento = requestAnimationFrame(seguirAncla);
  const ancla = marcadorSeleccion.getElement();
  if (!ancla) return;
  const cont = mapContainer.getBoundingClientRect();
  const r = ancla.getBoundingClientRect();
  const x = r.left + r.width / 2 - cont.left;
  const y = r.top + r.height / 2 - cont.top;
  const aLaVista = Number.isFinite(x) && Number.isFinite(y) &&
                   x > -60 && x < cont.width + 60 && y > -80 && y < cont.height + 60;
  pinFijo.style.visibility = aLaVista ? "visible" : "hidden";
  pinFijo.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
}

// ─── Consulta de un territorio ────────────────────────────
// La consulta guarda el punto del territorio, no la unidad de una capa:
// así sobrevive a los cambios de variable, estación o capa de referencia.
let infoPopup = null;
let consulta  = null;

function capaActiva() {
  return state.imcActive ? imcLayer : climateLayer;
}

function localizarUnidad(capa, punto) {
  if (!capa || !punto) return null;
  let hallada = null;
  capa.eachLayer(l => {
    if (hallada || !l.feature || !l.getBounds) return;
    if (!l.getBounds().contains(punto)) return;
    if (puntoEnGeometria(punto.lat, punto.lng, l.feature.geometry)) hallada = l;
  });
  return hallada;
}

function resaltarUnidad(layer) {
  const capa = capaActiva();
  if (selectedFeature && capa) capa.resetStyle(selectedFeature);
  selectedFeature = layer;
  layer.setStyle({ weight: 2.5, color: "#1e5bb5", fillOpacity: 0.97, dashArray: null });
  layer.bringToFront();
  if (refGeoLayer) refGeoLayer.bringToFront();
}

function limpiarSeleccion() {
  if (!selectedFeature) return;
  const capa = capaActiva();
  if (capa) capa.resetStyle(selectedFeature);
  selectedFeature = null;
}

function ocultarInfo() {
  marcarSeleccion(null);
  document.getElementById("infoPanel").style.display = "none";
  const abierto = infoPopup;
  infoPopup = null;
  if (abierto) map.closePopup(abierto);
}

function cerrarInfo() {
  consulta = null;
  ocultarInfo();
  limpiarSeleccion();
}

function consultarUnidad(layer, ancla) {
  const punto = puntoRepresentativo(layer);
  consulta = { punto, ancla: ancla || punto };
  resaltarUnidad(layer);
  pulsoEn(punto);
  mostrarInfo(layer.feature.properties);
}

// Vuelve a resolver la consulta vigente sobre las capas actuales.
function refrescarConsulta() {
  if (!consulta) return;
  const unidad = localizarUnidad(capaActiva(), consulta.punto);
  if (!unidad) { cerrarInfo(); return; }
  resaltarUnidad(unidad);
  mostrarInfo(unidad.feature.properties);
}

// Globo anclado al territorio en pantalla amplia y vista plana; panel en
// teléfono o en relieve, donde el globo quedaría inclinado.
function mostrarInfo(props) {
  if (!consulta) return;
  const { punto, ancla } = consulta;
  const isImc    = state.imcActive;
  const html     = construirInfoHTML(props, state.variable, isImc, punto);
  const inclinado  = enRelieve();
  const enTelefono = window.innerWidth <= 768;
  const anclado    = ancla && !inclinado && !enTelefono;

  marcarSeleccion(inclinado ? punto : null);

  if (anclado) {
    document.getElementById("infoPanel").style.display = "none";
    const libre = margenesLibres();
    const abierto = infoPopup;
    infoPopup = null;
    if (abierto) map.closePopup(abierto);
    infoPopup = L.popup({
      className: "info-popup",
      maxWidth: 340,
      minWidth: 270,
      autoPan: true,
      autoPanPaddingTopLeft: libre.topLeft,
      autoPanPaddingBottomRight: libre.bottomRight,
      closeButton: true,
      offset: [0, -4],
    })
      .setLatLng(ancla)
      .setContent(`<div class="info-popup-head">Información del punto</div>
                   <div class="info-popup-body">${html}</div>`)
      .openOn(map);
    setTimeout(() => {
      const globo = document.querySelector(".info-popup");
      if (globo) evitarChoqueConLeyenda(globo);
    }, 60);
    return;
  }

  const abierto = infoPopup;
  infoPopup = null;
  if (abierto) map.closePopup(abierto);

  const panel = document.getElementById("infoPanel");
  panel.classList.remove("extendida");
  panel.classList.toggle("compacto", enTelefono);
  document.getElementById("infoPanelBody").innerHTML =
    enTelefono ? construirInfoCompacto(props, state.variable, isImc, punto) : html;

  const buscador = document.getElementById("mapSearchFloat");
  if (buscador && !enTelefono) {
    const r = buscador.getBoundingClientRect();
    const c = mapContainer.getBoundingClientRect();
    panel.style.top = (r.bottom - c.top + 10) + "px";
  }
  panel.style.display = "block";
  evitarChoqueConLeyenda(panel);

  const manija = document.getElementById("icManija");
  if (manija) {
    manija.addEventListener("click", () => {
      const extendida = panel.classList.toggle("extendida");
      manija.setAttribute("aria-label", extendida ? "Reducir la ficha" : "Extender la ficha");
    });
  }
}

// Ante un solape, la leyenda se pliega: la información nunca queda tapada.
function evitarChoqueConLeyenda(elemento) {
  const leyenda = document.getElementById("mapLegend");
  if (!leyenda || leyenda.classList.contains("collapsed")) return;
  const a = elemento.getBoundingClientRect();
  const b = leyenda.getBoundingClientRect();
  const chocan = !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  if (!chocan) return;
  leyenda.classList.add("collapsed");
  const btn = document.getElementById("legendToggle");
  if (btn) {
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "Desplegar leyenda");
  }
}

map.on("popupclose", e => { if (e.popup === infoPopup) cerrarInfo(); });

document.getElementById("closeInfoPanel").addEventListener("click", cerrarInfo);

// ─── Leyenda ──────────────────────────────────────────────
function buildClimateLegend(variable) {
  const el = document.getElementById("legendContent");
  document.getElementById("mapLegend").classList.remove("empty");
  const isPrec = variable === "pr";
  const bins   = isPrec ? PREC_BINS   : TEMP_BINS;
  const colors = isPrec ? PREC_COLORS : TEMP_COLORS;
  const unit   = isPrec ? "%" : "°C";
  const title  = isPrec ? "Δ Precipitación (%)" : `Δ Temperatura (°C)`;

  const items = colors.map((c, i) => {
    const lo = bins[i], hi = bins[i + 1];
    const label = lo <= -900 ? `≤ ${hi}` : hi >= 900 ? `≥ ${lo}` : `${lo} – ${hi}`;
    return `<div class="legend-item">
      <span class="legend-swatch" style="background:${c}"></span>
      <span class="legend-label">${label} ${unit}</span>
    </div>`;
  }).join("");

  el.innerHTML = `
    <div class="legend-title">${title}</div>
    <div class="legend-ref-note">Cambio respecto a 1981–2010</div>
    ${items}`;
}

function buildImcLegend() {
  const el = document.getElementById("legendContent");
  document.getElementById("mapLegend").classList.remove("empty");
  const items = [
    ["Muy Alto", "≥ 0.75",    "Exposición crítica a múltiples peligros climáticos"],
    ["Alto",     "0.50–0.75", "Alta concurrencia de amenazas climáticas"],
    ["Medio",    "0.25–0.50", "Exposición moderada a peligros climáticos"],
    ["Bajo",     "< 0.25",    "Baja exposición a peligros climáticos"],
  ].map(([cat, rng, desc]) => { const c = IMC_COLORS[cat]; return (
    `<div class="legend-item" style="align-items:flex-start; margin-bottom:8px;">
      <span class="legend-swatch" style="background:${c}; margin-top:3px; flex-shrink:0;"></span>
      <span style="display:flex; flex-direction:column; gap:1px;">
        <span class="legend-label" style="font-weight:700; color:#1a2236;">${cat} <span style="font-weight:400; color:#888;">(${rng})</span></span>
        <span style="font-size:0.62rem; color:#6b7a8d; line-height:1.3;">${desc}</span>
      </span>
    </div>`);
  }).join("");

  el.innerHTML = `
    <div class="legend-title">Índice Multipeligro Climático</div>
    <div class="legend-ref-note">Cambio respecto a 1981–2010</div>
    ${items}`;
}

// ─── Cargar/refrescar la capa de datos ────────────────────
// Una sola vía para la capa climática y la del índice: se diferencian en
// el archivo, el color y el trazo, no en el procedimiento.
const ESTILO_CLIMA = { color: "#555",    weight: 0.3, fillOpacity: 0.85 };
const ESTILO_IMC   = { color: "#5e005e", weight: 0.5, fillOpacity: 0.82 };

// Cada petición lleva número de orden: si al resolverse ya hay otra
// posterior en marcha, el resultado se descarta. Sin esto, cambiar de
// variable dos veces seguidas dejaba capas superpuestas y la leyenda
// podía quedar describiendo un dato que no era el pintado.
let generacionDatos = 0;

function quitarCapasDeDatos() {
  if (climateLayer) { map.removeLayer(climateLayer); climateLayer = null; }
  if (imcLayer)     { map.removeLayer(imcLayer);     imcLayer     = null; }
  selectedFeature = null;
}

async function cargarDatos() {
  const generacion = ++generacionDatos;
  quitarCapasDeDatos();
  ocultarInfo();

  const esImc = state.imcActive;
  const archivo = esImc ? imcFilename(state.imcTipo)
                        : climateFilename(state.variable, state.estacion);
  showLoader(esImc
    ? `Cargando ${NOMBRE_VARIABLE.imc} · Anual`
    : `Cargando ${NOMBRE_VARIABLE[state.variable]} · ${seasonLabel(state.estacion)}`);

  try {
    const data = await fetchGeoJSON(archivo);
    if (generacion !== generacionDatos) return;

    const base = esImc ? ESTILO_IMC : ESTILO_CLIMA;
    const capa = L.geoJSON(data, {
      style: feat => Object.assign({
        fillColor: esImc ? getImcColor(feat.properties.valor)
                         : getClimateColor(feat.properties.valor, state.variable),
      }, base),
      onEachFeature: (feat, layer) => {
        layer.on({
          mouseover(e) {
            if (e.target !== selectedFeature)
              e.target.setStyle({ weight: 1.8, color: "#3a6ea8", fillOpacity: 0.95 });
          },
          mouseout(e) {
            if (e.target !== selectedFeature) capa.resetStyle(e.target);
          },
          click(e) { consultarUnidad(e.target, e.latlng); },
        });
      },
    }).addTo(map);

    if (esImc) imcLayer = capa; else climateLayer = capa;
    if (refGeoLayer) refGeoLayer.bringToFront();
    if (esImc) buildImcLegend(); else buildClimateLegend(state.variable);
    refrescarConsulta();
  } catch (err) {
    if (generacion !== generacionDatos) return;
    cerrarInfo();
    console.warn("Capa de datos no disponible:", err.message);
    document.getElementById("legendContent").innerHTML = "";
    document.getElementById("mapLegend").classList.add("empty");
  } finally {
    hideLoader();
  }
}

// ─── Cargar capa de referencia ────────────────────────────
let generacionRef = 0;

async function cargarReferencia(key) {
  const generacion = ++generacionRef;
  if (refGeoLayer) { map.removeLayer(refGeoLayer); refGeoLayer = null; }
  if (key === "ninguna") { refrescarConsulta(); return; }

  showLoader(`Cargando ${NOMBRE_REFERENCIA[key] || key}`);
  try {
    const data = await fetchGeoJSON(refFilename(key));
    if (generacion !== generacionRef) return;
    refGeoLayer = L.geoJSON(data, {
      style: { color: "#1a2a4e", weight: 1.4, fillOpacity: 0, interactive: false },
    }).addTo(map);
    refGeoLayer.bringToFront();
  } catch (err) {
    console.warn("Capa de referencia no disponible:", err.message);
  } finally {
    hideLoader();
    if (generacion === generacionRef) refrescarConsulta();
  }
}

// ─── Helpers de etiquetas ─────────────────────────────────
function seasonLabel(v) {
  return { anual:"Anual", DEF:"Verano (DJF)", MAM:"Otoño (MAM)", JJA:"Invierno (JJA)", SON:"Primavera (SON)" }[v] || v;
}

// ─── Radio group genérico ─────────────────────────────────
function setupRadioGroup(groupId, onSelect) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll(".radio-card").forEach(card => {
    card.addEventListener("click", () => {
      group.querySelectorAll(".radio-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      onSelect(card.dataset.value);
    });
  });
}

// ─── Bloquear / desbloquear botones de estación ───────────
function setSeasonBlocked(blocked) {
  const btns = document.querySelectorAll(".btn-season");
  const msg  = document.getElementById("seasonBlockedMsg");
  btns.forEach(btn => {
    if (blocked && btn.dataset.value !== "anual") {
      btn.classList.add("blocked");
    } else {
      btn.classList.remove("blocked");
    }
  });
  if (msg) msg.style.display = blocked ? "block" : "none";

  // El IMC solo existe en escala anual
  if (blocked && state.estacion !== "anual") {
    btns.forEach(b => b.classList.remove("active"));
    document.querySelector('.btn-season[data-value="anual"]').classList.add("active");
    state.estacion = "anual";
  }
}

// ─── Botones estación ─────────────────────────────────────
document.querySelectorAll(".btn-season").forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.classList.contains("blocked")) return;
    document.querySelectorAll(".btn-season").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.estacion = btn.dataset.value;
    cargarDatos();
  });
});

// ─── Variable climática (incluye IMC como opción) ─────────
setupRadioGroup("varGroup", value => {
  if (state.variable === value) return;
  state.imcActive = value === "imc";
  state.variable  = value;
  setSeasonBlocked(state.imcActive);
  cargarDatos();
});

// ─── Capa de referencia (radio exclusivo) ─────────────────
setupRadioGroup("refLayerGroup", value => {
  if (state.refLayer === value) return;
  state.refLayer = value;
  cargarReferencia(value);
});

// ─── Marcador de búsqueda ─────────────────────────────────
function placeSearchMarker(lat, lon, label) {
  if (searchMarker) { map.removeLayer(searchMarker); searchMarker = null; }
  const icon = L.divIcon({
    className: "",
    html: '<div class="search-marker-icon"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
  searchMarker = L.marker([lat, lon], { icon })
    .addTo(map)
    .bindTooltip(label || `${lat.toFixed(5)}, ${lon.toFixed(5)}`, { permanent: false });
  map.setView([lat, lon], 11, { animate: true });
}

// ─── Buscador de lugares (Nominatim) ─────────────────────
const placeInput       = document.getElementById("placeInput");
const placeSuggestions = document.getElementById("placeSuggestions");
const placeClearBtn    = document.getElementById("placeClearBtn");
let   searchTimer      = null;

// El nombre buscado y las respuestas de Nominatim son texto ajeno: se
// escapan antes de insertarlos, o un apóstrofo basta para romper la lista.
function escaparHTML(txt) {
  return String(txt).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function hideSuggestions() {
  placeSuggestions.innerHTML = "";
}

function showSuggestions(html) {
  placeSuggestions.innerHTML = html;
}

placeInput.addEventListener("input", () => {
  const q = placeInput.value.trim();
  placeClearBtn.style.display = q ? "block" : "none";
  clearTimeout(searchTimer);
  if (q.length < 2) { hideSuggestions(); return; }

  showSuggestions(`<div class="place-searching">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a7ec0" stroke-width="2.5" style="animation:spin 0.7s linear infinite;flex-shrink:0">
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
    Buscando resultados…
  </div>`);

  searchTimer = setTimeout(async () => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=pe&limit=6&addressdetails=1`;
      const res  = await fetch(url, { headers: { "Accept-Language": "es" } });
      const data = await res.json();

      if (!data.length) {
        showSuggestions(`<div class="place-suggestions-empty">
          <div class="place-suggestions-empty-icon">🔍</div>
          <div class="place-suggestions-empty-text">Sin resultados para "<strong>${escaparHTML(q)}</strong>"<br>Intenta con otro nombre</div>
        </div>`);
        return;
      }

      const items = data.map(item => {
        const parts  = item.display_name.split(",");
        const name   = parts[0].trim();
        const detail = parts.slice(1, 3).join(",").trim();
        return `<div class="place-suggestion-item"
                  data-lat="${parseFloat(item.lat)}" data-lon="${parseFloat(item.lon)}"
                  data-name="${escaparHTML(name)}">
          <div class="place-suggestion-pin-wrap">📍</div>
          <div>
            <div class="place-suggestion-name">${escaparHTML(name)}</div>
            <div class="place-suggestion-detail">${escaparHTML(detail)}</div>
          </div>
        </div>`;
      }).join("");

      showSuggestions(items);

      placeSuggestions.querySelectorAll(".place-suggestion-item").forEach(el => {
        el.addEventListener("click", () => {
          const lat  = parseFloat(el.dataset.lat);
          const lon  = parseFloat(el.dataset.lon);
          const name = el.dataset.name;
          placeInput.value = name;
          placeClearBtn.style.display = "block";
          hideSuggestions();
          placeSearchMarker(lat, lon, name);
          highlightDistrictAt(lat, lon);
          // Elegido el lugar, el buscador ya cumplió: vuelve a ser lupa
          if (esMovil()) cerrarBuscador();
        });
      });
    } catch {
      showSuggestions(`<div class="place-suggestions-empty">
        <div class="place-suggestions-empty-icon">⚠️</div>
        <div class="place-suggestions-empty-text">Error de conexión. Inténtalo de nuevo.</div>
      </div>`);
    }
  }, 380);
});

placeClearBtn.addEventListener("click", () => {
  placeInput.value = "";
  placeClearBtn.style.display = "none";
  hideSuggestions();
  if (searchMarker) { map.removeLayer(searchMarker); searchMarker = null; }
});

document.addEventListener("click", e => {
  if (!e.target.closest(".map-search-float")) hideSuggestions();
});

// ─── Toggle panel coordenadas ─────────────────────────────
document.getElementById("coordToggle").addEventListener("click", () => {
  const panel = document.getElementById("coordPanel");
  panel.style.display = panel.style.display === "none" ? "block" : "none";
});

// ─── Búsqueda por coordenadas ─────────────────────────────
document.getElementById("btnBuscar").addEventListener("click", () => {
  const lat = parseFloat(document.getElementById("latInput").value.replace(",", "."));
  const lon = parseFloat(document.getElementById("lonInput").value.replace(",", "."));
  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    alert("Coordenadas no válidas. Latitud: −90 a 90 · Longitud: −180 a 180");
    return;
  }
  // Fuera del ámbito el mapa no puede desplazarse y la búsqueda quedaría
  // sin efecto aparente
  if (!PERU_BOUNDS.contains([lat, lon])) {
    alert("Las coordenadas quedan fuera del territorio peruano.");
    return;
  }
  placeSearchMarker(lat, lon);
  highlightDistrictAt(lat, lon);
});

// ─── Botones de información de variable (?) ───────────────
let activeVarTooltip = null;

function removeVarTooltip() {
  if (activeVarTooltip) { activeVarTooltip.remove(); activeVarTooltip = null; }
}

document.querySelectorAll(".var-info-btn").forEach(btn => {
  btn.addEventListener("click", e => {
    e.stopPropagation();
    e.preventDefault();
    const varKey = btn.dataset.var;
    const info   = VAR_INFO[varKey];
    if (!info) return;

    if (activeVarTooltip) { removeVarTooltip(); return; }

    const tip = document.createElement("div");
    tip.className = "var-tooltip";
    tip.innerHTML = `
      <div class="var-tooltip-title">${info.title}</div>
      <div>${info.desc}</div>
      <div class="var-tooltip-sector">
        ${info.sectores.map(s => `<span class="var-tooltip-tag">${s}</span>`).join("")}
      </div>`;

    document.body.appendChild(tip);
    activeVarTooltip = tip;

    const rect = btn.getBoundingClientRect();
    const tipW = 240;
    let left = rect.right + 8;
    if (left + tipW > window.innerWidth - 10) left = rect.left - tipW - 8;
    tip.style.left = `${left}px`;
    tip.style.top  = `${rect.top}px`;
  });
});

document.addEventListener("click", e => {
  if (!e.target.closest(".var-info-btn")) removeVarTooltip();
});

map.on("click movestart zoomstart", removeVarTooltip);
["varGroup", "refLayerGroup", "seasonGroup"].forEach(id => {
  const grupo = document.getElementById(id);
  if (grupo) grupo.addEventListener("click", e => {
    if (!e.target.closest(".var-info-btn")) removeVarTooltip();
  });
});
window.addEventListener("scroll", removeVarTooltip, true);

// ─── Resaltar distrito desde el buscador ──────────────────
// Si el punto no cae en ningún distrito se toma el de centro más próximo.
function highlightDistrictAt(lat, lon) {
  const capa = capaActiva();
  if (!capa) return;
  const punto = L.latLng(lat, lon);

  let unidad = localizarUnidad(capa, punto);
  if (!unidad) {
    let menor = Infinity;
    capa.eachLayer(l => {
      if (!l.feature || !l.getBounds) return;
      const c = l.getBounds().getCenter();
      const d = Math.hypot(c.lat - lat, c.lng - lon);
      if (d < menor) { menor = d; unidad = l; }
    });
  }
  if (unidad) consultarUnidad(unidad, punto);
}

/* =========================================================
   INTERFAZ MÓVIL
   Sidebar deslizable, buscador plegable, leyenda plegable
   y auto-ocultado de los flotantes al explorar el mapa.
   ========================================================= */

const MOBILE_QUERY = window.matchMedia("(max-width: 768px)");
const esMovil = () => MOBILE_QUERY.matches;

// ─── Sidebar deslizable ───────────────────────────────────
const sidebar        = document.getElementById("sidebar");
const sidebarToggle  = document.getElementById("sidebarToggle");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const sidebarClose   = document.getElementById("sidebarClose");

function abrirSidebar() {
  sidebar.classList.add("open");
  sidebarOverlay.classList.add("visible");
  sidebarToggle.classList.add("active");
  sidebarToggle.setAttribute("aria-expanded", "true");
  document.body.classList.add("no-scroll");
}

function cerrarSidebar() {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("visible");
  sidebarToggle.classList.remove("active");
  sidebarToggle.setAttribute("aria-expanded", "false");
  document.body.classList.remove("no-scroll");
}

sidebarToggle.addEventListener("click", () => {
  sidebar.classList.contains("open") ? cerrarSidebar() : abrirSidebar();
});
sidebarOverlay.addEventListener("click", cerrarSidebar);
sidebarClose.addEventListener("click", cerrarSidebar);

["varGroup", "refLayerGroup", "seasonGroup"].forEach(id => {
  const grupo = document.getElementById(id);
  if (!grupo) return;
  grupo.addEventListener("click", () => {
    if (esMovil()) setTimeout(cerrarSidebar, 220);
  });
});

// ─── Buscador plegable en móvil ───────────────────────────
const searchFab    = document.getElementById("searchFab");
const searchFloat  = document.getElementById("mapSearchFloat");
const msfCollapse  = document.getElementById("msfCollapse");

function abrirBuscador() {
  searchFloat.classList.add("expanded");
  searchFab.classList.add("hidden");
  if (esMovil()) setTimeout(() => placeInput.focus(), 260);
}

function cerrarBuscador() {
  searchFloat.classList.remove("expanded");
  searchFab.classList.remove("hidden");
  hideSuggestions();
  placeInput.blur();
}

searchFab.addEventListener("click", abrirBuscador);
msfCollapse.addEventListener("click", cerrarBuscador);

// ─── Nombre completo de PEGASO (solo teléfono) ────────────
// En pantalla pequeña el título no cabe en primer plano: al tocar la
// marca se despliega un globo bajo la barra con el nombre completo.
const brandName    = document.getElementById("brandName");
const brandTooltip = document.getElementById("brandTooltip");
let   brandTimer   = null;

function cerrarNombreCompleto() {
  clearTimeout(brandTimer);
  brandTooltip.classList.remove("visible");
  brandName.setAttribute("aria-expanded", "false");
}

function alternarNombreCompleto() {
  if (brandTooltip.classList.contains("visible")) { cerrarNombreCompleto(); return; }
  // Descubierto el nombre completo, la pista ya no hace falta
  brandName.closest(".brand-mark").classList.add("descubierto");
  brandTooltip.classList.add("visible");
  brandName.setAttribute("aria-expanded", "true");
  clearTimeout(brandTimer);
  brandTimer = setTimeout(cerrarNombreCompleto, 5000);   // se retira solo
}

brandName.addEventListener("click", e => {
  if (!esMovil()) return;
  e.stopPropagation();
  alternarNombreCompleto();
});

// Se cierra al tocar en cualquier otro sitio o al empezar a usar el mapa
document.addEventListener("click", cerrarNombreCompleto);
document.addEventListener("keydown", e => { if (e.key === "Escape") cerrarNombreCompleto(); });

// ─── Leyenda plegable ─────────────────────────────────────
const mapLegend    = document.getElementById("mapLegend");
const legendToggle = document.getElementById("legendToggle");

legendToggle.addEventListener("click", () => {
  const plegada = mapLegend.classList.toggle("collapsed");
  legendToggle.setAttribute("aria-expanded", String(!plegada));
  legendToggle.setAttribute("aria-label", plegada ? "Desplegar leyenda" : "Plegar leyenda");
});

// ─── Auto-ocultado al explorar el mapa ────────────────────
function ocultarFlotantes() {
  document.body.classList.add("map-interacting");
  cerrarNombreCompleto();
}

function mostrarFlotantes() {
  document.body.classList.remove("map-interacting");
}

map.on("movestart zoomstart", ocultarFlotantes);
// dragend llega al soltar el dedo; moveend esperaría a que acabe la inercia
map.on("dragend moveend zoomend", mostrarFlotantes);

// ─── Ajustes al cambiar entre móvil y escritorio ──────────
function aplicarModoViewport() {
  if (esMovil()) {
    cerrarSidebar();
    cerrarBuscador();
    mapLegend.classList.add("collapsed");
    legendToggle.setAttribute("aria-expanded", "false");
  } else {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("visible");
    document.body.classList.remove("no-scroll");
    searchFloat.classList.remove("expanded");
    searchFab.classList.remove("hidden");
    mapLegend.classList.remove("collapsed");
    legendToggle.setAttribute("aria-expanded", "true");
    cerrarNombreCompleto();
  }
}

MOBILE_QUERY.addEventListener("change", aplicarModoViewport);
aplicarModoViewport();

// ─── Vista en relieve (perspectiva) ───────────────────────
const btnRelieve = document.getElementById("btnRelieve");

btnRelieve.addEventListener("click", () => {
  const activo = mapContainer.classList.toggle("relieve");
  btnRelieve.classList.toggle("active", activo);
  btnRelieve.setAttribute("aria-pressed", String(activo));
  btnRelieve.title = activo ? "Volver a vista plana" : "Vista en relieve";

  ocultarInfo();
  refrescarConsulta();

  requestAnimationFrame(() => setTimeout(() => ajustarAmbito(true), 60));
});

// ─── Pantalla completa ────────────────────────────────────
const btnPantalla = document.getElementById("btnPantalla");

function enPantallaCompleta() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement) ||
         document.body.classList.contains("inmersivo");
}

// Safari en iPhone no expone la API de pantalla completa: allí se recurre
// a un modo inmersivo propio que retira la barra superior y el pie.
function admitePantallaCompleta() {
  const raiz = document.documentElement;
  return !!(raiz.requestFullscreen || raiz.webkitRequestFullscreen);
}

function alternarPantallaCompleta() {
  const raiz = document.documentElement;

  // Si se entró por el modo propio, por ahí se sale
  if (document.body.classList.contains("inmersivo")) { activarInmersivo(); return; }

  if (!admitePantallaCompleta()) { activarInmersivo(); return; }

  if (document.fullscreenElement || document.webkitFullscreenElement) {
    const salir = document.exitFullscreen || document.webkitExitFullscreen;
    if (salir) Promise.resolve(salir.call(document)).catch(() => {});
    return;
  }

  const pedir = raiz.requestFullscreen || raiz.webkitRequestFullscreen;
  Promise.resolve(pedir.call(raiz)).catch(() => activarInmersivo());
}

function activarInmersivo() {
  document.body.classList.toggle("inmersivo");
  map.invalidateSize({ animate: false });
  refrescarBotonPantalla();
}

function refrescarBotonPantalla() {
  const activo = enPantallaCompleta();
  btnPantalla.classList.toggle("active", activo);
  btnPantalla.setAttribute("aria-pressed", String(activo));
  btnPantalla.title = activo ? "Salir de pantalla completa" : "Pantalla completa";
  const expandir = btnPantalla.querySelector(".icono-expandir");
  const contraer = btnPantalla.querySelector(".icono-contraer");
  if (expandir && contraer) {
    expandir.style.display = activo ? "none" : "";
    contraer.style.display = activo ? "" : "none";
  }
  setTimeout(() => ajustarAmbito(true), 220);
}

btnPantalla.addEventListener("click", alternarPantallaCompleta);
document.addEventListener("fullscreenchange", refrescarBotonPantalla);
document.addEventListener("webkitfullscreenchange", refrescarBotonPantalla);

refrescarBotonPantalla();

// ─── Carga inicial ────────────────────────────────────────
Promise.all([cargarReferencia(state.refLayer), cargarDatos()]);
