#!/usr/bin/env python3
"""
Genera data/valores/ — los valores por distrito que consume el visor.

La geometría de los 1891 distritos pesa 2,5 MB y es la misma para todos los
cortes: se publica una sola vez en data/distritos.geojson y aquí salen solo
los valores, 15 KB por corte, emparejados por posición.

Fuentes
  SSP2-4.5  cambios/{anual,trimestral}/*.nc  ·  INDICES_EXTREMOS_CLIMATICOS245/*.nc
  SSP5-8.5  data/distritos_cambio_*.geojson  ·  data/indices/*.json
            (no se conservan las mallas .nc del escenario severo, así que sus
             valores se copian de lo ya publicado en lugar de recalcularse)

Agregación
  Promedio de las celdas cuyo centro cae dentro del distrito. Los distritos
  demasiado pequeños para contener un centro —85 de 1891— toman la celda más
  cercana a su punto representativo. Esta receta reproduce 1869 de los 1891
  valores del SSP5-8.5 ya publicados, al cuarto decimal.

Uso:  python tools/generar_valores.py
"""
import json
import sys
from pathlib import Path

import numpy as np
import xarray as xr

try:
    import geopandas as gpd
    from scipy.spatial import cKDTree
except ImportError:
    sys.exit("Faltan dependencias: pip install geopandas scipy netCDF4 xarray")

RAIZ = Path(__file__).resolve().parent.parent
DATA = RAIZ / "data"
SALIDA = DATA / "valores"

# El .nc nombra el verano austral DJF; el visor lo rotula DEF, en español.
CORTES = [("anual", "anual"), ("djf", "DEF"), ("mam", "MAM"),
          ("jja", "JJA"), ("son", "SON")]

VARIABLES = {
    "pr":     {"unidad": "%",  "nombre": "Precipitación"},
    "tasmax": {"unidad": "°C", "nombre": "Temperatura máxima"},
    "tasmin": {"unidad": "°C", "nombre": "Temperatura mínima"},
    "tasmed": {"unidad": "°C", "nombre": "Temperatura media"},
}

INDICES = {
    "txx": {"nc": "TXx", "unidad": "°C"},
    "txn": {"nc": "TXn", "unidad": "°C"},
    "tnx": {"nc": "TNx", "unidad": "°C"},
    "tnn": {"nc": "TNn", "unidad": "°C"},
}

# La costa desértica casi no recibe lluvia en invierno: pasar de una décima de
# milímetro a dos es un +1900 % que no dice nada. El SSP5-8.5 publicado ya trae
# ese tope aplicado —42 distritos clavados en 100 en pr_JJA—, así que el
# SSP2-4.5 lleva el mismo, o los dos escenarios dejan de ser comparables.
TOPE_PR = 100.0


# ── Agregación zonal ──────────────────────────────────────
_distritos = None
_arbol = None


def distritos():
    global _distritos
    if _distritos is None:
        _distritos = gpd.read_file(DATA / "distritos.geojson")
    return _distritos


def zonal(da):
    """Media de las celdas con centro dentro; vecino más cercano si no hay ninguna."""
    dist = distritos()
    lat = da["lat"].values
    lon = da["lon"].values
    vals = np.asarray(da.values, dtype=float)
    LON, LAT = np.meshgrid(lon, lat)
    dentro = ~np.isnan(vals)
    celdas = vals[dentro]

    puntos = gpd.GeoDataFrame(
        {"v": celdas},
        geometry=gpd.points_from_xy(LON[dentro], LAT[dentro]),
        crs="EPSG:4326",
    )
    unidos = gpd.sjoin(puntos, dist[["geometry"]], how="inner", predicate="within")
    medias = unidos.groupby("index_right")["v"].mean()

    salida = np.full(len(dist), np.nan)
    salida[medias.index.values] = medias.values

    huecos = np.where(np.isnan(salida))[0]
    if len(huecos):
        arbol = cKDTree(np.c_[LON[dentro], LAT[dentro]])
        centro = dist.geometry.representative_point()
        _, idx = arbol.query(np.c_[centro.x.values[huecos], centro.y.values[huecos]])
        salida[huecos] = celdas[idx]
    return salida


# ── Escritura ─────────────────────────────────────────────
def escribir(escenario, clave, corte, valores, unidad, extra=None):
    destino = SALIDA / escenario
    destino.mkdir(parents=True, exist_ok=True)
    cuerpo = {
        "clave": clave,
        "escenario": escenario,
        "periodo": corte,
        "unidad": unidad,
        "n": len(valores),
        "valores": [None if np.isnan(v) else round(float(v), 4) for v in valores],
    }
    if extra:
        cuerpo.update(extra)
    archivo = destino / f"{clave}_{corte}.json"
    archivo.write_text(json.dumps(cuerpo, ensure_ascii=False, separators=(",", ":")))
    return archivo


def recortar_pr(valores):
    """Aplica el tope de precipitación y devuelve qué distritos lo tocaron."""
    topados = np.where(np.abs(valores) > TOPE_PR)[0]
    return np.clip(valores, -TOPE_PR, TOPE_PR), [int(i) for i in topados]


# ── SSP2-4.5: desde las mallas NetCDF ─────────────────────
def variables_245():
    generados = []
    for var, meta in VARIABLES.items():
        anual = RAIZ / "cambios" / "anual" / f"{var}_cambio_anual_ssp245.nc"
        estac = RAIZ / "cambios" / "trimestral" / f"{var}_cambio_estacional_ssp245.nc"
        if not anual.exists():
            print(f"  · {var}: sin malla anual, se omite")
            continue

        with xr.open_dataset(anual, decode_timedelta=False) as ds:
            capas = [("anual", ds[f"delta_{var}"], ds["significancia"])]
            with xr.open_dataset(estac, decode_timedelta=False) as de:
                for i, temporada in enumerate(de["season"].values):
                    rotulo = "DEF" if str(temporada) == "DJF" else str(temporada)
                    capas.append((rotulo,
                                  de[f"delta_{var}"].isel(season=i),
                                  de["significancia"].isel(season=i)))

                for corte, capa, mascara in capas:
                    valores = zonal(capa)
                    sig = zonal(mascara)
                    extra = {"sig": [round(float(s), 2) for s in sig]}
                    if var == "pr":
                        valores, topados = recortar_pr(valores)
                        if topados:
                            extra["topados"] = topados
                    escribir("ssp245", var, corte, valores, meta["unidad"], extra)
                    generados.append(f"{var}_{corte}")
                    aviso = f" ({len(extra['topados'])} al tope)" if extra.get("topados") else ""
                    print(f"  · ssp245 {var}_{corte}{aviso}")
    return generados


def indices_245():
    generados = []
    for clave, meta in INDICES.items():
        malla = RAIZ / "INDICES_EXTREMOS_CLIMATICOS245" / f"{meta['nc']}_mean_ssp245_delta.nc"
        if not malla.exists():
            print(f"  · {clave}: sin malla, se omite")
            continue
        with xr.open_dataset(malla, decode_timedelta=False) as ds:
            for sufijo, corte in CORTES:
                escribir("ssp245", clave, corte, zonal(ds[f"delta_{sufijo}"]), meta["unidad"])
                generados.append(f"{clave}_{corte}")
        print(f"  · ssp245 {clave} (5 cortes)")
    return generados


# ── SSP5-8.5: desde lo ya publicado ───────────────────────
def variables_585():
    generados = []
    for var, meta in VARIABLES.items():
        for _, corte in CORTES:
            origen = DATA / f"distritos_cambio_{var}_{corte}_cmip6_2036_2065_5km.geojson"
            if not origen.exists():
                continue
            capa = json.loads(origen.read_text())
            valores = np.array([f["properties"]["valor"] for f in capa["features"]], dtype=float)
            extra = None
            if var == "pr":
                topados = [int(i) for i in np.where(np.abs(valores) >= TOPE_PR - 1e-9)[0]]
                extra = {"topados": topados} if topados else None
            escribir("ssp585", var, corte, valores, meta["unidad"], extra)
            generados.append(f"{var}_{corte}")
        print(f"  · ssp585 {var}")
    return generados


def indices_585():
    generados = []
    for clave, meta in INDICES.items():
        for _, corte in CORTES:
            origen = DATA / "indices" / f"{clave}_{corte}.json"
            if not origen.exists():
                continue
            valores = np.array(json.loads(origen.read_text())["valores"], dtype=float)
            escribir("ssp585", clave, corte, valores, meta["unidad"])
            generados.append(f"{clave}_{corte}")
        print(f"  · ssp585 {clave} (5 cortes)")
    return generados


def multipeligro():
    """El índice multipeligro no depende del escenario: vive fuera de ambos."""
    origen = DATA / "indice_multipeligro_agricola_2036_2065.geojson"
    if not origen.exists():
        return []
    capa = json.loads(origen.read_text())
    valores = np.array([f["properties"]["valor"] for f in capa["features"]], dtype=float)
    SALIDA.mkdir(parents=True, exist_ok=True)
    (SALIDA / "imc_agricola.json").write_text(json.dumps({
        "clave": "imc", "escenario": None, "periodo": "anual", "unidad": "",
        "n": len(valores), "valores": [round(float(v), 4) for v in valores],
    }, ensure_ascii=False, separators=(",", ":")))
    print("  · imc_agricola")
    return ["imc_agricola"]


def main():
    print("SSP2-4.5 — variables desde las mallas NetCDF")
    v245 = variables_245()
    print("SSP2-4.5 — índices extremos")
    i245 = indices_245()
    print("SSP5-8.5 — variables desde los GeoJSON publicados")
    v585 = variables_585()
    print("SSP5-8.5 — índices extremos desde data/indices/")
    i585 = indices_585()
    print("Índice multipeligro")
    imc = multipeligro()

    manifiesto = {
        "geometria": "data/distritos.geojson",
        "n": len(distritos()),
        "periodo": "2036-2065",
        "referencia": "1981-2010",
        "escenarios": {
            "ssp245": {
                "etiqueta": "SSP2-4.5",
                "nombre": "Escenario moderado",
                "variables": sorted({c.rsplit("_", 1)[0] for c in v245}),
                "indices": sorted({c.rsplit("_", 1)[0] for c in i245}),
                "significancia": True,
            },
            "ssp585": {
                "etiqueta": "SSP5-8.5",
                "nombre": "Escenario severo",
                "variables": sorted({c.rsplit("_", 1)[0] for c in v585}),
                "indices": sorted({c.rsplit("_", 1)[0] for c in i585}),
                "significancia": False,
            },
        },
        "tope_precipitacion": TOPE_PR,
    }
    (SALIDA / "manifiesto.json").write_text(
        json.dumps(manifiesto, ensure_ascii=False, indent=1))

    total = sum(f.stat().st_size for f in SALIDA.rglob("*.json"))
    print(f"\n{len(v245)+len(i245)+len(v585)+len(i585)+len(imc)} archivos · "
          f"{total/1024:.0f} KB en total")


if __name__ == "__main__":
    main()
