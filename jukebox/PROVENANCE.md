# Night Lights Change · SVS 5313

## Verified source

NASA Scientific Visualization Studio's EIC cut of *Change in Night Lights between 2012 and 2023*, visualized by Kel Elkins. NASA identifies the underlying series as Black Marble night imagery, from Suomi NPP VIIRS. It uses purple for more light and orange for less. EarthPulse extracts the fixed change frame at 42.000 seconds, zero-based frame 1260 at 30 fps, 7680 × 2160. The unmodified download was 34,306,797 bytes with SHA-256 `fa770691e32961d6670ef22689a63210fd732228fabf4946a8117e96b2bcffd9`. Full-frame and inset WebP files come from that frame. [NASA SVS 5313](https://svs.gsfc.nasa.gov/5313/) · [Source MP4](https://svs.gsfc.nasa.gov/vis/a000000/a005300/a005313/nightlights_flat_series_and_change_wZooms_13_EIC_2160p30_h265.mp4)

Credit NASA's Scientific Visualization Studio. The attribution appears alongside the frame and links to full credits. The educational exhibit uses its own identity and includes OFL terms for the packaged fonts. [NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)

## Derived image measurements

Each of the four regions is a rectangular crop inside NASA's named inset. The half-open source-pixel bounds are recorded in the [manifest](site/media/night-lights.json). These windows exclude the titles, borders, global map and legend. Twelve whole-pixel bands partition each crop horizontally. At default threshold 12, classify a pixel as purple if `B >= 32`, `B−G >= 12`, `R−G >= 3` and `B−R >= −3`. Classify it as orange if `R >= 36`, `R−G >= 12` and `G−B >= 5`. The masks are disjoint. All pixels in each band, including water and unclassified background, form the denominator. Count on the decoded RGB frame before browser resizing and WebP compression.

| Inset | Purple | Orange | Pixels inspected |
| --- | ---: | ---: | ---: |
| Western Europe | 40,852 (2.61%) | 78,673 (5.02%) | 1,566,480 |
| Eastern Mediterranean | 49,257 (5.65%) | 22,039 (2.53%) | 872,256 |
| Ukraine | 14,746 (1.90%) | 9,496 (1.23%) | 775,104 |
| India | 73,147 (7.81%) | 1,324 (0.14%) | 936,000 |

The Europe–India comparison reverses the dominant color at thresholds 10, 12 and 14. These are classifier checks, not confidence intervals. This is image color coverage in each chosen window. It depends on cropping, zoom, background, compression and the palette. It has no radiance unit and estimates no land area, national trend, population or cause. The slide represents endpoints of a change interval. The interaction travels through space within that image; it does not step through annual observations.

## Sound mapping

For each band, purple drives the 392 Hz voice and orange the 261.626 Hz voice. The fixed pitches distinguish the directions. The optional stereo positions are +0.38 and −0.38 respectively. Each voice blends a fundamental and its second harmonic with fixed weights. Peak gain is `0.17 × sqrt(clamp(share / 0.24, 0, 1))`. Both voices share this reference. All packaged bands are below 0.24, so no available band saturates. A zero count schedules no voice. The score uses a 0.53 s slot and a 0.49 s sound window at 1×, with an attack and release of up to 47 ms. The meter follows the same authored envelope. Playback speed affects the scan clock and scheduling, while volume, mute and stereo affect presentation. The voices are generated mathematically from the displayed counts.

## Reproduce and scope

Run `python -m pip install Pillow==11.0.0 numpy==2.2.1` with FFmpeg on PATH, then `python tools/extract.py --check` and `npm run verify`. The extractor performs a bounded public download or accepts an existing matching MP4 as its first argument. Omit `--check` to regenerate the files. The original video stays in the ignored release directory. The manifest records SHA-256 for decoded RGB pixels and delivered derivatives. Compare hashes and the regional counts when using a different FFmpeg/codec build.

The other candidates were inspected for fit. [SVS 3912](https://svs.gsfc.nasa.gov/3912/) depicts ECCO2 modeled surface currents colored by temperature from 2007–2008 and interpolates between model sample points. [SVS 5011](https://svs.gsfc.nasa.gov/5011/) uses quality-controlled ISS LIS detections from 2017–2023 in rolling ten-day display windows. Both are outside this exhibit. The official challenge search entry exposed the main EIC-to-live-sonification objective. Direct access to the Details/Resources tabs failed in the research environment and their complete contents remain unverified. [Challenge listing](https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/)
