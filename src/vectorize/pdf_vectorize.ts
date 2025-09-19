import fs from 'fs';
import pdfParse from 'pdf-parse';
import { db } from '../services/firebase2';
import { collection, addDoc } from 'firebase/firestore';
import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
console.log("Gemini API Key:", process.env.GEMINI_API_KEY!);

/**
 * Converts a piece of text into a numerical vector using Google's embedding model.
 * @param text The text to vectorize.
 * @returns A promise that resolves to an array of numbers (the vector).
 */
export async function vectorizeText(text: string): Promise<number[]> {
  try {
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await embeddingModel.embedContent(text);
    const embedding = result.embedding.values;
    
    return embedding;

  } catch (error) {
    console.error("Error creating embedding:", error);
    throw new Error("Failed to vectorize text.");
  }
}

async function processPDF(pdfPath: string): Promise<void> {
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(dataBuffer);
  const textChunks: string[] = data.text.split('\n\n').filter(Boolean);

  for (const chunk of textChunks) {
    const vector: number[] = await vectorizeText(chunk);
    // Store each chunk and its vector in Firestore
    await addDoc(collection(db, 'cement_doc_chunks'), {
      chunk,
      vector,
      timestamp: new Date().toISOString(),
    });
  }
  console.log('PDF vectorization and Firestore storage complete!');
}

processPDF('d:/github/Optex/src/vectorize/cement_doc.pdf');
