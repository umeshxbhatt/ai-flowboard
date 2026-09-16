import { GoogleGenAI } from "@google/genai";
import ApiError from "../utils/ApiError.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

let client = null;

const getClient = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "your-gemini-api-key")
    throw new ApiError("GEMINI_API_KEY is not configured on the server");

  if (!client) {
    client = new GoogleGenAI({ apiKey: key });
  }
  return client;
};

const extractJson = (text) => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : text; // fenced[1] inner part of ```json ```

  const start = candidate.search(/[\[{]/); // Find the first [ or { inside candidate (where the json starts)
  if (start === -1)
    throw new ApiError(502, "AI returned an unexpected response");

  const end = Math.max(candidate.lastIndexOf("]"), candidate.lastIndexOf("}")); // where the json ends

  try {
    return JSON.parse(candidate.slice(start, end + 1)); // slice(start, end) does not include the character at end.
  } catch {
    throw new ApiError(502, "Failed to parse AI response");
  }
};

const runPrompt = async (prompt, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await getClient().models.generateContent({
        model: MODEL,
        contents: prompt,
      });
      return response.text;
    } catch (err) {
      if (err.isApiError) throw err;

      const status = err.status || err.statusCode;

      // Identify retryable errors. Sometimes the status is inside the error message JSON.
      let isRetryable = status === 429 || status === 503;
      if (!isRetryable && err.message) {
        if (err.message.includes('"code":503') || err.message.includes('"code":429')) {
          isRetryable = true;
        }
      }

      if (isRetryable && attempt < retries) {
        console.warn(`Gemini API busy (attempt ${attempt}/${retries}). Retrying in ${attempt}s...`);
        await new Promise((res) => setTimeout(res, attempt * 1000));
        continue;
      }

      if (status === 429 || (err.message && err.message.includes('"code":429')))
        throw new ApiError(
          429,
          "AI quota exceeded. Check your Gemini plan/billing and try again later.",
        );
      if (status === 400 || status === 401 || status === 403)
        throw new ApiError(
          503,
          "AI request rejected - verify your GEMINI_API_KEY is valid.",
        );
      console.error("Gemini request failed:", err.message);
      throw new ApiError(
        502,
        "The AI service is temporarily unavailable. Please try again.",
      );
    }
  }
};

const normalizeTask = (t) => ({
  title: String(t.title || t.name || "")
    .trim()
    .slice(0, 200),

  description: String(t.description || "")
    .trim()
    .slice(0, 1000),

  priority: ["low", "medium", "high", "urgent"].includes(t.priority)
    ? t.priority
    : "medium",
});

export const generateTasks = async (goal, count = 6) => {
  const prompt = `
    You are a senior project manager.
    Break the following project goal into ${count} concrete, actionable Kanban tasks.
    Project goal: ${goal}

    Respond ONLY with a JSON array.
    Each item must have:
    { 
      "title": string,
      "description": string (1-2 sentences),
      "priority": one of "low", "medium", "high", "urgent"
    }.
    No markdown.
    No commentary.`.trim();

  const json = extractJson(await runPrompt(prompt));

  if (!Array.isArray(json))
    throw new ApiError(502, "Gemini did not return a task array");

  return json.map(normalizeTask).filter((t) => t.title);
};

export const breakdownTask = async (title, description, count = 5) => {
  const prompt = `
    Break the following task into ${count} smaller, sequential subtasks.
    Task title: ${title}
    Task details: ${description || "No additional details provided."}

    Respond only with a JSON array.
    Each item must have:
    { 
      "title": string,
      "description": string (short),
      "priority": one of "low", "medium", "high", "urgent"
    }.
    No markdown.
    No commentary.`.trim();

  const json = extractJson(await runPrompt(prompt));

  if (!Array.isArray(json))
    throw new ApiError(502, "Gemini did not return a subtask array");

  return json.map(normalizeTask).filter((t) => t.title);
};

export const summarizeBoard = async ({ boardTitle, columns }) => {
  const snapshot = columns
    .map(
      (c) =>
        `${c.title} (${c.tasks.length}):\n` +
        (c.tasks.map((t) => `  -${t.title} [${t.priority}]`).join("\n") ||
          " (none)"),
    )
    .join("\n");

  const prompt = `
    You are a Scrum Master.
    Write a concise sprint summary for the following Kanban board "${boardTitle}".
    Current board state:
    ${snapshot}

    Respond only with JSON: 
    The JSON must contain: {
      "headline": string (one sentence overview)
      "complete": string[] (key completed items)
      "inProgress": string[] (what is actively being worked on)
      "risks": string[] (blockers, risks, or overdue concerns)
      "recommendations": string[] (next priorities)
    }
    No markdown. No commentary.`.trim();

  return extractJson(await runPrompt(prompt));
};
