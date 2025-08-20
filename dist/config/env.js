import { config } from "dotenv";
config({ path: ".env.development.local" });
export const { PORT, NEWS_API_KEY, EXA_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY } = process.env;
//# sourceMappingURL=env.js.map