import { generateText } from "ai";
import { searchTool } from "./getNewsArticlesHelpers.js";
import { generateArticles } from "./getNewsArticles.js";
import { analyseNewsReport } from "./sentiment-analyser.js";
import { mainModel } from "./services.js";
export const aiToolKit = async (prompt, location) => {
    console.log("\nPrompt is running");
    console.log("Searching the web for articles");
    const { text, toolResults } = await generateText({
        model: mainModel,
        prompt,
        tools: { searchTool },
    });
    const first = toolResults[0];
    if (toolResults.length > 0 && first.toolName === "searchTool") {
        const generatedArticles = await generateArticles(first.result, location);
        const analysedNews = await analyseNewsReport(generatedArticles.relevantArticles, location);
        console.log("Prompt finished");
        return analysedNews;
    }
    console.log("Prompt finished");
    return text;
};
//# sourceMappingURL=aiSdk.js.map