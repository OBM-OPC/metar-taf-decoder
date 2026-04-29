export interface LiveMetar {
  metar_id: number;
  icaoId: string;
  receiptTime: string;
  obsTime: number;
  reportTime: string;
  temp: number;
  dewp: number;
  wdir: number;
  wspd: number;
  wgst: number | null;
  visib: number | string;
  altim: number;
  slp: number | null;
  qcField: number;
  wxString: string | null;
  presTend: number | null;
  maxT: number | null;
  minT: number | null;
  maxT24: number | null;
  minT24: number | null;
  precip: number | null;
  pcp3hr: number | null;
  pcp6hr: number | null;
  pcp24hr: number | null;
  snow: number | null;
  vertVis: number | null;
  metarType: string;
  rawOb: string;
  mostRecent: number;
  lat: number;
  lon: number;
  elev: number;
  prior: number;
  name: string;
  clouds: { cover: string; base: number }[];
}

export interface TafForecast {
  timeFrom: string;
  timeTo: string;
  windDir: number | null;
  windSpd: number | null;
  windGust: number | null;
  visib: number | string | null;
  wxString: string | null;
  skyCover: string[] | null;
  base: number[] | null;
}

export interface LiveTaf {
  tafId: number;
  icaoId: string;
  issueTime: string;
  validTimeFrom: string;
  validTimeTo: string;
  rawText: string;
  fcsts: TafForecast[];
  lat: number;
  lon: number;
  elev: number;
}

export interface HistoryMetar {
  metar_id: number;
  icaoId: string;
  reportTime: string;
  temp: number;
  dewp: number;
  wdir: number;
  wspd: number;
  wgst: number | null;
  visib: number | string;
  altim: number;
  clouds: { cover: string; base: number }[];
  rawOb: string;
}

export interface SigmetEntry {
  icaoId: string;
  receiptTime: string;
  validTimeFrom: string;
  validTimeTo: string;
  rawAirSigmet: string;
  area: { lat: number; lon: number }[];
}

export async function fetchLiveMetar(icao: string): Promise<LiveMetar | null> {
  try {
    const response = await fetch(
      `/api/metar?ids=${icao.toUpperCase()}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (data.found && Array.isArray(data.data) && data.data.length > 0) {
      return data.data[0] as LiveMetar;
    }
    if (data.fallback && Array.isArray(data.data) && data.data.length > 0) {
      return data.data[0] as LiveMetar;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchLiveTaf(icao: string): Promise<LiveTaf | null> {
  try {
    const response = await fetch(
      `https://aviationweather.gov/api/data/taf?ids=${icao.toUpperCase()}&format=json`,
      { headers: { Accept: 'application/json' } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return data[0] as LiveTaf;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchMetarHistory(icao: string): Promise<HistoryMetar[]> {
  try {
    const response = await fetch(
      `https://aviationweather.gov/api/data/metar?ids=${icao.toUpperCase()}&format=json&hours=24`,
      { headers: { Accept: 'application/json' } }
    );
    if (!response.ok) return [];
    const data = await response.json();
    if (Array.isArray(data)) {
      return data.slice(0, 6) as HistoryMetar[];
    }
    return [];
  } catch {
    return [];
  }
}

export async function fetchSigmets(icao: string, lat: number, lon: number): Promise<SigmetEntry[]> {
  try {
    const bbox = `${lat - 5},${lon - 5},${lat + 5},${lon + 5}`;
    const response = await fetch(
      `https://aviationweather.gov/api/data/isigmet?format=json&bbox=${bbox}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!response.ok) return [];
    const data = await response.json();
    if (Array.isArray(data)) {
      return data as SigmetEntry[];
    }
    return [];
  } catch {
    return [];
  }
}
