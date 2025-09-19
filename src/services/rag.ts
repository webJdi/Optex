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
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await embeddingModel.embedContent(query);
  return result.embedding.values;
}

// Retrieve top N relevant chunks from Firestore
export async function retrieveContext(query: string, topN = 3): Promise<string[]> {
  const queryVector = await embedQuery(query);
  const snapshot = await getDocs(collection(db, 'cement_doc_chunks'));
  const chunks: { chunk: string; vector: number[] }[] = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.chunk && Array.isArray(data.vector)) {
      chunks.push({ chunk: data.chunk, vector: data.vector });
    }
  });
  // Rank by similarity
  const ranked = chunks
    .map(c => ({ chunk: c.chunk, score: cosineSimilarity(queryVector, c.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
  return ranked.map(r => r.chunk);
}
