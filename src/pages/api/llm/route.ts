import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChromaClient } from "chromadb";

// Initialize Gemini and ChromaDB
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const chromaClient = new ChromaClient();

async function setupCollection() {
  try {
    const collection = await chromaClient.getOrCreateCollection({ name: "my_docs" });
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
setupCollection();

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
    const collection = await chromaClient.getCollection({ name: "my_docs" });
    const results = await collection.query({
      nResults: 2,
      queryTexts: [query],
    });
    const context = results.documents[0].join("\n");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      You are a helpful assistant. Answer the user's question based on the following context.
      If the context doesn't contain the answer, say that you don't know.

      Context:
      ${context}

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