import { NextFunction, Request, Response } from "express"
import { createCustomError, fetchNews } from "../utils/helpers.js"
import z from "zod"
import { aiToolKit } from "../utils/aiSdk.js"
import { generateSentimentData } from "../utils/sentiment-analyser.js"

const SentimentRequestSchema = z.object({
	location: z.object({
		longitude: z.string(),
		latitude: z.string(),
		name: z.string(),
	}),
	previousDate: z.string().optional(),
	currentDate: z.string().optional(),
})

export const getSentiment = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		const parseResult = SentimentRequestSchema.safeParse(req.body)

		if (!parseResult.success) {
			const error = createCustomError("Invalid request data", 400)
			throw error
		}

		const { location, previousDate, currentDate } = parseResult.data
		const { name } = location

		// Define the date range (e.g., for use in AI prompt context)

		const formatLocationForNews = (location: string): string => {
			const parts = location.split(",").map((part) => part.trim())

			// Remove the most specific part (e.g., "London")
			const broaderParts = parts.slice(1)

			return broaderParts.join(" OR ")
		}

		const searchLocation = formatLocationForNews(location.name)



		const fetchedNews = await fetchNews(
			`(${searchLocation})`,
			previousDate as string,
			currentDate as string,
			25
		)

		
		console.log(fetchedNews)

		const prompt = (): string => {
			if (fetchedNews.length > 0) {
				const articleReferences = fetchedNews
					.map(
						(article) =>
							`- **${article.title}** ([${article.url}](@${article.url}))`
					)
					.join("\n")
				return (
					`Sentiment and Urgency Analysis of Crime-Related Posts in ${searchLocation}, ` +
					`Analyze the sentiment and urgency of the following crime-related posts in ${searchLocation} using the posts below as a reference. Provide the overall sentiment.` +
					`Referenced Posts\n${articleReferences}`
				)
			} else {
				return (
					`Sentiment and Urgency Analysis of Crime-Related Posts in ${searchLocation}` +
					`Analyze the sentiment and urgency of crime-related posts in ${searchLocation} over the period of 3 to 6 months leading to ${currentDate}. Provide the overall sentiment.`
				)
			}
		}

		const aiResponse = await aiToolKit(prompt())
		const data = await generateSentimentData(aiResponse)

		res.status(200).json({
			success: true,
			message: "Data gathered and preprocessed successfully.",
			data: {
				location: name,
				result: data, 
			},
		})
	} catch (error) {
		next(error)
	}
}

