export interface Cloud {
  cover: string;
  base: number;
}

export interface MetarResponse {
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
  clouds: Cloud[];
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

export interface TafResponse {
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

export interface SigmetEntry {
  icaoId: string;
  receiptTime: string;
  validTimeFrom: string;
  validTimeTo: string;
  rawAirSigmet: string;
  area: { lat: number; lon: number }[];
}

export interface HistoryEntry {
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
  clouds: Cloud[];
  rawOb: string;
}
