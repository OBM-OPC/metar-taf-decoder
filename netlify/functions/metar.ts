import type { Config } from "@netlify/functions";
import { readFileSync } from "fs";
import { join } from "path";

// --- Stations-Datenbank (4.557+ Stationen weltweit) ---
// Lazy-load aus der JSON-Datei im selben Verzeichnis
let stationsDbTyped: Record<string, { lat: number; lon: number; name: string; elev: number }> = {};
try {
  const stationsPath = join(__dirname, "stations.json");
  const stationsRaw = readFileSync(stationsPath, "utf-8");
  stationsDbTyped = JSON.parse(stationsRaw);
} catch (e) {
  console.warn("Could not load stations.json:", e);
}

async function lookupStationViaNominatim(icao: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(icao + " airport")}&format=json&limit=1`;
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "METAR-Decoder/1.0 (metar-decoder.netlify.app)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as Array<{ lat: string; lon: string; class?: string; type?: string }>;
    if (Array.isArray(data) && data.length > 0) {
      const hit = data[0];
      if (hit.lat && hit.lon) {
        console.log("Nominatim found:", icao, hit.lat, hit.lon);
        return { lat: parseFloat(hit.lat), lon: parseFloat(hit.lon) };
      }
    }
  } catch (e) {
    console.log("Nominatim lookup error:", e);
  }
  return null;
}

interface MetarData {
  icaoId: string;
  lat: number;
  lon: number;
  rawOb: string;
  reportTime: string;
  temp: number;
  dewp: number;
  wdir: number;
  wspd: number;
  wgst: number | null;
  visib: number | string;
  altim: number;
  clouds: { cover: string; base: number }[];
  name: string;
  elev: number;
}

interface StationInfo {
  icaoId: string;
  lat: number;
  lon: number;
  elev: number;
  name: string;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440;
  const toRad = (deg: number) => deg * (Math.PI / 180);
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// WICHTIGE REGIONALE BOUNDING-BOXEN weltweit
function getRegionalBbox(icao: string): string {
  const c1 = icao.charAt(0);
  const c2 = icao.charAt(1);

  // --- SÜDAMERIKA ---
  if (c1 === "S") {
    // Brasilien
    if (c2 === "B") return "-35,-75,5,-30";
    // Kolumbien, Ecuador, Venezuela, Guyanas
    if (["A","C","E","K","M","N","O","P","Q","R","T","U","V","W","X","Y","Z"].includes(c2)) return "-15,-90,15,-30";
    // Argentinien, Chile, Uruguay, Paraguay, Bolivien, Peru
    return "-60,-90,-5,-30";
  }

  // --- AFRIKA ---
  if (c1 === "D" || c1 === "F" || c1 === "G" || c1 === "H") {
    // Nordafrika / Mittelmeerraum
    if (["A","B","D"].includes(c2) && c1 === "D") return "15,-20,40,35";
    // Zentralafrika
    if (c1 === "F") return "-20,10,20,50";
    // Westafrika
    if (c1 === "G") return "0,-25,25,25";
    // Ostafrika
    if (c1 === "H") return "-15,30,15,55";
    // Fallback Afrika
    return "-40,-25,40,60";
  }

  // --- ASIEN ---
  if (c1 === "U") {
    // Russland / GUS
    if (["A","B","D","E","G","H","I","K","L","M","N","O","R","S","T","U","W"].includes(c2)) return "40,40,80,180";
    // Kasachstan, Usbekistan etc.
    return "35,45,60,90";
  }
  if (c1 === "V") {
    // Indien, Pakistan, Sri Lanka, Bangladesch
    if (["A","B","C","E","G","I","O","R"].includes(c2)) return "5,65,40,95";
    // Thailand, Vietnam, Malaysia, Singapur, Indonesien (Teil)
    if (["D","T","V","V","W","Y","Z"].includes(c2)) return "0,95,25,110";
    return "5,65,40,110";
  }
  if (c1 === "W") {
    // Indonesien, Malaysia, Osttimor, Brunei
    return "-15,90,10,145";
  }
  if (c1 === "Z") {
    // China, Mongolei, Nordkorea
    return "15,70,55,140";
  }
  if (c1 === "R") {
    // Japan, Südkorea, Taiwan, Philippinen
    if (["J","K","O","P","R"].includes(c2)) return "20,120,50,150";
    if (c2 === "C") return "30,120,45,140";
    return "20,120,50,160";
  }
  if (c1 === "O") {
    // Mittlerer Osten / Golfstaaten / Irak / Iran
    return "10,30,45,70";
  }

  // --- AUSTRALIEN / OZEANIEN ---
  if (c1 === "Y") {
    if (c2 === "A") return "-45,110,-10,160"; // Australien
    if (c2 === "B") return "-45,140,-25,180"; // Australien Ost
    if (c2 === "C") return "-45,130,-20,170"; // Australien Mitte
    if (c2 === "P") return "-45,110,-25,155"; // Australien
    if (c2 === "S") return "-45,130,-30,155"; // Australien Süd
    return "-50,110,-5,180";
  }
  if (c1 === "N") return "-25,160,10,-150"; // Süd-Pazifik

  // --- NORDAMERIKA ---
  if (c1 === "K") return "24,-125,50,-65";   // USA (contiguous)
  if (c1 === "P") return "15,-180,75,-50";   // Alaska, Hawaii, Pacific
  if (c1 === "C") return "41,-141,84,-52";   // Kanada

  // --- KARIBIK / ZENTRALAMERIKA ---
  if (c1 === "M") {
    if (["B","C","D","E","F","G","H","I","J","K","L","M","N","P","R","S","T","U","V","W","X","Y"].includes(c2)) return "5,-100,30,-55";
    return "5,-100,30,-55";
  }
  if (c1 === "T") return "5,-100,30,-55";    // Karibik

  // --- EUROPA ---
  if (c1 === "E") {
    // Skandinavien
    if (["N","S","F"].includes(c2)) return "55,-15,72,35";
    // UK
    if (["G","G","G"].includes(c2)) return "48,-12,62,5";
    // Osteuropa / Baltikum
    if (["E","U","V","Y"].includes(c2)) return "50,20,65,40";
    return "35,-15,75,40";
  }
  if (c1 === "L") return "35,-10,50,40";     // Süd-Europa
  if (c1 === "B") return "50,-30,68,10";     // Island, UK

  // Default: sehr große Box (ganze Welt, um sicherzustellen dass was gefunden wird)
  return "-90,-180,90,180";
}

async function fetchMetarByBbox(bbox: string): Promise<MetarData[]> {
  try {
    console.log("Fetching METARs for bbox:", bbox);
    const response = await fetch(
      `https://aviationweather.gov/api/data/metar?format=json&bbox=${bbox}`,
      { headers: { Accept: "application/json" } }
    );
    if (!response.ok) return [];
    const text = await response.text();
    if (!text || !text.trim()) return [];
    const parsed = JSON.parse(text) as MetarData[];
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch (e) {
    console.log("Bbox fetch error:", e);
    return [];
  }
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const icao = url.searchParams.get("ids");

  if (!icao) {
    return new Response(JSON.stringify({ error: "Missing ids parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const upperIcao = icao.toUpperCase();

  try {
    // ============================================================
    // SCHRITT 1: Direkte METAR-Abfrage
    // ============================================================
    console.log("[1] Direct METAR for:", upperIcao);
    const metarResponse = await fetch(
      `https://aviationweather.gov/api/data/metar?ids=${upperIcao}&format=json&taf=false`,
      { headers: { Accept: "application/json" } }
    );

    if (metarResponse.ok) {
      const text = await metarResponse.text();
      if (text && text.trim()) {
        try {
          const metarData = JSON.parse(text) as MetarData[];
          if (Array.isArray(metarData) && metarData.length > 0 && metarData[0].icaoId) {
            return new Response(JSON.stringify({ found: true, station: upperIcao, data: metarData }), {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            });
          }
        } catch (e) {
          console.log("METAR parse error:", e);
        }
      }
    }
    console.log("[1] No direct METAR found for:", upperIcao);

    // ============================================================
    // SCHRITT 2: Station-Koordinaten ermitteln (mehrere Quellen)
    // ============================================================
    let stationLat = 0;
    let stationLon = 0;
    let stationName = "";
    let hasStation = false;

    // 2a. aviationweather.gov Station-Info API
    try {
      console.log("[2a] Station API for:", upperIcao);
      const stationResponse = await fetch(
        `https://aviationweather.gov/api/data/stationinfo?ids=${upperIcao}&format=json`,
        { headers: { Accept: "application/json" } }
      );
      if (stationResponse.ok) {
        const text = await stationResponse.text();
        if (text && text.trim()) {
          try {
            const stationData = JSON.parse(text) as StationInfo[];
            if (Array.isArray(stationData) && stationData.length > 0) {
              stationLat = stationData[0].lat || 0;
              stationLon = stationData[0].lon || 0;
              stationName = stationData[0].name || "";
              hasStation = true;
              console.log("[2a] Found via API:", upperIcao, stationLat, stationLon);
            }
          } catch (e) {
            console.log("Station parse error:", e);
          }
        }
      }
    } catch (e) {
      console.log("Station fetch error:", e);
    }

    // 2b. Lokale Stations-Datenbank (4.557+ Stationen)
    if (!hasStation) {
      const dbEntry = stationsDbTyped[upperIcao];
      if (dbEntry && dbEntry.lat && dbEntry.lon) {
        stationLat = dbEntry.lat;
        stationLon = dbEntry.lon;
        stationName = dbEntry.name || "";
        hasStation = true;
        console.log("[2b] Found via local DB:", upperIcao, stationLat, stationLon);
      }
    }

    // 2c. Nominatim (OpenStreetMap)
    if (!hasStation) {
      const nominatimResult = await lookupStationViaNominatim(upperIcao);
      if (nominatimResult) {
        stationLat = nominatimResult.lat;
        stationLon = nominatimResult.lon;
        hasStation = true;
        console.log("[2c] Found via Nominatim:", upperIcao, stationLat, stationLon);
      }
    }

    // ============================================================
    // SCHRITT 3: Lokale METAR-Suche (BBOX um Zielstation)
    // ============================================================
    let nearbyData: MetarData[] = [];

    if (hasStation && stationLat !== 0 && stationLon !== 0) {
      const bbox = `${stationLat - 2},${stationLon - 2},${stationLat + 2},${stationLon + 2}`;
      nearbyData = await fetchMetarByBbox(bbox);
      if (nearbyData.length > 0) {
        console.log("[3] Found nearby METARs:", nearbyData.length);
      }
    }

    // ============================================================
    // SCHRITT 4: Regionale METAR-Suche (größere BBOX basierend auf ICAO-Prefix)
    // ============================================================
    if (nearbyData.length === 0) {
      const regionalBbox = getRegionalBbox(upperIcao);
      console.log("[4] Regional bbox:", regionalBbox);
      nearbyData = await fetchMetarByBbox(regionalBbox);
      if (nearbyData.length > 0) {
        console.log("[4] Found regional METARs:", nearbyData.length);
      }
    }

    // ============================================================
    // SCHRITT 5: Globale METAR-Suche (alle aktuellen METARs)
    // ============================================================
    if (nearbyData.length === 0) {
      console.log("[5] Global search (all current METARs)...");
      // Welt-BBOX, um alle aktuellen METARs zu bekommen
      nearbyData = await fetchMetarByBbox("-90,-180,90,180");
      if (nearbyData.length > 0) {
        console.log("[5] Found global METARs:", nearbyData.length);
      }
    }

    // ============================================================
    // SCHRITT 6: Nach Entfernung sortieren und nächstgelegenes zurückgeben
    // ============================================================
    if (nearbyData.length > 0) {
      // Filtere die angefragte Station selbst heraus (wir wollen nur Fallback)
      let candidates = nearbyData.filter((m) => m.icaoId !== upperIcao);

      // Wenn wir Koordinaten haben: nach Haversine-Distanz sortieren
      if (hasStation && stationLat !== 0 && stationLon !== 0) {
        const withDistance = candidates.map((m) => ({
          ...m,
          distance: haversineDistance(stationLat, stationLon, m.lat, m.lon),
        }));
        withDistance.sort((a, b) => a.distance - b.distance);
        candidates = withDistance;
      }
      // Sonst: sortiere nach Priorität (versuche gleichen ICAO-Prefix)
      else {
        const prefix = upperIcao.substring(0, 2);
        candidates.sort((a, b) => {
          const aMatch = a.icaoId.startsWith(prefix) ? 0 : 1;
          const bMatch = b.icaoId.startsWith(prefix) ? 0 : 1;
          return aMatch - bMatch;
        });
      }

      if (candidates.length > 0) {
        const nearest = candidates[0];
        const dist = hasStation
          ? Math.round((nearest as any).distance * 10) / 10
          : null;

        console.log("[6] Fallback station:", nearest.icaoId, "distance:", dist, "NM");

        return new Response(
          JSON.stringify({
            found: false,
            requested: upperIcao,
            fallback: true,
            fallbackStation: nearest.icaoId,
            fallbackDistance: dist,
            fallbackDistanceUnit: "NM",
            fallbackName: stationName || undefined,
            data: [nearest],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }

    // ============================================================
    // NICHTS GEFUNDEN
    // ============================================================
    return new Response(
      JSON.stringify({ error: "Keine METAR-Daten für diesen Flugplatz oder die Region verfügbar" }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err: any) {
    console.error("METAR proxy error:", err);
    return new Response(JSON.stringify({ error: "Interner Serverfehler", details: err?.message || String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config: Config = {
  path: "/api/metar",
};
