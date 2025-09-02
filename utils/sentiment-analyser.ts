import { generateText, generateObject } from "ai"
import z from "zod"
import { Exa } from "exa-js"
import { EXA_API_KEY } from "../config/env.js"
import { google } from "@ai-sdk/google"
import {
	Article,
	CrimeAnalysisReport,
	PerArticleAnalysis,
	Sentiment,
} from "../lib/types.js"

const exa = new Exa(EXA_API_KEY)
const mainModel = google("gemini-2.0-flash")

/**
 * -------------------------------------------------------------------------
 * -------------------------------------------------------------------------
 * ------------------------------- Utilities -------------------------------
 * -------------------------------------------------------------------------
 * -------------------------------------------------------------------------
 */

// ---------- Per-article analysis schema ----------
const perArticleSchema = z.object({
	eventDateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
	locationMatch: z.boolean(),
	categories: z.array(z.string()).min(1).max(5),
	sentiment: z.enum(["Positive", "Neutral", "Negative"]),
	confidence: z.number().min(0).max(1),
	summary: z.string().min(10).max(500),
	eventKey: z.string().min(6).max(160),
})

const batchAnalysisSchema = z.array(perArticleSchema)

/**
 * ---------------
 * ---- SLEEP ----
 * ---------------
 * @param ms
 * @returns Promise<void>
 */
const sleep = (ms: number): Promise<void> =>
	new Promise((res) => setTimeout(res, ms))

const chunk = <T>(arr: T[], size: number): T[][] => {
	const out: T[][] = []
	for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
	return out
}

/**
 * ------------------------
 * ---- NORMALIZE TEXT ----
 * ------------------------
 * @param s
 * @returns string
 */

const normalizeTitle = (s: string | null | undefined): string => {
	return (s ?? "")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.replace(/\s+/g, " ")
		.trim()
}

/**
 * ---------------------
 * ---- TO ISO DATE ----
 * ---------------------
 * @param d
 * @returns string | null
 */
const toISODate = (d?: string | null): string | null => {
	if (!d) return null
	const dt = new Date(d)
	return isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10)
}

/**
 * -----------------------------------------
 * ---- Fetch article contents with Exa ----
 * -----------------------------------------
 * @description Uses Exa "Get contents" endpoint with text extraction.
 * Docs show body { urls: [...], text: true } returning `text` and `publishedDate`.
 * @param urls
 * @returns ArticleContent
 */

interface ArticleContent {
	url: string
	title?: string | null
	text?: string | null
	publishedDate?: string | null
}

export const fetchArticleContentsWithExa = async (
	urls: string[]
): Promise<ArticleContent[]> => {
	const MAX_BATCH = 20 // Keep payloads small and friendly for rate limits
	const batches = chunk(urls, MAX_BATCH)
	const results: ArticleContent[] = []

	for (const batch of batches) {
		const resp = await exa.getContents(batch.map((u) => u))

		for (const r of resp.results ?? []) {
			results.push({
				url: r.url,
				title: r.title ?? null,
				text: r.text ?? null,
				publishedDate: r.publishedDate ?? null,
			})
		}

		// Gentle pacing against vendor rate limits
		await sleep(100)
	}

	return results
}

/**
 * --------------------------------
 * ---- ANALYSE BATCH ARTICLES ----
 * --------------------------------
 * @description Analyse articles in batches
 * @param article
 * @param content
 * @param location
 * @returns Promise<PerArticleAnalysis[]>
 */

const analyseArticlesBatch = async (
	articles: { url: string; title?: string | null; snippet?: string | null }[],
	contentsByUrl: Map<
		string,
		{ text?: string | null; publishedDate?: string | null }
	>,
	location: string
): Promise<PerArticleAnalysis[]> => {
	const analyses: PerArticleAnalysis[] = []

	// Step 1: prepare the batch (skip tiny/no-text ones)
	type ArticleInput = {
		url: string
		title?: string | null
		snippet?: string | null
	}
	type ContentValue =
		| { text?: string | null; publishedDate?: string | null }
		| undefined
	const toSend: {
		article: ArticleInput
		content: ContentValue
		text: string
	}[] = []
	for (const article of articles) {
		const content = contentsByUrl.get(article.url)
		const text = content?.text ?? article.snippet ?? ""
		if (!text || text.trim().length < 100) {
			// fallback minimal
			const pub =
				toISODate(content?.publishedDate) ??
				new Date().toISOString().slice(0, 10)
			analyses.push({
				url: article.url,
				title: article.title ?? null,
				sourcePublishedDate: toISODate(content?.publishedDate),
				eventDateISO: pub,
				locationMatch: true,
				categories: ["Unspecified"],
				sentiment: "Neutral",
				confidence: 0.3,
				summary:
					"Insufficient content extracted; counted as neutral placeholder.",
				eventKey: `${normalizeTitle(article.title)}|${pub}`,
			})
		} else {
			toSend.push({ article, content, text })
		}
	}

	if (toSend.length === 0) return analyses

	// Step 2: send to Gemini in one call (multi-article prompt)
	const { object } = await generateObject({
		model: mainModel,
		schema: batchAnalysisSchema,
		prompt: `
You are a careful fact extractor. Read the news article content below and return a strict JSON object that describes the *primary* crime event being reported, from the perspective of the location "${location}".

Rules:
- "eventDateISO": the date the crime *occurred* (not publish date). If unclear, pick the most likely *latest* event date mentioned. If none, use the article's publish date (provided separately).
- "locationMatch": true only if the primary event is in "${location}" or directly implicates that location.
- "categories": choose 1-5. Allowed examples (not exhaustive): Robbery, Armed Robbery, Burglary, Assault, Sexual Assault, Homicide, Kidnapping, Cultism, Fraud, Scam, Cybercrime, Corruption, Terrorism, Banditry, Carjacking, Drug-related, Human Trafficking, Extortion, Riot, Arson, Domestic Violence, Police Brutality.
- "sentiment": 
   • Negative = worsening crime, severe incidents, fatalities, rising trend, impunity, or failures.  
   • Positive = improvement, arrests, convictions, drops in crime, effective policy.  
   • Neutral = factual report without clear trend implication.
- "confidence": 0..1 for the entire extraction.
- "summary": 1-2 sentences, factual, include who/what/where/when.
- "eventKey": a stable, short string for deduping duplicates. Example: "Parubiy-homicide-2025-09-01".

For reference, article publish date: <<see each article below>>

${toSend
	.map(
		(item, i) => `
--- ARTICLE ${i + 1} ---
Publish date: ${item.content?.publishedDate ?? "unknown"}
Content:
${item.text.slice(0, 12000)}`
	)
	.join("\n")}
		`,
	})

	// Step 3: attach urls/titles back
	if (Array.isArray(object)) {
		object.forEach((o: z.infer<typeof perArticleSchema>, idx: number) => {
			analyses.push({
				url: toSend[idx].article.url,
				title: toSend[idx].article.title ?? null,
				sourcePublishedDate: toISODate(toSend[idx].content?.publishedDate),
				...o,
			})
		})
	}

	return analyses
}

/**
 * -----------------------
 * ---- DEDUPE EVENTS ----
 * -----------------------
 * @description Dedupe events across outlets
 * @param items
 * @returns PerArticleAnalysis[]
 */

const dedupeEvents = (items: PerArticleAnalysis[]): PerArticleAnalysis[] => {
	const seen = new Set<string>()
	const out: PerArticleAnalysis[] = []
	for (const it of items) {
		const key = `${it.eventKey}`.toLowerCase().trim()
		if (seen.has(key)) continue
		seen.add(key)
		out.push(it)
	}
	return out
}

/**
 * ---------------------------
 * ---- AGGREGATE METRICS ----
 * ---------------------------
 * @description Aggregates all the metrics from the report
 * @param deduped
 * @returns CrimeAnalysisReport["metrics"]
 */

const aggregateMetrics = (
	deduped: PerArticleAnalysis[]
): CrimeAnalysisReport["metrics"] => {
	// Distribution
	const distMap: Record<Sentiment, number> = {
		Positive: 0,
		Neutral: 0,
		Negative: 0,
	}
	for (const a of deduped) distMap[a.sentiment]++

	// Time series (daily)
	const tsMap = new Map<
		string,
		{ Positive: number; Neutral: number; Negative: number }
	>()
	for (const a of deduped) {
		const day =
			a.eventDateISO ||
			a.sourcePublishedDate ||
			new Date().toISOString().slice(0, 10)
		if (!tsMap.has(day))
			tsMap.set(day, { Positive: 0, Neutral: 0, Negative: 0 })
		tsMap.get(day)![a.sentiment]++
	}
	const timeSeries = [...tsMap.entries()]
		.sort(([d1], [d2]) => (d1 < d2 ? -1 : 1))
		.map(([time, counts]) => ({ time, ...counts }))

	// Categorization × sentiment
	const catMap = new Map<
		string,
		{ Positive: number; Neutral: number; Negative: number }
	>()
	for (const a of deduped) {
		const cats = a.categories.length ? a.categories : ["Unspecified"]
		for (const c of cats) {
			if (!catMap.has(c))
				catMap.set(c, { Positive: 0, Neutral: 0, Negative: 0 })
			catMap.get(c)![a.sentiment]++
		}
	}
	const categorization = [...catMap.entries()]
		.sort((a, b) => {
			const suma = a[1].Positive + a[1].Neutral + a[1].Negative
			const sumb = b[1].Positive + b[1].Neutral + b[1].Negative
			return sumb - suma
		})
		.map(([category, counts]) => ({ category, ...counts }))

	// Summary string placeholder; the narrative builder will craft a better one.
	const summary =
		`Coverage includes ${deduped.length} distinct crime events. Distribution: ` +
		`Negative ${distMap.Negative}, Neutral ${distMap.Neutral}, Positive ${distMap.Positive}.`

	return [
		{ type: "summary", data: summary },
		{
			type: "distribution",
			data: [
				{ sentiment: "Neutral", value: distMap.Neutral },
				{ sentiment: "Positive", value: distMap.Positive },
				{ sentiment: "Negative", value: distMap.Negative },
			],
		},
		{ type: "time_series", data: timeSeries },
		{ type: "categorization", data: categorization },
	]
}

/**
 * --------------------------------
 * ---- BUILD NARRATIVE REPORT ----
 * --------------------------------
 * @description Makes a comprehensive report on the state of crime
 * @param deduped
 * @param location
 * @returns Promise<string>
 */

const buildNarrativeReport = async (
	deduped: PerArticleAnalysis[],
	location: string
): Promise<string> => {
	const head = deduped
		.slice(0, 30) // keep prompt size in check; 30 deduped events is a lot already
		.map((d) => ({
			date: d.eventDateISO || d.sourcePublishedDate,
			sentiment: d.sentiment,
			categories: d.categories,
			summary: d.summary,
		}))

	const { text } = await generateText({
		model: mainModel,
		prompt: `
Write a comprehensive but concise report on the *state of crime* in "${location}" using the structured incidents below.
Requirements:
- Be factual and avoid speculation.
- Reference dates explicitly (YYYY-MM-DD).
- Call out notable trends (rising/falling), police actions, arrests, convictions, hotspots, modus operandi.
- End with a one-line verdict: "Overall sentiment: Positive/Neutral/Negative".

Incidents:
${JSON.stringify(head, null, 2)}
    `,
	})

	return text
}

// ---------- Main Function ----------

/**
 * --------------------------------
 * ---- ANALYSE SINGLE ARTICLE ----
 * --------------------------------
 * @description Main Function, performs the logic for analysing the news articles
 * @param generatedArticles
 * @param location
 * @returns Promise<CrimeAnalysisReport>
 */

export const analyseNewsReport = async (
	generatedArticles: Article[],
	location: string
): Promise<CrimeAnalysisReport> => {
	console.log("Analysing articles")
	// 1) Fetch contents for every article URL
	const urls = generatedArticles.map((a) => a.url)
	const contents = await fetchArticleContentsWithExa(urls) // returns text + publishedDate

	// 2) Per-article extraction with bounded concurrency
	console.log("Extracting article content")
	const byUrl = new Map(contents.map((c) => [c.url, c]))
	const allAnalyses: PerArticleAnalysis[] = []
	const BATCH_SIZE = 5
	const MAX_TOTAL = 15
	const subset = generatedArticles.slice(0, MAX_TOTAL)

	for (let i = 0; i < subset.length; i += BATCH_SIZE) {
		const batch = subset.slice(i, i + BATCH_SIZE)
		const results = await analyseArticlesBatch(batch, byUrl, location)
		allAnalyses.push(...results)
	}

	console.log("Filtering location relevant articles")
	// 3) Filter to location-relevant (belt-and-suspenders) + dedupe across outlets
	const locationRelevant = allAnalyses.filter((a) => a.locationMatch)
	const deduped = dedupeEvents(locationRelevant)

	console.log("Aggregating metrics")
	// 4) Aggregate metrics
	const metrics = aggregateMetrics(deduped)

	console.log("Generating Report")
	// 5) Narrative summary
	const reportText = await buildNarrativeReport(deduped, location)
	console.log("Report Generated")

	return { reportText, /** perArticle: deduped,  */ metrics }
}
