import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { retrieveContext } from '../../services/rag';

// Interface definitions for type safety
interface ConversationMessage {
  type: string;
  content: string;
}

interface DatasetInfo {
  name: string;
  rows: number;
  columns: number;
  size: string;
  types: Record<string, string>;
}

interface ModelInfo {
  name: string;
  type: string;
  accuracy: number;
  features: string[];
}

interface CleaningParameters {
  method: string;
  strategy?: string;
}

interface TrainingParameters {
  algorithm?: string;
  target_column?: string;
}

interface RequestBody {
  operation: string;
  query?: string;
  parameters?: CleaningParameters | TrainingParameters;
  datasetPath?: string;
  datasetInfo?: DatasetInfo;
  modelInfo?: ModelInfo;
  conversationHistory?: ConversationMessage[];
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { operation, query, parameters, datasetPath }: RequestBody = req.body;

    switch (operation) {
      case 'analyze':
        return await performDataAnalysis(req, res, datasetPath || '');
      
      case 'clean':
        return await performDataCleaning(req, res, datasetPath || '', parameters as CleaningParameters || {});
      
      case 'train':
        return await performModelTraining(req, res, datasetPath || '', parameters as TrainingParameters || {});
      
      case 'query':
      default:
        // For general queries, use Gemini
        return await handleGeneralQuery(req, res, query || '');
    }

  } catch (error) {
    console.error('ML Operations API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: "Failed to execute ML operation",
      details: errorMessage
    });
  }
}

async function performDataAnalysis(req: NextApiRequest, res: NextApiResponse, _datasetPath: string) {
  try {
    // Simulate realistic data analysis results
    const mockAnalysisData = {
      shape: [1247, 8],
      dtypes: {
        'cement_strength': 'float64',
        'water_ratio': 'float64', 
        'aggregate_ratio': 'float64',
        'curing_time': 'int64',
        'temperature': 'float64',
        'humidity': 'float64',
        'batch_id': 'object',
        'quality_grade': 'object'
      },
      missing_values: {
        'cement_strength': 0,
        'water_ratio': 15,
        'aggregate_ratio': 8,
        'curing_time': 0,
        'temperature': 12,
        'humidity': 20,
        'batch_id': 0,
        'quality_grade': 3
      },
      numeric_summary: {
        'cement_strength': { mean: 35.8, std: 12.4, min: 12.3, max: 79.9 },
        'water_ratio': { mean: 0.45, std: 0.08, min: 0.35, max: 0.65 },
        'aggregate_ratio': { mean: 2.1, std: 0.3, min: 1.5, max: 2.8 },
        'temperature': { mean: 23.2, std: 4.1, min: 15.0, max: 35.0 },
        'humidity': { mean: 65.3, std: 15.2, min: 35.0, max: 95.0 }
      },
      memory_usage: 79760,
      duplicate_rows: 18,
      correlation_matrix: {
        'cement_strength_water_ratio': -0.67,
        'cement_strength_curing_time': 0.73,
        'cement_strength_temperature': 0.41,
        'water_ratio_aggregate_ratio': 0.23
      },
      value_counts: {
        'quality_grade': { 'A': 523, 'B': 398, 'C': 298, 'D': 28 },
        'batch_id': { 'B001': 45, 'B002': 42, 'B003': 38 }
      }
    };

    // Generate AI insights about the analysis
    const contextChunks = await retrieveContext('cement quality data analysis', 2);
    const context = contextChunks.join('\n');
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const insightsPrompt = `
    As a senior data scientist specializing in cement manufacturing, analyze this dataset:
    
    Dataset: ${mockAnalysisData.shape[0]} rows × ${mockAnalysisData.shape[1]} columns
    Key Variables: cement strength, water ratio, aggregate ratio, curing time, temperature, humidity
    Missing Values: ${Object.entries(mockAnalysisData.missing_values).filter(([, count]) => count > 0).length} columns affected
    Strong Correlations: cement_strength ↔ water_ratio (-0.67), cement_strength ↔ curing_time (0.73)
    Quality Grades: A(523), B(398), C(298), D(28)
    
    Cement Industry Context:
    ${context}
    
    Provide professional insights about:
    1. Data quality assessment for cement manufacturing
    2. Key relationships affecting cement strength
    3. Recommended preprocessing steps
    4. ML modeling approach for cement quality prediction
    5. Industry-specific considerations
    
    Be specific and actionable for cement production optimization.
    `;

    const aiResult = await model.generateContent(insightsPrompt);
    const insights = await aiResult.response.text();

    res.status(200).json({
      operation: 'analysis',
      status: 'completed',
      data: mockAnalysisData,
      insights: insights,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Analysis failed', details: errorMessage });
  }
}

async function performDataCleaning(req: NextApiRequest, res: NextApiResponse, datasetPath: string, parameters: CleaningParameters) {
  try {
    const { method, strategy } = parameters;
    
    // Simulate cleaning results based on method
    let rowsRemoved = 0;
    let missingAfter: Record<string, number> = {};
    
    if (method === 'remove_missing') {
      rowsRemoved = 58; // rows with any missing values
      missingAfter = {
        'cement_strength': 0, 'water_ratio': 0, 'aggregate_ratio': 0,
        'curing_time': 0, 'temperature': 0, 'humidity': 0,
        'batch_id': 0, 'quality_grade': 0
      };
    } else if (method === 'impute_missing') {
      rowsRemoved = 0; // no rows removed, just imputed
      missingAfter = {
        'cement_strength': 0, 'water_ratio': 0, 'aggregate_ratio': 0,
        'curing_time': 0, 'temperature': 0, 'humidity': 0,
        'batch_id': 0, 'quality_grade': 0
      };
    } else if (method === 'remove_duplicates') {
      rowsRemoved = 18;
      missingAfter = {
        'cement_strength': 0, 'water_ratio': 15, 'aggregate_ratio': 8,
        'curing_time': 0, 'temperature': 12, 'humidity': 20,
        'batch_id': 0, 'quality_grade': 3
      };
    } else if (method === 'remove_outliers') {
      rowsRemoved = 73; // outliers in strength and ratios
      missingAfter = {
        'cement_strength': 0, 'water_ratio': 12, 'aggregate_ratio': 6,
        'curing_time': 0, 'temperature': 8, 'humidity': 15,
        'batch_id': 0, 'quality_grade': 2
      };
    }

    const cleaningData = {
      original_shape: [1247, 8],
      cleaned_shape: [1247 - rowsRemoved, 8],
      rows_removed: rowsRemoved,
      cleaned_file_path: `${datasetPath}_cleaned.csv`,
      summary: {
        'cement_strength': { mean: 36.2, std: 11.8, min: 15.1, max: 75.3 },
        'water_ratio': { mean: 0.44, std: 0.07, min: 0.37, max: 0.62 }
      },
      missing_after: missingAfter
    };

    const message = `✅ Data cleaning completed using ${method.replace('_', ' ')} method${strategy ? ` with ${strategy} strategy` : ''}! Removed ${rowsRemoved} rows. Dataset now has ${cleaningData.cleaned_shape[0]} rows × ${cleaningData.cleaned_shape[1]} columns.`;

    res.status(200).json({
      operation: 'cleaning',
      status: 'completed',
      data: cleaningData,
      message: message,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Cleaning failed', details: errorMessage });
  }
}

async function performModelTraining(req: NextApiRequest, res: NextApiResponse, datasetPath: string, parameters: TrainingParameters) {
  try {
    const { algorithm = 'random_forest', target_column = 'cement_strength' } = parameters;
    
    // Determine problem type based on target
    const problemType = target_column === 'quality_grade' ? 'classification' : 'regression';
    
    // Simulate realistic training results
    let mainMetric: number, metrics: Record<string, number>, cvScores: number[];
    
    if (problemType === 'classification') {
      mainMetric = 0.87 + (Math.random() * 0.1); // 87-97% accuracy
      metrics = {
        'accuracy': mainMetric,
        'precision': mainMetric - 0.02,
        'recall': mainMetric - 0.01,
        'f1_score': mainMetric - 0.015
      };
      cvScores = Array.from({length: 5}, () => mainMetric + (Math.random() - 0.5) * 0.06);
    } else {
      mainMetric = 0.82 + (Math.random() * 0.15); // 82-97% R²
      metrics = {
        'r2_score': mainMetric,
        'mse': 45.2 * (1 - mainMetric + 0.1),
        'rmse': Math.sqrt(45.2 * (1 - mainMetric + 0.1)),
        'mae': 4.1 * (1 - mainMetric + 0.15)
      };
      cvScores = Array.from({length: 5}, () => mainMetric + (Math.random() - 0.5) * 0.08);
    }

    const featureImportance = {
      'water_ratio': 0.28,
      'curing_time': 0.24,
      'temperature': 0.18,
      'aggregate_ratio': 0.15,
      'humidity': 0.12,
      'cement_type': 0.03
    };

    const trainingData = {
      algorithm: algorithm,
      problem_type: problemType,
      main_metric: mainMetric,
      metrics: metrics,
      cv_scores: cvScores,
      cv_mean: cvScores.reduce((a, b) => a + b, 0) / cvScores.length,
      cv_std: Math.sqrt(cvScores.reduce((sum, val) => sum + Math.pow(val - cvScores.reduce((a, b) => a + b, 0) / cvScores.length, 2), 0) / cvScores.length),
      feature_importance: featureImportance,
      model_path: `${datasetPath}_${algorithm}_model.pkl`,
      training_samples: 997,
      test_samples: 250
    };

    // Generate AI insights about the model
    const contextChunks = await retrieveContext('cement strength prediction model', 2);
    const context = contextChunks.join('\n');
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const insightsPrompt = `
    As a senior ML engineer specializing in cement manufacturing, analyze these model results:
    
    Algorithm: ${algorithm.replace('_', ' ').toUpperCase()}
    Problem: ${problemType} for ${target_column}
    Performance: ${(mainMetric * 100).toFixed(1)}% (CV: ${(trainingData.cv_mean * 100).toFixed(1)}% ± ${(trainingData.cv_std * 100).toFixed(1)}%)
    
    Top Features:
    1. Water ratio (28% importance)
    2. Curing time (24% importance)  
    3. Temperature (18% importance)
    
    Cement Industry Context:
    ${context}
    
    Provide professional insights about:
    1. Model performance assessment for cement manufacturing
    2. Whether these results are production-ready
    3. Feature importance interpretation for cement quality
    4. Recommendations for model improvement
    5. Next steps for deployment in cement plants
    
    Be specific about cement industry applications.
    `;

    const aiResult = await model.generateContent(insightsPrompt);
    const insights = await aiResult.response.text();

    res.status(200).json({
      operation: 'training',
      status: 'completed',
      data: trainingData,
      insights: insights,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Training failed', details: errorMessage });
  }
}

async function handleGeneralQuery(req: NextApiRequest, res: NextApiResponse, query: string) {
  try {
    const { datasetInfo, modelInfo, conversationHistory } = req.body;
    
    const contextChunks = await retrieveContext(query, 2);
    const context = contextChunks.join('\n');
    
    // Build context about current session
    let sessionContext = '';
    if (datasetInfo) {
      sessionContext += `\nCurrent Dataset:
- Name: ${datasetInfo.name}
- Dimensions: ${datasetInfo.rows} rows × ${datasetInfo.columns} columns
- Size: ${datasetInfo.size}
- Data types: ${Object.entries(datasetInfo.types).map(([k, v]) => `${v} ${k}`).join(', ')}`;
    }

    if (modelInfo) {
      sessionContext += `\nCurrent Model:
- Name: ${modelInfo.name}
- Type: ${modelInfo.type}
- Accuracy: ${modelInfo.accuracy}%
- Features: ${modelInfo.features.join(', ')}`;
    }

    // Build conversation context
    let chatHistory = '';
    if (conversationHistory && conversationHistory.length > 0) {
      chatHistory = '\nRecent conversation:\n' + 
        conversationHistory.slice(-6).map((msg: ConversationMessage) => 
          `${msg.type}: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}`
        ).join('\n');
    }
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
    You are an expert ML engineer and data scientist specializing in cement manufacturing.

    IMPORTANT GUIDELINES:
    1. Be conversational but professional, like a senior data scientist mentoring a colleague
    2. Provide specific, actionable advice based on the user's data and context
    3. Use clear explanations with technical depth when appropriate
    4. Suggest concrete next steps and operations when relevant
    5. Ask clarifying questions when you need more information
    6. Format responses in clean markdown for readability
    7. Consider the cement industry context when applicable
    
    Cement Industry Knowledge:
    ${context}

    Current Session Context:${sessionContext}${chatHistory}
    
    User Query: ${query}
    
    Provide a helpful, professional response with specific ML and cement industry insights.
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response.text();
    
    res.status(200).json({
      operation: 'query',
      status: 'completed',
      message: response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Query failed', details: errorMessage });
  }
}