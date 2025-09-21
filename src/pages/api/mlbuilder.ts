import { GoogleGenerativeAI } from "@google/generative-ai";
import { retrieveContext } from '../../services/rag';
import { NextApiRequest, NextApiResponse } from 'next';

// Interface for conversation history messages
interface ConversationMessage {
  type: string;
  content: string;
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { query, datasetInfo, modelInfo, conversationHistory } = req.body;
    
    if (!query) {
      res.status(400).json({ error: "Query is required" });
      return;
    }

    // Retrieve context from vectorized document for cement industry knowledge
    const contextChunks = await retrieveContext(query, 2);
    const context = contextChunks.join('\n');

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Build context about current session
    let sessionContext = '';
    if (datasetInfo) {
      sessionContext += `\nCurrent Dataset:
- Name: ${datasetInfo.name}
- Dimensions: ${datasetInfo.rows} rows × ${datasetInfo.columns} columns
- Size: ${datasetInfo.size}
- Data types: ${Object.entries(datasetInfo.types).map(([k, v]) => `${v} ${k}`).join(', ')}
- Missing values: ${Object.keys(datasetInfo.missingValues).length} columns affected`;
    }

    if (modelInfo) {
      sessionContext += `\nCurrent Model:
- Name: ${modelInfo.name}
- Type: ${modelInfo.type}
- Accuracy: ${modelInfo.accuracy}%
- Features: ${modelInfo.features.join(', ')}
- Target: ${modelInfo.target}`;
    }

    // Build conversation context
    let chatHistory = '';
    if (conversationHistory && conversationHistory.length > 0) {
      chatHistory = '\nRecent conversation:\n' + 
        conversationHistory.slice(-6).map((msg: ConversationMessage) => 
          `${msg.type}: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}`
        ).join('\n');
    }

    const prompt = `You are an expert Data Scientist and ML Engineer with deep knowledge in:
- Data preprocessing, cleaning, and feature engineering
- Machine learning algorithms (supervised, unsupervised, deep learning)
- Model evaluation, hyperparameter tuning, and deployment
- Data visualization and statistical analysis
- Python libraries: pandas, numpy, scikit-learn, XGBoost, TensorFlow, PyTorch
- Best practices in ML pipeline development

IMPORTANT GUIDELINES:
1. Be conversational but professional, like a senior data scientist mentoring a colleague
2. Provide specific, actionable advice based on the user's data and context
3. Use clear explanations with technical depth when appropriate
4. Suggest concrete next steps and code examples when relevant
5. Ask clarifying questions when you need more information
6. Format responses in clean markdown for readability
7. Consider the cement industry context when applicable

Cement Industry Knowledge:
${context}

Current Session Context:${sessionContext}${chatHistory}

User Query: ${query}

Respond as a professional data scientist would, providing intelligent insights and recommendations.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.status(200).json({ 
      answer: text,
      timestamp: new Date().toISOString() 
    });

  } catch (error) {
    console.error('ML Builder API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: "Failed to generate response",
      details: errorMessage
    });
  }
}