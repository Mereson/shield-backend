import { PORT } from "./config/env.js"
import express from "express"
import errorMiddleware from "./middleware/error.middleware.js"
import promptRouter from "./routes/prompt.routes.js"

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// routes
app.use("/api/v1/prompt", promptRouter)

app.get("/", (req, res) => {
	res.send("Welcome to the Agent of Shield API")
})

app.use(errorMiddleware)

app.listen(PORT, () => {
	console.log(
		`Agent of Shield API is running live on http://localhost:${PORT}`
	)
})
