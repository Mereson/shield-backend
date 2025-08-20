import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import "dotenv/config";
import { sentimentOutputSchema } from "../lib/schemas.js";
export const generateSentimentData = async (reportData) => {
    const sentimentData = await generateReport(reportData);
    console.log("Sentiment analysis completed!");
    return sentimentData;
};
const generateReport = async (reportData) => {
    const result = await generateObject({
        model: google("gemini-2.5-flash"),
        system: "You are a professional JSON-generating AI for crime sentiment analysis.",
        prompt: `
You are an expert AI analyst. From the following crime report, generate a JSON array with exactly 4 objects, using this structure:

[
  {
    "type": "summary",
    "data": "A summarized overview of the overall sentiment and trends in the report."
  },
  {
    "type": "distribution",
    "data": [
      { "sentiment": "Neutral", "value": X },
      { "sentiment": "Positive", "value": Y },
      { "sentiment": "Negative", "value": Z }
    ]
  },
  {
    "type": "time_series",
    "data": [
      { "time": "2024-07-29", "Neutral": X, "Positive": Y, "Negative": Z },
      ...
    ]
  },
  {
    "type": "categorization",
    "data": [
      { "category": "Robbery", "Neutral": X, "Positive": Y, "Negative": Z },
      ...
    ]
  }
]

Only return the JSON array. Do not include any other explanation or text.

Report:
"""
${reportData}
"""
    `,
        schema: sentimentOutputSchema,
    });
    return result.object;
};
//# sourceMappingURL=sentiment-analyser.js.map