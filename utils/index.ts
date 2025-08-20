export * from "./helpers.js"
export * from "./services.js"


// export const fetchNews = async (
// 	query: string,
// 	startDate: string,
// 	endDate: string,
// 	maxItems: number,
// 	maxChars: number
// ): Promise<
// 	{
// 		title: string
// 		description: string
// 		url: string
// 		source: string
// 		content: string
// 	}[]
// > => {
// 	try {
// 		const apiKey = NEWS_API_KEY
// 		if (!apiKey) {
// 			throw new Error("NEWS_API_KEY environment variable is required")
// 		}

// 		const params = {
// 			q: query,
// 			from: startDate,
// 			to: endDate,
// 			sortBy: "publishedAt",
// 			pageSize: Math.min(maxItems, 100),
// 			apiKey: apiKey,
// 			language: "en",
// 		}

// 		const response = await axios.get("https://newsapi.org/v2/everything", {
// 			params,
// 		})
// 		console.log(response)
// 		const articles = response.data.articles

// 		console.log(articles)

// 		const news = []
// 		let totalChars = 0

// 		for (const article of articles) {
// 			const title = cleanText(article.title)
// 			const description = cleanText(article.description || "")
// 			const content = `${title}. ${description}`.trim()

// 			if (content.length < 10) continue
// 			if (totalChars + content.length > maxChars) break

// 			news.push({
// 				title: title,
// 				description: description,
// 				url: article.url,
// 				publishedAt: article.publishedAt,
// 				source: article.source.name,
// 				content: content,
// 			})

// 			totalChars += content.length
// 			if (news.length >= maxItems) break
// 		}

// 		return news
// 	} catch (err) {
// 		const error = err as CustomError
// 		console.error("Error fetching News:", error.message)
// 		throw createCustomError(
// 			`News fetch failed: ${error.message}`,
// 			error.statusCode || 500
// 		)
// 	}
// }