import { GoogleGenerativeAI } from "@google/generative-ai";

// Use environment variables for your API key!
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * Converts a piece of text into a numerical vector using Google's embedding model.
 * @param text The text to vectorize.
 * @returns A promise that resolves to an array of numbers (the vector).
 */
export async function vectorizeText(text: string): Promise<number[]> {
  try {
    // 1. We use the "text-embedding-004" model for this task
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

    // 2. Call the embedContent method with your text
    const result = await embeddingModel.embedContent(text);

    // 3. The vector is located in result.embedding.values
    const embedding = result.embedding.values;
    
    return embedding;

  } catch (error) {
    console.error("Error creating embedding:", error);
    throw new Error("Failed to vectorize text.");
  }
}

// --- Example of how to use it ---
async function main() {
  const myText = "The Next.js App Router was introduced in version 13.";
  console.log("Vectorizing the text:", `"${myText}"`);

  const vector = await vectorizeText(myText);
  
  console.log("Vector created successfully!");
  console.log("Vector dimensions:", vector.length); // e.g., 768
  console.log("First 5 values:", vector.slice(0, 5)); // e.g., [0.0123, -0.0456, ...]
}

// You can run this example to test it.
// main();
