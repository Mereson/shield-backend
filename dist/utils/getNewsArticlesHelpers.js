import { generateObject, generateText, tool } from "ai";
import { Exa } from "exa-js";
import { EXA_API_KEY } from "../config/env.js";
import z from "zod";
import { mainModel } from "./services.js";
const exa = new Exa(EXA_API_KEY);
/**
 * ---------------
 * ---- TOOLS ----
 * ---------------
 */
export const searchTool = tool({
    description: "Search the web for news articles",
    parameters: z.object({
        query: z.string().min(1),
    }),
    execute: async ({ query }) => {
        const { results } = await exa.search(query, { numResults: 10 });
        return results.map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.text,
        }));
    },
});
/**
 * -----------------------
 * ---- NORMALIZE URL ----
 * -----------------------
 * @description Simple URL + title dedupe
 * @param u
 * @returns string | URL
 */
const normalizeUrl = (u) => {
    try {
        const x = new URL(u);
        x.hash = "";
        x.search = ""; // strip UTM/etc
        return x.toString();
    }
    catch {
        return u;
    }
};
/**
 * -------------------------
 * ---- DEDUPE ARTICLES ----
 * -------------------------
 * @param articles
 * @returns Article[]
 */
const dedupeArticles = (articles) => {
    const seen = new Set();
    return articles.filter((a) => {
        const key = `${normalizeUrl(a.url)}|${(a.title ?? "").toLowerCase().trim()}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
};
/**
 * -------------------------------
 * ---- GET RELEVANT ARTICLES ----
 * -------------------------------
 * @description Ask the model to call the tool for a single query
 * @param query
 * @returns Article[]
 */
const runToolSearch = async (query) => {
    const { toolResults } = await generateText({
        model: mainModel,
        // Nudge the model to invoke the tool with the right parameter name.
        prompt: `Use the searchTool to fetch ~10 recent news articles for this query: "${query}".`,
        tools: { searchTool },
    });
    const item = toolResults.find((t) => t.toolName === "searchTool");
    return item?.result ?? [];
};
/**
 * ------------------------
 * ---- EXPAND QUERIES ----
 * ------------------------
 * @description Generates more queries for deeper search
 * @param relevant
 * @param location
 * @returns string
 */
const expandQueries = async (relevant, location) => {
    const { object } = await generateObject({
        model: mainModel,
        // Keep the schema strict so TS stays happy.
        schema: z.object({
            queries: z.array(z.string()).min(2).max(8),
        }),
        prompt: `
		You are helping with deep research.
		Given these relevant articles (titles/snippets) and the location "${location}",
		produce 3-6 highly specific follow-up search queries that will likely surface
		more *directly related* crime news. Use key entities (people, places, schools,
		neighborhoods), synonyms, and common aliases/abbreviations. Prefer queries
		that mention the location and concrete crime terms (e.g., robbery, assault,
		kidnapping, cultism, scam, fraud, etc.). Avoid generic queries.
  
		Return ONLY JSON in the shape: { "queries": [ ... ] }.
		
		Articles:
		${JSON.stringify(relevant.slice(0, 8), null, 2)}
	  `,
    });
    return object?.queries ?? [];
};
/**
 * -------------------------------
 * ---- GET RELEVANT ARTICLES ----
 * -------------------------------
 * @description Filters relevant articles from all articles
 * @param toolResults
 * @param location
 * @returns Result[]
 */
const getRelevantArticles = async (toolResults, location) => {
    const { object } = await generateObject({
        model: mainModel,
        prompt: `
		You are a research assistant. 
		These are a list of news articles <search_result> ${JSON.stringify(toolResults)} </search_result>. 
		Please return ONLY the articles that are relevant to crime in "${location}". 
		Discard unrelated or tangential results.
		Return them in JSON format with title, url, and snippet.
	  `,
        schema: z.array(z.object({
            title: z.string().nullable(),
            url: z.string(),
            snippet: z.string(),
        })),
    });
    return object;
};
export { expandQueries, runToolSearch, dedupeArticles, getRelevantArticles };
//# sourceMappingURL=getNewsArticlesHelpers.js.map