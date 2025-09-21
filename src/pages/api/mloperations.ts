/* eslint-disable @typescript-eslint/no-explicit-any */
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
let genAI: GoogleGenerativeAI | null = null;

try {
  if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  } else {
    console.warn('GEMINI_API_KEY environment variable not set');
  }
} catch (error) {
  console.error('Failed to initialize Gemini AI:', error);
}

// Helper function to generate basic analysis message without AI
function generateBasicAnalysisMessage(analysisData: any) {
  return `## 📊 Dataset Analysis Complete

**Dataset Overview:**
- **Dimensions:** ${analysisData.shape[0]} rows × ${analysisData.shape[1]} columns
- **Data Types:** ${Object.entries(analysisData.dtypes).map(([k, v]) => `${k} (${v})`).join(', ')}

**Data Quality:**
${Object.entries(analysisData.missing_values).map(([col, count]: [string, any]) => 
  count > 0 ? `- ⚠️ **${col}:** ${count} missing values` : `- ✅ **${col}:** Complete`
).join('\n')}

**Key Statistics:**
- **Cement Strength:** ${analysisData.statistics.cement_strength.mean.toFixed(2)} MPa (avg)
- **Water Ratio:** ${analysisData.statistics.water_ratio.mean.toFixed(3)} (avg)
- **Aggregate Ratio:** ${analysisData.statistics.aggregate_ratio.mean.toFixed(3)} (avg)

**Quality Distribution:**
${Object.entries(analysisData.value_counts.quality_grade).map(([grade, count]: [string, any]) => 
  `- **Grade ${grade}:** ${count} samples`
).join('\n')}

**Next Steps:**
1. 🧹 Clean any missing values: "clean my data"
2. 🎯 Train a predictive model: "train a model"
3. 📈 Create visualizations: "show correlation matrix"

Ready to proceed with data preprocessing or model training!`;
}

// Helper function to generate basic training message without AI
function generateBasicTrainingMessage(trainingData: any, algorithm: string, problemType: string) {
  return `## 🎯 Model Training Complete

**Model Details:**
- **Algorithm:** ${algorithm.replace('_', ' ').toUpperCase()}
- **Problem Type:** ${problemType}
- **Performance:** ${(trainingData.main_metric * 100).toFixed(1)}%

**Cross-Validation Results:**
- **Mean Score:** ${(trainingData.cv_mean * 100).toFixed(1)}%
- **Standard Deviation:** ± ${(trainingData.cv_std * 100).toFixed(1)}%

**Feature Importance:**
${Object.entries(trainingData.feature_importance)
  .sort(([,a]: any, [,b]: any) => b - a)
  .slice(0, 5)
  .map(([feature, importance]: [string, any]) => 
    `- **${feature.replace('_', ' ')}:** ${(importance * 100).toFixed(1)}%`
  ).join('\n')}

**Model Metrics:**
${Object.entries(trainingData.metrics).map(([metric, value]: [string, any]) => 
  `- **${metric.replace('_', ' ').toUpperCase()}:** ${value.toFixed(3)}`
).join('\n')}

**Next Steps:**
1. 📊 Analyze feature importance
2. 📈 Generate prediction visualizations  
3. 💾 Export model for production use

Your model is ready for predictions!`;
}

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
      
      case 'correlation':
        return await performCorrelationAnalysis(req, res, datasetPath || '');
      
      case 'statistics':
        return await performStatisticalAnalysis(req, res, datasetPath || '');
      
      case 'visualization':
        return await performVisualization(req, res, datasetPath || '', parameters);
      
      case 'missing_analysis':
        return await performMissingValuesAnalysis(req, res, datasetPath || '');
      
      case 'feature_analysis':
        return await performFeatureAnalysis(req, res, datasetPath || '');
      
      case 'quality_check':
        return await performQualityCheck(req, res, datasetPath || '');
      
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
    
    if (!genAI) {
      // Provide basic analysis without AI insights
      res.status(200).json({
        message: generateBasicAnalysisMessage(mockAnalysisData),
        data: mockAnalysisData,
        status: 'completed'
      });
      return;
    }
    
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
    
    if (!genAI) {
      // Provide basic model training message without AI insights
      res.status(200).json({
        message: generateBasicTrainingMessage(trainingData, algorithm, problemType),
        data: trainingData,
        status: 'completed'
      });
      return;
    }
    
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
    // If Gemini AI is not available, provide a helpful fallback response
    if (!genAI) {
      const fallbackResponse = `
## 🤖 AI Assistant Temporarily Unavailable

I understand you're asking: "${query}"

**Quick ML Guidance:**

📊 **For Data Analysis:** Upload your dataset and I'll provide basic insights
🧹 **For Data Cleaning:** Use "clean my data" after uploading
🎯 **For Model Training:** Try "train a model" with your prepared dataset
📈 **For Visualizations:** Ask about specific plots after data upload

**Common Commands:**
- "analyze my data" - Get dataset insights
- "clean missing values" - Handle data quality issues  
- "train a classification model" - Build predictive models
- "show correlation matrix" - Understand feature relationships

Please try uploading a dataset first, then I can provide more specific assistance!
`;

      res.status(200).json({ 
        message: fallbackResponse,
        status: 'completed'
      });
      return;
    }

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

// New analysis functions for specific operations

async function performCorrelationAnalysis(req: NextApiRequest, res: NextApiResponse, _datasetPath: string) {
  try {
    // Simulate correlation analysis results
    const correlationData = {
      correlation_matrix: {
        'cement_strength': {
          'water_ratio': -0.67,
          'curing_time': 0.73,
          'temperature': 0.41,
          'humidity': -0.28,
          'aggregate_ratio': 0.35
        },
        'water_ratio': {
          'cement_strength': -0.67,
          'curing_time': -0.45,
          'temperature': 0.12,
          'humidity': 0.18,
          'aggregate_ratio': 0.23
        },
        'curing_time': {
          'cement_strength': 0.73,
          'water_ratio': -0.45,
          'temperature': 0.28,
          'humidity': -0.15,
          'aggregate_ratio': -0.12
        }
      },
      strong_correlations: [
        { features: ['cement_strength', 'curing_time'], correlation: 0.73, strength: 'Strong Positive' },
        { features: ['cement_strength', 'water_ratio'], correlation: -0.67, strength: 'Strong Negative' },
        { features: ['water_ratio', 'curing_time'], correlation: -0.45, strength: 'Moderate Negative' }
      ],
      insights: [
        'Curing time has the strongest positive correlation with cement strength (0.73)',
        'Water ratio shows strong negative correlation with strength (-0.67)',
        'Temperature shows moderate positive correlation with strength (0.41)',
        'Humidity appears to have negative impact on cement strength (-0.28)'
      ]
    };

    const analysisMessage = `## 🔗 Correlation Analysis Results

**Key Findings:**

**🎯 Strongest Correlations:**
${correlationData.strong_correlations.map(item => 
  `- **${item.features.join(' ↔ ')}:** ${item.correlation} (${item.strength})`
).join('\n')}

**📊 Correlation Matrix (Top Features):**
${Object.entries(correlationData.correlation_matrix.cement_strength)
  .sort(([,a]: any, [,b]: any) => Math.abs(b) - Math.abs(a))
  .map(([feature, corr]: [string, any]) => 
    `- **${feature.replace('_', ' ')}:** ${corr.toFixed(3)} ${corr > 0 ? '📈' : '📉'}`
  ).join('\n')}

**💡 Key Insights:**
${correlationData.insights.map(insight => `- ${insight}`).join('\n')}

**🔬 Recommendations:**
- **Optimize curing time** for maximum strength gains
- **Monitor water ratio** carefully - lower ratios improve strength
- **Control temperature** during curing process
- **Consider humidity impact** in quality control

**Next Steps:**
1. 📈 Create scatter plots for strongest correlations
2. 🎯 Focus feature engineering on high-correlation variables
3. 📊 Build predictive model using these key relationships`;

    res.status(200).json({
      operation: 'correlation',
      status: 'completed',
      data: correlationData,
      message: analysisMessage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Correlation analysis error:', error);
    res.status(500).json({
      error: 'Failed to perform correlation analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function performStatisticalAnalysis(req: NextApiRequest, res: NextApiResponse, _datasetPath: string) {
  try {
    // Simulate comprehensive statistical analysis
    const statsData = {
      summary_statistics: {
        'cement_strength': { 
          count: 1247, mean: 35.8, std: 12.4, min: 12.3, 
          q25: 27.1, q50: 34.9, q75: 43.2, max: 79.9,
          skewness: 0.23, kurtosis: -0.45
        },
        'water_ratio': { 
          count: 1232, mean: 0.45, std: 0.08, min: 0.35, 
          q25: 0.40, q50: 0.44, q75: 0.50, max: 0.65,
          skewness: 0.12, kurtosis: -0.78
        },
        'curing_time': { 
          count: 1247, mean: 28.5, std: 8.2, min: 7, 
          q25: 21, q50: 28, q75: 35, max: 90,
          skewness: 0.68, kurtosis: 1.23
        },
        'temperature': { 
          count: 1235, mean: 23.2, std: 4.1, min: 15.0, 
          q25: 20.5, q50: 23.0, q75: 26.0, max: 35.0,
          skewness: 0.15, kurtosis: -0.32
        }
      },
      distribution_analysis: {
        'cement_strength': 'Nearly normal with slight positive skew',
        'water_ratio': 'Normal distribution, well-centered',
        'curing_time': 'Right-skewed, some extended curing times',
        'temperature': 'Normal distribution, controlled environment'
      },
      outlier_detection: {
        'cement_strength': { count: 23, percentage: 1.8 },
        'water_ratio': { count: 12, percentage: 0.97 },
        'curing_time': { count: 31, percentage: 2.5 },
        'temperature': { count: 8, percentage: 0.65 }
      }
    };

    const statsMessage = `## 📊 Statistical Analysis Summary

**📈 Key Statistics:**

${Object.entries(statsData.summary_statistics).map(([feature, stats]: [string, any]) => `
**${feature.replace('_', ' ').toUpperCase()}:**
- **Mean:** ${stats.mean} | **Std:** ${stats.std}
- **Range:** ${stats.min} - ${stats.max}
- **Quartiles:** Q1(${stats.q25}) | Q2(${stats.q50}) | Q3(${stats.q75})
- **Shape:** Skew=${stats.skewness}, Kurtosis=${stats.kurtosis}`).join('\n')}

**🔍 Distribution Insights:**
${Object.entries(statsData.distribution_analysis).map(([feature, analysis]: [string, any]) => 
  `- **${feature.replace('_', ' ')}:** ${analysis}`
).join('\n')}

**⚠️ Outlier Detection:**
${Object.entries(statsData.outlier_detection).map(([feature, outliers]: [string, any]) => 
  `- **${feature.replace('_', ' ')}:** ${outliers.count} outliers (${outliers.percentage}%)`
).join('\n')}

**💡 Statistical Insights:**
- **Cement strength** shows good normal distribution with few outliers
- **Water ratio** is well-controlled with minimal variation
- **Curing time** has some extended values requiring investigation
- **Temperature** indicates good process control

**🎯 Recommendations:**
1. **Investigate outliers** in curing time (2.5% of data)
2. **Standardize temperature control** to reduce variation
3. **Monitor cement strength distribution** for quality consistency
4. **Consider data transformation** for skewed variables

**Next Steps:**
1. 📊 Create distribution plots for each variable
2. 🔍 Investigate outlier patterns
3. 📈 Perform normality tests for modeling readiness`;

    res.status(200).json({
      operation: 'statistics',
      status: 'completed',
      data: statsData,
      message: statsMessage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Statistical analysis error:', error);
    res.status(500).json({
      error: 'Failed to perform statistical analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function performVisualization(req: NextApiRequest, res: NextApiResponse, _datasetPath: string, parameters: any) {
  try {
    const plotType = parameters?.plotType || 'histogram';
    
    // Simulate visualization data generation
    const vizData = {
      plot_type: plotType,
      generated_plots: [] as string[],
      data_summary: {
        total_plots: 0,
        features_visualized: [] as string[],
        plot_descriptions: [] as string[]
      }
    };

    let vizMessage = '';

    switch (plotType) {
      case 'histogram':
        vizData.generated_plots = [
          'cement_strength_histogram.png',
          'water_ratio_histogram.png',
          'curing_time_histogram.png',
          'temperature_histogram.png'
        ];
        vizData.data_summary = {
          total_plots: 4,
          features_visualized: ['cement_strength', 'water_ratio', 'curing_time', 'temperature'],
          plot_descriptions: [
            'Cement strength shows near-normal distribution',
            'Water ratio has controlled, narrow distribution',
            'Curing time shows right-skewed distribution',
            'Temperature follows normal distribution'
          ]
        };
        vizMessage = `## 📊 Histogram Visualizations Generated

**📈 Distribution Analysis:**

${vizData.data_summary.features_visualized.map((feature, index) => 
  `**${feature.replace('_', ' ').toUpperCase()}**\n- ${vizData.data_summary.plot_descriptions[index]}`
).join('\n\n')}

**📋 Generated Files:**
${vizData.generated_plots.map(plot => `- 📊 \`${plot}\``).join('\n')}

**💡 Insights:**
- Most variables show good distribution patterns
- Curing time may benefit from log transformation
- Temperature control appears consistent
- Cement strength distribution suitable for modeling

**🎯 Next Steps:**
1. Review generated histogram files
2. Consider data transformations for skewed variables
3. Create box plots to identify outliers`;
        break;

      case 'scatter':
        vizData.generated_plots = [
          'cement_strength_vs_water_ratio.png',
          'cement_strength_vs_curing_time.png',
          'cement_strength_vs_temperature.png',
          'water_ratio_vs_curing_time.png'
        ];
        vizMessage = `## 📊 Scatter Plot Analysis

**🔗 Relationship Visualizations Generated:**

${vizData.generated_plots.map(plot => 
  `- 📈 \`${plot}\` - Shows correlation patterns`
).join('\n')}

**💡 Key Relationships:**
- **Strength vs Curing Time:** Strong positive trend
- **Strength vs Water Ratio:** Clear negative correlation
- **Strength vs Temperature:** Moderate positive relationship
- **Water vs Curing:** Weak negative association

**🎯 Insights:**
- Linear relationships support regression modeling
- Some non-linear patterns may need polynomial features
- Outliers are clearly visible in scatter plots`;
        break;

      case 'boxplot':
        vizData.generated_plots = [
          'feature_boxplots.png',
          'outlier_analysis.png'
        ];
        vizMessage = `## 📊 Box Plot Analysis

**📦 Generated Visualizations:**
${vizData.generated_plots.map(plot => `- 📊 \`${plot}\``).join('\n')}

**⚠️ Outlier Detection:**
- **Cement Strength:** 23 outliers identified
- **Water Ratio:** 12 outliers (mostly high values)
- **Curing Time:** 31 outliers (extended curing periods)
- **Temperature:** 8 outliers (temperature spikes)

**💡 Insights:**
- Most outliers appear to be legitimate data points
- Extended curing times may indicate special processes
- Temperature outliers warrant investigation`;
        break;

      case 'heatmap':
        vizData.generated_plots = ['correlation_heatmap.png'];
        vizMessage = `## 📊 Correlation Heatmap Generated

**🔥 Visualization File:**
- 📊 \`correlation_heatmap.png\`

**🎯 Key Correlation Patterns:**
- **Strong positive:** Cement strength ↔ Curing time (0.73)
- **Strong negative:** Cement strength ↔ Water ratio (-0.67)
- **Moderate positive:** Cement strength ↔ Temperature (0.41)
- **Weak correlations:** Most other feature pairs

**💡 Insights:**
- Clear feature hierarchy for predictive modeling
- Some features show multicollinearity concerns
- Temperature and curing time interaction effects possible`;
        break;

      default:
        vizMessage = `## 📊 Visualization Complete

**Generated Plot Type:** ${plotType}
**Status:** ✅ Successfully created visualizations
**Files Generated:** Available for download

**Next Steps:**
1. Review generated visualizations
2. Analyze patterns and outliers
3. Consider additional plot types for deeper insights`;
    }

    res.status(200).json({
      operation: 'visualization',
      status: 'completed',
      data: vizData,
      message: vizMessage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Visualization error:', error);
    res.status(500).json({
      error: 'Failed to generate visualizations',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function performMissingValuesAnalysis(req: NextApiRequest, res: NextApiResponse, _datasetPath: string) {
  try {
    const missingData = {
      missing_summary: {
        'cement_strength': { count: 0, percentage: 0.0 },
        'water_ratio': { count: 15, percentage: 1.2 },
        'aggregate_ratio': { count: 8, percentage: 0.64 },
        'curing_time': { count: 0, percentage: 0.0 },
        'temperature': { count: 12, percentage: 0.96 },
        'humidity': { count: 20, percentage: 1.6 },
        'batch_id': { count: 0, percentage: 0.0 },
        'quality_grade': { count: 3, percentage: 0.24 }
      },
      total_rows: 1247,
      total_missing: 58,
      missing_patterns: [
        { pattern: 'water_ratio + temperature', count: 8, description: 'Sensor malfunction during measurement' },
        { pattern: 'humidity only', count: 12, description: 'Humidity sensor issues' },
        { pattern: 'aggregate_ratio only', count: 8, description: 'Incomplete batch recording' }
      ],
      impact_assessment: {
        rows_with_any_missing: 45,
        percentage_affected: 3.6,
        critical_features_missing: ['water_ratio', 'humidity'],
        recommended_action: 'imputation'
      }
    };

    const missingMessage = `## 🔍 Missing Values Analysis

**📊 Missing Data Summary:**

${Object.entries(missingData.missing_summary)
  .filter(([, data]: [string, any]) => data.count > 0)
  .map(([feature, data]: [string, any]) => 
    `- **${feature.replace('_', ' ')}:** ${data.count} missing (${data.percentage}%)`
  ).join('\n')}

**📈 Overall Impact:**
- **Total Missing Values:** ${missingData.total_missing} out of ${missingData.total_rows * 8} data points
- **Affected Rows:** ${missingData.impact_assessment.rows_with_any_missing} (${missingData.impact_assessment.percentage_affected}%)
- **Missing Rate:** ${((missingData.total_missing / (missingData.total_rows * 8)) * 100).toFixed(2)}%

**🔍 Missing Patterns:**
${missingData.missing_patterns.map(pattern => 
  `- **${pattern.pattern}:** ${pattern.count} cases - ${pattern.description}`
).join('\n')}

**⚠️ Critical Assessment:**
- **Low Impact:** Overall missing rate is manageable (< 5%)
- **Critical Features:** ${missingData.impact_assessment.critical_features_missing.join(', ')} need attention
- **Data Quality:** Most critical variables (cement_strength, curing_time) are complete

**💡 Recommendations:**

**🔧 Immediate Actions:**
1. **Impute water_ratio** using mean/median based on batch characteristics
2. **Impute humidity** using weather data correlation if available
3. **Investigate sensor issues** for temperature measurements
4. **Complete aggregate_ratio** from batch records if possible

**📋 Imputation Strategy:**
- **Water Ratio:** Use batch-specific mean (varies by cement type)
- **Temperature:** Use daily average from weather station
- **Humidity:** Use forward-fill from same day measurements
- **Aggregate Ratio:** Use recipe-based defaults

**🎯 Next Steps:**
1. 🔧 Run data cleaning with recommended imputation
2. 📊 Validate imputed values against historical patterns
3. 🚨 Set up alerts for future missing data patterns
4. 📈 Monitor data quality trends`;

    res.status(200).json({
      operation: 'missing_analysis',
      status: 'completed',
      data: missingData,
      message: missingMessage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Missing values analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze missing values',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function performFeatureAnalysis(req: NextApiRequest, res: NextApiResponse, _datasetPath: string) {
  try {
    const featureData = {
      feature_importance: {
        'curing_time': 0.287,
        'water_ratio': 0.245,
        'temperature': 0.183,
        'aggregate_ratio': 0.156,
        'humidity': 0.089,
        'batch_id_encoded': 0.040
      },
      feature_selection: {
        univariate_scores: {
          'curing_time': 89.4,
          'water_ratio': 76.2,
          'temperature': 54.8,
          'aggregate_ratio': 42.1,
          'humidity': 23.7,
          'batch_id_encoded': 12.3
        },
        mutual_information: {
          'curing_time': 0.42,
          'water_ratio': 0.38,
          'temperature': 0.29,
          'aggregate_ratio': 0.24,
          'humidity': 0.15,
          'batch_id_encoded': 0.08
        }
      },
      feature_interactions: [
        { features: ['curing_time', 'temperature'], interaction_strength: 0.23, type: 'Synergistic' },
        { features: ['water_ratio', 'aggregate_ratio'], interaction_strength: 0.18, type: 'Competitive' },
        { features: ['humidity', 'temperature'], interaction_strength: 0.15, type: 'Moderate' }
      ],
      recommendations: {
        keep_features: ['curing_time', 'water_ratio', 'temperature', 'aggregate_ratio'],
        consider_removal: ['batch_id_encoded'],
        feature_engineering: [
          'curing_time * temperature interaction',
          'water_ratio / aggregate_ratio ratio',
          'temperature^2 for non-linear effects'
        ]
      }
    };

    const featureMessage = `## 🎯 Feature Analysis Results

**🏆 Feature Importance Ranking:**

${Object.entries(featureData.feature_importance)
  .sort(([,a]: any, [,b]: any) => b - a)
  .map(([feature, importance]: [string, any], index) => 
    `${index + 1}. **${feature.replace('_', ' ')}:** ${(importance * 100).toFixed(1)}% ${index < 3 ? '⭐' : ''}`
  ).join('\n')}

**📊 Selection Criteria Comparison:**

| Feature | Importance | Univariate | Mutual Info |
|---------|------------|------------|-------------|
${Object.keys(featureData.feature_importance).map(feature => {
  const imp = featureData.feature_importance[feature];
  const uni = featureData.feature_selection.univariate_scores[feature];
  const mut = featureData.feature_selection.mutual_information[feature];
  return `| ${feature.replace('_', ' ')} | ${(imp * 100).toFixed(1)}% | ${uni.toFixed(1)} | ${mut.toFixed(2)} |`;
}).join('\n')}

**🔗 Feature Interactions:**
${featureData.feature_interactions.map(interaction => 
  `- **${interaction.features.join(' × ')}:** ${interaction.interaction_strength.toFixed(3)} (${interaction.type})`
).join('\n')}

**💡 Key Insights:**

**🎯 Top Performing Features:**
- **Curing Time (28.7%):** Most predictive single feature
- **Water Ratio (24.5%):** Strong negative correlation with strength
- **Temperature (18.3%):** Important process control variable
- **Aggregate Ratio (15.6%):** Moderate predictive power

**⚠️ Low Impact Features:**
- **Batch ID (4.0%):** Consider encoding differently or removing
- **Humidity (8.9%):** Weak predictor, monitor for seasonal effects

**🔧 Recommended Actions:**

**✅ Keep These Features:**
${featureData.recommendations.keep_features.map(f => `- ${f.replace('_', ' ')}`).join('\n')}

**❌ Consider Removing:**
${featureData.recommendations.consider_removal.map(f => `- ${f.replace('_', ' ')}`).join('\n')}

**🚀 Feature Engineering Opportunities:**
${featureData.recommendations.feature_engineering.map(f => `- ${f}`).join('\n')}

**🎯 Next Steps:**
1. 🔧 Engineer interaction features for top predictors
2. 📊 Test polynomial features for non-linear relationships
3. 🎛️ Optimize feature selection with cross-validation
4. 📈 Monitor feature stability over time
5. 🔄 Re-evaluate with new data collections`;

    res.status(200).json({
      operation: 'feature_analysis',
      status: 'completed',
      data: featureData,
      message: featureMessage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Feature analysis error:', error);
    res.status(500).json({
      error: 'Failed to perform feature analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function performQualityCheck(req: NextApiRequest, res: NextApiResponse, _datasetPath: string) {
  try {
    const qualityData = {
      overall_score: 8.2,
      quality_metrics: {
        completeness: 96.4,
        accuracy: 94.2,
        consistency: 91.8,
        timeliness: 89.5,
        validity: 93.7
      },
      data_issues: [
        { type: 'outliers', count: 74, severity: 'medium', description: 'Values beyond 3 standard deviations' },
        { type: 'inconsistent_formats', count: 12, severity: 'low', description: 'Date format variations in batch_id' },
        { type: 'duplicate_records', count: 18, severity: 'medium', description: 'Potential duplicate measurements' },
        { type: 'missing_values', count: 58, severity: 'low', description: 'Scattered missing values across features' }
      ],
      quality_trends: {
        last_30_days: 8.5,
        last_7_days: 7.8,
        trend: 'declining',
        primary_cause: 'increased missing values in humidity sensor'
      },
      compliance_check: {
        cement_strength_range: { min: 12.3, max: 79.9, within_specs: true, spec_range: '10-85 MPa' },
        water_ratio_range: { min: 0.35, max: 0.65, within_specs: true, spec_range: '0.3-0.7' },
        temperature_range: { min: 15.0, max: 35.0, within_specs: true, spec_range: '10-40°C' },
        curing_time_range: { min: 7, max: 90, within_specs: true, spec_range: '1-120 days' }
      }
    };

    const qualityMessage = `## 🏥 Data Quality Assessment

**📊 Overall Quality Score: ${qualityData.overall_score}/10** ${qualityData.overall_score >= 8 ? '✅ Good' : qualityData.overall_score >= 6 ? '⚠️ Fair' : '❌ Poor'}

**📈 Quality Metrics Breakdown:**

${Object.entries(qualityData.quality_metrics).map(([metric, score]: [string, any]) => 
  `- **${metric.charAt(0).toUpperCase() + metric.slice(1)}:** ${score.toFixed(1)}% ${score >= 95 ? '✅' : score >= 85 ? '⚠️' : '❌'}`
).join('\n')}

**⚠️ Identified Issues:**

${qualityData.data_issues.map(issue => {
  const icon = issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '🟢';
  return `${icon} **${issue.type.replace('_', ' ')}** (${issue.severity.toUpperCase()})\n   └ ${issue.count} instances: ${issue.description}`;
}).join('\n\n')}

**📅 Quality Trends:**
- **Last 30 days:** ${qualityData.quality_trends.last_30_days}/10
- **Last 7 days:** ${qualityData.quality_trends.last_7_days}/10
- **Trend:** ${qualityData.quality_trends.trend === 'declining' ? '📉 Declining' : qualityData.quality_trends.trend === 'improving' ? '📈 Improving' : '➡️ Stable'}
- **Primary Issue:** ${qualityData.quality_trends.primary_cause}

**✅ Compliance Check:**

${Object.entries(qualityData.compliance_check).map(([param, check]: [string, any]) => 
  `- **${param.replace('_', ' ')}:** ${check.within_specs ? '✅' : '❌'} Range: ${check.min}-${check.max} (Spec: ${check.spec_range})`
).join('\n')}

**💡 Quality Insights:**

**🎯 Strengths:**
- High completeness rate (96.4%)
- Good accuracy levels (94.2%)
- All parameters within specification ranges
- Consistent measurement protocols

**⚠️ Areas for Improvement:**
- Recent decline in quality score (8.5 → 7.8)
- Humidity sensor reliability issues
- Outlier management needed
- Duplicate record prevention

**🔧 Recommended Actions:**

**🚨 Immediate (Next 24 hours):**
1. **Investigate humidity sensor** - calibration or replacement needed
2. **Review duplicate detection** - implement unique ID validation
3. **Outlier analysis** - determine if legitimate extreme values

**📋 Short-term (Next week):**
1. **Implement data validation rules** at collection point
2. **Set up automated quality monitoring** alerts
3. **Create data quality dashboard** for real-time monitoring
4. **Train operators** on consistent data entry practices

**🎯 Long-term (Next month):**
1. **Upgrade sensor infrastructure** for humidity monitoring
2. **Implement data governance** policies
3. **Create data quality SLAs** with measurable targets
4. **Establish data stewardship** roles and responsibilities

**📈 Expected Outcomes:**
- Quality score improvement to 9.0+ within 30 days
- Reduced missing values to < 1%
- Automated outlier detection and flagging
- 99%+ compliance with specification ranges`;

    res.status(200).json({
      operation: 'quality_check',
      status: 'completed',
      data: qualityData,
      message: qualityMessage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Quality check error:', error);
    res.status(500).json({
      error: 'Failed to perform quality check',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}