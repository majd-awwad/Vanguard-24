# Earth assets for the cinematic Decode page

`web/decode-3d.html` renders a 3D Earth that unrolls onto the challenge region. Everything it needs ships in this
repository, so the page works offline: there is no CDN and no network request at runtime.

## Textures

| File | Size | Pixels | SHA-256 |
|---|---|---|---|
| `web/assets/earth/blue-marble-4096.jpg` (day, desktop) | 750,440 bytes | 4096 × 2048 | `e3343e007f5dfbe4b1941d56c0f871e97b1153fbe1688a54d32d1fe52fcc2bdf` |
| `web/assets/earth/blue-marble-2048.jpg` (day, mobile) | 223,799 bytes | 2048 × 1024 | `5a2bea0a8438374482dad92b20f0b4f281a72ea8d01b379fabf84380417b5af8` |
| `web/assets/earth/black-marble-3600.jpg` (night lights, desktop) | 779,638 bytes | 3600 × 1800 | `d87de751a264e4f8ff69c68de5dab9606daee87a6f15ae743c93200743bd7ec1` |
| `web/assets/earth/black-marble-2048.jpg` (night lights, mobile) | 168,784 bytes | 2048 × 1024 | `016e59ab9d277984285db89809f5c79041dde88a577f4966acda4bd6016b6e35` |

Together they are about 1.83 MB, far under the 8 MB budget, and no texture is above 4096 pixels wide. The page loads
the 2048 pair on narrow screens (`max-width: 700px`), when the browser reports data saving, or on low-memory devices,
and the large pair otherwise. The night-lights texture is shown only on the unlit side of the hero Earth; it never
appears over the decoding map, which is always fully lit.

### Source: Blue Marble (day side)

NASA Earth Observatory, **Blue Marble: Next Generation**, August 2004 monthly composite, land surface, ocean colour
and sea ice, 5400 × 2700 (about 8 km per pixel). Produced by Reto Stöckli (NASA Earth Observatory) from Terra/MODIS.

- Collection page: <https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/>
- File downloaded: <https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/august/world.200408.3x5400x2700.jpg>
- Downloaded file: `world.200408.3x5400x2700.jpg`, 1,616,254 bytes, SHA-256
  `2048023ccc62250c677c0f4b03d4362f997b130eb0154a6cad00aa1b27c390b9`
- Credit: NASA's Earth Observatory (Reto Stöckli, Blue Marble: Next Generation).

NASA states that its imagery is generally not subject to copyright and may be reused with credit; see NASA's media usage
guidelines at <https://www.nasa.gov/nasa-brand-center/images-and-media/>. The composite has no cloud layer.

### How the two shipped files were made

Both were resized from the downloaded 5400 × 2700 file with .NET `System.Drawing` (high-quality bicubic, JPEG quality 86).
No colour grading and no content was added. To reproduce, resize the source to 4096 × 2048 and 2048 × 1024 and compare
SHA-256 values (JPEG encoders differ slightly between machines, so a byte-identical result is not guaranteed; the source
hash above is the fixed reference).

### Why this texture is safe for a hidden-answer game

The texture is one static image, identical for every Decode case and every phase. It is a land and ocean base map, not a
dust product, so it shows no aerosol signal. The desert land colour in the Sahara is surface colour, not modelled dust.
Before Reveal the globe draws no localized haze, dust or tint over the challenge region; any later decorative atmosphere
must be uniform over the whole globe, identical for every case, and labelled as artistic.

### Source: Black Marble (night lights)

NASA Earth Observatory / NASA Goddard, **Black Marble 2016** global composite of night lights, 0.1 degree
(3600 × 1800) colour map, from the Suomi NPP VIIRS day/night band (Roman Sàenz / Miguel Román, NASA Goddard Space
Flight Center, with NASA Earth Observatory).

- Collection page: <https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/>
- File downloaded: <https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg>
- `black-marble-3600.jpg` is that file unmodified: 779,638 bytes, SHA-256
  `d87de751a264e4f8ff69c68de5dab9606daee87a6f15ae743c93200743bd7ec1`.
- `black-marble-2048.jpg` was resized from it with .NET `System.Drawing` (high-quality bicubic, JPEG quality 88).
- Credit: NASA Earth Observatory, Black Marble 2016.

NASA's usage guidelines are the same as above. The image shows human lights, not dust.

## three.js

| File | Version | SHA-256 |
|---|---|---|
| `web/vendor/three/three.module.min.js` | three 0.169.0 (npm `three@0.169.0`, `build/three.module.min.js`) | `f7cee3c7533449a1505cc12cb5128b89e3d4fd3d7ea62b05f9f5464a217472ee` |
| `web/vendor/three/LICENSE` | MIT License, copyright three.js authors | `4c40a1ef62450b857c3b2aaf294936304cd552d965fbcd9d32d4c5bcf4ba4454` |

The file was copied unmodified from the npm package; npm verified the package against its registry integrity value
(`sha512-Ed906MA3dR4TS5riErd4QBsRGPcx+HBDX2O5yYE5GqJeFQTPU+M56Va/f/Oph9X7uZo3W3o4l2ZhBZ6f6qUv0w==`).
`tests/cinematic.test.mjs` checks every hash in this document against the files.
