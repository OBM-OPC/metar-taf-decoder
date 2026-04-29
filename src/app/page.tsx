'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  fetchLiveMetar,
  fetchLiveTaf,
  fetchMetarHistory,
  fetchSigmets,
  type LiveMetar,
  type LiveTaf,
  type HistoryMetar,
  type SigmetEntry,
} from '@/lib/api';
import {
  Wind, Eye, Cloud, Thermometer, Gauge, Search, Loader2, MapPin, AlertTriangle,
  ShieldAlert, Radar, Star, History, GitCompare, Navigation, ExternalLink,
} from 'lucide-react';

type FallbackInfo = { requested: string; fallbackStation: string; distance: number } | null;

function getWindDirection(degrees?: number | null) {
  if (degrees === undefined || degrees === null || degrees < 0) return 'Variable';
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return directions[Math.round(degrees / 22.5) % 16];
}

function visMeters(vis: number | string | null | undefined) {
  if (vis === null || vis === undefined) return 9999;
  if (typeof vis === 'string') {
    if (vis === '6+') return 9999;
    const n = parseFloat(vis);
    if (!Number.isNaN(n)) return Math.round(n * 1609.34);
    return 9999;
  }
  return vis > 100 ? Math.round(vis) : Math.round(vis * 1609.34);
}

function getFlightCategory(metar: LiveMetar | null) {
  if (!metar) return { cat: 'N/A', color: 'text-muted-foreground border-[hsl(217,33%,25%)]' };
  const visM = visMeters(metar.visib);
  const ceiling = [...(metar.clouds || [])]
    .filter((c) => ['BKN', 'OVC'].includes(c.cover))
    .sort((a, b) => a.base - b.base)[0]?.base ?? 99999;
  if (ceiling < 500 || visM < 1609) return { cat: 'LIFR', color: 'text-red-400 bg-red-500/10 border-red-500/30' };
  if (ceiling < 1000 || visM < 4828) return { cat: 'IFR', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' };
  if (ceiling < 3000 || visM < 8047) return { cat: 'MVFR', color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' };
  return { cat: 'VFR', color: 'text-green-400 bg-green-500/10 border-green-500/30' };
}

function windComponent(metar: LiveMetar | null, runway: string) {
  if (!metar || !runway || metar.wdir === undefined || metar.wdir < 0) return null;
  const runwayNum = parseInt(runway.replace(/\D/g, ''), 10);
  if (!runwayNum || runwayNum > 36) return null;
  const runwayDir = runwayNum * 10;
  let angleDiff = metar.wdir - runwayDir;
  angleDiff = ((angleDiff + 540) % 360) - 180;
  const rad = angleDiff * Math.PI / 180;
  const headwind = Math.round(metar.wspd * Math.cos(rad));
  const crosswind = Math.round(Math.abs(metar.wspd * Math.sin(rad)));
  const tailwind = Math.max(0, -headwind);
  return {
    runwayDir,
    headwind: Math.max(0, headwind),
    tailwind,
    crosswind,
    crosswindDir: angleDiff > 0 ? 'rechts' : 'links',
  };
}

function windColor(speed: number, gust?: number | null) {
  const max = gust || speed;
  if (max >= 30) return 'text-aviation-red';
  if (max >= 20) return 'text-aviation-amber';
  return 'text-aviation-green';
}

function categoryColor(category: string) {
  if (category === 'LIFR') return 'border-red-500/30';
  if (category === 'IFR') return 'border-yellow-500/30';
  if (category === 'MVFR') return 'border-sky-500/30';
  return 'border-green-500/30';
}

function sigmetRegion(icao: string) {
  const c = icao[0] || 'world';
  if (['K', 'C', 'P'].includes(c)) return 'us';
  if (['E', 'L', 'B', 'U'].includes(c)) return 'europe';
  if (['R', 'V', 'W', 'Z', 'O', 'Y'].includes(c)) return 'asia';
  if (['S'].includes(c)) return 'southamerica';
  if (['D', 'F', 'G', 'H'].includes(c)) return 'africa';
  return 'world';
}

function WindRose({ dir, speed }: { dir?: number | null; speed?: number | null }) {
  const rotation = dir && dir >= 0 ? dir : 0;
  const len = Math.min(28, 10 + (speed || 0));
  return (
    <svg viewBox="0 0 100 100" className="w-24 h-24 mx-auto mt-2">
      <circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" opacity="0.25" />
      <text x="50" y="14" textAnchor="middle" fontSize="10" fill="currentColor">N</text>
      <text x="50" y="96" textAnchor="middle" fontSize="10" fill="currentColor">S</text>
      <text x="10" y="54" textAnchor="middle" fontSize="10" fill="currentColor">W</text>
      <text x="90" y="54" textAnchor="middle" fontSize="10" fill="currentColor">E</text>
      <g transform={`rotate(${rotation} 50 50)`}>
        <line x1="50" y1="50" x2="50" y2={50 - len} stroke="currentColor" strokeWidth="3" />
        <polygon points={`50,${50 - len - 6} 45,${50 - len + 4} 55,${50 - len + 4}`} fill="currentColor" />
      </g>
    </svg>
  );
}

function MetarGrid({ metar, runway }: { metar: LiveMetar; runway: string }) {
  const cat = getFlightCategory(metar);
  const windComp = windComponent(metar, runway);
  const visM = visMeters(metar.visib);
  return (
    <div className="space-y-6">
      <Card className={`cockpit-display glow-border ${categoryColor(cat.cat)}`}>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-3xl text-aviation-green font-mono tracking-wider">{metar.icaoId}</CardTitle>
              <CardDescription className="text-muted-foreground font-mono mt-1">
                {metar.name} · Beobachtung: {new Date(metar.reportTime).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', timeZone: 'UTC' })} UTC
              </CardDescription>
            </div>
            <div className={`px-3 py-2 rounded-md border font-mono font-bold ${cat.color}`}>{cat.cat}</div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card className="cockpit-display scope-ring">
          <CardHeader><CardTitle className="text-lg text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-2"><Wind className="w-5 h-5" />Wind</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold font-mono ${windColor(metar.wspd, metar.wgst)}`}>{metar.wspd}<span className="text-lg text-muted-foreground ml-1">KT</span></div>
            <div className="text-sm text-muted-foreground mt-2 font-mono">{getWindDirection(metar.wdir)} · {metar.wdir}°</div>
            {metar.wgst ? <div className="text-sm text-aviation-amber mt-1 font-mono">Böen: {metar.wgst} KT</div> : null}
            <div className="text-aviation-green"><WindRose dir={metar.wdir} speed={metar.wspd} /></div>
          </CardContent>
        </Card>

        <Card className="cockpit-display scope-ring">
          <CardHeader><CardTitle className="text-lg text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-2"><Eye className="w-5 h-5" />Sicht</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold font-mono ${visM < 1000 ? 'text-aviation-red' : visM < 3000 ? 'text-aviation-amber' : 'text-aviation-green'}`}>{visM >= 9999 ? '10+' : (visM / 1000).toFixed(1)}<span className="text-lg text-muted-foreground ml-1">km</span></div>
            <div className="text-sm text-muted-foreground mt-2 font-mono">{visM} m</div>
          </CardContent>
        </Card>

        <Card className="cockpit-display scope-ring">
          <CardHeader><CardTitle className="text-lg text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-2"><Thermometer className="w-5 h-5" />Temp</CardTitle></CardHeader>
          <CardContent>
            <div className="text-4xl font-bold font-mono text-aviation-green">{metar.temp}°<span className="text-lg text-muted-foreground ml-1">C</span></div>
            <div className="text-sm text-muted-foreground mt-2 font-mono">DP {metar.dewp}°C · Spread {(metar.temp - metar.dewp).toFixed(1)}°C</div>
          </CardContent>
        </Card>

        <Card className="cockpit-display scope-ring">
          <CardHeader><CardTitle className="text-lg text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-2"><Gauge className="w-5 h-5" />QNH</CardTitle></CardHeader>
          <CardContent>
            <div className="text-4xl font-bold font-mono text-aviation-green">{metar.altim}<span className="text-lg text-muted-foreground ml-1">hPa</span></div>
            <div className="text-sm text-muted-foreground mt-2 font-mono">{metar.altim > 1020 ? 'HIGH' : metar.altim < 1000 ? 'LOW' : 'STD'} PRESSURE</div>
          </CardContent>
        </Card>

        <Card className="cockpit-display scope-ring xl:col-span-2">
          <CardHeader><CardTitle className="text-lg text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-2"><Cloud className="w-5 h-5" />Clouds</CardTitle></CardHeader>
          <CardContent>
            {!metar.clouds?.length ? <p className="text-muted-foreground font-mono">CAVOK / NO SIGNIFICANT CLOUDS</p> : (
              <div className="space-y-2">
                {metar.clouds.map((cloud, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-[hsl(217,33%,20%)] pb-2">
                    <span className="font-medium text-aviation-green font-mono">{cloud.cover}</span>
                    <span className="text-muted-foreground font-mono">{cloud.base} ft AGL</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {windComp && (
          <Card className="cockpit-display scope-ring xl:col-span-3">
            <CardHeader><CardTitle className="text-lg text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-2"><Navigation className="w-5 h-5" />Runway Wind Calculator RWY {runway.toUpperCase()}</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-4 font-mono">
              <div className="p-3 rounded border border-[hsl(217,33%,20%)]">
                <div className="text-sm text-muted-foreground">Headwind</div>
                <div className="text-2xl text-aviation-green font-bold">{windComp.headwind} KT</div>
              </div>
              <div className={`p-3 rounded border ${windComp.crosswind > 25 ? 'border-red-500/30 text-red-400' : windComp.crosswind >= 15 ? 'border-yellow-500/30 text-yellow-400' : 'border-green-500/30 text-green-400'}`}>
                <div className="text-sm opacity-80">Crosswind</div>
                <div className="text-2xl font-bold">{windComp.crosswind} KT</div>
                <div className="text-sm">von {windComp.crosswindDir}</div>
              </div>
              <div className={`p-3 rounded border ${windComp.tailwind > 5 ? 'border-red-500/30 text-red-400' : 'border-[hsl(217,33%,20%)] text-muted-foreground'}`}>
                <div className="text-sm opacity-80">Tailwind</div>
                <div className="text-2xl font-bold">{windComp.tailwind} KT</div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="cockpit-display glow-border">
        <CardHeader><CardTitle className="text-lg text-muted-foreground font-mono uppercase tracking-wider">METAR Rohdaten</CardTitle></CardHeader>
        <CardContent><code className="block bg-[hsl(222,47%,5%)] p-4 rounded-md font-mono text-sm text-aviation-green overflow-x-auto border border-[hsl(217,33%,20%)]">{metar.rawOb}</code></CardContent>
      </Card>
    </div>
  );
}

export default function Home() {
  const [icaoInput, setIcaoInput] = useState('');
  const [compareInput, setCompareInput] = useState('');
  const [runway, setRunway] = useState('');
  const [liveMetar, setLiveMetar] = useState<LiveMetar | null>(null);
  const [compareMetar, setCompareMetar] = useState<LiveMetar | null>(null);
  const [liveTaf, setLiveTaf] = useState<LiveTaf | null>(null);
  const [historyMetars, setHistoryMetars] = useState<HistoryMetar[]>([]);
  const [sigmets, setSigmets] = useState<SigmetEntry[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [fallbackInfo, setFallbackInfo] = useState<FallbackInfo>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFavorites(JSON.parse(localStorage.getItem('metar-favorites') || '[]'));
    setSearchHistory(JSON.parse(localStorage.getItem('metar-history') || '[]'));
  }, []);

  const activeCategory = useMemo(() => getFlightCategory(liveMetar), [liveMetar]);

  const updateHistory = (icao: string) => {
    const next = [icao, ...searchHistory.filter((h) => h !== icao)].slice(0, 10);
    setSearchHistory(next);
    localStorage.setItem('metar-history', JSON.stringify(next));
  };

  const toggleFavorite = (icao: string) => {
    const next = favorites.includes(icao) ? favorites.filter((f) => f !== icao) : [...favorites, icao];
    setFavorites(next);
    localStorage.setItem('metar-favorites', JSON.stringify(next));
  };

  const loadStation = async (icaoRaw?: string, compare = false) => {
    const icao = (icaoRaw || icaoInput).trim().toUpperCase();
    if (icao.length !== 4 || !/^[A-Z]{4}$/.test(icao)) {
      setError('Bitte einen gültigen 4-stelligen ICAO-Code eingeben (z.B. EDDF)');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const metar = await fetchLiveMetar(icao);
      if (!metar) {
        setError('Keine METAR-Daten gefunden');
        return;
      }
      if (compare) {
        setCompareMetar(metar);
      } else {
        setLiveMetar(metar);
        updateHistory(icao);
        const [taf, metarHistory, sigmetData] = await Promise.all([
          fetchLiveTaf(icao),
          fetchMetarHistory(icao),
          fetchSigmets(icao, metar.lat, metar.lon),
        ]);
        setLiveTaf(taf);
        setHistoryMetars(metarHistory);
        setSigmets(sigmetData);
      }
    } catch {
      setError('Fehler beim Abrufen der Daten. Bitte später erneut versuchen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen radar-grid">
      <header className="border-b border-[hsl(220,16%,20%)] bg-[hsl(220,24%,10%)]/88 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center gap-3">
          <Radar className="w-6 h-6 text-aviation-green" />
          <span className="font-bold text-xl text-foreground tracking-wider uppercase" style={{ fontFamily: "'Roboto Mono', ui-monospace, monospace" }}>CLOUDLINE</span>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-aviation-green animate-pulse" />
            <span className="text-xs text-muted-foreground font-mono">SYS ONLINE</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-2 tracking-tight crt-text">Cloudline</h1>
          <p className="text-muted-foreground font-mono text-sm">METAR · TAF · FLIGHT WEATHER FOR EVERY AIRFIELD WORLDWIDE</p>
        </div>

        <Card className="cockpit-display glow-border">
          <CardContent className="p-6 space-y-4">
            <div className="grid lg:grid-cols-[1fr_1fr_180px_180px_150px] gap-2">
              <Input placeholder="ICAO (EDDF)" value={icaoInput} onChange={(e) => setIcaoInput(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && loadStation()} className="font-mono text-lg h-12 uppercase bg-[hsl(222,47%,8%)] border-[hsl(217,33%,25%)] text-aviation-green" maxLength={4} />
              <Input placeholder="Vergleich (EGLL)" value={compareInput} onChange={(e) => setCompareInput(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && loadStation(compareInput, true)} className="font-mono text-lg h-12 uppercase bg-[hsl(222,47%,8%)] border-[hsl(217,33%,25%)] text-aviation-green" maxLength={4} />
              <Input placeholder="Runway 27" value={runway} onChange={(e) => setRunway(e.target.value.toUpperCase())} className="font-mono text-lg h-12 uppercase bg-[hsl(222,47%,8%)] border-[hsl(217,33%,25%)] text-aviation-green" maxLength={3} />
              <Button onClick={() => loadStation()} disabled={loading} className="h-12 bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-mono uppercase tracking-wider">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Search className="w-4 h-4 mr-2" />Abrufen</>}</Button>
              <Button onClick={() => loadStation(compareInput, true)} disabled={loading || !compareInput} className="h-12 bg-[hsl(220,18%,16%)] text-foreground border border-[hsl(220,16%,24%)] hover:bg-[hsl(220,18%,20%)] font-mono uppercase tracking-wider"><GitCompare className="w-4 h-4 mr-2" />Vergleich</Button>
            </div>

            {(favorites.length > 0 || searchHistory.length > 0) && (
              <div className="grid md:grid-cols-2 gap-4 text-sm font-mono">
                <div>
                  <div className="text-muted-foreground mb-2">Favoriten</div>
                  <div className="flex flex-wrap gap-2">
                    {favorites.map((fav) => <button key={fav} onClick={() => { setIcaoInput(fav); loadStation(fav); }} className="px-2 py-1 rounded border border-yellow-500/30 text-yellow-300 bg-yellow-500/10">{fav}</button>)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-2">Letzte Suchen</div>
                  <div className="flex flex-wrap gap-2">
                    {searchHistory.map((item) => <button key={item} onClick={() => { setIcaoInput(item); loadStation(item); }} className="px-2 py-1 rounded border border-[hsl(217,33%,25%)] text-aviation-green bg-[hsl(222,47%,8%)]">{item}</button>)}
                  </div>
                </div>
              </div>
            )}

            {error && <div className="flex items-center gap-2 text-aviation-red text-sm font-mono bg-aviation-red/10 border border-aviation-red/30 p-3 rounded-md"><AlertTriangle className="w-4 h-4" />{error}</div>}
          </CardContent>
        </Card>

        <Card className="safety-banner border-amber-500/30">
          <CardContent className="p-4 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-500 mt-0.5" />
            <div>
              <p className="font-bold text-amber-500 text-sm font-mono uppercase tracking-wider">Sicherheitshinweis</p>
              <p className="text-sm text-amber-400/80 mt-1 font-mono leading-relaxed">Nur zu Informationszwecken. Für flugbetriebliche Entscheidungen immer offizielle Quellen verwenden.</p>
            </div>
          </CardContent>
        </Card>

        {liveMetar && (
          <>
            <div className="flex items-center justify-between gap-4 font-mono text-sm">
              <div className={`px-3 py-2 rounded-md border ${activeCategory.color}`}>Kategorie: {activeCategory.cat}</div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => toggleFavorite(liveMetar.icaoId)} className="border-yellow-500/30 text-yellow-300 bg-yellow-500/10 hover:bg-yellow-500/20">
                  <Star className="w-4 h-4 mr-2" />{favorites.includes(liveMetar.icaoId) ? 'Favorit entfernt' : 'Favorit'}
                </Button>
                <a className="inline-flex items-center px-3 py-2 rounded-md border border-sky-500/30 text-sky-300 bg-sky-500/10 hover:bg-sky-500/20" href={`https://aviationweather.gov/sigmet/?region=${sigmetRegion(liveMetar.icaoId)}`} target="_blank">
                  SIGMET <ExternalLink className="w-4 h-4 ml-2" />
                </a>
              </div>
            </div>

            {fallbackInfo && (
              <Card className="bg-amber-950/30 border-amber-500/30">
                <CardContent className="p-4 flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-amber-500 mt-0.5" />
                  <div className="font-mono text-sm text-amber-300">Fallback aktiv: {fallbackInfo.requested} → {fallbackInfo.fallbackStation} ({fallbackInfo.distance.toFixed(1)} NM)</div>
                </CardContent>
              </Card>
            )}

            <div className={compareMetar ? 'grid xl:grid-cols-2 gap-6' : 'grid grid-cols-1'}>
              <MetarGrid metar={liveMetar} runway={runway} />
              {compareMetar ? <MetarGrid metar={compareMetar} runway={runway} /> : null}
            </div>

            <div className="grid xl:grid-cols-2 gap-6">
              <Card className="cockpit-display glow-border">
                <CardHeader><CardTitle className="text-lg text-muted-foreground font-mono uppercase tracking-wider">TAF</CardTitle><CardDescription className="font-mono">{liveTaf ? `${liveTaf.icaoId} gültig ${new Date(liveTaf.validTimeFrom).toLocaleString('de-DE')} bis ${new Date(liveTaf.validTimeTo).toLocaleString('de-DE')}` : 'Kein TAF verfügbar'}</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  {liveTaf?.fcsts?.length ? liveTaf.fcsts.map((f, i) => {
                    const category = getFlightCategory({ ...liveMetar, visib: f.visib ?? liveMetar?.visib ?? 9999, clouds: (f.skyCover || []).map((cover, idx) => ({ cover, base: f.base?.[idx] || 0 })) } as LiveMetar);
                    return (
                      <div key={i} className={`rounded-md border p-3 font-mono text-sm ${category.color}`}>
                        <div className="font-bold mb-1">{new Date(f.timeFrom).toLocaleString('de-DE', { day: '2-digit', hour: '2-digit', minute: '2-digit' })} → {new Date(f.timeTo).toLocaleString('de-DE', { day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                        <div>Wind: {f.windDir ?? 'VRB'}° / {f.windSpd ?? '-'} KT {f.windGust ? `G${f.windGust}` : ''}</div>
                        <div>Sicht: {visMeters(f.visib)} m</div>
                        <div>Weather: {f.wxString || '—'}</div>
                        <div>Clouds: {(f.skyCover || []).join(', ') || '—'}</div>
                      </div>
                    );
                  }) : <p className="text-muted-foreground font-mono text-sm">Noch kein TAF geladen.</p>}
                </CardContent>
              </Card>

              <Card className="cockpit-display glow-border">
                <CardHeader><CardTitle className="text-lg text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-2"><History className="w-5 h-5" />Letzte METARs</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {historyMetars.length ? historyMetars.map((item) => (
                    <div key={item.metar_id} className="rounded-md border border-[hsl(217,33%,20%)] p-3 font-mono text-sm">
                      <div className="text-aviation-green font-bold">{new Date(item.reportTime).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit', day: '2-digit' })} UTC</div>
                      <div>Wind {item.wdir}°/{item.wspd}KT · Temp {item.temp}°C · QNH {item.altim} hPa</div>
                      <div className="text-muted-foreground truncate">{item.rawOb}</div>
                    </div>
                  )) : <p className="text-muted-foreground font-mono text-sm">Keine Verlaufdaten.</p>}
                </CardContent>
              </Card>
            </div>

            <div className="grid xl:grid-cols-2 gap-6">
              <Card className="cockpit-display glow-border">
                <CardHeader><CardTitle className="text-lg text-muted-foreground font-mono uppercase tracking-wider">Karte</CardTitle></CardHeader>
                <CardContent>
                  <iframe title="map" src={`https://www.openstreetmap.org/export/embed.html?bbox=${liveMetar.lon - 0.1},${liveMetar.lat - 0.1},${liveMetar.lon + 0.1},${liveMetar.lat + 0.1}&layer=mapnik&marker=${liveMetar.lat},${liveMetar.lon}`} style={{ width: '100%', height: 320, border: 'none' }} />
                </CardContent>
              </Card>

              <Card className="cockpit-display glow-border">
                <CardHeader><CardTitle className="text-lg text-muted-foreground font-mono uppercase tracking-wider">SIGMET / Alerts</CardTitle></CardHeader>
                <CardContent className="space-y-3 font-mono text-sm">
                  {sigmets.length ? sigmets.slice(0, 5).map((s, i) => (
                    <div key={i} className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-red-300">{s.rawAirSigmet}</div>
                  )) : <p className="text-muted-foreground">Keine SIGMETs im lokalen BBOX gefunden.</p>}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-[hsl(220,16%,20%)] mt-12 py-6">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-muted-foreground font-mono">
          <p>METAR & TAF Decoder · Datenquelle: Aviation Weather Center</p>
          <p className="mt-1">Nicht für flugbetriebliche Zwecke geeignet · Always consult official sources</p>
        </div>
      </footer>
    </div>
  );
}
