# PEGASO

**Plataforma de Escenarios de Cambio Climático para la Gestión y la Adaptación en los Servicios Sectoriales**

SENAMHI · MINAM — Escenario SSP5-8.5 CMIP6 · Resolución 5 km · Período 2036–2065
(cambio proyectado respecto al período de referencia 1981–2010)

## Qué es

Visor web interactivo de las proyecciones de cambio climático para el Perú a nivel distrital,
orientado a la gestión y la adaptación en los servicios sectoriales.

## Variables disponibles

| Variable | Descripción | Períodos |
|---|---|---|
| Precipitación (`pr`) | Cambio relativo (%) | Anual · Verano · Otoño · Invierno · Primavera |
| Temperatura máxima (`tasmax`) | Cambio proyectado (°C) | Anual · Verano · Otoño · Invierno · Primavera |
| Temperatura mínima (`tasmin`) | Cambio proyectado (°C) | Anual · Verano · Otoño · Invierno · Primavera |
| Índice Multipeligro (IMC) | Índice multipeligro agrícola | Solo Anual |

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

## Estructura

```
index.html                 Aplicación web (versión publicada)
assets/app.js              Lógica del visor (Leaflet)
assets/style_standalone.css Estilos
data/*.geojson             Capas climáticas y de referencia
streamlit_app.py           Versión alternativa en Streamlit
```

## Uso local

La versión web es estática y no requiere instalación:

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

Versión Streamlit:

```bash
pip install -r requirements.txt
streamlit run streamlit_app.py
```

## Fuente

Servicio Nacional de Meteorología e Hidrología del Perú (SENAMHI) —
Ministerio del Ambiente (MINAM).
