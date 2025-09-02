import { dedupeArticles, expandQueries, getRelevantArticles, runToolSearch, } from "./getNewsArticlesHelpers.js";
export const generateArticles = async (first, location) => {
    // Round 1: Filter relevant articles from initial results
    console.log("Filtering relevant articles");
    const initialAll = first;
    const round1Relevant = await getRelevantArticles(initialAll, location);
    // If no relevant article, return initial results
    if (!round1Relevant.length) {
        return { relevantArticles: [], allArticles: initialAll };
    }
    // Round 2: deep research — generate follow-up queries
    console.log("Generating follow-up queries");
    const queries = await expandQueries(round1Relevant, location);
    // If no follow-ups, return round 1
    if (!queries.length) {
        return {
            relevantArticles: round1Relevant,
            allArticles: dedupeArticles(initialAll),
            expandedQueries: [],
        };
    }
    // Run the tool again for each follow-up query (in parallel)
    console.log("Searching the web with follow-up queries");
    const batches = await Promise.all(queries.map(runToolSearch));
    const round2All = batches.flat();
    // Merge + dedupe all found articles
    console.log("Merging all articles");
    const mergedAll = dedupeArticles([...initialAll, ...round2All]);
    // Final relevance filter on the merged set
    console.log("Arranging final relevant articles");
    const finalRelevant = await getRelevantArticles(mergedAll, location);
    console.log("Articles arranged");
    return {
        relevantArticles: finalRelevant,
        allArticles: mergedAll,
        expandedQueries: queries,
    };
};
//# sourceMappingURL=getNewsArticles.js.map