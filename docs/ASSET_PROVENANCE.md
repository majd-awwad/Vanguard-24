# Visual and audio asset provenance

| Asset | Origin and use |
| --- | --- |
| `web/assets/map/{ocean,rain,fires,dust}.jpg` | NASA EOSDIS GIBS `BlueMarble_ShadedRelief_Bathymetry`. Regional EPSG:4326 reference imagery. Exact requests, extents, sizes and SHA-256 are in the [map manifest](../web/assets/map/provenance.json). |
| `web/assets/earth/{blue,black}-marble-*.jpg` | NASA Earth Observatory day and night imagery. See [source URLs, processing and fingerprints](earth-assets.md). The aging composites provide orientation. |
| `web/assets/atlas/svs-*.jpg`, `web/assets/decode/svs-5669-context.webp`, `web/assets/gedi/svs-4950.jpg` | NASA Scientific Visualization Studio stills. Presentation assets with related context status. Full landing pages and numerical sources are in the [data ledger](DATA_PROVENANCE.md). Retain NASA SVS credit and source hyperlinks. |
| Earth coastlines | Natural Earth 1:110m land, v5.1.2, public domain. See [distribution terms](https://www.naturalearthdata.com/about/terms-of-use/) and the [source ledger](source-status.md). |
| `web/assets/gedi/cerrado-dusk.jpg` | Team's original AI-generated illustration. It supplies atmosphere for the Forest route. The illustrated scene has no known geographic registration or shot membership. |
| `web/assets/fonts/` | Instrument Serif, Instrument Sans and IBM Plex Mono, SIL Open Font License 1.1. The three full notices ship with the files. |
| `web/vendor/three/` | Three.js 0.169.0, MIT. The vendored LICENSE, source and integrity pin are in the repository. |
| Sound | Deterministic synthesis by EarthPulse via Web Audio. There are no external audio recordings. Air, grains, pulses and the preview are generated locally. See the [mapping and envelopes](sound-mapping.md). |

Keep the attribution visible where imagery is displayed. The app uses its own identity and follows [NASA imagery and media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).
