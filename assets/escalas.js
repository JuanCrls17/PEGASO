/* =========================================================
   escalas.js — de un número a un color y a una cifra

   Las dos rampas del dato, la de la brecha entre escenarios y la del
   índice multipeligro, con lo que hace falta para pintar una banda y
   escribir la cifra que la acompaña.

   Cálculo puro: nada de aquí toca el mapa, el DOM ni el estado.
   ========================================================= */

// ─── Paletas de colores ────────────────────────────────────
export const PREC_BINS   = [-999,-90,-75,-60,-45,-30,-15,0,15,30,45,60,75,90,999];

export const PREC_COLORS = [
  "#663300","#7b4d1b","#916836","#a68351","#bc9d6d","#d2b888","#e7d3a3",
  "#c1f4db","#a1d4bf","#80b3a3","#609387","#40736b","#20534f","#003333"
];

export const TEMP_BINS   = [-999,0.2,0.4,0.6,0.8,1.0,1.2,1.4,1.6,1.8,2.0,2.2,
                     2.4,2.6,2.8,3.0,3.2,3.4,3.6,3.8,999];

export const TEMP_COLORS = [
  "#ffffcc","#fff7b9","#fff0a7","#ffe895","#fee983","#fed572","#fec460",
  "#feb44e","#fea446","#fd953f","#fd8038","#fc6531","#fb4b29","#f03523",
  "#e61f1d","#d7121f","#c70723","#b30026","#9a0026","#800026"
];

export const NOMBRE_VARIABLE = {
  pr: "Precipitación", tasmax: "T° Máxima", tasmin: "T° Mínima",
  imc: "Índice Multipeligro",
  txx: "Día más cálido", txn: "Día más fresco",
  tnx: "Noche más cálida", tnn: "Noche más fría",
};

// ─── Escenarios de emisiones ──────────────────────────────
// Dos trayectorias del CMIP6 sobre la misma malla y el mismo período: se
// eligen por separado y se pueden enfrentar. El severo es el que la
// plataforma publicaba hasta ahora, y sigue siendo el que abre.
export const ESCENARIOS = {
  ssp245: {
    etiqueta: "SSP2-4.5", nombre: "Moderado",
    resumen: "Las emisiones se estabilizan hacia mitad de siglo",
  },
  ssp585: {
    etiqueta: "SSP5-8.5", nombre: "Severo",
    resumen: "Las emisiones siguen creciendo sin freno",
  },
};

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
// La brecha se pinta en el azul de la casa —el mismo tono del cromo, más
// abierto y más cerrado—, que ninguna de las dos rampas de datos ocupa: la
// de temperatura va de amarillo a rojo y la de lluvia de marrón a verde
// azulado, así que el azul se lee de inmediato como «esto es otra cosa».
// El ámbar queda para lo excepcional: que el escenario moderado vaya más
// lejos que el severo, que pasa en el 1 % del territorio.
// Los pasos están medidos en OKLCH y ninguna pareja vecina baja de ΔE 8.
const BRECHA_ESCALAS = {
  temp: {
    bins: [-999, -0.2, 0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.75, 999],
    colores: ["#ad7227", "#efc395", "#ccdef9", "#a6bee5", "#80a0d1",
              "#5c82bd", "#3864a8", "#114593", "#00257d"],
  },
  prec: {
    bins: [-999, -40, -20, -10, 0, 10, 20, 40, 999],
    colores: ["#975800", "#b78246", "#d6ad80", "#f6d8ba",
              "#cddffd", "#83a3d5", "#3d68ac", "#002c82"],
  },
};

// ─── Índices extremos de temperatura (ETCCDI) ─────────────
// No son promedios sino los extremos del período: TXx y TXn salen de la
// temperatura máxima diaria —el día más caluroso y el más fresco—, TNx y TNn de
// la mínima —la noche más cálida y la más fría—. Los cuatro se publican
// como cambio en grados frente a 1981-2010, así que comparten la escala de
// temperatura con tasmax y tasmin.
export const INDICES_EXTREMOS = {
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

export const NOMBRE_REFERENCIA = {
  departamentos: "departamentos", provincias: "provincias", cuencas: "cuencas hidrográficas",
};

export const IMC_COLORS = {
  "Muy Alto": "#d7191c",
  "Alto":     "#f7941d",
  "Medio":    "#f1dd00",
  "Bajo":     "#9bc68b",
};

// El amarillo y el verde del mapa no tienen contraste suficiente como
// texto sobre el fondo claro de la ficha: allí se usa una versión oscura.
export const IMC_COLORS_TEXTO = {
  "Muy Alto": "#c0141a",
  "Alto":     "#c47410",
  "Medio":    "#8a7a00",
  "Bajo":     "#3f7d46",
};

export const IMC_ORDEN = ["Bajo", "Medio", "Alto", "Muy Alto"];

export function imcBarConfig(valor) {
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

export const IMC_DESC = {
  "Muy Alto": "Este territorio tiene <strong>exposición crítica</strong> a múltiples peligros climáticos simultáneos. Se recomienda planificación urgente de adaptación.",
  "Alto":     "Alta concurrencia de amenazas climáticas. Requiere <strong>medidas de adaptación</strong> en los sectores más vulnerables.",
  "Medio":    "Exposición <strong>moderada</strong> a peligros climáticos. Monitoreo continuo y planificación preventiva recomendados.",
  "Bajo":     "Baja exposición relativa a peligros climáticos en comparación con otras zonas del país.",
};

// ─── Helpers de color ─────────────────────────────────────
export function getClimateColor(value, variable) {
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

export function escalaDeBrecha(variable) {
  return variable === "pr" ? BRECHA_ESCALAS.prec : BRECHA_ESCALAS.temp;
}

export function getBrechaColor(value, variable) {
  if (value == null) return "#cccccc";
  const v = parseFloat(value);
  if (isNaN(v)) return "#cccccc";
  const { bins, colores } = escalaDeBrecha(variable);
  for (let i = 0; i < bins.length - 1; i++) {
    if (v > bins[i] && v <= bins[i + 1]) return colores[i];
  }
  return "#cccccc";
}

// La escala de la brecha está hecha para rellenar un distrito, no para
// leerse: sobre el fondo claro de la ficha su azul del primer tramo da
// 1,2:1 y el ámbar claro 3:1. La cifra lleva su propia rampa oscura, como
// ya hacen la del clima y la del índice —el matiz fino lo pone la banda
// de color que va justo debajo.
const BRECHA_TEXTO_AMBAR = "#8a5a00";

const BRECHA_TEXTO_AZUL  = ["#1a5fb4", "#12459a", "#0a3580", "#002163"];

export function colorTextoBrecha(value, variable) {
  if (value == null) return "#4a5568";
  const v = parseFloat(value);
  if (isNaN(v)) return "#4a5568";
  const { bins, colores } = escalaDeBrecha(variable);
  let tramo = -1;
  for (let i = 0; i < bins.length - 1; i++) {
    if (v > bins[i] && v <= bins[i + 1]) { tramo = i; break; }
  }
  if (tramo < 0) return "#4a5568";
  // Los primeros tramos son los ámbar —que el moderado vaya más lejos que
  // el severo—; el resto es el azul de la casa, que se cierra conforme la
  // brecha crece.
  const primerAzul = variable === "pr" ? 4 : 2;
  if (tramo < primerAzul) return BRECHA_TEXTO_AMBAR;
  const ultimo = colores.length - 1;
  const dentro = ultimo > primerAzul ? (tramo - primerAzul) / (ultimo - primerAzul) : 1;
  return BRECHA_TEXTO_AZUL[Math.round(dentro * (BRECHA_TEXTO_AZUL.length - 1))];
}

export function getImcColor(value) {
  if (value == null) return "#cccccc";
  const v = parseFloat(value);
  if (isNaN(v)) return "#cccccc";
  if (v >= 0.75) return IMC_COLORS["Muy Alto"];
  if (v >= 0.50) return IMC_COLORS["Alto"];
  if (v >= 0.25) return IMC_COLORS["Medio"];
  return IMC_COLORS["Bajo"];
}

export function imcLabel(value) {
  const v = parseFloat(value);
  if (isNaN(v)) return "Sin dato";
  if (v >= 0.75) return "Muy Alto";
  if (v >= 0.50) return "Alto";
  if (v >= 0.25) return "Medio";
  return "Bajo";
}

// La ficha no muestra una barra de llenado sino la posición del valor
// dentro de la escala de la variable: la misma escala, en el mismo orden,
// que la leyenda del mapa. Un cambio pequeño se lee como una marca junto
// al centro y no como una franja de un milímetro, y el tramo donde cae la
// marca es el color con el que el distrito está pintado.
function escalaDe(variable) {
  if (variable === "pr")     return { bins: PREC_BINS, colores: PREC_COLORS };
  if (variable === "tasmax" || variable === "tasmin" || INDICES_EXTREMOS[variable])
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

export function climateBarConfig(variable, valor) {
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
      ? (v < 0 ? "#a85200" : "#1f7a44")
      : (v < 1.0 ? "#a05c0c" : v < 2.0 ? "#b03d0e" : "#a01010"),
    banda: bandaDeEscala(colores),
    // El cero solo separa dos sentidos cuando la escala los tiene
    cero: esPrec ? (bins.indexOf(0) / colores.length) * 100 : null,
    minLabel: `≤ ${bins[1]} ${unidad}`,
    midLabel: esPrec ? `0 ${unidad}` : `${bins[Math.round(colores.length / 2)]} ${unidad}`,
    maxLabel: `≥ ${bins[fin]} ${unidad}`,
  };
}

// ─── Escenarios en la ficha ───────────────────────────────
export function unidadDe(clave) {
  return clave === "pr" ? "%" : "°C";
}

// El signo positivo se explicita en temperatura, donde un aumento es la
// lectura relevante; el negativo ya lo pone el propio número.
export function signo(valor, variable) {
  return variable !== "pr" && parseFloat(valor) >= 0 ? "+" : "";
}

export function cifraDe(valor, clave) {
  if (valor == null) return "Sin dato";
  const v = parseFloat(valor);
  if (isNaN(v)) return "Sin dato";
  return `${signo(v, clave)}${v.toFixed(1)} ${unidadDe(clave)}`;
}

// La brecha lleva siempre su signo: es una distancia con sentido, no una
// magnitud suelta. Positiva significa que el escenario severo va más lejos.
export function cifraBrecha(valor, clave) {
  if (valor == null) return "—";
  const v = parseFloat(valor);
  if (isNaN(v)) return "—";
  const n = clave === "pr" ? v.toFixed(1) : v.toFixed(2);
  return `${v >= 0 ? "+" : ""}${n} ${unidadDe(clave)}`;
}

// ─── El filete de la escala ───────────────────────────────
// La cabecera se abre y el pie se cierra con tres píxeles de la rampa del
// dato. PEGASO no tiene una rampa sino varias —una por variable, más la de
// la brecha y la del índice—, así que el filete no es fijo: se reescribe
// con la escala que el mapa está pintando.
export function gradienteDe(colores) {
  const ultimo = colores.length - 1;
  const paradas = colores.map((c, i) => `${c} ${(i / ultimo * 100).toFixed(2)}%`);
  return `linear-gradient(90deg, ${paradas.join(", ")})`;
}
