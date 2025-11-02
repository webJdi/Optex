/* eslint-disable @typescript-eslint/no-explicit-any */
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase2';
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

// Cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (normA * normB);
}

// Embed the query using Gemini
export async function embedQuery(query: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn('No Gemini API key available for embedding');
    return []; // Return empty array if no API key
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await embeddingModel.embedContent(query);
  return result.embedding.values;
}

// Retrieve top N relevant chunks from Firestore
export async function retrieveContext(query: string, topN = 3): Promise<string[]> {
  try {
    const queryVector = await embedQuery(query);
    
    // If no query vector (e.g., no API key), return empty context
    if (!queryVector || queryVector.length === 0) {
      console.warn('No query vector available for context retrieval');
      return [];
    }
    
    const snapshot = await getDocs(collection(db, 'cement_doc_chunks'));
    const chunks: { chunk: string; vector: number[] }[] = [];
    snapshot.forEach((doc: any) => {
      const data = doc.data();
      if (data.chunk && Array.isArray(data.vector)) {
        chunks.push({ chunk: data.chunk, vector: data.vector });
      }
    });
    
    // If no chunks found, return empty array
    if (chunks.length === 0) {
      console.warn('No document chunks found in Firestore');
      return [];
    }
    
    // Rank by similarity
    const ranked = chunks
      .map(c => ({ chunk: c.chunk, score: cosineSimilarity(queryVector, c.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);
    return ranked.map(r => r.chunk);
  } catch (error) {
    console.error('Error retrieving context:', error);
    return []; // Return empty array on error
  }
}
