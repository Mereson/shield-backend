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
		prompt: `Generate ${n} search queries for the following query: ${query}`,
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
		numResults: 1,
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
		system: `You are a researcher. For each query, search the web and then evaluate if the results are relevant and will help answer the following query.
			- Add dates for each discovered detail to your findings.
  			- When specifying the date for the report, highlight the range of data you have not just the current date.
			- If the location provided in the query is too specific and there are no relevant findings, broaden the search, city level to LGA level to state level stoping at national level.
 		 	- If the location search is broadened make it clear in your findings.
		`,
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
					const pendingResult = pendingSearchResults.pop()!
					const { object: evaluation } = await generateObject({
						model: mainModel,
						prompt: `Evaluate whether the search results are relevant and will help answer the following query: ${query}. If the page already exists in the existing results, mark it as irrelevant.
   
			  <search_results>
			  ${JSON.stringify(pendingResult)}
			  </search_results>
   
			  <existing_results>
			  ${JSON.stringify(accumulatedSources.map((result) => result.url))}
			  </existing_results>
   
			  `,
						output: "enum",
						enum: ["relevant", "irrelevant"],
					})
					if (evaluation === "relevant") {
						finalSearchResults.push(pendingResult)
					}
					console.log("Found:", pendingResult.url)
					console.log("Evaluation completed:", evaluation)
					return evaluation === "irrelevant"
						? "Search results are irrelevant. Please search again with a more specific query."
						: "Search results are relevant. End research for this query."
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

const SYSTEM_PROMPT = `You are an expert researcher. Today is ${new Date().toISOString()}. Follow these instructions when responding:
  - You may be asked to research subjects that is after your knowledge cutoff, assume the user is right when presented with news.
  - The user is a highly experienced analyst, no need to simplify it, be as detailed as possible and make sure your response is correct.
  - Be highly organized.
  - Analyse the situation over time if there are various time frames.
  - Be proactive and anticipate my needs.
  - Treat me as an expert in all subject matter.
  - Mistakes erode my trust, so be accurate and thorough.
  - Provide detailed explanations, I'm comfortable with lots of detail.
  - Value good arguments over authorities, the source is irrelevant.
  - Consider new technologies and contrarian ideas, not just the conventional wisdom.
  - You may use high levels of speculation or prediction, just flag it for me.
  - Add dates for each discovered detail to your findings.
  - When specifying the date for the report, highlight the range of data you have not just the current date.
  - Use Markdown formatting.`

const generateReport = async (research: Research) => {
	const { text } = await generateText({
		model: google("gemini-2.5-flash"),
		system: SYSTEM_PROMPT,
		prompt:
			"Generate a summerized report based on the following research data:\n\n" +
			JSON.stringify(research, null, 2),
	})
	return text
}
