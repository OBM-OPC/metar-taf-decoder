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

export async function fetchLiveMetar(icao: string): Promise<LiveMetar | null> {
  try {
    // Use Netlify function proxy to avoid CORS
    const response = await fetch(
      `/api/metar?ids=${icao.toUpperCase()}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return data[0] as LiveMetar;
    }
    return null;
  } catch {
    return null;
  }
}
