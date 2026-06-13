import type { Config } from "@netlify/functions";
import { readFileSync } from "fs";
import { join } from "path";

// ── Types ───────────────────────────────────────────────────────────────────

interface CheckResult {
  name: string;
  status: "ok" | "degraded" | "error";
  message: string;
  durationMs: number;
}

interface HealthResponse {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  version: string;
  checks: CheckResult[];
}

// ── Helper: Overall status from individual checks ────────────────────────────

function deriveOverallStatus(checks: CheckResult[]): HealthResponse["status"] {
  if (checks.some((c) => c.status === "error")) return "error";
  if (checks.some((c) => c.status === "degraded")) return "degraded";
  return "ok";
}

// ── Checks ─────────────────────────────────────────────────────────────────

/**
 * Check 1: Is the aviationweather.gov API reachable?
 */
async function checkApiReachable(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const response = await fetch(
      "https://aviationweather.gov/api/data/metar?ids=EDDB&format=json&taf=false",
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      return {
        name: "aviationweather-api",
        status: "degraded",
        message: `API responded with status ${response.status}`,
        durationMs: Date.now() - start,
      };
    }

    const text = await response.text();
    if (!text || !text.trim()) {
      return {
        name: "aviationweather-api",
        status: "degraded",
        message: "API returned empty response",
        durationMs: Date.now() - start,
      };
    }

    const data = JSON.parse(text);
    if (!Array.isArray(data) || data.length === 0) {
      return {
        name: "aviationweather-api",
        status: "degraded",
        message: "API returned unexpected data format",
        durationMs: Date.now() - start,
      };
    }

    return {
      name: "aviationweather-api",
      status: "ok",
      message: `API reachable, returned ${data.length} METAR record(s)`,
      durationMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      name: "aviationweather-api",
      status: "error",
      message: err?.message || String(err),
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Check 2: Is the local stations database loaded?
 */
async function checkStationsDb(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const stationsPath = join(__dirname, "stations.json");
    const raw = readFileSync(stationsPath, "utf-8");
    const data = JSON.parse(raw);

    const count = Object.keys(data).length;
    if (count === 0) {
      return {
        name: "stations-database",
        status: "degraded",
        message: "Stations database loaded but empty",
        durationMs: Date.now() - start,
      };
    }

    return {
      name: "stations-database",
      status: "ok",
      message: `Loaded ${count.toLocaleString("de-DE")} stations`,
      durationMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      name: "stations-database",
      status: "error",
      message: err?.message || String(err),
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Check 3: Can we read the package.json (used for version info)?
 */
async function checkPackageJson(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const pkgPath = join(__dirname, "..", "..", "package.json");
    const raw = readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw);

    if (!pkg.version) {
      return {
        name: "package-json",
        status: "degraded",
        message: "package.json loaded but has no version field",
        durationMs: Date.now() - start,
      };
    }

    return {
      name: "package-json",
      status: "ok",
      message: `Version ${pkg.version} read successfully`,
      durationMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      name: "package-json",
      status: "error",
      message: err?.message || String(err),
      durationMs: Date.now() - start,
    };
  }
}

// ── Version reader (used for the response payload) ───────────────────────────

function getVersion(): string {
  try {
    const pkgPath = join(__dirname, "..", "..", "package.json");
    const raw = readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw);
    return pkg.version || "unknown";
  } catch {
    return "unknown";
  }
}

// ── Handler ─────────────────────────────────────────────────────────────────

export default async (_req: Request): Promise<Response> => {
  const checks: CheckResult[] = await Promise.all([
    checkApiReachable(),
    checkStationsDb(),
    checkPackageJson(),
  ]);

  const body: HealthResponse = {
    status: deriveOverallStatus(checks),
    timestamp: new Date().toISOString(),
    version: getVersion(),
    checks,
  };

  const statusCode = body.status === "error" ? 503 : body.status === "degraded" ? 200 : 200;

  return new Response(JSON.stringify(body, null, 2), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
};

// ── Netlify Config ────────────────────────────────────────────────────────────

export const config: Config = {
  path: "/api/health",
};