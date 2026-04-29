'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  ChevronDown, ChevronUp,
} from 'lucide-react';

type FallbackInfo = { requested: string; fallbackStation: string; distance: number } | null;

function getWindDirection(degrees?: number | null) {
  if (degrees === undefined || degrees === null || degrees < 0) return 'VRB';
  const d = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return d[Math.round(degrees / 22.5) % 16];
}

function visM(vis: number | string | null | undefined) {
  if (vis === null || vis === undefined) return 9999;
  if (typeof vis === 'string') { if (vis === '6+') return 9999; const n = parseFloat(vis); return Number.isNaN(n) ? 9999 : Math.round(n * 1609.34); }
  return vis > 100 ? Math.round(vis) : Math.round(vis * 1609.34);
}

function getFlightCategory(metar: LiveMetar | null) {
  if (!metar) return { cat: 'N/A', color: 'text-muted-foreground', bg: '' };
  const v = visM(metar.visib);
  const c = [...(metar.clouds || [])].filter(x => ['BKN','OVC'].includes(x.cover)).sort((a,b) => a.base - b.base)[0]?.base ?? 99999;
  if (c < 500 || v < 1609) return { cat: 'LIFR', color: 'text-red-400', bg: 'bg-red-500/10' };
  if (c < 1000 || v < 4828) return { cat: 'IFR', color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
  if (c < 3000 || v < 8047) return { cat: 'MVFR', color: 'text-sky-400', bg: 'bg-sky-500/10' };
  return { cat: 'VFR', color: 'text-green-400', bg: 'bg-green-500/10' };
}

function windComp(metar: LiveMetar | null, rwy: string) {
  if (!metar || !rwy || metar.wdir == null || metar.wdir < 0) return null;
  const n = parseInt(rwy.replace(/\D/g, ''), 10);
  if (!n || n > 36) return null;
  const rd = n * 10;
  let ad = ((metar.wdir - rd + 540) % 360) - 180;
  const rad = ad * Math.PI / 180;
  const hw = Math.round(metar.wspd * Math.cos(rad));
  const cw = Math.round(Math.abs(metar.wspd * Math.sin(rad)));
  return { hw: Math.max(0, hw), tw: Math.max(0, -hw), cw, cwd: ad > 0 ? 'R' : 'L' };
}

function wc(s: number, g?: number | null) { const m = g || s; return m >= 30 ? 'text-red-400' : m >= 20 ? 'text-yellow-400' : 'text-green-400'; }

function sigmetRegion(icao: string) {
  const c = icao[0] || 'w';
  if ('KCP'.includes(c)) return 'us';
  if ('ELBU'.includes(c)) return 'europe';
  if ('RVWOZY'.includes(c)) return 'asia';
  if (c === 'S') return 'southamerica';
  if ('DFGH'.includes(c)) return 'africa';
  return 'world';
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
  const [showDetails, setShowDetails] = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    setFavorites(JSON.parse(localStorage.getItem('metar-favorites') || '[]'));
    setSearchHistory(JSON.parse(localStorage.getItem('metar-history') || '[]'));
  }, []);

  const cat = useMemo(() => getFlightCategory(liveMetar), [liveMetar]);

  const updateHistory = (icao: string) => {
    const next = [icao, ...searchHistory.filter(h => h !== icao)].slice(0, 10);
    setSearchHistory(next);
    localStorage.setItem('metar-history', JSON.stringify(next));
  };

  const toggleFavorite = (icao: string) => {
    const next = favorites.includes(icao) ? favorites.filter(f => f !== icao) : [...favorites, icao];
    setFavorites(next);
    localStorage.setItem('metar-favorites', JSON.stringify(next));
  };

  const loadStation = async (icaoRaw?: string, compare = false) => {
    const icao = (icaoRaw || icaoInput).trim().toUpperCase();
    if (icao.length !== 4 || !/^[A-Z]{4}$/.test(icao)) { setError('Ungültiger ICAO-Code'); return; }
    setLoading(true); setError('');
    try {
      const metar = await fetchLiveMetar(icao);
      if (!metar) { setError('Keine METAR-Daten gefunden'); return; }
      if (compare) { setCompareMetar(metar); setShowCompare(true); }
      else {
        setLiveMetar(metar); updateHistory(icao);
        const [taf, hist, sig] = await Promise.all([fetchLiveTaf(icao), fetchMetarHistory(icao), fetchSigmets(icao, metar.lat, metar.lon)]);
        setLiveTaf(taf); setHistoryMetars(hist); setSigmets(sig);
      }
    } catch { setError('Fehler beim Abrufen.'); } finally { setLoading(false); }
  };

  const vm = liveMetar ? visM(liveMetar.visib) : 0;
  const wComp = windComp(liveMetar, runway);

  return (
    <div className="min-h-screen radar-grid">
      <header className="border-b border-[hsl(220,16%,20%)] bg-[hsl(220,24%,10%)]/88 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          <Radar className="w-5 h-5 text-emerald-400" />
          <span className="font-bold text-lg text-foreground tracking-wider uppercase font-mono">CLOUDLINE</span>
          <div className="ml-auto flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span className="text-[10px] text-muted-foreground font-mono">LIVE</span></div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        {/* Search */}
        <div className="flex gap-2 flex-wrap">
          <Input placeholder="ICAO" value={icaoInput} onChange={e => setIcaoInput(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && loadStation()} className="font-mono text-base h-10 uppercase w-28 bg-[hsl(220,24%,11%)] border-[hsl(220,16%,20%)] text-foreground" maxLength={4} />
          <Input placeholder="Compare" value={compareInput} onChange={e => setCompareInput(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && loadStation(compareInput, true)} className="font-mono text-base h-10 uppercase w-28 bg-[hsl(220,24%,11%)] border-[hsl(220,16%,20%)] text-foreground" maxLength={4} />
          <Input placeholder="RWY" value={runway} onChange={e => setRunway(e.target.value.toUpperCase())} className="font-mono text-base h-10 uppercase w-20 bg-[hsl(220,24%,11%)] border-[hsl(220,16%,20%)] text-foreground" maxLength={3} />
          <Button onClick={() => loadStation()} disabled={loading} className="h-10 bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-mono text-sm px-4">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-3.5 h-3.5 mr-1" />GO</>}</Button>
        </div>

        {/* Quick chips */}
        {(favorites.length > 0 || searchHistory.length > 0) && (
          <div className="flex flex-wrap gap-1.5 text-xs font-mono">
            {favorites.map(f => <button key={f} onClick={() => { setIcaoInput(f); loadStation(f); }} className="px-2 py-0.5 rounded border border-yellow-500/30 text-yellow-300 bg-yellow-500/10">★ {f}</button>)}
            {searchHistory.filter(h => !favorites.includes(h)).slice(0, 5).map(h => <button key={h} onClick={() => { setIcaoInput(h); loadStation(h); }} className="px-2 py-0.5 rounded border border-[hsl(220,16%,24%)] text-muted-foreground bg-[hsl(220,24%,11%)]">{h}</button>)}
          </div>
        )}

        {error && <div className="flex items-center gap-2 text-red-400 text-xs font-mono bg-red-500/10 border border-red-500/20 p-2 rounded"><AlertTriangle className="w-3 h-3" />{error}</div>}

        {fallbackInfo && <div className="flex items-center gap-2 text-amber-400 text-xs font-mono bg-amber-500/10 border border-amber-500/20 p-2 rounded"><MapPin className="w-3 h-3" />Fallback: {fallbackInfo.requested} → {fallbackInfo.fallbackStation} ({fallbackInfo.distance.toFixed(1)} NM)</div>}

        {/* === MAIN METAR DATA — compact, no scroll needed === */}
        {liveMetar && (
          <div className="space-y-3">
            {/* Header row: ICAO + name + category + favorite + sigmet */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-2xl font-bold font-mono text-foreground tracking-wider">{liveMetar.icaoId}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${cat.color} ${cat.bg} border border-current/20`}>{cat.cat}</span>
              <span className="text-muted-foreground font-mono text-xs">{liveMetar.name} · {new Date(liveMetar.reportTime).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', timeZone: 'UTC' })} UTC</span>
              <button onClick={() => toggleFavorite(liveMetar.icaoId)} className="ml-auto text-xs font-mono">{favorites.includes(liveMetar.icaoId) ? '★' : '☆'}</button>
              <a href={`https://aviationweather.gov/sigmet/?region=${sigmetRegion(liveMetar.icaoId)}`} target="_blank" className="text-xs font-mono text-sky-400 hover:underline flex items-center gap-1">SIGMET <ExternalLink className="w-3 h-3" /></a>
            </div>

            {/* KPI row: all core data in one line */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              <div className="rounded-md border border-[hsl(220,16%,20%)] bg-[hsl(220,24%,11%)] p-2">
                <div className="text-[10px] text-muted-foreground font-mono uppercase">Wind</div>
                <div className={`text-lg font-bold font-mono ${wc(liveMetar.wspd, liveMetar.wgst)}`}>{liveMetar.wdir >= 0 ? `${liveMetar.wdir}°` : 'VRB'} / {liveMetar.wspd} KT</div>
                {liveMetar.wgst ? <div className="text-[10px] text-yellow-400 font-mono">G{liveMetar.wgst}</div> : null}
              </div>
              <div className="rounded-md border border-[hsl(220,16%,20%)] bg-[hsl(220,24%,11%)] p-2">
                <div className="text-[10px] text-muted-foreground font-mono uppercase">Sicht</div>
                <div className={`text-lg font-bold font-mono ${vm < 1000 ? 'text-red-400' : vm < 3000 ? 'text-yellow-400' : 'text-green-400'}`}>{vm >= 9999 ? '10+ km' : `${(vm/1000).toFixed(1)} km`}</div>
                <div className="text-[10px] text-muted-foreground font-mono">{vm} m</div>
              </div>
              <div className="rounded-md border border-[hsl(220,16%,20%)] bg-[hsl(220,24%,11%)] p-2">
                <div className="text-[10px] text-muted-foreground font-mono uppercase">Temp</div>
                <div className="text-lg font-bold font-mono text-green-400">{liveMetar.temp}°C</div>
                <div className="text-[10px] text-muted-foreground font-mono">DP {liveMetar.dewp}°</div>
              </div>
              <div className="rounded-md border border-[hsl(220,16%,20%)] bg-[hsl(220,24%,11%)] p-2">
                <div className="text-[10px] text-muted-foreground font-mono uppercase">QNH</div>
                <div className="text-lg font-bold font-mono text-green-400">{liveMetar.altim} hPa</div>
                <div className="text-[10px] text-muted-foreground font-mono">{liveMetar.altim > 1020 ? 'HIGH' : liveMetar.altim < 1000 ? 'LOW' : 'STD'}</div>
              </div>
              <div className="rounded-md border border-[hsl(220,16%,20%)] bg-[hsl(220,24%,11%)] p-2">
                <div className="text-[10px] text-muted-foreground font-mono uppercase">Clouds</div>
                <div className="text-sm font-bold font-mono text-green-400">{!liveMetar.clouds?.length ? 'CAVOK' : liveMetar.clouds.map(c => `${c.cover} ${c.base}`).join(' · ')}</div>
              </div>
              <div className="rounded-md border border-[hsl(220,16%,20%)] bg-[hsl(220,24%,11%)] p-2">
                <div className="text-[10px] text-muted-foreground font-mono uppercase">WX</div>
                <div className="text-sm font-bold font-mono text-green-400">{liveMetar.wxString || '—'}</div>
              </div>
            </div>

            {/* Runway component — inline if set */}
            {wComp && (
              <div className="grid grid-cols-3 gap-2 font-mono text-sm">
                <div className="rounded-md border border-[hsl(220,16%,20%)] bg-[hsl(220,24%,11%)] p-2 text-center">
                  <div className="text-[10px] text-muted-foreground">HW</div>
                  <div className="text-base font-bold text-green-400">{wComp.hw} KT</div>
                </div>
                <div className={`rounded-md border p-2 text-center ${wComp.cw > 25 ? 'border-red-500/30 text-red-400' : wComp.cw >= 15 ? 'border-yellow-500/30 text-yellow-400' : 'border-green-500/30 text-green-400'}`}>
                  <div className="text-[10px] opacity-70">XW {wComp.cwd}</div>
                  <div className="text-base font-bold">{wComp.cw} KT</div>
                </div>
                <div className={`rounded-md border p-2 text-center ${wComp.tw > 5 ? 'border-red-500/30 text-red-400' : 'border-[hsl(220,16%,20%)] text-muted-foreground'}`}>
                  <div className="text-[10px] opacity-70">TW</div>
                  <div className="text-base font-bold">{wComp.tw} KT</div>
                </div>
              </div>
            )}

            {/* Raw METAR — one line */}
            <div className="rounded-md border border-[hsl(220,16%,20%)] bg-[hsl(220,24%,11%)] px-3 py-2">
              <code className="font-mono text-xs text-green-400">{liveMetar.rawOb}</code>
            </div>

            {/* Compare station — compact inline */}
            {showCompare && compareMetar && (
              <div className="rounded-md border border-sky-500/20 bg-sky-500/5 p-3 space-y-2">
                <div className="flex items-center gap-2"><span className="font-bold font-mono text-foreground">{compareMetar.icaoId}</span><span className="text-xs text-muted-foreground font-mono">{compareMetar.name}</span><button onClick={() => { setCompareMetar(null); setShowCompare(false); }} className="ml-auto text-xs text-muted-foreground">✕</button></div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 font-mono text-xs">
                  <div><span className="text-muted-foreground">Wind </span><span className={wc(compareMetar.wspd, compareMetar.wgst)}>{compareMetar.wdir}°/{compareMetar.wspd}KT</span></div>
                  <div><span className="text-muted-foreground">Vis </span><span className="text-green-400">{visM(compareMetar.visib)}m</span></div>
                  <div><span className="text-muted-foreground">T </span><span className="text-green-400">{compareMetar.temp}°C</span></div>
                  <div><span className="text-muted-foreground">QNH </span><span className="text-green-400">{compareMetar.altim}</span></div>
                  <div><span className="text-muted-foreground">Cloud </span><span className="text-green-400">{!compareMetar.clouds?.length ? 'CAVOK' : compareMetar.clouds.map(c => `${c.cover}${c.base}`).join(' ')}</span></div>
                  <div><span className="text-muted-foreground">WX </span><span className="text-green-400">{compareMetar.wxString || '—'}</span></div>
                </div>
              </div>
            )}

            {/* Expandable details toggle */}
            <button onClick={() => setShowDetails(!showDetails)} className="flex items-center gap-1 text-xs text-muted-foreground font-mono hover:text-foreground transition-colors">
              {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showDetails ? 'Weniger anzeigen' : 'TAF · Verlauf · Karte · SIGMET'}
            </button>

            {showDetails && (
              <div className="space-y-3">
                {/* TAF */}
                <div className="rounded-md border border-[hsl(220,16%,20%)] bg-[hsl(220,24%,11%)] p-3">
                  <div className="text-xs font-mono text-muted-foreground mb-2">TAF {liveTaf ? `${liveTaf.icaoId} ${new Date(liveTaf.validTimeFrom).toLocaleString('de-DE',{day:'2-digit',hour:'2-digit',minute:'2-digit'})}–${new Date(liveTaf.validTimeTo).toLocaleString('de-DE',{day:'2-digit',hour:'2-digit',minute:'2-digit'})}` : ''}</div>
                  {liveTaf?.fcsts?.length ? liveTaf.fcsts.map((f, i) => {
                    const fc = getFlightCategory({ ...liveMetar, visib: f.visib ?? liveMetar.visib, clouds: (f.skyCover||[]).map((c,idx)=>({cover:c,base:f.base?.[idx]||0})) } as LiveMetar);
                    return (
                      <div key={i} className={`rounded border p-2 mb-1 font-mono text-xs ${fc.color} ${fc.bg} border-current/20`}>
                        <span className="font-bold">{new Date(f.timeFrom).toLocaleString('de-DE',{day:'2-digit',hour:'2-digit',minute:'2-digit'})}→{new Date(f.timeTo).toLocaleString('de-DE',{day:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
                        {' '}W:{f.windDir??'VRB'}°/{f.windSpd??'-'}KT{f.windGust?`G${f.windGust}`:''} V:{visM(f.visib)}m WX:{f.wxString||'—'} CLD:{(f.skyCover||[]).join(' ')||'—'}
                      </div>
                    );
                  }) : <p className="text-xs font-mono text-muted-foreground">Kein TAF</p>}
                </div>

                {/* History */}
                <div className="rounded-md border border-[hsl(220,16%,20%)] bg-[hsl(220,24%,11%)] p-3">
                  <div className="text-xs font-mono text-muted-foreground mb-2">Verlauf (24h)</div>
                  {historyMetars.length ? historyMetars.map(h => (
                    <div key={h.metar_id} className="text-xs font-mono text-muted-foreground py-1 border-b border-[hsl(220,16%,18%)] last:border-0">
                      <span className="text-green-400">{new Date(h.reportTime).toLocaleString('de-DE',{hour:'2-digit',minute:'2-digit'})}</span>
                      {' '}W{h.wdir}°/{h.wspd}KT T{h.temp}° Q{h.altim}
                    </div>
                  )) : <p className="text-xs font-mono text-muted-foreground">—</p>}
                </div>

                {/* Map + SIGMET */}
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="rounded-md border border-[hsl(220,16%,20%)] bg-[hsl(220,24%,11%)] overflow-hidden">
                    <iframe title="map" src={`https://www.openstreetmap.org/export/embed.html?bbox=${liveMetar.lon-0.1},${liveMetar.lat-0.1},${liveMetar.lon+0.1},${liveMetar.lat+0.1}&layer=mapnik&marker=${liveMetar.lat},${liveMetar.lon}`} style={{width:'100%',height:200,border:'none'}} />
                  </div>
                  <div className="rounded-md border border-[hsl(220,16%,20%)] bg-[hsl(220,24%,11%)] p-3">
                    <div className="text-xs font-mono text-muted-foreground mb-2">SIGMET</div>
                    {sigmets.length ? sigmets.slice(0,3).map((s,i) => <div key={i} className="text-xs font-mono text-red-400 mb-1">{s.rawAirSigmet}</div>) : <p className="text-xs font-mono text-muted-foreground">Keine aktiven SIGMETs</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Disclaimer */}
        <div className="text-[10px] text-amber-500/60 font-mono">⚠ Nur zu Informationszwecken. Immer offizielle Quellen für flugbetriebliche Entscheidungen verwenden.</div>
      </main>

      <footer className="border-t border-[hsl(220,16%,20%)] py-3">
        <div className="mx-auto max-w-5xl px-4 text-center text-[10px] text-muted-foreground font-mono">Cloudline · Daten: Aviation Weather Center · Not for flight planning</div>
      </footer>
    </div>
  );
}