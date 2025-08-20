import { z } from "zod";
const distributionSchema = z.array(z.object({
    sentiment: z.enum(["Neutral", "Positive", "Negative"]),
    value: z.number(),
}));
const timeSeriesSchema = z.array(z.object({
    time: z.string(), // You can refine to ISO8601 with z.string().datetime() if needed
    Neutral: z.number(),
    Positive: z.number(),
    Negative: z.number(),
}));
const categorizationSchema = z.array(z.object({
    category: z.string(),
    Neutral: z.number(),
    Positive: z.number(),
    Negative: z.number(),
}));
export const sentimentOutputSchema = z.array(z.discriminatedUnion("type", [
    z.object({
        type: z.literal("summary"),
        data: z.string(),
    }),
    z.object({
        type: z.literal("distribution"),
        data: distributionSchema,
    }),
    z.object({
        type: z.literal("time_series"),
        data: timeSeriesSchema,
    }),
    z.object({
        type: z.literal("categorization"),
        data: categorizationSchema,
    }),
]));
//# sourceMappingURL=schemas.js.map