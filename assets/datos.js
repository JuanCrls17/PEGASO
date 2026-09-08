/* =========================================================
   datos.js — rutas y carga de los archivos

   Una sola geometría para los 1891 distritos y un archivo de valores por
   corte, que se le acopla en el orden en que vienen. Cada respuesta se
   guarda para no volver a pedirla.
   ========================================================= */

// ─── Rutas de los datos ───────────────────────────────────
// Todo lo que pinta el mapa vive en data/valores/: un archivo por
// escenario, variable y corte, con los 1891 valores en el mismo orden que
// data/distritos.geojson. Ver tools/generar_valores.py.
function valoresFilename(escenario, clave, estacion) {
  const est = estacion === "anual" ? "anual" : estacion.toUpperCase();
  return `data/valores/${escenario}/${clave}_${est}.json`;
}

export function imcFilename(tipo) {
  return `data/valores/imc_${tipo}.json`;
}

export function refFilename(layer) {
  return `data/${layer}.geojson`;
}

// ─── Carga de GeoJSON con fetch ───────────────────────────
export async function fetchGeoJSON(path) {
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

export function cargarValores(ruta) {
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
export async function distritosConValores(clave, estacion, escenario) {
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
export async function distritosComparados(clave, estacion) {
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

// El multipeligro llega en el mismo formato de valores sueltos que el resto.
export async function distritosDesdeValores(datos) {
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
