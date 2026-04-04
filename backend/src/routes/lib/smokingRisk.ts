import smokingRiskData from "../../data/smokingRiskData.json"; //Pulls data from JSON

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

export interface SmokingFormInput { //Raw input from frontend
  age: string;
  yearsSmoked: string;
  cigarettesPerDay: string;
}

export interface ParsedSmokingInput { //Validated and parsed data to be used by backend
  age: number;
  yearsSmoked: number;
  cigarettesPerDay: number;
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

  if (age === null || yearsSmoked === null || cigarettesPerDay === null) {
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
  };
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
        heartDiseasePct: matchedEntry.heartDiseasePct,
        strokePct: matchedEntry.strokePct,
        lungDiseasePct: matchedEntry.lungDiseasePct,
      };
    })
    .filter((entry): entry is RiskTimelinePoint => entry !== null);

  return {
    age: input.age,
    cigarettesPerDay: input.cigarettesPerDay,
    yearsSmoked: input.yearsSmoked,
    bucket,
    timeline,
  };
}

export function analyzeSmokingRisk(input: SmokingFormInput): SmokingAnalysisResult { //Main function to calculate everything
  const parsedInput = parseSmokingFormInput(input);

  if (!parsedInput) {
    return {
      success: false,
      error: "Invalid smoking input.",
    };
  }

  const timelineResult = buildRiskTimeline(parsedInput);

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
}
