/* eslint-disable @typescript-eslint/no-explicit-any */
import { GoogleGenAI } from "@google/genai";
import { NextApiRequest, NextApiResponse } from "next";
import { retrieveContext } from '../../services/rag';
import { fetchPlantReading } from '../../services/plantApi';

// Initialize Gemini with proper environment variable
let ai: GoogleGenAI | null = null;

try {
  const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  
  if (geminiApiKey) {
    ai = new GoogleGenAI({
      apiKey: geminiApiKey
    });
    console.log('✓ Gemini AI initialized for LLM API');
  } else {
    console.warn('⚠ NEXT_PUBLIC_GEMINI_API_KEY or GOOGLE_API_KEY not set for LLM API');
  }
} catch (error) {
  console.error('Failed to initialize Gemini AI for LLM:', error);
}

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

    // Check if AI is available
    if (!ai) {
      console.error('Gemini AI not initialized for voice assistant');
      res.status(500).json({ 
        error: "AI service unavailable", 
        answer: "Sorry, the AI voice assistant is currently not available. Please configure NEXT_PUBLIC_GEMINI_API_KEY in your environment variables." 
      });
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

    // Use correct @google/genai pattern
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are a helpful cement plant assistant. Use the following design/process knowledge and current plant condition to answer the user's question concisely and professionally.
      
      ${plantStateText}
      
      Context from knowledge base:
      ${context}
      
      User Question: ${query}
      
      Please provide a clear, concise answer that directly addresses the question. Keep responses under 100 words for voice interaction.`
    });

    const text = result.text;
    res.status(200).json({ answer: text });
  } catch (error) {
    console.error('LLM API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: "Internal server error",
      answer: "I apologize, but I'm having trouble processing your request right now. Please try again in a moment."
    });
  }
}