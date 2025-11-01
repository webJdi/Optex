/* eslint-disable @typescript-eslint/no-explicit-any */
import { GoogleGenAI } from "@google/genai";
import { NextApiRequest, NextApiResponse } from "next";
import { retrieveContext } from '../../services/rag';
import { fetchPlantReading } from '../../services/plantApi';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });



export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are a helpful assistant. Use the following design/process knowledge and current plant condition to answer the user's question.
      ${plantStateText}
      Context:\n${context}\n
      Question:
      ${query}`
    });
    const text = result.text;
    res.status(200).json({ answer: text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
}