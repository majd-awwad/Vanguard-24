export type SourceStatus = 'VERIFIED_MATCHED' | 'VERIFIED_RELATED_VISUAL' | 'PROPOSED_NOT_VERIFIED' | 'BLOCKED';
export type Coordinates = { lat: number; lon: number };
export type ScientificTime = { start: string; end: string; granule?: string };
export type Bounds = { north: number; south: number; east: number; west: number };

export interface SourceReference {
  product: string;
  version: string;
  url: string;
  status: SourceStatus;
  svs: string;
}

export interface GriddedSeries {
  id: 'ocean' | 'rain';
  kind: 'gridded-time-series';
  source: SourceReference;
  coordinates: 'EPSG:4326';
  sites: (Coordinates & { id: string })[];
  times: ScientificTime[];
  cells: (Coordinates & {
    samples: { value: number | null; error: number | null; mask: number | null }[];
  })[];
  unit: '°C' | 'mm/day';
  bounds: Bounds;
  step: number;
  subsetUrl?: string;
}

export interface WindowedEvents {
  id: 'fires';
  kind: 'windowed-events';
  source: SourceReference;
  coordinates: 'EPSG:4326';
  sites: { id: string; bounds: Bounds }[];
  times: ScientificTime[];
  unit: 'MW';
  bounds: Bounds;
  subsetUrl: string;
  windows: (ScientificTime & { detections: (Coordinates & {
    acquisitionTime: string;
    sensor: string;
    confidence: string;
    frpMW: number | null;
  })[] })[];
}

export interface DiscreteWaveforms {
  id: 'forest';
  kind: 'discrete-waveforms';
  source: SourceReference;
  heightEdgesM: number[];
  axes: ['track', 'height'];
  relativeTo: 'estimated-ground';
  observations: {
    id: string;
    utc: string;
    distanceM: number;
    coordinates: Coordinates;
    returnFraction: number[];
    l1bCounts: number[];
  }[];
}

export type ScientificCase = GriddedSeries | WindowedEvents | DiscreteWaveforms;
