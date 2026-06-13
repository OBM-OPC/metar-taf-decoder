import type { Config } from "@netlify/functions";
import { readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CheckStatus = "ok" | "degraded" | "error";

interface HealthCheck {
  name: string;
  status: CheckStatus;
  message: string;
  details?: Record<string, unknown>;
}

interface HealthResponse {
  status: CheckStatus;
  timestamp: string;
  version: string;
  checks: HealthCheck[];
}

interface PackageJson {
  version?: string;
}

interface StationRecord {
  lat: number;
  lon: number;
  name: string;
  elev: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AVIATION_WEATHER_API = "https://aviationweather.gov/api/data/metar";
const TEST_ICAO = "EDDH"; // Hamburg — stable, well-known ICAO code
const REQUEST_TIMEOUT_MS = 8_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(body: HealthResponse, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}

function readPackageVersion(): string {
  try {
    const packagePath = join(process.cwd(), "package.json");
    const raw = readFileSync(packagePath, "utf-8");
    const parsed = JSON.parse(raw) as PackageJson;
    return parsed.version ?? "unknown";
  } catch (e) {
    console.warn("Could not read package.json version:", e);
    return "unknown";
  }
}

function loadStationsDatabase(): Record<string, StationRecord> {
  try {
    const stationsPath = join(__dirname, "stations.json");
    const raw = readFileSync(stationsPath, "utf-8");
    return JSON.parse(raw) as Record<string, StationRecord>;
  } catch (e) {
    console.warn("Could not load local stations database:", e);
    return {};
  }
}

async function checkAviationWeatherApi(): Promise<HealthCheck> {
  try {
    const url = `${AVIATION_WEATHER_API}?ids=${TEST_ICAO}&format=json&taf=false`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        name: "aviationweather_api",
        status: "error",
        message: `AviationWeather API returned HTTP ${response.status}`,
        details: { statusCode: response.status, url },
      };
    }

    const text = await response.text();
    if (!text || !text.trim()) {
      return {
        name: "aviationweather_api",
        status: "degraded",
        message: "AviationWeather API reachable but returned empty response",
        details: { url },
      };
    }

    const data = JSON.parse(text) as unknown[];
    if (!Array.isArray(data)) {
      return {
        name: "aviationweather_api",
        status: "degraded",
        message: "AviationWeather API returned unexpected data shape",
        details: { url },
      };
    }

    return {
      name: "aviationweather_api",
      status: "ok",
      message: `AviationWeather API reachable (${data.length} METAR record(s) for ${TEST_ICAO})`,
      details: { url, recordCount: data.length },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("AviationWeather API health check failed:", err);
    return {
      name: "aviationweather_api",
      status: "error",
      message: `AviationWeather API unreachable: ${errorMessage}`,
      details: { url: `${AVIATION_WEATHER_API}?ids=${TEST_ICAO}&format=json&taf=false` },
    };
  }
}

function checkStationsDatabase(): HealthCheck {
  const stations = loadStationsDatabase();
  const count = Object.keys(stations).length;

  if (count === 0) {
    return {
      name: "stations_database",
      status: "error",
      message: "Stations database could not be loaded",
      details: { path: "netlify/functions/stations.json" },
    };
  }

  if (count < 1_000) {
    return {
      name: "stations_database",
      status: "degraded",
      message: `Stations database loaded but count is low (${count} stations)`,
      details: { stationCount: count, path: "netlify/functions/stations.json" },
    };
  }

  return {
    name: "stations_database",
    status: "ok",
    message: `Stations database loaded (${count} stations)`,
    details: { stationCount: count, path: "netlify/functions/stations.json" },
  };
}

function deriveOverallStatus(checks: HealthCheck[]): CheckStatus {
  if (checks.some((c) => c.status === "error")) return "error";
  if (checks.some((c) => c.status === "degraded")) return "degraded";
  return "ok";
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  const version = readPackageVersion();

  const checks = await Promise.all([
    checkAviationWeatherApi(),
    checkStationsDatabase(),
  ]);

  const overallStatus = deriveOverallStatus(checks);

  const response: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version,
    checks,
  };

  // Return 503 when the overall health is not "ok" so callers / load balancers
  // can react appropriately, but still include the full JSON body.
  const httpStatus = overallStatus === "ok" ? 200 : 503;

  return jsonResponse(response, httpStatus);
};

export const config: Config = {
  path: "/api/health",
};
