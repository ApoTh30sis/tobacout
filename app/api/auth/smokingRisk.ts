// smokingRisk.ts
// Replaces the local-JSON data layer with live CDC PLACES API calls.
// The public shape (SmokingAnalysisResult / RiskTimelineResult) is unchanged
// so the frontend and API route need zero edits.

// ─── Types (unchanged public contract) ────────────────────────────────────────

export type SmokingBucketKey = "1_5" | "6_10" | "11_20" | "21_30" | "31_plus";

export interface SmokingFormInput {
  age: string;
  yearsSmoked: string;
  cigarettesPerDay: string;
  /** Two-letter US state abbreviation, e.g. "AZ". Defaults to "US" (national avg). */
  stateabbr?: string;
}

export interface ParsedSmokingInput {
  age: number;
  yearsSmoked: number;
  cigarettesPerDay: number;
  stateabbr: string;
}

export interface RiskTimelinePoint {
  yearOffset: number;
  yearsSmokedTotal: number;
  multiplier: number;
  heartDiseasePct: number;
  strokePct: number;
  lungDiseasePct: number;
}

export interface RiskTimelineResult {
  age: number;
  cigarettesPerDay: number;
  yearsSmoked: number;
  bucket: SmokingBucketKey;
  stateabbr: string;
  /** State-level baseline smoking prevalence (% of adults who smoke). */
  smokingPrevalencePct: number;
  timeline: RiskTimelinePoint[];
}

export interface SmokingAnalysisSuccess {
  success: true;
  data: RiskTimelineResult;
}

export interface SmokingAnalysisError {
  success: false;
  error: string;
}

export type SmokingAnalysisResult = SmokingAnalysisSuccess | SmokingAnalysisError;

// ─── CDC PLACES API ───────────────────────────────────────────────────────────

const CDC_BASE = "https://data.cdc.gov/resource/cwsq-ngmh.json";

interface CDCRow {
  data_value?: string | number;
  measureid?: string;
  stateabbr?: string;
}

/**
 * Fetches crude prevalence (%) for a single measureid + state from the CDC
 * PLACES census-tract dataset and returns the mean across all tracts.
 * Returns null if the request fails or no rows are returned.
 */
async function fetchStatePrevalence(
  measureid: "CSMOKING" | "CHD" | "COPD",
  stateabbr: string
): Promise<number | null> {
  // Pull up to 5 000 tracts — enough for any state; mean is robust to count.
  const url =
    `${CDC_BASE}?measureid=${measureid}&stateabbr=${stateabbr.toUpperCase()}` +
    `&$where=data_value_type=%27Crude%20prevalence%27&$limit=5000` +
    `&$select=data_value`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } }); // cache 24 h
    if (!res.ok) return null;

    const rows: CDCRow[] = await res.json();
    const values = rows
      .map((r) => parseFloat(String(r.data_value ?? "")))
      .filter((v) => Number.isFinite(v) && v > 0);

    if (values.length === 0) return null;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.round(mean * 10) / 10; // one decimal place
  } catch {
    return null;
  }
}

// ─── Bucket helpers (unchanged) ───────────────────────────────────────────────

export function getSmokingBucket(cigarettesPerDay: number): SmokingBucketKey | null {
  if (!Number.isFinite(cigarettesPerDay) || cigarettesPerDay <= 0) return null;
  if (cigarettesPerDay <= 5)  return "1_5";
  if (cigarettesPerDay <= 10) return "6_10";
  if (cigarettesPerDay <= 20) return "11_20";
  if (cigarettesPerDay <= 30) return "21_30";
  return "31_plus";
}

/**
 * Intensity multiplier: how much riskier is this user's smoking level
 * compared to the average smoker in the dataset?
 * Average smoker ≈ 14 cigs/day (midpoint of the most common bucket).
 */
function intensityMultiplier(cigarettesPerDay: number): number {
  const REFERENCE_CPD = 14;
  // Risk scales roughly with the square root of dose (diminishing returns at high doses)
  return Math.sqrt(cigarettesPerDay / REFERENCE_CPD);
}

// ─── Risk projection ──────────────────────────────────────────────────────────

/**
 * Annual risk growth rates by condition (percentage-point increase per year of
 * continued smoking, applied on top of the state baseline).
 *
 * Derived from published relative-risk literature:
 *   - CHD:   ~2–4 % relative increase per pack-year → ~0.3 pp/yr absolute
 *   - Stroke: tracks CHD at roughly 0.6× the rate
 *   - COPD:  accelerates faster at longer durations → 0.45 pp/yr
 */
const ANNUAL_GROWTH = {
  heart: 0.30,  // percentage-points per additional year of smoking
  stroke: 0.18,
  lung: 0.45,
} as const;

/**
 * The CDC CHD/COPD figures are population-wide (smokers + non-smokers).
 * To estimate risk among the *average* smoker we divide by the smoking fraction
 * and multiply by the attributable fraction.
 *
 * This gives us the baseline for a pack-a-day, long-term smoker.
 * We then scale DOWN from this baseline using intensityMultiplier and
 * durationFactor in buildTimeline so lighter / newer smokers get lower numbers.
 */
function smokerSpecificRisk(
  populationRisk: number,
  smokingPrevalencePct: number,
  attributableFraction: number // e.g. 0.85 for COPD, 0.40 for CHD
): number {
  const smokingFraction = Math.max(smokingPrevalencePct / 100, 0.05);
  const smokerRisk = (populationRisk * attributableFraction) / smokingFraction;
  // Cap at a realistic maximum for a heavy long-term smoker, not 95
  return Math.min(Math.round(smokerRisk * 10) / 10, 40);
}

// ─── Timeline builder ─────────────────────────────────────────────────────────

const DEFAULT_YEAR_OFFSETS = [0, 10, 20, 30];

function buildTimeline(
  input: ParsedSmokingInput,
  baseHeartPct: number,   // baseline for an average smoker (~14 cigs/day, ~10 yrs)
  baseStrokePct: number,
  baseLungPct: number,
  yearOffsets: number[] = DEFAULT_YEAR_OFFSETS
): RiskTimelinePoint[] {
  const iMult = intensityMultiplier(input.cigarettesPerDay);

  return yearOffsets.map((yearOffset) => {
    const yearsSmokedTotal = input.yearsSmoked + yearOffset;

    // durationFactor: how far along relative to the "average" smoker in the dataset
    // (~10 pack-years). Capped at 1.5 so even 40-year smokers don't multiply by 2.5.
    // Starts below 1.0 for short durations (correctly reducing baseline risk).
    const durationFactor = Math.min(yearsSmokedTotal / 10, 1.5);

    // Scale the CDC baseline by both intensity and duration
    const scaledHeart  = baseHeartPct  * iMult * durationFactor;
    const scaledStroke = baseStrokePct * iMult * durationFactor;
    const scaledLung   = baseLungPct   * iMult * durationFactor;

    // Additional risk from future years of continued smoking
    const extraHeart  = ANNUAL_GROWTH.heart  * yearOffset * iMult;
    const extraStroke = ANNUAL_GROWTH.stroke * yearOffset * iMult;
    const extraLung   = ANNUAL_GROWTH.lung   * yearOffset * iMult;

    const heartDiseasePct = Math.min(
      Math.round((scaledHeart + extraHeart) * 10) / 10,
      75
    );
    const strokePct = Math.min(
      Math.round((scaledStroke + extraStroke) * 10) / 10,
      50
    );
    const lungDiseasePct = Math.min(
      Math.round((scaledLung + extraLung) * 10) / 10,
      80
    );

    // Aggregate multiplier vs baseline (for display)
    const multiplier =
      Math.round(
        ((heartDiseasePct + strokePct + lungDiseasePct) /
          (baseHeartPct + baseStrokePct + baseLungPct)) *
          10
      ) / 10;

    return {
      yearOffset,
      yearsSmokedTotal,
      multiplier,
      heartDiseasePct,
      strokePct,
      lungDiseasePct,
    };
  });
}

// ─── Input parsing (unchanged) ────────────────────────────────────────────────

function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function parseSmokingFormInput(
  input: SmokingFormInput
): ParsedSmokingInput | null {
  const age = parsePositiveNumber(input.age);
  const yearsSmoked = parsePositiveNumber(input.yearsSmoked);
  const cigarettesPerDay = parsePositiveNumber(input.cigarettesPerDay);

  if (age === null || yearsSmoked === null || cigarettesPerDay === null) return null;
  if (cigarettesPerDay <= 0) return null;
  if (yearsSmoked > age) return null;

  return {
    age,
    yearsSmoked,
    cigarettesPerDay,
    stateabbr: (input.stateabbr ?? "US").toUpperCase(),
  };
}

// ─── Main exported function ───────────────────────────────────────────────────

/**
 * Fetches live CDC PLACES data for the user's state, then builds a 30-year
 * risk timeline personalised to their smoking intensity and duration.
 *
 * Falls back to national averages if CDC calls fail.
 */
export async function analyzeSmokingRisk(
  input: SmokingFormInput
): Promise<SmokingAnalysisResult> {
  const parsed = parseSmokingFormInput(input);
  if (!parsed) {
    return { success: false, error: "Invalid smoking input." };
  }

  const bucket = getSmokingBucket(parsed.cigarettesPerDay);
  if (!bucket) {
    return { success: false, error: "Could not determine smoking bucket." };
  }

  // ── Fetch CDC data (parallel) ──────────────────────────────────────────────
  const stateabbr = parsed.stateabbr;

  const [smokingPct, chdPct, copdPct] = await Promise.all([
    fetchStatePrevalence("CSMOKING", stateabbr),
    fetchStatePrevalence("CHD",      stateabbr),
    fetchStatePrevalence("COPD",     stateabbr),
  ]);

  // National fallback values (2023 BRFSS / PLACES national estimates)
  const NATIONAL_SMOKING = 14.0; // % of adults who smoke
  const NATIONAL_CHD     = 6.2;  // % crude prevalence, all adults
  const NATIONAL_COPD    = 6.5;  // % crude prevalence, all adults

  const resolvedSmoking = smokingPct ?? NATIONAL_SMOKING;
  const resolvedCHD     = chdPct    ?? NATIONAL_CHD;
  const resolvedCOPD    = copdPct   ?? NATIONAL_COPD;

  // ── Convert population rates → smoker-specific baselines ──────────────────
  // CHD: ~40% of cases attributable to smoking
  // COPD: ~85% of cases attributable to smoking
  // Stroke: not in PLACES; estimated at 0.6× the CHD smoker-specific rate
  const baseHeartPct  = smokerSpecificRisk(resolvedCHD,  resolvedSmoking, 0.40);
  const baseLungPct   = smokerSpecificRisk(resolvedCOPD, resolvedSmoking, 0.85);
  const baseStrokePct = Math.round(baseHeartPct * 0.6 * 10) / 10;

  // ── Build timeline ─────────────────────────────────────────────────────────
  const timeline = buildTimeline(parsed, baseHeartPct, baseStrokePct, baseLungPct);

  return {
    success: true,
    data: {
      age: parsed.age,
      cigarettesPerDay: parsed.cigarettesPerDay,
      yearsSmoked: parsed.yearsSmoked,
      bucket,
      stateabbr,
      smokingPrevalencePct: resolvedSmoking,
      timeline,
    },
  };
}