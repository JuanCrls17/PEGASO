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
  pr: "Precipitación", tasmax: "T° Máxima", tasmin: "T° Mínima", tasmed: "T° Media",
  imc: "Índice Multipeligro",
  txx: "Día más cálido", txn: "Día más fresco",
  tnx: "Noche más cálida", tnn: "Noche más fría",
};

// ─── Escenarios de emisiones ──────────────────────────────
// Dos trayectorias del CMIP6 sobre la misma malla y el mismo período: se
// eligen por separado y se pueden enfrentar. El severo es el que la
// plataforma publicaba hasta ahora, y sigue siendo el que abre.
const ESCENARIOS = {
  ssp245: {
    etiqueta: "SSP2-4.5", nombre: "Moderado",
    resumen: "Las emisiones se estabilizan hacia mitad de siglo",
  },
  ssp585: {
    etiqueta: "SSP5-8.5", nombre: "Severo",
    resumen: "Las emisiones siguen creciendo sin freno",
  },
};

// La temperatura media solo llegó en el escenario moderado: no hay malla
// equivalente en el severo, así que la tarjeta se apaga al cambiar.
const SOLO_EN_ESCENARIO = { tasmed: "ssp245" };

function escenarioTiene(escenario, clave) {
  const unico = SOLO_EN_ESCENARIO[clave];
  return !unico || unico === escenario;
}

// ─── Escala de la brecha entre escenarios ─────────────────
// Al comparar, el mapa no pinta un escenario sino la distancia entre los
// dos: cuánto añade el severo sobre el moderado. Es otra magnitud y lleva
// otra escala —divergente y de tonos ajenos a las dos rampas de arriba—,
// para que nadie confunda una brecha de 0,5 °C con un cambio de 0,5 °C.
// Los tramos están cortados sobre el reparto real de la brecha, no sobre
// números redondos: casi toda la temperatura se separa entre 0,3 y 0,8 °C,
// y una escala de pasos de 0,2 dejaba dos tercios del país de un solo color.
// El cero no cae al centro porque el dato no es simétrico: que el escenario
// moderado caliente más que el severo pasa en el 1 % del territorio, y
// merece un tono aparte, no la mitad de la escala.
// Los pasos están medidos en OKLCH para que dos tramos vecinos se
// distingan siempre —ninguna pareja baja de ΔE 8—, y el salto de signo se
// marca con un cambio de familia de color, no con un tono más claro.
const BRECHA_ESCALAS = {
  temp: {
    bins: [-999, -0.2, 0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.75, 999],
    colores: ["#006457", "#7fb8ac", "#ebd4f6", "#d3b3e2", "#bc92ce",
              "#a472ba", "#8d51a6", "#762f92", "#5f007d"],
  },
  prec: {
    bins: [-999, -40, -20, -10, 0, 10, 20, 40, 999],
    colores: ["#005e4f", "#34897a", "#76b5a8", "#b3e3d9",
              "#e6cdf2", "#ba90cc", "#8e55a6", "#630e80"],
  },
};

// ─── Índices extremos de temperatura (ETCCDI) ─────────────
// No son promedios sino los extremos del período: TXx y TXn salen de la
// temperatura máxima diaria —el día más caluroso y el más fresco—, TNx y TNn de
// la mínima —la noche más cálida y la más fría—. Los cuatro se publican
// como cambio en grados frente a 1981-2010, así que comparten la escala de
// temperatura con tasmax y tasmin.
const INDICES_EXTREMOS = {
  txx: { codigo: "TXx", quien: "El día más caluroso del período",
         sube: "más caluroso", baja: "menos caluroso",
         lectura: "Es el techo del calor, del que dependen los umbrales de golpe de calor y de estrés térmico en los cultivos." },
  txn: { codigo: "TXn", quien: "El día más fresco del período",
         sube: "más cálido", baja: "más fresco",
         lectura: "Sube también el extremo templado, con lo que se acorta el respiro entre episodios de calor." },
  tnx: { codigo: "TNx", quien: "La noche más cálida del período",
         sube: "más cálida", baja: "menos cálida",
         lectura: "Sin noches frescas, ni las personas ni los cultivos descargan el calor acumulado durante el día." },
  tnn: { codigo: "TNn", quien: "La noche más fría del período",
         sube: "menos fría", baja: "más fría",
         lectura: "Se esperan menos heladas, y también menos frío invernal del que contiene plagas y marca los ciclos de cultivo." },
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

const IMC_ORDEN = ["Bajo", "Medio", "Alto", "Muy Alto"];

function imcBarConfig(valor) {
  if (valor == null) return null;
  const v = parseFloat(valor);
  if (isNaN(v)) return null;
  const paso = 100 / IMC_ORDEN.length;
  const tramos = IMC_ORDEN.map((cat, i) =>
    `${IMC_COLORS[cat]} ${(i * paso).toFixed(3)}%, ${IMC_COLORS[cat]} ${((i + 1) * paso).toFixed(3)}%`);
  return {
    pos: Math.min(100, Math.max(0, v * 100)),
    color: getImcColor(v),
    banda: `linear-gradient(90deg, ${tramos.join(", ")})`,
    cero: null,
    minLabel: "0", midLabel: "0.50", maxLabel: "1",
  };
}

const IMC_DESC = {
  "Muy Alto": "Este territorio tiene <strong>exposición crítica</strong> a múltiples peligros climáticos simultáneos. Se recomienda planificación urgente de adaptación.",
  "Alto":     "Alta concurrencia de amenazas climáticas. Requiere <strong>medidas de adaptación</strong> en los sectores más vulnerables.",
  "Medio":    "Exposición <strong>moderada</strong> a peligros climáticos. Monitoreo continuo y planificación preventiva recomendados.",
  "Bajo":     "Baja exposición relativa a peligros climáticos en comparación con otras zonas del país.",
};

// ─── Estado de la aplicación ──────────────────────────────
const state = {
  variable:  "pr",     // "pr" | "tasmax" | "tasmin" | "tasmed" | "imc"
  estacion:  "anual",
  imcActive: false,
  imcTipo:   "agricola",
  indice:    null,     // clave del índice extremo en uso, o null
  refLayer:  "departamentos",
  escenario: "ssp585", // trayectoria de emisiones en pantalla
  comparar:  false,    // el mapa pinta la brecha entre los dos escenarios
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

// Los datos y las fronteras viven en planos separados: así el velo que
// hunde el mapa al consultar un distrito no arrastra también los límites
// departamentales, y las fronteras no necesitan bringToFront en cada carga.
map.createPane("datos");
map.getPane("datos").style.zIndex = 400;
map.createPane("referencia");
map.getPane("referencia").style.zIndex = 450;
map.getPane("referencia").style.pointerEvents = "none";

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

function escalaDeBrecha(variable) {
  return variable === "pr" ? BRECHA_ESCALAS.prec : BRECHA_ESCALAS.temp;
}

function getBrechaColor(value, variable) {
  if (value == null) return "#cccccc";
  const v = parseFloat(value);
  if (isNaN(v)) return "#cccccc";
  const { bins, colores } = escalaDeBrecha(variable);
  for (let i = 0; i < bins.length - 1; i++) {
    if (v > bins[i] && v <= bins[i + 1]) return colores[i];
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

// ─── Rutas de los datos ───────────────────────────────────
// Todo lo que pinta el mapa vive en data/valores/: un archivo por
// escenario, variable y corte, con los 1891 valores en el mismo orden que
// data/distritos.geojson. Ver tools/generar_valores.py.
function valoresFilename(escenario, clave, estacion) {
  const est = estacion === "anual" ? "anual" : estacion.toUpperCase();
  return `data/valores/${escenario}/${clave}_${est}.json`;
}

function imcFilename(tipo) {
  return `data/valores/imc_${tipo}.json`;
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

// La geometría de los 1891 distritos pesa 2,5 MB y es idéntica en los veinte
// cortes de índice: se descarga una vez y los valores viajan aparte, 13 KB
// cada uno. Repetirla en cada archivo costaría 52 MB y una espera entera al
// cambiar de índice. Se guarda la promesa, no el resultado, para que dos
// peticiones seguidas no disparen dos descargas.
let geometriaDistritos = null;

function cargarGeometriaDistritos() {
  if (!geometriaDistritos) {
    geometriaDistritos = fetchGeoJSON("data/distritos.geojson")
      .catch(err => { geometriaDistritos = null; throw err; });
  }
  return geometriaDistritos;
}

// Los archivos de valores pesan 15 KB y se piden una y otra vez al alternar
// entre escenarios: se guarda la promesa de cada uno, de modo que volver a
// un escenario ya visto no cuesta ninguna descarga.
const cacheValores = new Map();

function cargarValores(ruta) {
  if (!cacheValores.has(ruta)) {
    cacheValores.set(ruta, fetchGeoJSON(ruta)
      .catch(err => { cacheValores.delete(ruta); throw err; }));
  }
  return cacheValores.get(ruta);
}

function comprobarLargo(datos, geo, ruta) {
  const valores = datos && datos.valores;
  // Los valores se emparejan por posición, no por nombre: hay 99 nombres de
  // distrito repetidos en el país y emparejar por nombre los mezclaría.
  if (!Array.isArray(valores) || valores.length !== geo.features.length) {
    throw new Error(`${ruta} no cuadra con la capa de distritos`);
  }
  return datos;
}

// Un escenario: el valor pintado es el cambio proyectado.
async function distritosConValores(clave, estacion, escenario) {
  const ruta = valoresFilename(escenario, clave, estacion);
  const [geo, datos] = await Promise.all([cargarGeometriaDistritos(), cargarValores(ruta)]);
  comprobarLargo(datos, geo, ruta);
  const sig = Array.isArray(datos.sig) ? datos.sig : null;
  const topados = new Set(datos.topados || []);
  return {
    type: "FeatureCollection",
    features: geo.features.map((f, i) => ({
      type: "Feature",
      geometry: f.geometry,
      properties: {
        DISTRITO: f.properties.DISTRITO,
        valor: datos.valores[i],
        sig: sig ? sig[i] : null,
        topado: topados.has(i),
      },
    })),
  };
}

// Los dos escenarios a la vez: el valor pintado es la brecha —cuánto añade
// el severo sobre el moderado— y cada distrito conserva las dos lecturas
// para que la ficha las enfrente sin volver a pedir nada.
async function distritosComparados(clave, estacion) {
  const rutaMod = valoresFilename("ssp245", clave, estacion);
  const rutaSev = valoresFilename("ssp585", clave, estacion);
  const [geo, mod, sev] = await Promise.all([
    cargarGeometriaDistritos(), cargarValores(rutaMod), cargarValores(rutaSev),
  ]);
  comprobarLargo(mod, geo, rutaMod);
  comprobarLargo(sev, geo, rutaSev);
  const sig = Array.isArray(mod.sig) ? mod.sig : null;
  const topados = new Set([...(mod.topados || []), ...(sev.topados || [])]);
  return {
    type: "FeatureCollection",
    features: geo.features.map((f, i) => {
      const a = mod.valores[i], b = sev.valores[i];
      const brecha = (a == null || b == null) ? null : b - a;
      return {
        type: "Feature",
        geometry: f.geometry,
        properties: {
          DISTRITO: f.properties.DISTRITO,
          valor: brecha,
          ssp245: a,
          ssp585: b,
          sig: sig ? sig[i] : null,
          topado: topados.has(i),
        },
      };
    }),
  };
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
  tasmed: {
    title: "Temperatura Media",
    desc: "Cambio proyectado en la temperatura media diaria (°C). Es la lectura de fondo del calentamiento, la que resume el desplazamiento de todo el ciclo diario. <strong>Solo está disponible para el escenario SSP2-4.5</strong>: no se cuenta con la malla equivalente del SSP5-8.5.",
    sectores: ["Planificación territorial", "Agricultura", "Salud", "Energía"],
  },
  indices: {
    title: "Índices extremos de temperatura",
    desc: "Cuatro índices ETCCDI que no describen el promedio sino el extremo del período: <strong>TXx</strong> el día más caluroso y <strong>TXn</strong> el más fresco, ambos de la temperatura máxima diaria; <strong>TNx</strong> la noche más cálida y <strong>TNn</strong> la más fría, de la mínima. Se publican como cambio en grados frente a 1981–2010.",
    sectores: ["Salud", "Agricultura", "Ganadería", "Gestión de riesgos"],
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
    if (v <= -30) return { text: `Reducción <strong>severa</strong> de lluvias (${v.toFixed(1)}%). Alto riesgo de sequías prolongadas.` };
    if (v <= -15) return { text: `Reducción <strong>moderada</strong> de lluvias (${v.toFixed(1)}%). Impacto relevante en disponibilidad hídrica.` };
    if (v <    0) return { text: `Leve reducción de lluvias (${v.toFixed(1)}%). Monitoreo recomendado.` };
    if (v <   15) return { text: `Leve aumento de lluvias (${v.toFixed(1)}%). Puede intensificar eventos locales.` };
    if (v <   30) return { text: `Aumento <strong>moderado</strong> de lluvias (${v.toFixed(1)}%). Mayor riesgo de inundaciones locales.` };
    return { text: `Aumento <strong>significativo</strong> de lluvias (${v.toFixed(1)}%). Riesgo elevado de inundaciones y deslizamientos.` };
  }

  const extremo = INDICES_EXTREMOS[variable];
  if (extremo) {
    // Sin escala de gravedad. La de temperatura media está calibrada sobre
    // otro reparto y aquí no distingue nada: TNx entero cae entre 1,7 y
    // 2,8 °C, con lo que todos los distritos del país saldrían «altos». La
    // comparación regional de la línea de arriba ya sitúa el valor; esta
    // frase dice qué es lo que sube y qué se sigue de ello.
    const cuanto = `<strong>${Math.abs(v).toFixed(1)} °C</strong>`;
    const sentido = v >= 0 ? extremo.sube : extremo.baja;
    return { text: `${extremo.quien} será ${cuanto} ${sentido} que en 1981–2010. ${extremo.lectura}` };
  }

  if (variable === "tasmax" || variable === "tasmin" || variable === "tasmed") {
    const lbl = variable === "tasmax" ? "días más cálidos"
              : variable === "tasmin" ? "noches más frías"
              : "la temperatura media";
    if (v < 0.5)  return { text: `Calentamiento leve (+${v.toFixed(1)}°C en ${lbl}). Cambio dentro de variabilidad natural.` };
    if (v < 1.0)  return { text: `Calentamiento <strong>moderado</strong> (+${v.toFixed(1)}°C en ${lbl}). Impactos perceptibles en agricultura y salud.` };
    if (v < 1.5)  return { text: `Calentamiento <strong>alto</strong> (+${v.toFixed(1)}°C en ${lbl}). Estrés hídrico y térmico significativo.` };
    if (v < 2.0)  return { text: `Calentamiento <strong>muy alto</strong> (+${v.toFixed(1)}°C en ${lbl}). Riesgo serio para ecosistemas y población.` };
    return { text: `Calentamiento <strong>crítico</strong> (+${v.toFixed(1)}°C en ${lbl}). Zona entre las más afectadas del país.` };
  }

  return null;
}

// El signo positivo se explicita en temperatura, donde un aumento es la
// lectura relevante; el negativo ya lo pone el propio número.
function signo(valor, variable) {
  return variable !== "pr" && parseFloat(valor) >= 0 ? "+" : "";
}

// ─── Escenarios en la ficha ───────────────────────────────
function unidadDe(clave) {
  return clave === "pr" ? "%" : "°C";
}

function cifraDe(valor, clave) {
  if (valor == null) return "Sin dato";
  const v = parseFloat(valor);
  if (isNaN(v)) return "Sin dato";
  return `${signo(v, clave)}${v.toFixed(1)} ${unidadDe(clave)}`;
}

// La brecha lleva siempre su signo: es una distancia con sentido, no una
// magnitud suelta. Positiva significa que el escenario severo va más lejos.
function cifraBrecha(valor, clave) {
  if (valor == null) return "—";
  const v = parseFloat(valor);
  if (isNaN(v)) return "—";
  const n = clave === "pr" ? v.toFixed(1) : v.toFixed(2);
  return `${v >= 0 ? "+" : ""}${n} ${unidadDe(clave)}`;
}

// Nota sobre la significancia: solo existe en el escenario moderado, y solo
// cambia la lectura donde la señal es débil, que en la práctica es la lluvia.
// Callarla en el mapa de precipitación sugiere una certeza que el modelo no da.
function notaSignificancia(props, clave) {
  const sig = props ? props.sig : null;
  if (sig == null || clave !== "pr") return "";
  if (sig >= 0.5) return "";
  const parte = sig <= 0.05 ? "en prácticamente todo el distrito"
              : sig < 0.25  ? "en la mayor parte del distrito"
              : "en más de la mitad del distrito";
  // La máscara solo llegó con el escenario moderado: al comparar hay que
  // decir de cuál de los dos se está hablando.
  const cual = comparaAhora() ? "en el SSP2-4.5 " : "";
  return `<div class="info-cautela">El cambio de lluvia ${cual}<strong>no es
          estadísticamente significativo</strong> ${parte} (p ≥ 0,05):
          los modelos no coinciden en el sentido de la señal.</div>`;
}

// Nota sobre el tope: en la costa desértica casi no llueve en invierno y el
// cambio relativo se dispara. Un +100 % recortado y un +100 % real se ven
// igual en el mapa; aquí se distinguen.
function notaTope(props, clave) {
  if (!props || !props.topado || clave !== "pr") return "";
  return `<div class="info-cautela">Valor <strong>recortado al tope de
          ±100 %</strong>. Aquí la lluvia de referencia es casi nula y el
          cambio relativo se dispara sin que ello signifique mucha agua.</div>`;
}

// ─── Contexto regional ────────────────────────────────────
// Un valor suelto no dice si es mucho o poco. La ficha lo compara con los
// demás distritos de la unidad de referencia activa —departamento,
// provincia o cuenca—, que suele ser el marco en el que se decide. Se
// resuelve solo para la unidad consultada, no para las 25 o las 231, y se
// guarda en caché mientras no cambien ni los datos ni la referencia.
let cacheRegional = { clave: null, datos: null };

function distritosDeLaUnidad(unidad) {
  const capa = capaActiva();
  if (!capa || !unidad) return null;

  const limites = unidad.getBounds();
  const geom = unidad.feature.geometry;
  const valores = [];
  capa.eachLayer(l => {
    if (!l.feature || !l.getBounds) return;
    const v = parseFloat(l.feature.properties.valor);
    if (isNaN(v)) return;
    if (!limites.intersects(l.getBounds())) return;
    // El mismo punto con el que se resuelve el distrito consultado: así
    // ningún distrito puede quedar fuera del grupo al que pertenece. El
    // centro del rectángulo envolvente no sirve —en los territorios de
    // forma irregular cae fuera, o dentro del departamento vecino—.
    const c = puntoRepresentativo(l);
    if (puntoEnGeometria(c.lat, c.lng, geom)) valores.push(v);
  });
  if (!valores.length) return null;

  valores.sort((a, b) => a - b);
  return { valores };
}

function datosRegionales(punto) {
  const unidad = localizarUnidad(refGeoLayer, punto);
  if (!unidad) return null;
  const clave = `${generacionDatos}|${state.refLayer}|${L.Util.stamp(unidad)}`;
  if (cacheRegional.clave !== clave) {
    cacheRegional = { clave, datos: distritosDeLaUnidad(unidad), props: unidad.feature.properties };
  }
  if (!cacheRegional.datos) return null;
  return { ...cacheRegional.datos, props: cacheRegional.props };
}

// Cuántos distritos del grupo quedan por delante y por detrás del valor,
// contando desde el extremo que interesa: el mayor aumento, la mayor
// reducción o la mayor exposición. Los empates no van a ningún lado, de
// modo que dos distritos con el mismo valor reciben la misma lectura.
function posicionEnGrupo(valor, ordenados, descendente) {
  const v = parseFloat(valor);
  let delante = 0, detras = 0;
  for (const x of ordenados) {
    if (x === v) continue;
    if (descendente ? x > v : x < v) delante++;
    else detras++;
  }
  return { delante, detras };
}

const MINUSCULAS = new Set(["de", "del", "la", "las", "los", "y"]);

function enTitulo(nombre) {
  if (!nombre) return nombre;
  return String(nombre).toLocaleLowerCase("es")
    .split(" ")
    .map((p, i) => (i && MINUSCULAS.has(p)) ? p
                 : p.charAt(0).toLocaleUpperCase("es") + p.slice(1))
    .join(" ");
}

function nombreDeUnidad(props) {
  if (state.refLayer === "departamentos") {
    return { articulo: "del departamento de", en: "en el departamento de",
             nombre: enTitulo(conTildes(props.DEPARTAMEN)) };
  }
  if (state.refLayer === "provincias") {
    return { articulo: "de la provincia de", en: "en la provincia de",
             nombre: enTitulo(conTildes(props.PROVINCIA)) };
  }
  const ref = describirReferencia(props);
  if (!ref) return { articulo: "de la cuenca", en: "en la cuenca", nombre: null };
  const nombre = enTitulo(ref.valor);
  // Buena parte de las cuencas se nombran «Unidad Hidrográfica NNNNN»:
  // anteponerles «de la cuenca» sonaría redundante.
  const generica = /^unidad hidrogr/i.test(nombre);
  return { articulo: generica ? "de la" : "de la cuenca",
           en:       generica ? "en la" : "en la cuenca", nombre };
}

// La lectura primero y el dato después. Un recuento suelto —«19 de los 38
// distritos suben más que este»— obliga a dividirlo mentalmente por el
// total para saber si el distrito está alto, bajo o en medio, que es lo
// único que se quiere saber. La frase lo dice y deja el recuento detrás,
// para quien quiera comprobarlo.
const VEREDICTO = {
  sube: { mas:   "De los que más suben",   sobre: "Sube más de lo habitual",
          medio: "Un aumento intermedio",  bajo:  "Sube menos de lo habitual",
          menos: "De los que menos suben" },
  baja: { mas:   "De los que más bajan",      sobre: "Baja más de lo habitual",
          medio: "Una reducción intermedia",  bajo:  "Baja menos de lo habitual",
          menos: "De los que menos bajan" },
  imc:  { mas:   "De los más expuestos",   sobre: "Más expuesto de lo habitual",
          medio: "Exposición intermedia",  bajo:  "Menos expuesto de lo habitual",
          menos: "De los menos expuestos" },
};

// Los dos extremos se dicen con «de» —«de los que más suben del
// departamento de…»— y los tres tramos centrales con «en».
const VEREDICTO_CON_DE = new Set(["mas", "menos"]);

function tramoDe(fraccion) {
  if (fraccion < 0.10) return "mas";
  if (fraccion < 0.35) return "sobre";
  if (fraccion <= 0.65) return "medio";
  if (fraccion < 0.90) return "bajo";
  return "menos";
}

function contextoRegional(valor, variable, isImc, punto) {
  if (valor == null || !punto) return null;
  const grupo = datosRegionales(punto);
  if (!grupo) return null;

  const donde = nombreDeUnidad(grupo.props);
  if (!donde.nombre) return null;

  const v = parseFloat(valor);
  const total = grupo.valores.length;
  const nombre = escaparHTML(donde.nombre);

  if (total === 1) return `Único distrito ${donde.articulo} ${nombre} con dato.`;

  // En precipitación el extremo relevante depende del signo del cambio
  const reduce = variable === "pr" && !isImc && v < 0;
  const { delante, detras } = posicionEnGrupo(v, grupo.valores, !reduce);
  // La fracción se calcula sobre los distritos con los que cabe compararse,
  // sin los empatados: si todo el grupo tuviera el mismo valor, no habría
  // ni delantera ni retraso que leer y la lectura es la del medio.
  const comparables = delante + detras;
  const tramo = tramoDe(comparables ? delante / comparables : 0.5);

  const habla = isImc  ? { pl: "están más expuestos que este", sg: "está más expuesto que este" }
              : reduce ? { pl: "bajan más que este",           sg: "baja más que este" }
              :          { pl: "suben más que este",           sg: "sube más que este" };
  const veredicto = VEREDICTO[isImc ? "imc" : reduce ? "baja" : "sube"][tramo];
  const lugar = `${VEREDICTO_CON_DE.has(tramo) ? donde.articulo : donde.en} ${nombre}`;

  // «Solo» donde el recuento es pequeño: sin él, un número bajo suelto no
  // se lee como pocos hasta compararlo con el total.
  const cuantos = delante === 0 ? "ninguno"
                : delante === 1 ? "solo uno"
                : tramo === "mas" ? `solo ${delante}`
                : `${delante}`;
  const verbo = delante > 1 ? habla.pl : habla.sg;
  return `<strong>${veredicto}</strong> ${lugar}: ` +
         `${cuantos} de sus ${total} distritos ${verbo}.`;
}

// Al comparar, lo que se sitúa en la región no es el cambio sino la
// distancia entre escenarios: dónde se separan más las dos trayectorias.
function contextoBrecha(valor, punto) {
  if (valor == null || !punto) return "";
  const grupo = datosRegionales(punto);
  if (!grupo) return "";
  const donde = nombreDeUnidad(grupo.props);
  if (!donde.nombre) return "";

  const total = grupo.valores.length;
  if (total === 1) return "";
  const { delante } = posicionEnGrupo(parseFloat(valor), grupo.valores, true);
  const nombre = escaparHTML(donde.nombre);
  const cuantos = delante === 0 ? "Ningún distrito"
                : delante === 1 ? "Solo un distrito"
                : `${delante} de los ${total} distritos`;
  const verbo = delante === 1 ? "separa" : "separan";
  return `<div class="info-contexto">${cuantos} ${donde.articulo}
          ${nombre} ${verbo} más los dos escenarios que este.</div>`;
}

function lineaContexto(valor, variable, isImc, punto) {
  const txt = contextoRegional(valor, variable, isImc, punto);
  return txt ? `<div class="info-contexto">${txt}</div>` : "";
}

// La ficha no muestra una barra de llenado sino la posición del valor
// dentro de la escala de la variable: la misma escala, en el mismo orden,
// que la leyenda del mapa. Un cambio pequeño se lee como una marca junto
// al centro y no como una franja de un milímetro, y el tramo donde cae la
// marca es el color con el que el distrito está pintado.
function escalaDe(variable) {
  if (variable === "pr")     return { bins: PREC_BINS, colores: PREC_COLORS };
  if (variable === "tasmax" || variable === "tasmin" || variable === "tasmed"
      || INDICES_EXTREMOS[variable])
    return { bins: TEMP_BINS, colores: TEMP_COLORS };
  return null;
}

// Posición en la banda: cada tramo de la leyenda ocupa la misma anchura y
// el valor se sitúa dentro del suyo en proporción.
function posicionEnEscala(v, bins, colores) {
  const n = colores.length;
  for (let i = 0; i < n; i++) {
    if (v > bins[i] && v <= bins[i + 1]) {
      const lo = Math.max(bins[i], bins[1] - (bins[2] - bins[1]));
      const hi = Math.min(bins[i + 1], bins[n - 1] + (bins[2] - bins[1]));
      const dentro = hi > lo ? Math.min(1, Math.max(0, (v - lo) / (hi - lo))) : 0.5;
      return ((i + dentro) / n) * 100;
    }
  }
  return v <= bins[1] ? 0 : 100;
}

function bandaDeEscala(colores) {
  const paso = 100 / colores.length;
  const tramos = colores.map((c, i) =>
    `${c} ${(i * paso).toFixed(3)}%, ${c} ${((i + 1) * paso).toFixed(3)}%`);
  return `linear-gradient(90deg, ${tramos.join(", ")})`;
}

function climateBarConfig(variable, valor) {
  if (valor == null) return null;
  const v = parseFloat(valor);
  if (isNaN(v)) return null;
  const escala = escalaDe(variable);
  if (!escala) return null;
  const { bins, colores } = escala;
  const esPrec = variable === "pr";
  const unidad = esPrec ? "%" : "°C";
  const fin = bins.length - 2;

  return {
    pos: posicionEnEscala(v, bins, colores),
    color: getClimateColor(v, variable),
    // Los tonos claros del centro de la escala no se leen como texto:
    // la cifra usa un color propio, con el sentido del cambio.
    colorTexto: esPrec
      ? (v < 0 ? "#b85c00" : "#2a8a50")
      : (v < 1.0 ? "#c47410" : v < 2.0 ? "#c04510" : "#a01010"),
    banda: bandaDeEscala(colores),
    // El cero solo separa dos sentidos cuando la escala los tiene
    cero: esPrec ? (bins.indexOf(0) / colores.length) * 100 : null,
    minLabel: `≤ ${bins[1]} ${unidad}`,
    midLabel: esPrec ? `0 ${unidad}` : `${bins[Math.round(colores.length / 2)]} ${unidad}`,
    maxLabel: `≥ ${bins[fin]} ${unidad}`,
  };
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

// Las dos lecturas enfrentadas, cada una sobre la misma escala de color que
// usa el mapa. Enfrentarlas en una tabla de dos números no dice nada: puestas
// sobre la banda se ve de un vistazo cuánto se mueve el distrito al pasar de
// una trayectoria a la otra.
function filaEscenario(escenario, valor, clave, destacada) {
  const cfg = climateBarConfig(clave, valor);
  const meta = ESCENARIOS[escenario];
  return `
    <div class="cmp-fila${destacada ? " severa" : ""}">
      <div class="cmp-fila-cab">
        <span class="cmp-tag">${meta.etiqueta}</span>
        <span class="cmp-nombre">${meta.nombre}</span>
        <span class="cmp-cifra" style="color:${cfg ? cfg.colorTexto : "#555"}">
          ${cifraDe(valor, clave)}
        </span>
      </div>
      ${cfg ? `<div class="escala-banda compacta" style="background:${cfg.banda}">
        ${cfg.cero != null ? `<span class="escala-cero" style="left:${cfg.cero}%"></span>` : ""}
        <span class="escala-marca" style="left:${cfg.pos}%;background:${cfg.color}"></span>
      </div>` : ""}
    </div>`;
}

function bloqueComparado(props, clave, punto) {
  const a = props.ssp245, b = props.ssp585;
  const brecha = props.valor;
  const positiva = brecha != null && parseFloat(brecha) >= 0;
  const leyenda = brecha == null ? "sin dato en uno de los escenarios"
                : clave === "pr"
                  ? (positiva ? "más lluvia en el escenario severo"
                              : "menos lluvia en el escenario severo")
                  : (positiva ? "más de calentamiento en el escenario severo"
                              : "menos de calentamiento en el escenario severo");
  return `
    <div class="cmp">
      <div class="cmp-brecha">
        <span class="cmp-brecha-rotulo">Brecha entre escenarios</span>
        <span class="cmp-brecha-cifra" style="color:${getBrechaColor(brecha, clave)}">
          ${cifraBrecha(brecha, clave)}
        </span>
        <span class="cmp-brecha-txt">${leyenda}</span>
      </div>
      ${filaEscenario("ssp245", a, clave, false)}
      ${filaEscenario("ssp585", b, clave, true)}
      ${contextoBrecha(brecha, punto)}
    </div>`;
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
    const tinte = IMC_COLORS_TEXTO[lbl] || "#888";
    rows.push({ k: "Categoría", v: `<span style="font-weight:700;color:${tinte}">${lbl}</span>` });
    rows.push({ k: "Valor IMC", v: fmt, highlight: true });
    const bar = imcBarConfig(valor);
    if (bar) {
      barHtml = `
      <div class="info-value-bar-wrap">
        <div class="info-value-bar-label">
          <span>${bar.minLabel}</span><span>${bar.midLabel}</span><span>${bar.maxLabel}</span>
        </div>
        <div class="escala-banda" style="background:${bar.banda}">
          <span class="escala-marca" style="left:${bar.pos}%;background:${bar.color}"></span>
        </div>
        ${lineaContexto(valor, null, true, punto)}
      </div>`;
    }
    interpretHtml = `<div class="info-interpret">${IMC_DESC[lbl] || ""}</div>`;
  } else if (comparaAhora()) {
    const extremo = INDICES_EXTREMOS[variable];
    rows.push(extremo
      ? { k: "Índice",   v: `${NOMBRE_VARIABLE[variable]} (${extremo.codigo})` }
      : { k: "Variable", v: NOMBRE_VARIABLE[variable] || variable });
    rows.push({ k: "Estación", v: seasonLabel(state.estacion) });
    rows.push({ k: "Período",  v: "2036–2065 vs 1981–2010" });
    barHtml = bloqueComparado(props, variable, punto);
    interpretHtml = notaTope(props, variable) + notaSignificancia(props, variable);
  } else {
    const unit = variable === "pr" ? "%" : "°C";
    const fmt  = valor != null ? `${signo(valor, variable)}${parseFloat(valor).toFixed(1)} ${unit}` : "Sin dato";
    const extremo = INDICES_EXTREMOS[variable];
    rows.push(extremo
      ? { k: "Índice",   v: `${NOMBRE_VARIABLE[variable]} (${extremo.codigo})` }
      : { k: "Variable", v: NOMBRE_VARIABLE[variable] || variable });
    rows.push({ k: "Escenario", v: `${ESCENARIOS[state.escenario].etiqueta} · ${ESCENARIOS[state.escenario].nombre}` });
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
          <div class="escala-banda" style="background:${bar.banda}">
            ${bar.cero != null ? `<span class="escala-cero" style="left:${bar.cero}%"></span>` : ""}
            <span class="escala-marca" style="left:${bar.pos}%;background:${bar.color}"></span>
          </div>
          ${lineaContexto(valor, variable, false, punto)}
        </div>`;
    }
    const interp = climateInterpret(variable, valor);
    if (interp) interpretHtml = `<div class="info-interpret">${interp.text}</div>`;
    interpretHtml = notaTope(props, variable) + notaSignificancia(props, variable) + interpretHtml;
  }

  return rows.map(r =>
      `<div class="info-row">
        <span class="info-key">${r.k}</span>
        <span class="info-val${r.highlight ? " highlight" : ""}">${r.v}</span>
      </div>`
    ).join("") + barHtml + interpretHtml;
}


// Punto interior garantizado. El centro del rectángulo envolvente sirve
// para la mayoría de los territorios, pero en los de forma cóncava cae
// fuera —y el distrito se atribuía al departamento vecino—, y en los
// archipiélagos cae en el agua que separa las islas. Se recorre entonces
// cada parte, de la mayor a la menor, cortándola con una recta horizontal
// y tomando el centro del tramo interior más ancho.
function centroDeParte(anillo) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of anillo) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { lat: (y0 + y1) / 2, lng: (x0 + x1) / 2, extension: (x1 - x0) * (y1 - y0) };
}

function cortarEnLatitud(anillo, lat, geom) {
  const cortes = [];
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
    if ((yi > lat) !== (yj > lat)) cortes.push(xi + ((xj - xi) * (lat - yi)) / (yj - yi));
  }
  if (cortes.length < 2) return null;
  cortes.sort((p, q) => p - q);
  let mejor = null, ancho = -1;
  for (let k = 0; k + 1 < cortes.length; k += 2) {
    const medio = (cortes[k] + cortes[k + 1]) / 2;
    const largo = cortes[k + 1] - cortes[k];
    if (largo > ancho && puntoEnGeometria(lat, medio, geom)) { ancho = largo; mejor = medio; }
  }
  return mejor == null ? null : L.latLng(lat, mejor);
}

function puntoRepresentativo(layer) {
  const centro = layer.getBounds().getCenter();
  const geom = layer.feature && layer.feature.geometry;
  if (!geom) return centro;
  if (puntoEnGeometria(centro.lat, centro.lng, geom)) return centro;

  const partes = geom.type === "Polygon" ? [geom.coordinates]
               : geom.type === "MultiPolygon" ? geom.coordinates
               : [];
  const candidatas = partes
    .filter(p => p.length && p[0].length > 2)
    .map(p => ({ anillo: p[0], ...centroDeParte(p[0]) }))
    .sort((a, b) => b.extension - a.extension);

  for (const c of candidatas) {
    if (puntoEnGeometria(c.lat, c.lng, geom)) return L.latLng(c.lat, c.lng);
    const punto = cortarEnLatitud(c.anillo, c.lat, geom);
    if (punto) return punto;
  }
  return centro;
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
    const bar = imcBarConfig(valor);
    if (bar) barra = `<div class="escala-banda compacta" style="background:${bar.banda}">
      <span class="escala-marca" style="left:${bar.pos}%;background:${bar.color}"></span></div>`;
  } else if (comparaAhora()) {
    cifra = cifraBrecha(valor, variable);
    color = getBrechaColor(valor, variable);
    etiqueta = `Brecha entre escenarios · ${NOMBRE_VARIABLE[variable] || variable} · ${seasonLabel(state.estacion)}`;
    barra = bloqueComparado(props, variable, punto);
  } else {
    const unidad = variable === "pr" ? "%" : "°C";
    cifra = valor != null
      ? `${signo(valor, variable)}${parseFloat(valor).toFixed(1)} ${unidad}`
      : "Sin dato";
    etiqueta = `${NOMBRE_VARIABLE[variable] || variable} · ${ESCENARIOS[state.escenario].etiqueta} · ${seasonLabel(state.estacion)}`;
    const cfg = climateBarConfig(variable, valor);
    color = cfg ? cfg.colorTexto : "#888";
    if (cfg) barra = `<div class="escala-banda compacta" style="background:${cfg.banda}">
      ${cfg.cero != null ? `<span class="escala-cero" style="left:${cfg.cero}%"></span>` : ""}
      <span class="escala-marca" style="left:${cfg.pos}%;background:${cfg.color}"></span></div>`;
    const interp = climateInterpret(variable, valor);
    if (interp) texto = interp.text;
  }

  const ubica = ref ? `${ref.etiqueta}: ${ref.valor}` : "";

  const contexto = comparaAhora() && !isImc
    ? notaTope(props, variable) + notaSignificancia(props, variable)
    : lineaContexto(valor, variable, isImc, punto)
      + (isImc ? "" : notaTope(props, variable) + notaSignificancia(props, variable));

  return `<button class="ic-manija" id="icManija" aria-label="Extender la ficha"></button>
          <div class="ic-cabecera">
            <span class="ic-lugar">${distrito}</span>
            ${ubica ? `<span class="ic-ubica">${ubica}</span>` : ""}
          </div>
          <div class="ic-cifra" style="color:${color}">${cifra}</div>
          <div class="ic-meta">${etiqueta}</div>
          ${barra}
          ${contexto}
          <div class="ic-periodo">${isImc ? "Índice normalizado · 2036–2065"
                                    : "2036–2065 respecto a 1981–2010"}</div>
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
  elevarDistrito(layer);
}

// El distrito consultado se levanta y el resto del mapa se hunde: la
// atención va a un territorio, no a la mancha entera. Es una clase sobre el
// plano de datos y otra sobre el trazo elegido —dos escrituras en el DOM—,
// no 1891 cambios de estilo uno por uno.
function elevarDistrito(layer) {
  const plano = map.getPane("datos");
  document.querySelectorAll(".distrito-elevado")
    .forEach(el => el.classList.remove("distrito-elevado"));
  if (!layer || !layer._path) { if (plano) plano.classList.remove("enfocado"); return; }
  if (plano) plano.classList.add("enfocado");
  layer._path.classList.add("distrito-elevado");
}

function bajarDistritos() {
  const plano = map.getPane("datos");
  if (plano) plano.classList.remove("enfocado");
  document.querySelectorAll(".distrito-elevado")
    .forEach(el => el.classList.remove("distrito-elevado"));
}

function limpiarSeleccion() {
  bajarDistritos();
  if (!selectedFeature) return;
  const capa = capaActiva();
  if (capa) capa.resetStyle(selectedFeature);
  selectedFeature = null;
}

function ocultarInfo() {
  bajarDistritos();
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
      className: comparaAhora() ? "info-popup peek comparando" : "info-popup peek",
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
      if (!globo) return;
      evitarChoqueConLeyenda(globo);
    }, 60);
    return;
  }

  const abierto = infoPopup;
  infoPopup = null;
  if (abierto) map.closePopup(abierto);

  const panel = document.getElementById("infoPanel");
  panel.classList.remove("extendida");
  panel.classList.toggle("compacto", enTelefono);
  panel.classList.toggle("comparando", comparaAhora());
  // Reiniciar la animación: sin quitar la clase y forzar un reflujo, la
  // segunda consulta seguida aparecería sin el gesto de entrada.
  panel.classList.remove("peek");
  void panel.offsetWidth;
  panel.classList.add("peek");
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
  const title  = isPrec ? "Δ Precipitación (%)"
                        : `Δ ${NOMBRE_VARIABLE[variable]} (°C)`;

  const items = colors.map((c, i) => {
    const lo = bins[i], hi = bins[i + 1];
    const label = lo <= -900 ? `≤ ${hi}` : hi >= 900 ? `≥ ${lo}` : `${lo} – ${hi}`;
    return `<div class="legend-item">
      <span class="legend-swatch" style="background:${c}"></span>
      <span class="legend-label">${label} ${unit}</span>
    </div>`;
  }).join("");

  const extremo = INDICES_EXTREMOS[variable];
  const esc = ESCENARIOS[state.escenario];
  const nota = extremo ? `${extremo.codigo} · Cambio respecto a 1981–2010`
                       : "Cambio respecto a 1981–2010";
  el.innerHTML = `
    <div class="legend-title">${title}</div>
    <div class="legend-escenario">${esc.etiqueta} · ${esc.nombre}</div>
    <div class="legend-ref-note">${nota}</div>
    ${items}`;
}

// La leyenda de la comparación no describe un escenario sino la distancia
// entre los dos, así que lleva su propia escala y lo dice en el título.
function buildBrechaLegend(clave) {
  const el = document.getElementById("legendContent");
  document.getElementById("mapLegend").classList.remove("empty");
  const { bins, colores } = escalaDeBrecha(clave);
  const unit = unidadDe(clave);

  const items = colores.map((c, i) => {
    const lo = bins[i], hi = bins[i + 1];
    const label = lo <= -900 ? `≤ ${hi}` : hi >= 900 ? `≥ ${lo}` : `${lo} a ${hi}`;
    return `<div class="legend-item">
      <span class="legend-swatch" style="background:${c}"></span>
      <span class="legend-label">${label} ${unit}</span>
    </div>`;
  }).join("");

  el.innerHTML = `
    <div class="legend-title">Brecha · ${NOMBRE_VARIABLE[clave] || clave}</div>
    <div class="legend-escenario comparando">SSP5-8.5 menos SSP2-4.5</div>
    <div class="legend-ref-note">Cuánto añade el escenario severo sobre el moderado</div>
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
    <div class="legend-ref-note">Índice normalizado de 0 a 1 · 2036–2065</div>
    ${items}`;
}

// ─── Cargar/refrescar la capa de datos ────────────────────
// Una sola vía para la capa climática y la del índice: se diferencian en
// el archivo, el color y el trazo, no en el procedimiento.
const ESTILO_CLIMA   = { color: "#555",    weight: 0.3,  fillOpacity: 0.85 };
const ESTILO_IMC     = { color: "#5e005e", weight: 0.5,  fillOpacity: 0.82 };
const ESTILO_BRECHA  = { color: "#3d2a52", weight: 0.35, fillOpacity: 0.88 };

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

// El multipeligro no depende del escenario, y la temperatura media solo
// existe en el moderado: comparar solo tiene sentido con el resto.
function comparaAhora() {
  const clave = state.indice || state.variable;
  return state.comparar && !state.imcActive
      && escenarioTiene("ssp245", clave) && escenarioTiene("ssp585", clave);
}

async function cargarDatos() {
  const generacion = ++generacionDatos;
  quitarCapasDeDatos();
  ocultarInfo();

  const esImc  = state.imcActive;
  const clave  = state.indice || state.variable;
  const compara = comparaAhora();

  const pedirDatos = esImc   ? () => cargarValores(imcFilename(state.imcTipo))
                                       .then(d => distritosDesdeValores(d))
                    : compara ? () => distritosComparados(clave, state.estacion)
                    :           () => distritosConValores(clave, state.estacion, state.escenario);

  showLoader(esImc
    ? `Cargando ${NOMBRE_VARIABLE.imc} · Anual`
    : compara
      ? `Comparando escenarios · ${NOMBRE_VARIABLE[clave]} · ${seasonLabel(state.estacion)}`
      : `Cargando ${NOMBRE_VARIABLE[clave]} · ${ESCENARIOS[state.escenario].etiqueta} · ${seasonLabel(state.estacion)}`);

  try {
    const data = await pedirDatos();
    if (generacion !== generacionDatos) return;

    const base = esImc ? ESTILO_IMC : compara ? ESTILO_BRECHA : ESTILO_CLIMA;
    const capa = L.geoJSON(data, {
      pane: "datos",
      style: feat => Object.assign({
        fillColor: esImc   ? getImcColor(feat.properties.valor)
                 : compara ? getBrechaColor(feat.properties.valor, clave)
                 :           getClimateColor(feat.properties.valor, clave),
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
    if (esImc) buildImcLegend();
    else if (compara) buildBrechaLegend(clave);
    else buildClimateLegend(clave);
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

// El multipeligro llega en el mismo formato de valores sueltos que el resto.
async function distritosDesdeValores(datos) {
  const geo = await cargarGeometriaDistritos();
  comprobarLargo(datos, geo, "el índice multipeligro");
  return {
    type: "FeatureCollection",
    features: geo.features.map((f, i) => ({
      type: "Feature",
      geometry: f.geometry,
      properties: { DISTRITO: f.properties.DISTRITO, valor: datos.valores[i] },
    })),
  };
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
      pane: "referencia",
      style: { color: "#1a2a4e", weight: 1.4, fillOpacity: 0, interactive: false },
    }).addTo(map);
  } catch (err) {
    console.warn("Capa de referencia no disponible:", err.message);
  } finally {
    hideLoader();
    if (generacion === generacionRef) refrescarConsulta();
  }
}

// ─── Helpers de etiquetas ─────────────────────────────────
function seasonLabel(v) {
  return { anual:"Anual", DEF:"Verano (DEF)", MAM:"Otoño (MAM)", JJA:"Invierno (JJA)", SON:"Primavera (SON)" }[v] || v;
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
    // Volver a pulsar la temporada ya aplicada no cambia nada, y recargar
    // dejaría el mapa en blanco un instante para pintar lo mismo. Los demás
    // grupos ya se guardaban de esto; este no.
    if (state.estacion === btn.dataset.value) return;
    document.querySelectorAll(".btn-season").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.estacion = btn.dataset.value;
    cargarDatos();
  });
});

// ─── Variable climática (incluye IMC e índices extremos) ──
// Los índices son una variable más de cara al mapa: entran por la misma
// tarjeta y solo se distinguen en la subsección que despliegan.
const panelIndices = document.getElementById("indicePanel");

function marcarIndice(clave) {
  panelIndices.querySelectorAll(".indice-op").forEach(b =>
    b.classList.toggle("active", b.dataset.value === clave));
}

function activarIndice(clave) {
  if (state.variable === clave) return;
  marcarIndice(clave);
  state.indice    = clave;
  state.variable  = clave;
  state.imcActive = false;
  setSeasonBlocked(false);
  refrescarBotonComparar();
  cargarDatos();
}

setupRadioGroup("varGroup", value => {
  if (value === "indices") {
    panelIndices.hidden = false;
    const fila = panelIndices.querySelector(".indice-op.active")
              || panelIndices.querySelector(".indice-op");
    activarIndice(fila.dataset.value);
    return;
  }
  panelIndices.hidden = true;
  if (!state.indice && state.variable === value) return;
  state.indice    = null;
  state.imcActive = value === "imc";
  state.variable  = value;
  setSeasonBlocked(state.imcActive);
  if (state.imcActive && state.comparar) {
    state.comparar = false;
    marcarEscenario();
  }
  refrescarBotonComparar();
  cargarDatos();
});

panelIndices.querySelectorAll(".indice-op").forEach(btn => {
  btn.addEventListener("click", () => activarIndice(btn.dataset.value));
});

// ─── Capa de referencia (radio exclusivo) ─────────────────
setupRadioGroup("refLayerGroup", value => {
  if (state.refLayer === value) return;
  state.refLayer = value;
  cargarReferencia(value);
});

// ─── Escenario de emisiones ───────────────────────────────
// Dos cápsulas y un tercer estado: comparar. Elegir un escenario apaga la
// comparación, y comparar no borra cuál estaba elegido —al volver, el mapa
// vuelve al que el usuario tenía.
const grupoEscenario = document.getElementById("escenarioGroup");
const btnComparar    = document.getElementById("btnComparar");
const avisoEscenario = document.getElementById("escenarioAviso");

function rotularCromo() {
  const sub = document.getElementById("navbarEscenario");
  const pie = document.getElementById("footerEscenario");
  const esc = ESCENARIOS[state.escenario];
  const texto = state.comparar
    ? "SSP2-4.5 vs SSP5-8.5 · CMIP6 · Resolución 5 km · Período 2036–2065"
    : `Escenario ${esc.etiqueta} CMIP6 · Resolución 5 km · Período 2036–2065`;
  if (sub) sub.textContent = texto;
  if (pie) pie.textContent = texto;
}

// Las tarjetas de variable que el escenario en curso no tiene se apagan en
// lugar de desaparecer: el hueco se explica solo, y quien busca la
// temperatura media entiende por qué no está.
function refrescarDisponibilidad() {
  let faltante = null;
  document.querySelectorAll("#varGroup .radio-card").forEach(card => {
    const clave = card.dataset.value;
    const solo = SOLO_EN_ESCENARIO[clave];
    if (!solo) return;
    const fuera = state.comparar || solo !== state.escenario;
    card.classList.toggle("no-disponible", fuera);
    if (fuera) faltante = clave;
    const desc = card.querySelector(".radio-desc");
    if (desc) {
      if (!desc.dataset.original) desc.dataset.original = desc.textContent;
      desc.textContent = fuera ? `Solo en ${ESCENARIOS[solo].etiqueta}` : desc.dataset.original;
    }
  });

  if (avisoEscenario) {
    avisoEscenario.style.display = faltante ? "block" : "none";
    if (faltante) {
      avisoEscenario.textContent = state.comparar
        ? `La ${NOMBRE_VARIABLE[faltante]} no se puede comparar: no hay malla del SSP5-8.5.`
        : `La ${NOMBRE_VARIABLE[faltante]} solo está en el ${ESCENARIOS[SOLO_EN_ESCENARIO[faltante]].etiqueta}.`;
    }
  }

  // Si la variable en pantalla es justo la que deja de existir, el mapa no
  // puede quedarse en blanco: se pasa a la máxima, que es su pariente más
  // cercano, y la tarjeta se marca sola.
  const actual = state.indice || state.variable;
  if ((!state.imcActive && !escenarioTiene(state.escenario, actual))
      || (state.comparar && SOLO_EN_ESCENARIO[actual])) {
    state.variable = "tasmax";
    state.indice = null;
    document.querySelectorAll("#varGroup .radio-card").forEach(c =>
      c.classList.toggle("active", c.dataset.value === "tasmax"));
    document.getElementById("indicePanel").hidden = true;
    return true;
  }
  return false;
}

function marcarEscenario() {
  grupoEscenario.querySelectorAll(".capsula").forEach(b => {
    const activa = !state.comparar && b.dataset.value === state.escenario;
    b.classList.toggle("active", activa);
    b.setAttribute("aria-pressed", String(activa));
  });
  grupoEscenario.classList.toggle("comparando", state.comparar);
  btnComparar.classList.toggle("active", state.comparar);
  btnComparar.setAttribute("aria-pressed", String(state.comparar));
  btnComparar.querySelector(".comparar-texto").textContent =
    state.comparar ? "Viendo la brecha" : "Comparar los dos";
  document.body.classList.toggle("modo-comparar", state.comparar);
  refrescarDisponibilidad();
  rotularCromo();
}

function elegirEscenario(clave) {
  if (!ESCENARIOS[clave]) return;
  if (state.escenario === clave && !state.comparar) return;
  state.escenario = clave;
  state.comparar = false;
  marcarEscenario();
  cargarDatos();
}

function alternarComparacion() {
  if (state.imcActive) return;
  state.comparar = !state.comparar;
  marcarEscenario();
  cargarDatos();
}

grupoEscenario.querySelectorAll(".capsula").forEach(btn => {
  btn.addEventListener("click", () => elegirEscenario(btn.dataset.value));
});
btnComparar.addEventListener("click", alternarComparacion);

// El multipeligro es un índice único, sin escenario que enfrentar.
function refrescarBotonComparar() {
  const bloqueado = state.imcActive;
  btnComparar.classList.toggle("blocked", bloqueado);
  btnComparar.disabled = bloqueado;
  btnComparar.title = bloqueado
    ? "El Índice Multipeligro no depende del escenario"
    : "Pintar la distancia entre los dos escenarios";
}

marcarEscenario();
refrescarBotonComparar();

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

["varGroup", "refLayerGroup", "seasonGroup"].forEach(id => {
  const grupo = document.getElementById(id);
  if (!grupo) return;
  grupo.addEventListener("click", e => {
    // Elegir «Índices extremos» no cierra la elección sino que la abre: los
    // cuatro cortes se despliegan debajo, y plegar el panel aquí dejaría al
    // usuario sin poder llegar a ellos.
    if (e.target.closest('.radio-card[data-value="indices"]')) return;
    if (esMovil()) setTimeout(cerrarSidebar, 220);
  });
});

// La subsección sí cierra: elegir un índice concreto ya es la última decisión
panelIndices.addEventListener("click", e => {
  if (e.target.closest(".indice-op") && esMovil()) setTimeout(cerrarSidebar, 220);
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
