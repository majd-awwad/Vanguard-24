# Earth Sound Studio mapping

## Current reference-image mode

The map displays three exact NASA SVS 5276 frames. A bounded 1920×1080 browser
surface is derived from each 7680×4320 frame for interactive sampling. Pixel RGB
is converted deterministically to HSV. Purple hues (248–338°) are classified as
the published “more light” language, orange hues (8–64°) as “less light,” and
bright low-saturation pixels as “little visual change.” Dark or unclassified
pixels produce no tone. This classification is a reading of the rendered image,
not radiance and not a substitute for VNP46A4 quality flags.

The visual and audio always consume the same sampled pixel. Increasing signals
use a triangle fundamental beginning at 349.228 Hz and rising with rendered
color strength. Decreasing signals use a sawtooth beginning at 196 Hz and fall
with strength. Annual-image brightness uses `196 × 2^(1.85 × brightness)` Hz.
Gain is bounded and follows square-root strength. Stereo pan is limited to
±0.42 and follows the sample's left/right position in the active path. The
mapping is `studio-reference-v1`.

The audio graph has two persistent oscillators. Pointer movement updates
frequency, gain, filter and pan through parameter smoothing; it never creates
an oscillator per pixel. Missing or excluded directions fade both voices.

## Numeric acceptance gate

Quantitative mode requires the two exact VNP46A4.002 HDF5 files, successful
execution of `science/nightlights/extract_vnp46a4.py`, an independent spot-check
of calibrated values and QA, and browser tests showing that displayed color,
inspector values and sound share the same derived pixel. Until then all radiance
fields remain unavailable in the interface.
