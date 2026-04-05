import smokingRiskData from "./smokingRiskData.json"; //Pulls data from JSON

export type SmokingBucketKey = "1_5" | "6_10" | "11_20" | "21_30" | "31_plus"; //Creates a key for buckets

export interface BaseStats { //Describes format for base stats
  totalPeople: number;
  withYearsEstimate: number;
  totalYears: number;
  avgYearsSmoked: number;
  heartDiseaseYes: number;
  heartDiseaseAnswered: number;
  strokeYes: number;
  strokeAnswered: number;
  lungDiseaseYes: number;
  lungDiseaseAnswered: number;
  heartDiseasePct: number;
  strokePct: number;
  lungDiseasePct: number;
}

export interface TimelineEntry { //Describes format for timeline entries
  yearsSmoked: number;
  multiplier: number;
  heartDiseasePct: number;
  strokePct: number;
  lungDiseasePct: number;
}


export interface SmokingBucketData { //Describes format for bucket data
  baseStats: BaseStats;
  timeline: TimelineEntry[];
}

export interface SmokingAnalysisSuccess { //Describes format for successful response
  success: true;
  data: RiskTimelineResult;
}

export interface SmokingAnalysisError { //Describes format for error response
  success: false;
  error: string;
}

export type SmokingAnalysisResult = SmokingAnalysisSuccess | SmokingAnalysisError;

export type SmokingRiskDataset = Record<SmokingBucketKey, SmokingBucketData>;

const dataset: SmokingRiskDataset = smokingRiskData as SmokingRiskDataset; //Usable dataset typed out 

const DEFAULT_YEAR_OFFSETS = [0, 10, 20, 30]; //Default timeline points 
const HEART_DISEASE_SMOKING_MULTIPLIER = 2.0;
const STROKE_SMOKING_MULTIPLIER = 2.0;
const COPD_SMOKING_MULTIPLIER = 12.0;
const SMOKING_RATE = 0.354;
const NON_SMOKING_RATE = 1 - SMOKING_RATE;
const AVG_YEARS_SMOKED = 21;
const AVG_CIGS_PER_DAY = 15.8;
const AVG_PACK_YEARS = (AVG_CIGS_PER_DAY / 20) * AVG_YEARS_SMOKED;
const CDC_PLACES_URL = "https://data.cdc.gov/resource/cwsq-ngmh.json";

interface CdcPlacesChdRecord {
  data_value?: string;
}

export function getSmokingBucket(cigarettesPerDay: number): SmokingBucketKey | null { //Filters data into buckets 
  if (!Number.isFinite(cigarettesPerDay) || cigarettesPerDay <= 0) {
    return null;
  }

  if (cigarettesPerDay >= 1 && cigarettesPerDay <= 5) {
    return "1_5";
  }

  if (cigarettesPerDay >= 6 && cigarettesPerDay <= 10) {
    return "6_10";
  }

  if (cigarettesPerDay >= 11 && cigarettesPerDay <= 20) {
    return "11_20";
  }

  if (cigarettesPerDay >= 21 && cigarettesPerDay <= 30) {
    return "21_30";
  }

  return "31_plus";
}

export function getBucketData(bucket: SmokingBucketKey): SmokingBucketData { //Helper so code doesn't direcltly touch dataset 
  return dataset[bucket];
}

function roundToSingleDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function getSmokerSpecificChdRate(generalPopulationChdRate: number): number {
  const nonSmokerChdRate =
    generalPopulationChdRate /
    ((SMOKING_RATE * HEART_DISEASE_SMOKING_MULTIPLIER) + NON_SMOKING_RATE);

  return nonSmokerChdRate * HEART_DISEASE_SMOKING_MULTIPLIER;
}

function getSmokerSpecificStrokeRate(generalPopulationStrokeRate: number): number {
  const nonSmokerStrokeRate =
    generalPopulationStrokeRate /
    ((SMOKING_RATE * STROKE_SMOKING_MULTIPLIER) + NON_SMOKING_RATE);

  return nonSmokerStrokeRate * STROKE_SMOKING_MULTIPLIER;
}

function getSmokerSpecificCopdRate(
  generalPopulationCopdRate: number,
  smokingRate: number
): number {
  const nonSmokerCopdRate =
    generalPopulationCopdRate /
    ((smokingRate * COPD_SMOKING_MULTIPLIER) + (1 - smokingRate));

  return nonSmokerCopdRate * COPD_SMOKING_MULTIPLIER;
}

function projectHeartDiseaseRisk(
  cigarettesPerDay: number,
  yearsSmoking: number,
  futureYears: number,
  generalPopulationChdRate: number
): number {
  const futurePackYears = (cigarettesPerDay / 20) * (yearsSmoking + futureYears);
  const futureRatio = Math.min(futurePackYears / AVG_PACK_YEARS, 1);
  const smokerChdRate = getSmokerSpecificChdRate(generalPopulationChdRate);

  return roundToSingleDecimal(smokerChdRate * futureRatio);
}

function projectStrokeRisk(
  cigarettesPerDay: number,
  yearsSmoking: number,
  futureYears: number,
  generalPopulationStrokeRate: number
): number {
  const futurePackYears = (cigarettesPerDay / 20) * (yearsSmoking + futureYears);
  const futureRatio = Math.min(futurePackYears / AVG_PACK_YEARS, 1);
  const smokerStrokeRate = getSmokerSpecificStrokeRate(generalPopulationStrokeRate);

  return roundToSingleDecimal(smokerStrokeRate * futureRatio);
}

function projectCopdRisk(
  cigarettesPerDay: number,
  yearsSmoking: number,
  futureYears: number,
  generalPopulationCopdRate: number,
  smokingRate: number
): number {
  const futurePackYears = (cigarettesPerDay / 20) * (yearsSmoking + futureYears);
  const futureRatio = Math.min(futurePackYears / AVG_PACK_YEARS, 1);
  const smokerCopdRate = getSmokerSpecificCopdRate(generalPopulationCopdRate, smokingRate);

  return roundToSingleDecimal(smokerCopdRate * futureRatio);
}

export interface SmokingFormInput { //Raw input from frontend
  age: string;
  yearsSmoked: string;
  cigarettesPerDay: string;
  state: string;
}

export interface ParsedSmokingInput { //Validated and parsed data to be used by backend
  age: number;
  yearsSmoked: number;
  cigarettesPerDay: number;
  state: string;
}

export interface RiskTimelinePoint { //Results for timeline on one point
  yearOffset: number;
  yearsSmokedTotal: number;
  multiplier: number;
  heartDiseasePct: number;
  strokePct: number;
  lungDiseasePct: number;
}

export interface RiskTimelineResult { //Full response shape for backend 
  age: number;
  cigarettesPerDay: number;
  yearsSmoked: number;
  state: string;
  bucket: SmokingBucketKey;
  timeline: RiskTimelinePoint[];
}

function parsePositiveNumber(value: string): number | null { //Converts string to number and check if it is valid
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

export function parseSmokingFormInput(input: SmokingFormInput): ParsedSmokingInput | null { //Turns raw frontend input into clean data for backend
  const age = parsePositiveNumber(input.age);
  const yearsSmoked = parsePositiveNumber(input.yearsSmoked);
  const cigarettesPerDay = parsePositiveNumber(input.cigarettesPerDay);
  const state = input.state.trim().toUpperCase();

  if (age === null || yearsSmoked === null || cigarettesPerDay === null || !state) {
    return null;
  }

  if (cigarettesPerDay <= 0) {
    return null;
  }

  if (yearsSmoked > age) {
    return null;
  }

  return {
    age,
    yearsSmoked,
    cigarettesPerDay,
    state,
  };
}

async function fetchStateMeasureAverage(state: string, measureId: string): Promise<number> {
  const url = new URL(CDC_PLACES_URL);
  url.searchParams.set("measureid", measureId);
  url.searchParams.set("stateabbr", state);
  url.searchParams.set("$limit", "500");

  const response = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`CDC PLACES request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as CdcPlacesChdRecord[];
  const values = data
    .map((record) => Number.parseFloat(record.data_value ?? ""))
    .filter((value) => Number.isFinite(value));

  if (values.length === 0) {
    throw new Error(`No ${measureId} data returned for state ${state}.`);
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

export function getClosestTimelineEntry( //Finds timeline based on user input
  timeline: TimelineEntry[],
  yearsSmoked: number
): TimelineEntry | null {
  if (timeline.length === 0) {
    return null;
  }

  let closestEntry = timeline[0]!;
  let smallestDifference = Math.abs(closestEntry.yearsSmoked - yearsSmoked);

  for (const entry of timeline) {
    const difference = Math.abs(entry.yearsSmoked - yearsSmoked);

    if (difference < smallestDifference) {
      closestEntry = entry;
      smallestDifference = difference;
    }
  }

  return closestEntry;
}


export function getRiskEntry( //Calculate user's dataset match
  cigarettesPerDay: number,
  yearsSmoked: number
): {
  bucket: SmokingBucketKey;
  entry: TimelineEntry;
  baseStats: BaseStats;
} | null {
  const bucket = getSmokingBucket(cigarettesPerDay);

  if (!bucket) {
    return null;
  }

  const bucketData = getBucketData(bucket);
  const entry = getClosestTimelineEntry(bucketData.timeline, yearsSmoked);

  if (!entry) {
    return null;
  }

  return {
    bucket,
    entry,
    baseStats: bucketData.baseStats,
  };
}

export function buildRiskTimeline( //Builds full time result for frontend to display
  input: ParsedSmokingInput,
  generalPopulationChdRate: number,
  generalPopulationStrokeRate: number,
  generalPopulationSmokingRate: number,
  generalPopulationCopdRate: number,
  yearOffsets: number[] = DEFAULT_YEAR_OFFSETS
): RiskTimelineResult | null {
  const bucket = getSmokingBucket(input.cigarettesPerDay);

  if (!bucket) {
    return null;
  }

  const bucketData = getBucketData(bucket);

  const timeline: RiskTimelinePoint[] = yearOffsets
    .map((yearOffset) => {
      const yearsSmokedTotal = input.yearsSmoked + yearOffset;
      const matchedEntry = getClosestTimelineEntry(bucketData.timeline, yearsSmokedTotal);

      if (!matchedEntry) {
        return null;
      }

      return {
        yearOffset,
        yearsSmokedTotal,
        multiplier: matchedEntry.multiplier,
        heartDiseasePct: projectHeartDiseaseRisk(
          input.cigarettesPerDay,
          input.yearsSmoked,
          yearOffset,
          generalPopulationChdRate
        ),
        strokePct: projectStrokeRisk(
          input.cigarettesPerDay,
          input.yearsSmoked,
          yearOffset,
          generalPopulationStrokeRate
        ),
        lungDiseasePct: projectCopdRisk(
          input.cigarettesPerDay,
          input.yearsSmoked,
          yearOffset,
          generalPopulationCopdRate,
          generalPopulationSmokingRate / 100
        ),
      };
    })
    .filter((entry): entry is RiskTimelinePoint => entry !== null);

  return {
    age: input.age,
    cigarettesPerDay: input.cigarettesPerDay,
    yearsSmoked: input.yearsSmoked,
    state: input.state,
    bucket,
    timeline,
  };
}

export async function analyzeSmokingRisk(input: SmokingFormInput): Promise<SmokingAnalysisResult> { //Main function to calculate everything
  const parsedInput = parseSmokingFormInput(input);

  if (!parsedInput) {
    return {
      success: false,
      error: "Invalid smoking input.",
    };
  }

  try {
    const [
      generalPopulationChdRate,
      generalPopulationStrokeRate,
      generalPopulationSmokingRate,
      generalPopulationCopdRate,
    ] = await Promise.all([
      fetchStateMeasureAverage(parsedInput.state, "CHD"),
      fetchStateMeasureAverage(parsedInput.state, "STROKE"),
      fetchStateMeasureAverage(parsedInput.state, "CSMOKING"),
      fetchStateMeasureAverage(parsedInput.state, "COPD"),
    ]);
    const timelineResult = buildRiskTimeline(
      parsedInput,
      generalPopulationChdRate,
      generalPopulationStrokeRate,
      generalPopulationSmokingRate,
      generalPopulationCopdRate
    );

    if (!timelineResult) {
      return {
        success: false,
        error: "Could not build smoking risk timeline.",
      };
    }

    return {
      success: true,
      data: timelineResult,
    };
  } catch (error) {
    console.error("analyzeSmokingRisk error:", error);

    return {
      success: false,
      error: "Could not fetch CDC heart disease, stroke, smoking, or COPD data for the selected state.",
    };
  }
}
