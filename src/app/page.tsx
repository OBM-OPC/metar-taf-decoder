'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { fetchLiveMetar, type LiveMetar } from '@/lib/api';
import { Wind, Eye, Cloud, Thermometer, Gauge, Plane, Search, Loader2, MapPin, AlertTriangle, ShieldAlert, Radar } from 'lucide-react';

export default function Home() {
  const [icaoInput, setIcaoInput] = useState('');
  const [liveMetar, setLiveMetar] = useState<LiveMetar | null>(null);
  const [fallbackInfo, setFallbackInfo] = useState<{requested: string; fallbackStation: string; distance: number} | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFetch = async () => {
    const icao = icaoInput.trim().toUpperCase();
    if (icao.length !== 4 || !/^[A-Z]{4}$/.test(icao)) {
      setError('Bitte einen gültigen 4-stelligen ICAO-Code eingeben (z.B. EDDF)');
      setLiveMetar(null);
      setFallbackInfo(null);
      return;
    }

    setLoading(true);
    setError('');
    setLiveMetar(null);
    setFallbackInfo(null);

    try {
      const response = await fetch(`/api/metar?ids=${icao}`, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        const err = await response.json();
        setError(err.error || 'Keine METAR-Daten gefunden');
        setLoading(false);
        return;
      }

      const result = await response.json();

      if (result.found) {
        if (Array.isArray(result.data) && result.data.length > 0) {
          setLiveMetar(result.data[0] as LiveMetar);
        }
      } else if (result.fallback) {
        if (Array.isArray(result.data) && result.data.length > 0) {
          setLiveMetar(result.data[0] as LiveMetar);
          setFallbackInfo({
            requested: result.requested,
            fallbackStation: result.fallbackStation,
            distance: result.fallbackDistance,
          });
        }
      } else {
        setError('Keine METAR-Daten gefunden');
      }
    } catch {
      setError('Fehler beim Abrufen der Daten. Bitte später erneut versuchen.');
    } finally {
      setLoading(false);
    }
  };

  const getWindDirection = (degrees: number) => {
    if (degrees === -1 || degrees === undefined) return 'Variable';
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return directions[Math.round(degrees / 22.5) % 16];
  };

  const getVisibilityDescription = (vis: number) => {
    if (vis >= 9999) return '10+ km (CAVOK)';
    if (vis >= 5000) return 'Gut';
    if (vis >= 1000) return 'Mäßig';
    return 'Schlecht';
  };

  const visInMeters = (vis: number | string) => {
    if (typeof vis === 'string') {
      if (vis === '6+') return 9999;
      const num = parseFloat(vis);
      if (!isNaN(num)) return Math.round(num * 1609.34);
      return 9999;
    }
    return Math.round(vis * 1609.34);
  };

  const getWindColor = (wspd: number, wgst?: number) => {
    const max = wgst || wspd;
    if (max >= 30) return 'text-aviation-red';
    if (max >= 20) return 'text-aviation-amber';
    return 'text-aviation-green';
  };

  const getVisColor = (vis: number) => {
    if (vis < 1000) return 'text-aviation-red';
    if (vis < 3000) return 'text-aviation-amber';
    return 'text-aviation-green';
  };

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] radar-grid">
      {/* Top Bar */}
      <header className="border-b border-[hsl(217,33%,20%)] bg-[hsl(222,47%,5%)]/90 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center gap-3">
          <Radar className="w-6 h-6 text-aviation-green" />
          <span className="font-bold text-xl text-aviation-green tracking-wider uppercase" style={{fontFamily: "'Roboto Mono', ui-monospace, monospace"}}>
            METAR · TAF Decoder
          </span>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-aviation-green animate-pulse" />
            <span className="text-xs text-muted-foreground font-mono">SYS ONLINE</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-aviation-green mb-2 tracking-tight crt-text">
            Live METAR Decoder
          </h1>
          <p className="text-muted-foreground font-mono text-sm">
            ICAO-CODE EINGEBEN · AKTUELLE WETTERDATEN ABRUFEN
          </p>
        </div>

        {/* Search Card */}
        <Card className="mb-8 cockpit-display glow-border">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground font-mono uppercase tracking-wider">
                  ICAO-Code
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="EDDF"
                    value={icaoInput}
                    onChange={(e) => setIcaoInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
                    className="font-mono text-lg h-12 uppercase flex-1 bg-[hsl(222,47%,8%)] border-[hsl(217,33%,25%)] text-aviation-green placeholder:text-muted-foreground/50 cockpit-input focus:ring-aviation-green"
                    maxLength={4}
                  />
                  <Button 
                    onClick={handleFetch} 
                    disabled={loading}
                    className="h-12 px-6 bg-aviation-green/10 text-aviation-green border border-aviation-green/30 hover:bg-aviation-green/20 hover:text-aviation-green font-mono uppercase tracking-wider"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Search className="w-4 h-4 mr-2" />
                        Abrufen
                      </>
                    )}
                  </Button>
                </div>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-aviation-red text-sm font-mono bg-aviation-red/10 border border-aviation-red/30 p-3 rounded-md">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Safety Disclaimer */}
        <Card className="mb-6 safety-banner border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold text-amber-500 text-sm font-mono uppercase tracking-wider">
                  Sicherheitshinweis / Disclaimer
                </p>
                <p className="text-sm text-amber-400/80 mt-1 font-mono leading-relaxed">
                  Dieses Tool dient ausschließlich zu Informations- und Ausbildungszwecken. 
                  Die dargestellten METAR-Daten werden über Drittanbieter bezogen und können 
                  zeitlich verzögert oder unvollständig sein. Für flugbetriebliche Entscheidungen 
                  ist stets die offizielle Quelle (z.B. DFS, NOAA, Eurocontrol) heranzuziehen. 
                  Der Betreiber übernimmt keine Haftung für die Richtigkeit, Vollständigkeit oder 
                  Aktualität der Daten.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fallback Warning */}
        {fallbackInfo && (
          <Card className="mb-6 bg-amber-950/30 border-amber-500/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-amber-400 font-mono">
                    Kein METAR für {fallbackInfo.requested} verfügbar
                  </p>
                  <p className="text-sm text-amber-400/70 mt-1 font-mono">
                    Fallback auf <strong className="text-amber-300">{fallbackInfo.fallbackStation}</strong> ({fallbackInfo.distance.toFixed(1)} NM entfernt)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Data Display */}
        {liveMetar && (
          <div className="space-y-6">
            {/* Station Header */}
            <Card className="cockpit-display glow-border">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle className="text-3xl text-aviation-green font-mono tracking-wider">
                      {liveMetar.icaoId}
                    </CardTitle>
                    <CardDescription className="text-muted-foreground font-mono mt-1">
                      {liveMetar.name && `${liveMetar.name} · `}
                      Beobachtung: {new Date(liveMetar.reportTime).toLocaleString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'UTC'
                      })} UTC
                    </CardDescription>
                  </div>
                  <div className="text-right font-mono text-sm">
                    <div className="text-muted-foreground">LAT / LON</div>
                    <div className="text-aviation-green">
                      {liveMetar.lat?.toFixed(4)}° · {liveMetar.lon?.toFixed(4)}°
                    </div>
                    {liveMetar.elev && (
                      <div className="text-muted-foreground mt-1">
                        ELEV {liveMetar.elev} ft MSL
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Data Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Wind */}
              <Card className="cockpit-display scope-ring">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Wind className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="text-lg text-muted-foreground font-mono uppercase tracking-wider">
                      Wind
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`text-4xl font-bold font-mono ${getWindColor(liveMetar.wspd, liveMetar.wgst ?? undefined)}`}>
                    {liveMetar.wspd}
                    <span className="text-lg text-muted-foreground ml-1">KT</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-2 font-mono">
                    {getWindDirection(liveMetar.wdir)} · {liveMetar.wdir}°
                  </div>
                  {liveMetar.wgst && (
                    <div className="text-sm text-aviation-amber mt-1 font-mono flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Böen: {liveMetar.wgst} KT
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Visibility */}
              <Card className="cockpit-display scope-ring">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Eye className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="text-lg text-muted-foreground font-mono uppercase tracking-wider">
                      Sicht
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`text-4xl font-bold font-mono ${getVisColor(visInMeters(liveMetar.visib))}`}>
                    {visInMeters(liveMetar.visib) >= 9999 
                      ? '10+' 
                      : visInMeters(liveMetar.visib)}
                    <span className="text-lg text-muted-foreground ml-1">
                      {visInMeters(liveMetar.visib) >= 9999 ? 'km' : 'm'}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-2 font-mono">
                    {getVisibilityDescription(visInMeters(liveMetar.visib))}
                  </div>
                </CardContent>
              </Card>

              {/* Temperature */}
              <Card className="cockpit-display scope-ring">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Thermometer className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="text-lg text-muted-foreground font-mono uppercase tracking-wider">
                      Temp
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold font-mono text-aviation-green">
                    {liveMetar.temp}
                    <span className="text-lg text-muted-foreground ml-1">°C</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-2 font-mono">
                    DP: {liveMetar.dewp}°C · SPR: {(liveMetar.temp - liveMetar.dewp).toFixed(1)}°C
                  </div>
                </CardContent>
              </Card>

              {/* Pressure */}
              <Card className="cockpit-display scope-ring">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Gauge className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="text-lg text-muted-foreground font-mono uppercase tracking-wider">
                      QNH
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold font-mono text-aviation-green">
                    {liveMetar.altim}
                    <span className="text-lg text-muted-foreground ml-1">hPa</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-2 font-mono">
                    {liveMetar.altim > 1020 ? 'HIGH PRESSURE' : liveMetar.altim < 1000 ? 'LOW PRESSURE' : 'STD PRESSURE'}
                  </div>
                  {liveMetar.slp && (
                    <div className="text-sm text-muted-foreground font-mono">
                      SLP: {liveMetar.slp} hPa
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Clouds */}
              <Card className="cockpit-display scope-ring md:col-span-2">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Cloud className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="text-lg text-muted-foreground font-mono uppercase tracking-wider">
                      Wolken
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {(!liveMetar.clouds || liveMetar.clouds.length === 0) ? (
                    <p className="text-muted-foreground font-mono">CAVOK / KEINE SIGNIFIKANTEN WOLKEN</p>
                  ) : (
                    <div className="space-y-2">
                      {liveMetar.clouds.map((cloud, i) => (
                        <div key={i} className="flex items-center justify-between border-b border-[hsl(217,33%,20%)] pb-2">
                          <span className="font-medium text-aviation-green font-mono">{cloud.cover}</span>
                          <span className="text-muted-foreground font-mono">
                            {cloud.base} ft AGL
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Raw METAR */}
            {liveMetar.rawOb && (
              <Card className="cockpit-display glow-border">
                <CardHeader>
                  <CardTitle className="text-lg text-muted-foreground font-mono uppercase tracking-wider">
                    METAR Rohdaten
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <code className="block bg-[hsl(222,47%,5%)] p-4 rounded-md font-mono text-sm text-aviation-green overflow-x-auto border border-[hsl(217,33%,20%)]">
                    {liveMetar.rawOb}
                  </code>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[hsl(217,33%,20%)] mt-12 py-6">
        <div className="mx-auto max-w-4xl px-4 text-center text-xs text-muted-foreground font-mono">
          <p>METAR & TAF Decoder · Datenquelle: NOAA Aviation Weather Center</p>
          <p className="mt-1">Nicht für flugbetriebliche Zwecke geeignet · Always consult official sources</p>
        </div>
      </footer>
    </div>
  );
}
