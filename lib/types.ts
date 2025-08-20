export type SentimentType = "summary" | "distribution" | "time_series" | "categorization";

export type SummaryData = string;

export type DistributionData = {
  sentiment: "Neutral" | "Positive" | "Negative";
  value: number;
}[];

export type TimeSeriesData = {
  time: string; // e.g., "2024-07-29"
  Neutral: number;
  Positive: number;
  Negative: number;
}[];

export type CategorizationData = {
  category: string;
  Neutral: number;
  Positive: number;
  Negative: number;
}[];

export type SentimentOutput =
  | { type: "summary"; data: SummaryData }
  | { type: "distribution"; data: DistributionData }
  | { type: "time_series"; data: TimeSeriesData }
  | { type: "categorization"; data: CategorizationData };