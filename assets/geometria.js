/* =========================================================
   geometria.js — polígonos, puntos y posiciones

   Si un punto cae dentro de un contorno, qué punto interior representa a
   un territorio de forma irregular y en qué lugar de su grupo queda un
   valor. Sin dependencias de ningún otro módulo.
   ========================================================= */

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

export function puntoEnGeometria(lat, lon, geom) {
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

export function puntoRepresentativo(layer) {
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

// Cuántos distritos del grupo quedan por delante y por detrás del valor,
// contando desde el extremo que interesa: el mayor aumento, la mayor
// reducción o la mayor exposición. Los empates no van a ningún lado, de
// modo que dos distritos con el mismo valor reciben la misma lectura.
export function posicionEnGrupo(valor, ordenados, descendente) {
  const v = parseFloat(valor);
  let delante = 0, detras = 0;
  for (const x of ordenados) {
    if (x === v) continue;
    if (descendente ? x > v : x < v) delante++;
    else detras++;
  }
  return { delante, detras };
}
