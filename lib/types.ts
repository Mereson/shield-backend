// export type SentimentType =
// 	| "summary"
// 	| "distribution"
// 	| "time_series"
// 	| "categorization"

// export type SummaryData = string

// export type DistributionData = {
// 	sentiment: "Neutral" | "Positive" | "Negative"
// 	value: number
// }[]

// export type TimeSeriesData = {
// 	time: string // e.g., "2024-07-29"
// 	Neutral: number
// 	Positive: number
// 	Negative: number
// }[]

// export type CategorizationData = {
// 	category: string
// 	Neutral: number
// 	Positive: number
// 	Negative: number
// }[]

// export type SentimentOutput =
// 	| { type: "summary"; data: SummaryData }
// 	| { type: "distribution"; data: DistributionData }
// 	| { type: "time_series"; data: TimeSeriesData }
// 	| { type: "categorization"; data: CategorizationData }

export interface Result {
	title?: string | null
	url: string
	snippet?: string | null
}

export type Article = Result

export interface GeneratedArticles {
	relevantArticles: Article[]
	allArticles: Article[]
	expandedQueries?: string[]
}

export type Sentiment = "Positive" | "Neutral" | "Negative"

export type PerArticleAnalysis = {
	url: string
	title: string | null
	sourcePublishedDate?: string | null // from Exa if available
	eventDateISO: string // extracted from content (fallback to sourcePublishedDate)
	locationMatch: boolean // is it about the target location?
	categories: string[] // e.g., ["Robbery", "Kidnapping"]
	sentiment: Sentiment // Positive | Neutral | Negative (re: crime situation)
	confidence: number // 0..1
	summary: string // 1–2 lines, factual
	eventKey: string // stable key to dedupe cross-outlet duplicates
}

export type CrimeAnalysisReport = {
	reportText: string
	perArticle?: PerArticleAnalysis[]
	metrics: (
		| { type: "summary"; data: string }
		| { type: "distribution"; data: { sentiment: Sentiment; value: number }[] }
		| {
				type: "time_series"
				data: {
					time: string
					Neutral: number
					Positive: number
					Negative: number
				}[]
		  }
		| {
				type: "categorization"
				data: {
					category: string
					Neutral: number
					Positive: number
					Negative: number
				}[]
		  }
	)[]
}
