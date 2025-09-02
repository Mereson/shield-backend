import { createCustomError } from "../utils/helpers.js";
import z from "zod";
import { aiToolKit } from "../utils/aiSdk.js";
// import { generateSentimentData } from "../utils/sentiment-analyser.js"
const SentimentRequestSchema = z.object({
    location: z.string(),
});
export const getSentiment = async (req, res, next) => {
    try {
        const parseResult = SentimentRequestSchema.safeParse(req.body);
        if (!parseResult.success) {
            const error = createCustomError("Invalid request data", 400);
            throw error;
        }
        const { location } = parseResult.data;
        const prompt = `Use the searchTool to get recent news articles about crime on ${location}.`;
        const aiResponse = await aiToolKit(prompt, location);
        res.status(200).json({
            success: true,
            message: "Data gathered and preprocessed successfully.",
            data: {
                result: aiResponse,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=prompt.controller.js.map