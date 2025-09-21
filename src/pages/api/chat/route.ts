import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChromaClient } from "chromadb";
import { NextApiRequest, NextApiResponse } from "next";

// Initialize Gemini and ChromaDB
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const chromaClient = new ChromaClient(); // Assumes ChromaDB is running locally

// This is a placeholder for your data ingestion step.
// In a real app, you would run this once to populate your database.
async function setupCollection() {
  try {
    const collection = await chromaClient.getOrCreateCollection({ name: "my_docs" });
    // Example documents
    await collection.add({
      ids: ["doc1", "doc2", "doc3"],
      documents: [
        "The Next.js App Router was introduced in version 13.",
        "Google's newest Flash model is called Gemini 1.5 Flash.",
        "The Web Speech API allows for voice recognition in the browser.",
      ],
    });
    console.log("📚 Collection setup complete.");
  } catch (e) {
    console.log("Collection already exists or error:", e);
  }
}
setupCollection(); // Run setup on server start

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    // 1. Get the document collection from ChromaDB
    const collection = await chromaClient.getCollection({ name: "my_docs" });

    // 2. Query the collection to find relevant documents (the "Retrieval" part)
    const results = await collection.query({
      nResults: 2, // Find the 2 most relevant documents
      queryTexts: [query],
    });

    const context = results.documents[0].join("\n");

    // 3. Augment the prompt with the retrieved context
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      You are a helpful assistant. Answer the user's question based on the following context.
      If the context doesn't contain the answer, say that you don't know.

      Context:
      ${context}

      Question:
      ${query}
    `;

    // 4. Generate the response (the "Generation" part)
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({ answer: text });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
