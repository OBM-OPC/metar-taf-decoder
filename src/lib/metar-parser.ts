export interface DecodedMetar {
  raw: string;
  station: string;
  time: string;
  wind: {
    direction: number;
    speed: number;
    gusts?: number;
    unit: string;
  };
  visibility: number;
  visibilityUnit: string;
  weather: WeatherPhenomenon[];
  clouds: CloudLayer[];
  temperature: number;
  dewpoint: number;
  pressure: number;
  pressureUnit: string;
  remarks?: string;
}

export interface WeatherPhenomenon {
  intensity: string;
  descriptor: string;
  phenomena: string[];
}

export interface CloudLayer {
  amount: string;
  height: number;
  type?: string;
}

export function decodeMetar(metar: string): DecodedMetar {
  const parts = metar.trim().split(/\s+/);
  
  let idx = 0;
  
  // Station (first part)
  const station = parts[idx++];
  
  // Time (second part, format: DDHHMMZ)
  let time = '';
  if (parts[idx]?.match(/^\d{6}Z$/)) {
    time = parts[idx++];
  }
  
  // AUTO/COR
  if (parts[idx] === 'AUTO' || parts[idx] === 'COR') {
    idx++;
  }
  
  // Wind
  const wind = parseWind(parts[idx] || '');
  if (wind) idx++;
  
  // Visibility
  const visibility = parseVisibility(parts[idx] || '');
  if (visibility !== null) idx++;
  
  // Weather phenomena
  const weather: WeatherPhenomenon[] = [];
  while (idx < parts.length && isWeatherPhenomenon(parts[idx])) {
    weather.push(parseWeatherPhenomenon(parts[idx]));
    idx++;
  }
  
  // Clouds
  const clouds: CloudLayer[] = [];
  while (idx < parts.length && isCloudLayer(parts[idx])) {
    clouds.push(parseCloudLayer(parts[idx]));
    idx++;
  }
  
  // Temperature/Dewpoint
  let temperature = 0, dewpoint = 0;
  if (parts[idx]?.includes('/')) {
    [temperature, dewpoint] = parseTemperature(parts[idx]);
    idx++;
  }
  
  // Pressure
  let pressure = 0, pressureUnit = 'hPa';
  if (parts[idx]?.startsWith('Q') || parts[idx]?.startsWith('A')) {
    const p = parsePressure(parts[idx]);
    pressure = p.value;
    pressureUnit = p.unit;
    idx++;
  }
  
  // Remarks (everything after RMK)
  let remarks = '';
  const rmkIndex = parts.indexOf('RMK', idx);
  if (rmkIndex !== -1) {
    remarks = parts.slice(rmkIndex + 1).join(' ');
  }
  
  return {
    raw: metar,
    station,
    time,
    wind: wind || { direction: 0, speed: 0, unit: 'KT' },
    visibility: visibility ?? 9999,
    visibilityUnit: 'm',
    weather,
    clouds,
    temperature,
    dewpoint,
    pressure,
    pressureUnit,
    remarks: remarks || undefined,
  };
}

function parseWind(windStr: string) {
  const match = windStr.match(/^(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?(KT|MPS|KMH)$/);
  if (!match) return null;
  
  return {
    direction: match[1] === 'VRB' ? -1 : parseInt(match[1]),
    speed: parseInt(match[2]),
    gusts: match[4] ? parseInt(match[4]) : undefined,
    unit: match[5],
  };
}

function parseVisibility(visStr: string): number | null {
  if (visStr === 'CAVOK') return 9999;
  if (visStr === '9999') return 9999;
  if (visStr.match(/^\d{4}$/)) return parseInt(visStr);
  if (visStr.match(/^\d+$/)) return parseInt(visStr);
  return null;
}

function isWeatherPhenomenon(str: string): boolean {
  return /^[-+]?([A-Z]{2})+$/.test(str) && !isCloudLayer(str) && !str.includes('/') && !str.startsWith('Q') && !str.startsWith('A');
}

function parseWeatherPhenomenon(str: string): WeatherPhenomenon {
  let intensity = '';
  let descriptor = '';
  const phenomena: string[] = [];
  
  let s = str;
  if (s.startsWith('+')) { intensity = '+'; s = s.slice(1); }
  else if (s.startsWith('-')) { intensity = '-'; s = s.slice(1); }
  
  const descriptors = ['MI', 'PR', 'BC', 'DR', 'BL', 'SH', 'TS', 'FZ'];
  const weatherCodes: Record<string, string> = {
    'DZ': 'Nieselregen', 'RA': 'Regen', 'SN': 'Schnee',
    'SG': 'Schneegriesel', 'IC': 'Eisnadeln', 'PL': 'Eiskörner',
    'GR': 'Hagel', 'GS': 'Kleinhagel', 'UP': 'Unbekannt',
    'BR': 'Nebel', 'FG': 'Nebel', 'FU': 'Rauch',
    'VA': 'Vulkanasche', 'DU': 'Staub', 'SA': 'Sand',
    'HZ': 'Dunst', 'PY': 'Sprühregen', 'PO': 'Staubwirbel',
    'SQ': 'Böen', 'FC': 'Wirbelsturm', 'SS': 'Sandsturm',
    'DS': 'Staubsturm', 'TS': 'Gewitter',
  };
  
  // Check for 2-char codes
  for (let i = 0; i < s.length; i += 2) {
    const code = s.slice(i, i + 2);
    if (descriptors.includes(code)) {
      descriptor = code;
    } else if (weatherCodes[code]) {
      phenomena.push(weatherCodes[code]);
    }
  }
  
  return { intensity, descriptor, phenomena };
}

function isCloudLayer(str: string): boolean {
  return /^(FEW|SCT|BKN|OVC|SKC|NSC|CLR|NCD)\d{3}/.test(str) || str === 'CAVOK' || str === 'SKC' || str === 'NSC' || str === 'NCD' || str === 'CLR';
}

function parseCloudLayer(str: string): CloudLayer {
  const amounts: Record<string, string> = {
    'SKC': 'Sky Clear', 'CLR': 'Clear', 'NSC': 'No Significant Clouds',
    'NCD': 'No Clouds Detected', 'FEW': 'Few', 'SCT': 'Scattered',
    'BKN': 'Broken', 'OVC': 'Overcast',
  };
  
  if (str === 'CAVOK') return { amount: 'CAVOK', height: 0 };
  if (['SKC', 'CLR', 'NSC', 'NCD'].includes(str)) {
    return { amount: amounts[str] || str, height: 0 };
  }
  
  const match = str.match(/^(FEW|SCT|BKN|OVC)(\d{3})(CB|TCU)?$/);
  if (!match) return { amount: 'Unknown', height: 0 };
  
  return {
    amount: amounts[match[1]] || match[1],
    height: parseInt(match[2]) * 100,
    type: match[3],
  };
}

function parseTemperature(tempStr: string): [number, number] {
  const [t, d] = tempStr.split('/');
  const parseTemp = (s: string) => {
    if (s.startsWith('M')) return -parseInt(s.slice(1));
    return parseInt(s);
  };
  return [parseTemp(t), parseTemp(d)];
}

function parsePressure(presStr: string): { value: number; unit: string } {
  if (presStr.startsWith('Q')) {
    return { value: parseInt(presStr.slice(1)), unit: 'hPa' };
  }
  if (presStr.startsWith('A')) {
    return { value: Math.round(parseInt(presStr.slice(1)) * 0.3386), unit: 'hPa (inHg)' };
  }
  return { value: 0, unit: 'hPa' };
}
