import { google } from "@ai-sdk/google"
import { generateObject, generateText, tool } from "ai"
import "dotenv/config"
import z from "zod"
import { EXA_API_KEY } from "../config/env.js"
import { Exa } from "exa-js"

const exa = new Exa(EXA_API_KEY)
type Learning = {
	learning: string
	followUpQuestions: string[]
}

type Research = {
	query: string | undefined
	queries: string[]
	searchResults: SearchResult[]
	learnings: Learning[]
	completedQueries: string[]
}

const accumulatedResearch: Research = {
	query: undefined,
	queries: [],
	searchResults: [],
	learnings: [],
	completedQueries: [],
}

const mainModel = google("gemini-2.0-flash")

const deepResearch = async (
	prompt: string,
	depth: number = 3,
	breadth: number = 3
) => {
	if (!accumulatedResearch.query) {
		accumulatedResearch.query = prompt
	}

	if (depth === 0) {
		return accumulatedResearch
	}

	const queries = await generateSearchQueries(prompt, breadth)
	accumulatedResearch.queries = queries

	for (const query of queries) {
		console.log(`Searching the web for: ${query}`)
		const searchResults = await searchAndProcess(
			query,
			accumulatedResearch.searchResults
		)
		accumulatedResearch.searchResults.push(...searchResults)
		for (const searchResult of searchResults) {
			console.log(`Processing search result: ${searchResult.url}`)
			const learnings = await generateLearnings(query, searchResult)
			accumulatedResearch.learnings.push(learnings)
			accumulatedResearch.completedQueries.push(query)

			const newQuery = `Overall research goal: ${prompt}
		  Previous search queries: ${accumulatedResearch.completedQueries.join(", ")}
   
		  Follow-up questions: ${learnings.followUpQuestions.join(", ")}
		  `
			await deepResearch(newQuery, depth - 1, Math.ceil(breadth / 2))
		}
	}
	return accumulatedResearch
}

export const aiToolKit = async (prompt: string): Promise<string> => {
	const research = await deepResearch(prompt)

	console.log("Research completed!")
	console.log("Generating report...")
	const report = await generateReport(research)
	console.log("Report generated!")

	return report
}

const generateSearchQueries = async (query: string, n: number = 3) => {
	const {
		object: { queries },
	} = await generateObject({
		model: mainModel,
		prompt: `
Generate ${n} diverse search queries for the following research goal: ${query}.
- Include variations focusing on "crime", "security incidents", "violence", "public safety", "policing", "gangs", "terrorism".
- Try different time frames (e.g. past year, past 6 months, 2025, 2024).
- Include both English and local-language context (if known).
- Use synonyms like "attack", "arrest", "protests", "shooting", "kidnapping".
- Make some queries broader (city → region → country).
`,
		schema: z.object({
			queries: z.array(z.string()).min(1).max(5),
		}),
	})
	return queries
}

type SearchResult = {
	title: string
	url: string
	content: string
}

const searchWeb = async (query: string) => {
	const { results } = await exa.searchAndContents(query, {
		numResults: 5,
		livecrawl: "always",
	})
	return results.map(
		(r) =>
			({
				title: r.title,
				url: r.url,
				content: r.text,
			} as SearchResult)
	)
}

const searchAndProcess = async (
	query: string,
	accumulatedSources: SearchResult[]
) => {
	const pendingSearchResults: SearchResult[] = []
	const finalSearchResults: SearchResult[] = []

	await generateText({
		model: mainModel,
		prompt: `Search the web for information about ${query}`,
		system: `You are a crime and security researcher. 
Evaluate search results for usefulness, not just strict relevance.
- Accept results that mention crime/security issues in broader or related contexts (region, country, similar timeframe).
- Accept older reports if no new data exists, but note that they are retrospective.
- Reject only if the result is totally unrelated (e.g. tourism guide, restaurant review).`,
		maxSteps: 5,
		tools: {
			searchWeb: tool({
				description: "Search the web for information about a given query",
				parameters: z.object({
					query: z.string().min(1),
				}),
				async execute({ query }) {
					const results = await searchWeb(query)
					pendingSearchResults.push(...results)
					return results
				},
			}),
			evaluate: tool({
				description: "Evaluate the search results",
				parameters: z.object({}),
				async execute() {
					for (const pendingResult of [...pendingSearchResults]) {
						const { object: evaluation } = await generateObject({
							model: mainModel,
							prompt: `Evaluate whether the search results are relevant and will help answer the following query: ${query}. If the page already exists in the existing results, mark it as irrelevant.
   
							<search_result>
							${JSON.stringify(pendingResult)}
							</search_result>
   
							<existing_results>
							${JSON.stringify(accumulatedSources.map((result) => result.url))}
							</existing_results>
							`,
							output: "enum",
							enum: ["relevant", "irrelevant"],
						})

						if (evaluation === "relevant") {
							// avoid duplicates
							if (
								!accumulatedSources.some((r) => r.url === pendingResult.url)
							) {
								finalSearchResults.push(pendingResult)
							}
						}
						console.log("Found:", pendingResult.url)
						console.log("Evaluation completed:", evaluation)
					}
					return "Evaluation completed for all results."
				},
			}),
		},
	})

	return finalSearchResults
}

const generateLearnings = async (query: string, searchResult: SearchResult) => {
	const { object } = await generateObject({
		model: mainModel,
		prompt: `The user is researching "${query}". The following search result were deemed relevant.
	  Generate a learning and a follow-up question from the following search result:
   
	  <search_result>
	  ${JSON.stringify(searchResult)}
	  </search_result>
	  `,
		schema: z.object({
			learning: z.string(),
			followUpQuestions: z.array(z.string()),
		}),
	})
	return object
}

const SYSTEM_PROMPT = `You are an expert crime and security researcher. Today is ${new Date().toISOString()}.
Follow these instructions when writing your report:

- The user is an expert analyst. Be detailed, accurate, and highly organized.
- Analyse crime and security developments **over time**. Clearly indicate time ranges (e.g. July 2024 – September 2024).
- Always include dates for each event or trend you describe. If dates are vague, state "undated".
- Explicitly mention **sentiment signals** in coverage (Positive, Neutral, Negative). This will later be parsed into structured sentiment data.
- Highlight **categories of crime/security issues** (e.g. robbery, assault, cybercrime, protests, terrorism, policing actions).
- Note the **urgency** of each issue (immediate, ongoing, retrospective).
- If location specificity was broadened (city → district → national), clearly explain this.
- Provide aggregated insights into public opinion, recurring narratives, or community responses.
- Use **Markdown formatting** with sections, bullet points, and timelines for readability.
- Do not generate JSON. Only produce a detailed narrative analysis.
- Mistakes erode trust — be accurate, proactive, and thorough.
`

const generateReport = async (research: Research) => {
	const { text } = await generateText({
		model: google("gemini-2.5-flash"),
		system: SYSTEM_PROMPT,
		prompt:
			"Generate a comprehensive and sentiment-aware crime/security report based on the following research data:\n\n" +
			JSON.stringify(research, null, 2),
	})
	return text
}

// const generateReport = async (research: Research) => {
// 	const { text } = await generateText({
// 		model: google("gemini-2.5-flash"),
// 		system: SYSTEM_PROMPT,
// 		prompt:
// 			"Generate a summerized report based on the following research data:\n\n" +
// 			JSON.stringify(research, null, 2),
// 	})
// 	return text
// }

// const searchAndProcess = async (
// 	query: string,
// 	accumulatedSources: SearchResult[]
// ) => {
// 	const pendingSearchResults: SearchResult[] = []
// 	const finalSearchResults: SearchResult[] = []
// 	await generateText({
// 		model: mainModel,
// 		prompt: `Search the web for information about ${query}`,
// 		system: `You are a researcher. For each query, search the web and then evaluate if the results are relevant and will help answer the following query.
// 			- Add dates for each discovered detail to your findings.
//   			- When specifying the date for the report, highlight the range of data you have not just the current date.
// 			- If the location provided in the query is too specific and there are no relevant findings, broaden the search, city level to LGA level to state level stoping at national level.
//  		 	- If the location search is broadened make it clear in your findings.
// 		`,
// 		maxSteps: 5,
// 		tools: {
// 			searchWeb: tool({
// 				description: "Search the web for information about a given query",
// 				parameters: z.object({
// 					query: z.string().min(1),
// 				}),
// 				async execute({ query }) {
// 					const results = await searchWeb(query)
// 					pendingSearchResults.push(...results)
// 					return results
// 				},
// 			}),
// 			evaluate: tool({
// 				description: "Evaluate the search results",
// 				parameters: z.object({}),
// 				async execute() {
// 					const pendingResult = pendingSearchResults.pop()!
// 					const { object: evaluation } = await generateObject({
// 						model: mainModel,
// 						prompt: `Evaluate whether the search results are relevant and will help answer the following query: ${query}. If the page already exists in the existing results, mark it as irrelevant.

// 			  <search_results>
// 			  ${JSON.stringify(pendingResult)}
// 			  </search_results>

// 			  <existing_results>
// 			  ${JSON.stringify(accumulatedSources.map((result) => result.url))}
// 			  </existing_results>

// 			  `,
// 						output: "enum",
// 						enum: ["relevant", "irrelevant"],
// 					})
// 					if (evaluation === "relevant") {
// 						finalSearchResults.push(pendingResult)
// 					}
// 					console.log("Found:", pendingResult.url)
// 					console.log("Evaluation completed:", evaluation)
// 					return evaluation === "irrelevant"
// 						? "Search results are irrelevant. Please search again with a more specific query."
// 						: "Search results are relevant. End research for this query."
// 				},
// 			}),
// 		},
// 	})
// 	return finalSearchResults
// }

// const SYSTEM_PROMPT = `You are an expert researcher. Today is ${new Date().toISOString()}. Follow these instructions when responding:
//   - You may be asked to research subjects that is after your knowledge cutoff, assume the user is right when presented with news.
//   - The user is a highly experienced analyst, no need to simplify it, be as detailed as possible and make sure your response is correct.
//   - Be highly organized.
//   - Analyse the situation over time if there are various time frames.
//   - Be proactive and anticipate my needs.
//   - Treat me as an expert in all subject matter.
//   - Mistakes erode my trust, so be accurate and thorough.
//   - Provide detailed explanations, I'm comfortable with lots of detail.
//   - Value good arguments over authorities, the source is irrelevant.
//   - Consider new technologies and contrarian ideas, not just the conventional wisdom.
//   - You may use high levels of speculation or prediction, just flag it for me.
//   - Add dates for each discovered detail to your findings.
//   - When specifying the date for the report, highlight the range of data you have not just the current date.
//   - Use Markdown formatting.`

// const generateReport = async (research: Research) => {
// 	const { text } = await generateText({
// 		model: google("gemini-2.5-flash"),
// 		system: SYSTEM_PROMPT,
// 		prompt:
// 			"Generate a summerized report based on the following research data:\n\n" +
// 			JSON.stringify(research, null, 2),
// 	})
// 	return text
// }
