# PEGASO

**Plataforma de Escenarios de Cambio Climático para la Gestión y la Adaptación en los Servicios Sectoriales**

SENAMHI · MINAM — Escenarios SSP2-4.5 y SSP5-8.5 CMIP6 · Resolución 5 km · Período 2036–2065
(cambio proyectado respecto al período de referencia 1981–2010)

## Qué es

Visor web interactivo de las proyecciones de cambio climático para el Perú a nivel distrital,
orientado a la gestión y la adaptación en los servicios sectoriales.

## Escenarios

| Escenario | Trayectoria | Disponible |
|---|---|---|
| `ssp245` — SSP2-4.5 | Las emisiones se estabilizan hacia mitad de siglo | 3 variables · 4 índices · 5 cortes |
| `ssp585` — SSP5-8.5 | Las emisiones siguen creciendo sin freno | 3 variables · 4 índices · 5 cortes |

Los dos comparten malla (374 × 261 celdas de 0,05°), período y ensamble de
modelos, así que la resta entre ellos es válida celda a celda, y ofrecen
exactamente las mismas capas. El visor los presenta por separado y en un
tercer modo —**comparar**— que pinta la brecha: cuánto añade el escenario
severo sobre el moderado.

La malla del SSP2-4.5 trae además `tasmed`, que no se publica: resulta ser
exactamente `(tasmax + tasmin) / 2` —comprobado celda por celda— y no una
salida propia del modelo. Publicarla añadiría una capa derivada que el
SSP5-8.5 no tiene, a cambio de ninguna información nueva.

## Capas de datos

### Variables climáticas

| Variable | Descripción | Períodos |
|---|---|---|
| Precipitación (`pr`) | Cambio relativo (%) | Anual · Verano · Otoño · Invierno · Primavera |
| Temperatura máxima (`tasmax`) | Cambio proyectado (°C) | Anual · Verano · Otoño · Invierno · Primavera |
| Temperatura mínima (`tasmin`) | Cambio proyectado (°C) | Anual · Verano · Otoño · Invierno · Primavera |

Las tres existen en los dos escenarios.

### Índices derivados

| Índice | Descripción | Períodos |
|---|---|---|
| Índice Multipeligro (IMC) | Índice multipeligro agrícola | Solo Anual |
| Día más cálido (`TXx`) | Máximo de la temperatura máxima diaria (°C) | Anual · Verano · Otoño · Invierno · Primavera |
| Día más fresco (`TXn`) | Mínimo de la temperatura máxima diaria (°C) | Anual · Verano · Otoño · Invierno · Primavera |
| Noche más cálida (`TNx`) | Máximo de la temperatura mínima diaria (°C) | Anual · Verano · Otoño · Invierno · Primavera |
| Noche más fría (`TNn`) | Mínimo de la temperatura mínima diaria (°C) | Anual · Verano · Otoño · Invierno · Primavera |

Los cuatro índices extremos siguen la definición del ETCCDI y describen el
extremo del período, no su promedio.

## Formato de los datos

Todo lo que pinta el mapa comparte una única capa de geometría
(`data/distritos.geojson`, 2,5 MB) y publica solo los valores, en
`data/valores/<escenario>/<clave>_<corte>.json` — 15 KB por corte, en el
mismo orden que los 1891 polígonos. Cambiar de variable, de corte o de
escenario descarga 15 KB, y comparar los dos escenarios cuesta 30 KB.

```
data/valores/
  manifiesto.json          qué tiene cada escenario
  ssp245/pr_anual.json     valores, más la máscara de significancia
  ssp585/pr_anual.json     valores
  imc_agricola.json        el multipeligro, que no depende del escenario
```

Además de los valores, cada archivo puede traer:

- `sig` — fracción del distrito con cambio estadísticamente significativo
  (p < 0,05). Solo el SSP2-4.5 la tiene. En temperatura es 1 en todo el país;
  en precipitación baja de 0,5 en cuatro de cada cinco distritos, y la ficha
  lo advierte.
- `topados` — distritos cuyo cambio relativo de lluvia se recortó al tope de
  ±100 %. En la costa desértica casi no llueve en invierno y el cambio
  relativo se dispara hasta +1990 % sin que ello signifique mucha agua.

Los valores salen de las mallas NetCDF con `tools/generar_valores.py`:
promedio de las celdas cuyo centro cae dentro del distrito, y celda más
cercana para los 85 distritos demasiado pequeños para contener una.

Capas de referencia: departamentos (25), provincias (196) y cuencas (231 unidades hidrográficas).

## Funcionalidades

- Mapa coroplético por distrito (1891 distritos) con leyenda dinámica plegable
- Vista en relieve: perspectiva inclinada para leer la intensidad del cambio
- Panel de información contextual: informa el distrito y su departamento,
  provincia o unidad hidrográfica según la capa de referencia activa
- Buscador de lugares con sugerencias y resaltado del distrito
- Búsqueda por coordenadas exactas (latitud / longitud)
- Cambio de escenario de emisiones, capa de referencia y período estacional
- Modo comparación: el mapa pinta la brecha entre escenarios en el azul
  institucional —escala propia, distinta de las dos rampas de datos— y la
  ficha del punto enfrenta las dos lecturas sobre la misma banda
- Al consultar un distrito, el resto del mapa se hunde y el territorio
  elegido queda elevado, con su ficha saliendo del mapa
- Ámbito restringido al territorio nacional, con encuadre que se adapta
  al tamaño de pantalla
- Interfaz adaptativa: en teléfono los controles se agrupan en un panel
  deslizante y los elementos flotantes se repliegan automáticamente

## Fuente

Servicio Nacional de Meteorología e Hidrología del Perú (SENAMHI),
Subdirección de Cambio Climático y Modelamiento Atmosférico (SCM) —
Ministerio del Ambiente (MINAM).
