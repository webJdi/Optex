/* eslint-disable @typescript-eslint/no-explicit-any */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { retrieveContext } from '../../services/rag';
import { fetchPlantReading } from '../../services/plantApi';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);



export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const { query } = req.body;
    if (!query) {
      res.status(400).json({ error: "Query is required" });
      return;
    }
    // Retrieve context from vectorized document
    const contextChunks = await retrieveContext(query, 3);
    const context = contextChunks.join('\n');
    // Fetch present plant condition
    let plantStateText = '';
    try {
      const plantState = await fetchPlantReading();
      plantStateText = `Current Plant Condition:\n${JSON.stringify(plantState, null, 2)}`;
    } catch (e) {
      plantStateText = 'Current Plant Condition: [Unavailable]';
    }
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      You are a helpful assistant. Use the following design/process knowledge and current plant condition to answer the user's question.
      ${plantStateText}
      Context:\n${context}\n
      Question:
      ${query}
    `;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    res.status(200).json({ answer: text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
}