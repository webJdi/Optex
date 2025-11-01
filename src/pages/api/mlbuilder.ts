/* eslint-disable @typescript-eslint/no-explicit-any */
import { GoogleGenAI } from "@google/genai";
import { retrieveContext } from '../../services/rag';
import { NextApiRequest, NextApiResponse } from 'next';

// Interface for conversation history messages
interface ConversationMessage {
  type: string;
  content: string;
}

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Backend API URL
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

// Define function schemas for Gemini function calling
// This is kept for documentation purposes - the actual function calling is handled via JSON parsing
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mlFunctions = [
  {
    name: "analyze_dataset",
    description: "Analyze the loaded dataset to get comprehensive statistics, data types, missing values, and descriptive stats",
    parameters: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "Session ID for the ML workflow"
        }
      },
      required: ["session_id"]
    }
  },
  {
    name: "univariate_analysis",
    description: "Perform univariate analysis on a specific column to get distribution plot and statistics",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Session ID" },
        column: { type: "string", description: "Column name to analyze" }
      },
      required: ["session_id", "column"]
    }
  },
  {
    name: "bivariate_analysis",
    description: "Analyze relationship between two columns with scatter plots or cross-tabulation",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Session ID" },
        col1: { type: "string", description: "First column name" },
        col2: { type: "string", description: "Second column name" }
      },
      required: ["session_id", "col1", "col2"]
    }
  },
  {
    name: "correlation_analysis",
    description: "Generate correlation matrix and heatmap for all numeric columns",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Session ID" }
      },
      required: ["session_id"]
    }
  },
  {
    name: "split_dataset",
    description: "Split dataset into training and testing sets",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Session ID" },
        target_column: { type: "string", description: "Target variable column name" },
        test_size: { type: "number", description: "Proportion of test set (0.0-1.0)", default: 0.2 },
        random_state: { type: "integer", description: "Random seed", default: 42 }
      },
      required: ["session_id", "target_column"]
    }
  },
  {
    name: "train_model",
    description: "Train a machine learning model. Available models: linear_regression, ridge, lasso, elastic_net, decision_tree, random_forest, gradient_boosting, adaboost, xgboost, lightgbm, catboost",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Session ID" },
        model_type: { 
          type: "string", 
          description: "Model type to train",
          enum: ["linear_regression", "ridge", "lasso", "elastic_net", "decision_tree", 
                 "random_forest", "gradient_boosting", "adaboost", "xgboost", "lightgbm", "catboost"]
        },
        hyperparameters: { 
          type: "object", 
          description: "Model hyperparameters as key-value pairs",
          additionalProperties: true
        }
      },
      required: ["session_id", "model_type"]
    }
  },
  {
    name: "tune_hyperparameters",
    description: "Automatically tune hyperparameters using Optuna for random_forest, xgboost, or gradient_boosting",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Session ID" },
        model_type: { 
          type: "string", 
          description: "Model type to tune",
          enum: ["random_forest", "xgboost", "gradient_boosting"]
        },
        n_trials: { type: "integer", description: "Number of optimization trials", default: 50 }
      },
      required: ["session_id", "model_type"]
    }
  },
  {
    name: "shap_analysis",
    description: "Perform SHAP analysis for model interpretability and feature importance",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Session ID" },
        model_name: { type: "string", description: "Name of trained model to analyze" },
        max_samples: { type: "integer", description: "Max samples for SHAP", default: 100 }
      },
      required: ["session_id", "model_name"]
    }
  },
  {
    name: "download_model",
    description: "Download a trained model as pickle or joblib file",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Session ID" },
        model_name: { type: "string", description: "Name of model to download" },
        format: { type: "string", description: "File format", enum: ["pickle", "joblib"], default: "joblib" }
      },
      required: ["session_id", "model_name"]
    }
  },
  {
    name: "get_model_summary",
    description: "Get summary of current ML session including loaded dataset, trained models, and results",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Session ID" }
      },
      required: ["session_id"]
    }
  }
];

// Function to call backend ML API
async function callMLFunction(functionName: string, args: any): Promise<any> {
  try {
    const urlMap: Record<string, string> = {
      analyze_dataset: `/ml/analyze_dataset?session_id=${args.session_id}`,
      univariate_analysis: `/ml/univariate?session_id=${args.session_id}&column=${encodeURIComponent(args.column)}`,
      bivariate_analysis: `/ml/bivariate?session_id=${args.session_id}&col1=${encodeURIComponent(args.col1)}&col2=${encodeURIComponent(args.col2)}`,
      correlation_analysis: `/ml/correlation?session_id=${args.session_id}`,
      split_dataset: `/ml/split_dataset`,
      train_model: `/ml/train_model`,
      tune_hyperparameters: `/ml/tune_hyperparameters`,
      shap_analysis: `/ml/shap_analysis?session_id=${args.session_id}&model_name=${args.model_name}&max_samples=${args.max_samples || 100}`,
      download_model: `/ml/download_model?session_id=${args.session_id}&model_name=${args.model_name}&format=${args.format || 'joblib'}`,
      get_model_summary: `/ml/model_summary?session_id=${args.session_id}`
    };

    const url = urlMap[functionName];
    if (!url) {
      return { error: `Unknown function: ${functionName}` };
    }

    const method = ['split_dataset', 'train_model', 'tune_hyperparameters'].includes(functionName) ? 'POST' : 'GET';
    
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    if (method === 'POST') {
      options.body = JSON.stringify(args);
    }

    const response = await fetch(`${BACKEND_URL}${url}`, options);
    const data = await response.json();
    return data;
  } catch (error) {
    return { error: `Function call failed: ${error}` };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { query, sessionId, datasetInfo, modelInfo, conversationHistory } = req.body;
    
    if (!query) {
      res.status(400).json({ error: "Query is required" });
      return;
    }

    const session_id = sessionId || 'default_session';

    // Retrieve context from vectorized document for cement industry knowledge
    const contextChunks = await retrieveContext(query, 2);
    const context = contextChunks.join('\n');
    
    // Build context about current session
    let sessionContext = '';
    if (datasetInfo) {
      sessionContext += `\nCurrent Dataset:
- Name: ${datasetInfo.name}
- Dimensions: ${datasetInfo.rows} rows × ${datasetInfo.columns} columns
- Size: ${datasetInfo.size}
- Data types: ${Object.entries(datasetInfo.types).map(([k, v]) => `${v} ${k}`).join(', ')}
- Missing values: ${Object.keys(datasetInfo.missingValues || {}).length} columns affected`;
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

    const systemPrompt = `You are an expert Data Scientist and ML Engineer with deep knowledge in:
- Data preprocessing, cleaning, and feature engineering
- Machine learning algorithms (supervised, unsupervised, deep learning)
- Model evaluation, hyperparameter tuning, and deployment
- Data visualization and statistical analysis
- Python libraries: pandas, numpy, scikit-learn, XGBoost, LightGBM, CatBoost, Optuna, SHAP
- Best practices in ML pipeline development

You have access to ML functions through a backend API that can execute real data analysis and model training.

IMPORTANT: When users ask to perform ML operations, respond with a JSON function call in this EXACT format:
{
  "function": "function_name",
  "parameters": { "session_id": "${session_id}", "other_params": "values" }
}

Available Functions and When to Use Them:

1. **analyze_dataset** - When user asks to analyze/explore/examine the dataset
   Parameters: {"session_id": "${session_id}"}

2. **univariate_analysis** - When user asks about a single column's distribution
   Parameters: {"session_id": "${session_id}", "column": "column_name"}

3. **bivariate_analysis** - When user asks about relationship between two columns
   Parameters: {"session_id": "${session_id}", "col1": "first_column", "col2": "second_column"}

4. **correlation_analysis** - When user asks for correlation heatmap
   Parameters: {"session_id": "${session_id}"}

5. **split_dataset** - When user asks to split data for training
   Parameters: {"session_id": "${session_id}", "target_column": "target_name", "test_size": 0.2}

6. **train_model** - When user asks to train a specific model
   Available models: linear_regression, ridge, lasso, elastic_net, decision_tree, random_forest, gradient_boosting, adaboost, xgboost, lightgbm, catboost
   Parameters: {"session_id": "${session_id}", "model_type": "model_name", "hyperparameters": {}}

7. **tune_hyperparameters** - When user asks to optimize/tune hyperparameters
   Parameters: {"session_id": "${session_id}", "model_type": "random_forest|xgboost|gradient_boosting", "n_trials": 50}

8. **shap_analysis** - When user asks for SHAP/feature importance/interpretability
   Parameters: {"session_id": "${session_id}", "model_name": "model_type"}

9. **download_model** - When user asks to download/export model
   Parameters: {"session_id": "${session_id}", "model_name": "model_type", "format": "joblib"}

10. **get_model_summary** - When user asks what's been done or current status
    Parameters: {"session_id": "${session_id}"}

GUIDELINES:
1. If the query requires a function call, respond with ONLY the JSON function call
2. If explaining results or chatting, provide conversational responses
3. Always include session_id: "${session_id}" in function parameters
4. After function execution, I will provide results for you to interpret
5. Be specific and actionable in your advice
6. Use markdown formatting for clarity

Cement Industry Knowledge:
${context}

Current Session Context:${sessionContext}${chatHistory}

User Query: ${query}

If this requires a function call, respond with the JSON. Otherwise, provide helpful guidance.`;

    // First call to Gemini to get intent
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: systemPrompt
    });

    let responseText = result.text || '';
    const functionResults: any[] = [];

    // Check if response contains a function call (JSON format)
    const jsonMatch = responseText.match(/\{[\s\S]*"function"[\s\S]*\}/);
    
    if (jsonMatch) {
      try {
        const functionCall = JSON.parse(jsonMatch[0]);
        
        // Execute the function
        const funcResult = await callMLFunction(functionCall.function, functionCall.parameters);
        functionResults.push({
          name: functionCall.function,
          args: functionCall.parameters,
          result: funcResult
        });

        // Get interpretation from Gemini
        const interpretPrompt = `${systemPrompt}

Function Call Made:
${JSON.stringify(functionCall, null, 2)}

Function Results:
${JSON.stringify(funcResult, null, 2)}

Based on these results, provide a clear, professional explanation to the user. Include:
1. What was analyzed/trained
2. Key findings or metrics
3. Interpretation of results
4. Recommendations for next steps

Format your response in markdown with appropriate sections.`;

        const followUpResult = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: interpretPrompt
        });

        responseText = followUpResult.text || 'Function executed successfully.';
      } catch (parseError) {
        console.error('Failed to parse or execute function:', parseError);
        // If JSON parsing fails, treat as regular response
      }
    }

    res.status(200).json({ 
      answer: responseText,
      functionCalls: functionResults,
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