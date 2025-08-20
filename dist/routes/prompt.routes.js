import { Router } from "express";
import { getSentiment } from "../controllers/prompt.controller.js";
const promptRouter = Router();
// Path: /api/v1/prompt
promptRouter.post("/get-sentiment", getSentiment);
export default promptRouter;
//# sourceMappingURL=prompt.routes.js.map