# PEGASO

**Plataforma de Escenarios de Cambio Climático para la Gestión y la Adaptación en los Servicios Sectoriales**

SENAMHI · MINAM — Escenario SSP5-8.5 CMIP6 · Resolución 5 km · Período 2036–2065
(cambio proyectado respecto al período de referencia 1981–2010)

## Qué es

Visor web interactivo de las proyecciones de cambio climático para el Perú a nivel distrital,
orientado a la gestión y la adaptación en los servicios sectoriales.

## Capas de datos

### Variables climáticas

| Variable | Descripción | Períodos |
|---|---|---|
| Precipitación (`pr`) | Cambio relativo (%) | Anual · Verano · Otoño · Invierno · Primavera |
| Temperatura máxima (`tasmax`) | Cambio proyectado (°C) | Anual · Verano · Otoño · Invierno · Primavera |
| Temperatura mínima (`tasmin`) | Cambio proyectado (°C) | Anual · Verano · Otoño · Invierno · Primavera |

### Índices derivados

| Índice | Descripción | Períodos |
|---|---|---|
| Índice Multipeligro (IMC) | Índice multipeligro agrícola | Solo Anual |
| Día más cálido (`TXx`) | Máximo de la temperatura máxima diaria (°C) | Anual · Verano · Otoño · Invierno · Primavera |
| Día más fresco (`TXn`) | Mínimo de la temperatura máxima diaria (°C) | Anual · Verano · Otoño · Invierno · Primavera |
| Noche más cálida (`TNx`) | Máximo de la temperatura mínima diaria (°C) | Anual · Verano · Otoño · Invierno · Primavera |
| Noche más fría (`TNn`) | Mínimo de la temperatura mínima diaria (°C) | Anual · Verano · Otoño · Invierno · Primavera |

Los cuatro índices extremos siguen la definición del ETCCDI y describen el
extremo del período, no su promedio. Comparten una única capa de geometría
(`data/distritos.geojson`) y publican solo los valores en `data/indices/`,
de modo que cambiar de índice descarga 13 KB y no 2,6 MB.

Capas de referencia: departamentos (25), provincias (196) y cuencas (231 unidades hidrográficas).

## Funcionalidades

- Mapa coroplético por distrito (1891 distritos) con leyenda dinámica plegable
- Vista en relieve: perspectiva inclinada para leer la intensidad del cambio
- Panel de información contextual: informa el distrito y su departamento,
  provincia o unidad hidrográfica según la capa de referencia activa
- Buscador de lugares con sugerencias y resaltado del distrito
- Búsqueda por coordenadas exactas (latitud / longitud)
- Cambio de capa de referencia y de período estacional
- Ámbito restringido al territorio nacional, con encuadre que se adapta
  al tamaño de pantalla
- Interfaz adaptativa: en teléfono los controles se agrupan en un panel
  deslizante y los elementos flotantes se repliegan automáticamente

## Fuente

Servicio Nacional de Meteorología e Hidrología del Perú (SENAMHI),
Subdirección de Cambio Climático y Modelamiento Atmosférico (SCM) —
Ministerio del Ambiente (MINAM).
