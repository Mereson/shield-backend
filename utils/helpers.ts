import axios from "axios"
import { CustomError } from "./services.js"
import { NEWS_API_KEY } from "../config/env.js"

export const createCustomError = (
	message: string,
	statusCode: number = 500
): CustomError => {
	const error = new Error(message) as CustomError
	error.statusCode = statusCode
	error.name = "CustomError"
	error.message = message
	return error
}

/**
 * --------------------
 * ---- FETCH NEWS ----
 * --------------------
 */

export const fetchNews = async (
	query: string,
	from: string,
	to: string,
	maxItems = 20
): Promise<
	{
		title: string
		description: string
		url: string
		source: string
		content: string
	}[]
> => {
	try {
		// GNews API key (store securely, e.g., in environment variables)
		const apiKey = NEWS_API_KEY
		if (!apiKey) {
			throw createCustomError("GNews API key is missing", 500)
		}

		// Construct the GNews API URL
		const url = "https://gnews.io/api/v4/search"
		const params = {
			q: query,
			from,
			to,
			lang: "en",
			max: Math.min(maxItems, 100), // GNews max is 100
			sortby: "publishedAt",
			token: apiKey,
		}

		// Make the API request
		const response = await axios.get(url, { params })

		// Check for API errors
		if (response.status !== 200 || !response.data.articles) {
			throw createCustomError(
				`GNews API error: ${
					response.data.errors?.join(", ") || "Unknown error"
				}`,
				response.status || 500
			)
		}

		const articles = response.data.articles || []

		// Map GNews response to the desired output format
		type GNewsArticle = {
			title?: string
			description?: string
			url?: string
			source?: { name?: string }
		}

		return articles.map((article: GNewsArticle) => ({
			title: article.title || "",
			description: article.description || "",
			url: article.url || "",
			source: article.source?.name || "",
			content: `${article.title || ""}. ${article.description || ""}`.trim(),
		}))
	} catch (err) {
		const error = err as CustomError
		error.statusCode = error.statusCode || 400 // Preserve your original status code for errors
		console.error("Error fetching news:", error.message)

		throw createCustomError("News fetch failed", error.statusCode || 500)
	}
}

/**
 * ----------------------
 * ---- FETCH TWEETS ----
 * ----------------------
 */

// export const fetchTweets = async (
// 	query: string,
// 	startDate: string,
// 	endDate: string,
// 	maxItems: number,
// 	maxChars: number
// ): Promise<string[]> => {
// 	try {
// 		const browser = await playwright.chromium.launch({ headless: true })
// 		const page = await browser.newPage()
// 		await page.goto(
// 			`https://x.com/search?q=${encodeURIComponent(
// 				query
// 			)}%20since%3A${startDate}%20until%3A${endDate}`
// 		)

// 		const tweets = await page.evaluate((limit) => {
// 			return Array.from(document.querySelectorAll("article"))
// 				.slice(0, limit)
// 				.map((el: any) => el.innerText)
// 		}, maxItems)

// 		await browser.close()

// 		// Apply char limit
// 		let totalChars = 0
// 		const output: string[] = []
// 		for (const text of tweets) {
// 			if (totalChars + text.length > maxChars) break
// 			output.push(text.trim())
// 			totalChars += text.length
// 		}

// 		return output
// 	} catch (err) {
// 		const error = err as CustomError
// 		error.statusCode = 429
// 		console.error("Error fetching tweets:", error.message)

// 		throw createCustomError(
// 			`Tweet fetch failed: ${error.message}`,
// 			error.statusCode || 500
// 		)
// 	}
// }
