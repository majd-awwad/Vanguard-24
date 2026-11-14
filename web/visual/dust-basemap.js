import { land } from "./land.js";

const svgNamespace = "http://www.w3.org/2000/svg";

// The bundled Natural Earth 1:110m path uses the Sound Atlas fires viewport.
// Undo its Plate Carrée scale (see platform.js and sources/fires.js) before
// placing it in the requested geographic extent, with north up and west left.
const atlasX = lon => 48 + (lon - 13) / (42 - 13) * 612;
const atlasY = lat => 27 + (54 - lat) / (54 - 38) * 288;

/**
 * Append land in a normalized [0, 1] viewBox. Parent SVG clips to its viewport.
 * An embedded group can scale to other viewBox units without resizing the stroke.
 */
export function drawDustMapBase(svg, bounds) {
  const { west, east, north, south } = bounds ?? {};
  if (![west, east, north, south].every(Number.isFinite) ||
    west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) {
    return null;
  }

  const left = atlasX(west);
  const top = atlasY(north);
  const width = atlasX(east) - left;
  const height = atlasY(south) - top;
  if (width <= 0 || height <= 0) return null;
  const scaleX = 1 / width;
  const scaleY = 1 / height;
  const path = svg.ownerDocument.createElementNS(svgNamespace, "path");
  path.setAttribute("class", "dust-basemap-land");
  path.setAttribute("d", land.fires);
  path.setAttribute("transform", `matrix(${scaleX} 0 0 ${scaleY} ${-left * scaleX} ${-top * scaleY})`);
  path.setAttribute("vector-effect", "non-scaling-stroke");
  path.setAttribute("pointer-events", "none");
  svg.append(path);
  return path;
}
