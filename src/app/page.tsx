'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { decodeMetar } from '@/lib/metar-parser';
import type { DecodedMetar } from '@/lib/metar-parser';
import { Wind, Eye, Cloud, Thermometer, Gauge, Plane, MapPin } from 'lucide-react';

export default function Home() {
  const [metarInput, setMetarInput] = useState('');
  const [decoded, setDecoded] = useState<any>(null);
  const [error, setError] = useState('');

  const handleDecode = () => {
    try {
      setError('');
      const result = decodeMetar(metarInput);
      setDecoded(result);
    } catch (err) {
      setError('Ungültiger METAR-Code. Bitte überprüfen Sie die Eingabe.');
      setDecoded(null);
    }
  };

  const getWindDirection = (degrees: number) => {
    if (degrees === -1) return 'Variable';
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return directions[Math.round(degrees / 22.5) % 16];
  };

  const getVisibilityDescription = (vis: number) => {
    if (vis >= 9999) return '10+ km (CAVOK)';
    if (vis >= 5000) return 'Gut';
    if (vis >= 1000) return 'Mäßig';
    return 'Schlecht';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center gap-2">
          <Plane className="w-6 h-6 text-sky-600" />
          <span className="font-bold text-xl text-sky-900">METAR & TAF Decoder</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-sky-900 mb-2">METAR Decoder</h1>
          <p className="text-sky-600">
            Decodieren Sie METAR-Wettermeldungen in lesbare Informationen
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  METAR-Code eingeben
                </label>
                <Input
                  placeholder="z.B. EDDF 251220Z 27008KT 9999 FEW040 12/08 Q1020 NOSIG"
                  value={metarInput}
                  onChange={(e) => setMetarInput(e.target.value.toUpperCase())}
                  className="font-mono text-sm h-12"
                />
              </div>
              <Button onClick={handleDecode} className="w-full">
                <MapPin className="w-4 h-4 mr-2" />
                Decodieren
              </Button>
              {error && (
                <p className="text-red-500 text-sm mt-2">{error}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {decoded && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-3xl">{decoded.station}</CardTitle>
                    <CardDescription>
                      {decoded.time && `Beobachtung: ${decoded.time.slice(0, 2)}.${decoded.time.slice(2, 4)}. ${decoded.time.slice(4, 6)}:${decoded.time.slice(6, 8)} UTC`}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Wind className="w-5 h-5 text-sky-600" />
                    <CardTitle className="text-lg">Wind</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {decoded.wind.speed} {decoded.wind.unit}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Richtung: {getWindDirection(decoded.wind.direction)} ({decoded.wind.direction >= 0 ? `${decoded.wind.direction}°` : 'Variable'})
                  </div>
                  {decoded.wind.gusts && (
                    <div className="text-sm text-amber-600 mt-1">
                      Böen: {decoded.wind.gusts} {decoded.wind.unit}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Eye className="w-5 h-5 text-sky-600" />
                    <CardTitle className="text-lg">Sicht</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {decoded.visibility >= 9999 ? '10+' : decoded.visibility} m
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {getVisibilityDescription(decoded.visibility)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Thermometer className="w-5 h-5 text-sky-600" />
                    <CardTitle className="text-lg">Temperatur</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {decoded.temperature}°C
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Taupunkt: {decoded.dewpoint}°C
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Spread: {decoded.temperature - decoded.dewpoint}°C
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Gauge className="w-5 h-5 text-sky-600" />
                    <CardTitle className="text-lg">Druck</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {decoded.pressure} hPa
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {decoded.pressure > 1020 ? 'Hochdruck' : decoded.pressure < 1000 ? 'Tiefdruck' : 'Normal'}
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Cloud className="w-5 h-5 text-sky-600" />
                    <CardTitle className="text-lg">Wolken</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {decoded.clouds.length === 0 ? (
                    <p className="text-muted-foreground">Keine Wolkenberichterstattung</p>
                  ) : (
                    <div className="space-y-2">
                      {decoded.clouds.map((cloud: {amount: string, height: number, type?: string}, i: number) => (
                        <div key={i} className="flex items-center justify-between border-b pb-2">
                          <span className="font-medium">{cloud.amount}</span>
                          <span className="text-muted-foreground">
                            {cloud.height > 0 ? `${cloud.height} ft` : 'Bodennähe'}
                          </span>
                          {cloud.type && (
                            <span className="text-sm text-amber-600">
                              {cloud.type === 'CB' ? 'Cumulonimbus' : 'Towering Cumulus'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Rohdaten</CardTitle>
              </CardHeader>
              <CardContent>
                <code className="block bg-slate-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                  {decoded.raw}
                </code>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
