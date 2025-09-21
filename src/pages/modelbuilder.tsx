/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useRef } from 'react';
import { useRequireAuth } from '../hooks/useAuth';
import ReactMarkdown from 'react-markdown';
import { 
  Box, 
  Typography, 
  Paper, 
  TextField, 
  IconButton, 
  Button,
  Chip,
  LinearProgress,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  Alert
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import DatasetIcon from '@mui/icons-material/Dataset';
import ModelTrainingIcon from '@mui/icons-material/ModelTraining';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import Person2Icon from '@mui/icons-material/Person2';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import TuneIcon from '@mui/icons-material/Tune';
import TimelineIcon from '@mui/icons-material/Timeline';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import { accent, cardBg, textColor, textColor2, textColor3, gradientBg, glowBg1, glowBg2, glowBg3, glowBg4, shadowDrop, col1, col2, col3, col4, glowCol1, glowCol2, glowCol3, glowCol4 } from '../components/ColorPalette';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  data?: any;
  actionType?: 'upload' | 'analysis' | 'cleaning' | 'preprocessing' | 'training' | 'export' | 'visualization';
  progress?: number;
  status?: 'pending' | 'processing' | 'completed' | 'error';
}

interface DatasetInfo {
  name: string;
  rows: number;
  columns: number;
  size: string;
  types: Record<string, number>;
  missingValues: Record<string, number>;
  preview: any[];
}

interface ModelInfo {
  name: string;
  type: string;
  accuracy: number;
  features: string[];
  target: string;
  metrics: Record<string, number>;
  status: 'training' | 'completed' | 'error';
}

export default function ModelBuilder() {
  const { user, loading: authLoading } = useRequireAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'assistant',
      content: '🤖 **Welcome to the AI-Powered ML Model Builder!**\n\nI can help you with the complete ML pipeline:\n\n📊 **Data Upload & Analysis** - CSV, Excel, JSON support\n🧹 **Data Cleaning & Preprocessing** - Handle missing values, outliers\n🔍 **Exploratory Data Analysis** - Statistical insights, visualizations\n🤖 **Model Training & Optimization** - AutoML, hyperparameter tuning\n📈 **Model Evaluation & Export** - Performance metrics, model download\n\n**Quick Start:**\n• Upload your dataset using the button above\n• Ask "analyze my data" for insights\n• Say "train a model" to start ML training\n• Type "clean my data" for preprocessing\n\nWhat would you like to do first?',
      timestamp: new Date('2024-01-01T12:00:00'),
      actionType: 'analysis'
    }
  ]);
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentDataset, setCurrentDataset] = useState<DatasetInfo | null>(null);
  const [currentModel, setCurrentModel] = useState<ModelInfo | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Format timestamp consistently to avoid hydration issues
  const formatTimestamp = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };
  
  const scrollToBottom = () => {
    // Use setTimeout to ensure DOM has updated
    setTimeout(() => {
      if (messagesEndRef.current) {
        const container = messagesEndRef.current.closest('[data-scrollable]');
        if (container) {
          // Scroll within the chat container only
          messagesEndRef.current.scrollIntoView({ 
            behavior: "smooth", 
            block: "end",
            inline: "nearest"
          });
        } else {
          // Fallback: scroll within the messages container
          messagesEndRef.current.scrollIntoView({ 
            behavior: "smooth",
            block: "nearest"
          });
        }
      }
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Body margin effect
    useEffect(() => {
      document.body.style.margin = '0';
      return () => { document.body.style.margin = ''; };
    }, []);

  // Show loading spinner while checking authentication
  if (authLoading) {
      return (
        <Box sx={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1e1a2e 0%, #16213e 100%)',
        }}>
          {/* CSS Spinner */}
          <Box sx={{
            width: 50,
            height: 50,
            border: '4px solid rgba(106, 130, 251, 0.2)',
            borderTop: '4px solid #6a82fb',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            mb: 2
          }} />
          
          {/* CSS Animation */}
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </Box>
      );
    }

  // If not authenticated, useRequireAuth will redirect to login
  if (!user) {
    return null;
  }

    
  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    const userInput = input;
    setInput('');
    setIsLoading(true);
    
    try {
      // Determine if this is an operation or general query
      const operation = detectOperation(userInput);
      
      if (operation) {
        // Check if operation needs dataset but none is uploaded
        if ((operation as any).needsDataset) {
          const needsDatasetMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            type: 'assistant',
            content: `## 📂 Dataset Required

                I'd love to help you **${operation.type}** your data, but I need a dataset first!

                **To get started:**
                1. Click the **"Upload Dataset"** button above
                2. Choose a CSV, Excel, or JSON file
                3. I'll automatically analyze it and then we can proceed with ${operation.type === 'analyze' ? 'detailed analysis' : operation.type === 'clean' ? 'data cleaning' : 'model training'}

                **Supported formats:**
                - 📊 **CSV files** - Most common data format
                - 📈 **Excel files** - .xlsx format
                - 📋 **JSON files** - Structured data

                Once you upload your data, just ask me again and I'll ${operation.type === 'analyze' ? 'show you comprehensive insights!' : operation.type === 'clean' ? 'clean it for you!' : 'train a model for you!'}`,
            timestamp: new Date(),
            actionType: 'upload'
          };
          
          setMessages(prev => [...prev, needsDatasetMessage]);
          setIsLoading(false);
          return;
        }
        
        // Execute ML operation
        const response = await fetch('/api/mloperations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operation: operation.type,
            parameters: operation.parameters,
            datasetPath: currentDataset?.name ? `./uploads/${currentDataset.name}` : undefined,
            query: userInput
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to execute ML operation');
        }

        const data = await response.json();
        
        const aiResponse: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: formatOperationResponse(data),
          timestamp: new Date(),
          actionType: operation.type as any,
          data: data.data,
          status: data.status
        };
        
        setMessages(prev => [...prev, aiResponse]);
        
        // Update dataset/model info if operation was successful
        if (data.status === 'completed') {
          if (operation.type === 'analyze' && data.data) {
            setCurrentDataset(prev => prev ? {
              ...prev,
              rows: data.data.shape[0],
              columns: data.data.shape[1],
              types: data.data.dtypes
            } : prev);
          }
          
          if (operation.type === 'train' && data.data) {
            setCurrentModel({
              name: `${data.data.algorithm}_model`,
              type: data.data.problem_type,
              accuracy: data.data.main_metric * 100,
              features: Object.keys(data.data.feature_importance || {}),
              target: 'target',
              metrics: data.data.metrics,
              status: 'completed'
            });
          }
        }
        
      } else {
        // General conversation - also use mloperations with query type
        const response = await fetch('/api/mloperations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operation: 'query',
            query: userInput,
            datasetInfo: currentDataset,
            modelInfo: currentModel,
            conversationHistory: messages.slice(-10)
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get AI response');
        }

        const data = await response.json();
        
        const aiResponse: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: data.message,
          timestamp: new Date(),
          actionType: determineActionType(userInput)
        };
        
        setMessages(prev => [...prev, aiResponse]);
      }
      
    } catch (error) {
      console.error('Error processing request:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: '⚠️ Sorry, I encountered an error processing your request. Please try again or rephrase your question.',
        timestamp: new Date(),
        status: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Detect if user input is requesting a specific ML operation
  const detectOperation = (input: string) => {
    const lowerInput = input.toLowerCase();
    
    // Correlation analysis
    if (lowerInput.includes('correlation') || lowerInput.includes('correlation matrix') || 
        lowerInput.includes('correlation analysis') || lowerInput.includes('show correlations')) {
      if (!currentDataset) {
        return { type: 'correlation', parameters: {}, needsDataset: true };
      }
      return { type: 'correlation', parameters: {} };
    }
    
    // Statistical analysis
    if (lowerInput.includes('statistics') || lowerInput.includes('stats') || 
        lowerInput.includes('describe') || lowerInput.includes('summary')) {
      if (!currentDataset) {
        return { type: 'statistics', parameters: {}, needsDataset: true };
      }
      return { type: 'statistics', parameters: {} };
    }
    
    // Distribution analysis
    if (lowerInput.includes('distribution') || lowerInput.includes('histogram') || 
        lowerInput.includes('plot') || lowerInput.includes('visualize')) {
      if (!currentDataset) {
        return { type: 'visualization', parameters: {}, needsDataset: true };
      }
      
      let plotType = 'histogram';
      if (lowerInput.includes('scatter')) plotType = 'scatter';
      if (lowerInput.includes('box')) plotType = 'boxplot';
      if (lowerInput.includes('heatmap')) plotType = 'heatmap';
      
      return { type: 'visualization', parameters: { plotType } };
    }
    
    // Missing values analysis
    if (lowerInput.includes('missing') && (lowerInput.includes('analyze') || lowerInput.includes('show') || lowerInput.includes('check'))) {
      if (!currentDataset) {
        return { type: 'missing_analysis', parameters: {}, needsDataset: true };
      }
      return { type: 'missing_analysis', parameters: {} };
    }
    
    // Feature importance/selection
    if (lowerInput.includes('feature') && (lowerInput.includes('importance') || lowerInput.includes('selection') || lowerInput.includes('relevant'))) {
      if (!currentDataset) {
        return { type: 'feature_analysis', parameters: {}, needsDataset: true };
      }
      return { type: 'feature_analysis', parameters: {} };
    }
    
    // Data quality assessment
    if (lowerInput.includes('quality') || lowerInput.includes('assess') || 
        lowerInput.includes('data health') || lowerInput.includes('data issues')) {
      if (!currentDataset) {
        return { type: 'quality_check', parameters: {}, needsDataset: true };
      }
      return { type: 'quality_check', parameters: {} };
    }
    
    // Basic analyze operation
    if (lowerInput.includes('analyze') || lowerInput.includes('analyse') || 
        lowerInput.includes('analyze my data') || lowerInput.includes('show me the data')) {
      if (!currentDataset) {
        return { type: 'analyze', parameters: {}, needsDataset: true };
      }
      return { type: 'analyze', parameters: {} };
    }
    
    // Data cleaning operations
    if (lowerInput.includes('clean') || lowerInput.includes('remove missing') || 
        lowerInput.includes('handle missing values')) {
      if (!currentDataset) {
        return { type: 'clean', parameters: {}, needsDataset: true };
      }
      
      let method = 'impute_missing';
      let strategy = 'mean';
      
      if (lowerInput.includes('remove') || lowerInput.includes('drop')) method = 'remove_missing';
      if (lowerInput.includes('median')) strategy = 'median';
      if (lowerInput.includes('mode')) strategy = 'mode';
      if (lowerInput.includes('outlier')) method = 'remove_outliers';
      if (lowerInput.includes('duplicate')) method = 'remove_duplicates';
      
      return { type: 'clean', parameters: { method, strategy } };
    }
    
    // Model training
    if (lowerInput.includes('train') || lowerInput.includes('build a model') || 
        lowerInput.includes('create a model')) {
      if (!currentDataset) {
        return { type: 'train', parameters: {}, needsDataset: true };
      }
      
      let algorithm = 'random_forest';
      
      if (lowerInput.includes('logistic')) algorithm = 'logistic_regression';
      if (lowerInput.includes('linear')) algorithm = 'linear_regression';
      if (lowerInput.includes('svm') || lowerInput.includes('support vector')) algorithm = 'svm';
      
      // Try to extract target column from input
      const targetMatch = lowerInput.match(/target[:\s]+([a-zA-Z_][a-zA-Z0-9_]*)/);
      const target_column = targetMatch ? targetMatch[1] : 'cement_strength';
      
      return { type: 'train', parameters: { algorithm, target_column } };
    }
    
    return null;
  };

  // Format operation response for display
  const formatOperationResponse = (data: any) => {
    switch (data.operation) {
      case 'analysis':
        return `## 📊 Data Analysis Complete!

**Dataset Overview:**
- **Shape:** ${data.data.shape[0].toLocaleString()} rows × ${data.data.shape[1]} columns
- **Memory Usage:** ${(data.data.memory_usage / 1024 / 1024).toFixed(2)} MB
- **Duplicate Rows:** ${data.data.duplicate_rows.toLocaleString()}
- **Missing Values:** ${Object.entries(data.data.missing_values).filter(([col, count]: [string, any]) => count > 0).length} columns affected

**Data Types:**
${Object.entries(data.data.dtypes).map(([col, type]: [string, any]) => `- **${col}:** ${type}`).join('\n')}

**AI Insights:**
${data.insights}

**Next Steps:**
- Type "clean my data" to handle missing values
- Say "train a model" to start ML modeling
- Ask "show correlations" for feature relationships`;

      case 'cleaning':
        return `## 🧹 Data Cleaning Complete!

**Cleaning Results:**
- **Original Shape:** ${data.data.original_shape[0].toLocaleString()} rows × ${data.data.original_shape[1]} columns
- **Cleaned Shape:** ${data.data.cleaned_shape[0].toLocaleString()} rows × ${data.data.cleaned_shape[1]} columns
- **Rows Removed:** ${data.data.rows_removed.toLocaleString()}

**Remaining Missing Values:**
${Object.entries(data.data.missing_after).filter(([col, count]: [string, any]) => count > 0).map(([col, count]: [string, any]) => `- **${col}:** ${count}`).join('\n') || 'None - dataset is now complete!'}

${data.message}

**Next Steps:**
- Type "analyze my data" to see updated statistics
- Say "train a model with target [column_name]" to start modeling`;

      case 'training':
        return `## 🤖 Model Training Complete!

**Model Performance:**
- **Algorithm:** ${data.data.algorithm.replace('_', ' ').toUpperCase()}
- **Problem Type:** ${data.data.problem_type}
- **Main Metric:** ${(data.data.main_metric * 100).toFixed(2)}%
- **Cross-Validation:** ${(data.data.cv_mean * 100).toFixed(2)}% ± ${(data.data.cv_std * 100).toFixed(2)}%

**Training Details:**
- **Training Samples:** ${data.data.training_samples.toLocaleString()}
- **Test Samples:** ${data.data.test_samples.toLocaleString()}

**Feature Importance:**
${Object.entries(data.data.feature_importance || {})
  .sort(([,a]: [string, any], [,b]: [string, any]) => b - a)
  .slice(0, 5)
  .map(([feature, importance]: [string, any], index) => `${index + 1}. **${feature}:** ${(importance * 100).toFixed(1)}%`)
  .join('\n')}

**AI Analysis:**
${data.insights}

**Next Steps:**
- Type "export my model" to download the trained model
- Ask "how can I improve this model?" for optimization tips`;

      default:
        return data.message || data.insights || 'Operation completed successfully!';
    }
  };

  // Helper function to determine action type from user input
  const determineActionType = (input: string): 'upload' | 'analysis' | 'cleaning' | 'preprocessing' | 'training' | 'export' | 'visualization' => {
    const lowerInput = input.toLowerCase();
    if (lowerInput.includes('upload') || lowerInput.includes('data') || lowerInput.includes('dataset')) return 'upload';
    if (lowerInput.includes('clean') || lowerInput.includes('missing') || lowerInput.includes('preprocess')) return 'cleaning';
    if (lowerInput.includes('train') || lowerInput.includes('model') || lowerInput.includes('algorithm')) return 'training';
    if (lowerInput.includes('analyze') || lowerInput.includes('explore') || lowerInput.includes('visualize')) return 'analysis';
    if (lowerInput.includes('export') || lowerInput.includes('download') || lowerInput.includes('save')) return 'export';
    return 'analysis';
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      
      const uploadMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'system',
        content: `📁 **File Uploaded:** ${file.name}\n📊 **Size:** ${(file.size / 1024 / 1024).toFixed(2)} MB\n🔄 **Status:** Processing...\n\nAnalyzing data structure and generating insights...`,
        timestamp: new Date(),
        actionType: 'upload',
        status: 'processing'
      };
      
      setMessages(prev => [...prev, uploadMessage]);
      
      // Simulate dataset analysis
      setTimeout(() => {
        const mockDataset: DatasetInfo = {
          name: file.name,
          rows: 1000 + Math.floor(Math.random() * 5000),
          columns: 5 + Math.floor(Math.random() * 15),
          size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
          types: {
            'Numerical': Math.floor(Math.random() * 8) + 2,
            'Categorical': Math.floor(Math.random() * 5) + 1,
            'DateTime': Math.floor(Math.random() * 2),
            'Boolean': Math.floor(Math.random() * 2)
          },
          missingValues: {
            'Column_A': Math.floor(Math.random() * 50),
            'Column_B': Math.floor(Math.random() * 30),
            'Column_C': Math.floor(Math.random() * 10)
          },
          preview: []
        };
        
        setCurrentDataset(mockDataset);
        
        const analysisMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: `✅ **Dataset Analysis Complete!**\n\n📊 **${mockDataset.name}**\n• **Dimensions:** ${mockDataset.rows.toLocaleString()} rows × ${mockDataset.columns} columns\n• **File Size:** ${mockDataset.size}\n• **Data Types:** ${Object.entries(mockDataset.types).map(([k, v]) => `${v} ${k}`).join(', ')}\n• **Missing Values:** Found in ${Object.keys(mockDataset.missingValues).length} columns\n• **Memory Usage:** ~${(mockDataset.rows * mockDataset.columns * 8 / 1024 / 1024).toFixed(1)} MB\n\n**Quick Stats:**\n• Data quality: ${Math.floor(Math.random() * 20) + 75}% complete\n• Potential target columns: ${Math.floor(Math.random() * 3) + 1} identified\n• Recommended preprocessing: ${Math.floor(Math.random() * 4) + 2} steps\n\n🎯 **Suggested Next Steps:**\n• "Analyze my data" - Deep dive into patterns\n• "Clean my data" - Handle missing values\n• "Train a model" - Start ML modeling\n• "Show data preview" - View sample rows`,
          timestamp: new Date(),
          data: mockDataset,
          actionType: 'analysis',
          status: 'completed'
        };
        
        setMessages(prev => [...prev, analysisMessage]);
      }, 2500);
    }
  };

  const getActionIcon = (actionType?: string) => {
    switch (actionType) {
      case 'upload': return <UploadFileIcon sx={{ color: glowCol1, fontSize: 18 }} />;
      case 'analysis': return <AnalyticsIcon sx={{ color: glowCol2, fontSize: 18 }} />;
      case 'cleaning': return <CleaningServicesIcon sx={{ color: glowCol3, fontSize: 18 }} />;
      case 'preprocessing': return <TuneIcon sx={{ color: glowCol4, fontSize: 18 }} />;
      case 'training': return <ModelTrainingIcon sx={{ color: glowCol1, fontSize: 18 }} />;
      case 'export': return <FileDownloadIcon sx={{ color: glowCol2, fontSize: 18 }} />;
      case 'visualization': return <TimelineIcon sx={{ color: glowCol3, fontSize: 18 }} />;
      default: return <SmartToyIcon sx={{ color: accent, fontSize: 18 }} />;
    }
  };

  const renderMessage = (message: ChatMessage) => (
    <Box
      key={message.id}
      sx={{
        display: 'flex',
        justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
        mb: 3,
        alignItems: 'flex-start',
        gap: 1.5
      }}
    >
      {message.type !== 'user' && (
        <Box sx={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          background: message.type === 'system' ? glowBg3 : glowBg1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mt: 0.5,
          boxShadow: message.type === 'system' ? `0 0 20px ${glowCol3}40` : `0 0 20px ${glowCol1}40`
        }}>
          {message.type === 'system' ? getActionIcon(message.actionType) : <SmartToyIcon sx={{ color: 'white', fontSize: 20 }} />}
        </Box>
      )}
      
      <Paper
        sx={{
          p: 3,
          maxWidth: '75%',
          background: message.type === 'user' ? cardBg : 
                     message.type === 'system' ? `${glowBg3}60` : cardBg,
          border: message.type === 'user' ? `1px solid ${glowCol2}` :
                  message.type === 'system' ? `1px solid ${glowCol3}` : `1px solid ${accent}40`,
          borderRadius: 4,
          boxShadow: message.type === 'user' ? `0 4px 20px ${glowCol2}20` :
                     message.type === 'system' ? `0 4px 20px ${glowCol3}20` : `0 4px 20px ${accent}20`
        }}
      >
        {message.status === 'processing' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <CircularProgress size={16} sx={{ color: accent }} />
            <Typography sx={{ color: textColor3, fontSize: 13, fontWeight: 500 }}>
              Processing...
            </Typography>
          </Box>
        )}
        
        <Box
          sx={{
            color: textColor,
            fontSize: 14,
            lineHeight: 1.7,
            fontFamily: `'Montserrat', sans-serif`,
            fontWeight: 400,
            '& h1': { fontSize: 18, fontWeight: 600, color: accent, mb: 1 },
            '& h2': { fontSize: 16, fontWeight: 600, color: accent, mb: 1 },
            '& h3': { fontSize: 14, fontWeight: 600, color: textColor, mb: 0.5 },
            '& p': { mb: 1, color: textColor },
            '& ul': { pl: 2, mb: 1 },
            '& li': { mb: 0.5, color: textColor },
            '& strong': { fontWeight: 600, color: accent },
            '& em': { fontStyle: 'italic', color: textColor2 },
            '& code': { 
              background: `${accent}20`, 
              color: accent, 
              padding: '2px 6px', 
              borderRadius: 1,
              fontSize: 13,
              fontFamily: 'monospace'
            }
          }}
        >
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </Box>
        
        {message.data && message.actionType === 'analysis' && (
          <Card sx={{ 
            mt: 2, 
            background: `${accent}15`, 
            border: `1px solid ${accent}30`,
            borderRadius: 2
          }}>
            <CardContent sx={{ p: 2 }}>
              <Typography sx={{ 
                color: accent, 
                fontSize: 13, 
                fontWeight: 600, 
                mb: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <DatasetIcon sx={{ fontSize: 16 }} />
                Dataset Overview
              </Typography>
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
                gap: 1.5, 
                fontSize: 12 
              }}>
                <Box>
                  <Typography sx={{ color: textColor3, fontSize: 11 }}>Rows</Typography>
                  <Typography sx={{ color: textColor, fontWeight: 600 }}>{message.data.rows.toLocaleString()}</Typography>
                </Box>
                <Box>
                  <Typography sx={{ color: textColor3, fontSize: 11 }}>Columns</Typography>
                  <Typography sx={{ color: textColor, fontWeight: 600 }}>{message.data.columns}</Typography>
                </Box>
                <Box>
                  <Typography sx={{ color: textColor3, fontSize: 11 }}>Size</Typography>
                  <Typography sx={{ color: textColor, fontWeight: 600 }}>{message.data.size}</Typography>
                </Box>
                <Box>
                  <Typography sx={{ color: textColor3, fontSize: 11 }}>Missing</Typography>
                  <Typography sx={{ color: textColor, fontWeight: 600 }}>{Object.keys(message.data.missingValues).length} cols</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        )}
        
        <Typography
          sx={{
            color: textColor3,
            fontSize: 11,
            mt: 2,
            opacity: 0.8,
            textAlign: message.type === 'user' ? 'right' : 'left'
          }}
        >
          {formatTimestamp(message.timestamp)}
        </Typography>
      </Paper>
      
      {message.type === 'user' && (
        <Box sx={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          background: glowBg2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mt: 0.5,
          boxShadow: `0 0 20px ${glowCol2}40`
        }}>
          <Person2Icon sx={{ color: 'white', fontSize: 20 }} />
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{
          minHeight: '100vh',
          width: '100vw',
          background: gradientBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          fontFamily: `'Montserrat', sans-serif`,
        }}>
          <Box sx={{
            width: { xs: '100%', md: '95vw' },
            height: {xs: '100%', md: '90vh' },
            background: cardBg,
            borderRadius: 6,
            display: 'flex',
            flexDirection: 'row',
            overflow: 'hidden',
            boxShadow: shadowDrop
          }}>

        <Sidebar />

        {/* Main Content */}

        <Box sx={{
          flex: 1,
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 1
        }}>
          {/* Header */}
          <PageHeader pageName="AI Model Builder" />


          {/* Status Bar */}
          <Box sx={{
            px: 4,
            pb: 3,
            display: 'flex',
            gap: 2,
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <input
              type="file"
              id="file-upload"
              style={{ display: 'none' }}
              accept=".csv,.xlsx,.json"
              onChange={handleFileUpload}
            />
            <Button
              variant="outlined"
              startIcon={<UploadFileIcon />}
              onClick={() => document.getElementById('file-upload')?.click()}
              sx={{
                borderColor: glowCol1,
                color: glowCol1,
                textTransform: 'none',
                borderRadius: 2,
                px: 3,
                '&:hover': {
                  borderColor: glowCol1,
                  background: `${glowCol1}20`,
                  transform: 'translateY(-1px)'
                }
              }}
            >
              Upload Dataset
            </Button>

            {currentDataset && (
              <Chip
                icon={<DatasetIcon />}
                label={`${currentDataset.name} (${currentDataset.rows.toLocaleString()} rows)`}
                sx={{
                  background: `${glowCol2}25`,
                  border: `1px solid ${glowCol2}`,
                  color: textColor,
                  fontWeight: 500
                }}
              />
            )}

            {currentModel && (
              <Chip
                icon={<ModelTrainingIcon />}
                label={`${currentModel.name} - ${currentModel.accuracy.toFixed(1)}% accuracy`}
                sx={{
                  background: `${glowCol3}25`,
                  border: `1px solid ${glowCol3}`,
                  color: textColor,
                  fontWeight: 500
                }}
              />
            )}
          </Box>

          {/* Chat Area */}
          <Box 
            data-scrollable
            sx={{
              flex: 1,
              px: 4,
              pb: 2,
              overflow: 'auto',
              background: `${cardBg}99`,
              border: `1px solid ${accent}25`,
              borderRadius: 3,
              mx: 4,
              mb: 2,
              '&::-webkit-scrollbar': {
                width: '6px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                background: `${accent}40`,
                borderRadius: '3px',
              },
            }}
          >
            <Box sx={{ p: 3, pt: 4 }}>
              {messages.map(renderMessage)}
              {isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 3 }}>
                  <Box sx={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    background: glowBg1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mr: 1.5,
                    boxShadow: `0 0 20px ${glowCol1}40`
                  }}>
                    <SmartToyIcon sx={{ color: 'white', fontSize: 20 }} />
                  </Box>
                  <Paper sx={{
                    p: 3,
                    background: cardBg,
                    border: `1px solid ${accent}40`,
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    boxShadow: `0 4px 20px ${accent}20`
                  }}>
                    <CircularProgress size={18} sx={{ color: accent }} />
                    <Typography sx={{ color: textColor3, fontSize: 14 }}>
                      AI is analyzing and generating response...
                    </Typography>
                  </Paper>
                </Box>
              )}
              <div ref={messagesEndRef} />
            </Box>
          </Box>

          {/* Input Area */}
          <Box sx={{
            p: 4,
            pt: 0,
            display: 'flex',
            gap: 2,
            alignItems: 'flex-end'
          }}>
            <TextField
              fullWidth
              multiline
              minRows={1}
              maxRows={4}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me to analyze data, clean datasets, train models, or anything ML-related..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  e.stopPropagation();
                  if (input.trim() && !isLoading) {
                    handleSendMessage();
                  }
                }
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  background: cardBg,
                  borderRadius: 3,
                  '& fieldset': {
                    borderColor: `${accent}30`,
                  },
                  '&:hover fieldset': {
                    borderColor: accent,
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: accent,
                  },
                },
                '& .MuiInputBase-input': {
                  color: textColor,
                  fontFamily: `'Montserrat', sans-serif`,
                  fontSize: 14,
                },
                '& .MuiInputBase-input::placeholder': {
                  color: textColor3,
                  opacity: 1,
                },
              }}
            />
            <IconButton
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              sx={{
                background: accent,
                color: 'white',
                width: 50,
                height: 50,
                borderRadius: 2,
                '&:hover': {
                  background: accent,
                  transform: 'scale(1.05)',
                },
                '&:disabled': {
                  background: `${accent}50`,
                },
              }}
            >
              <SendIcon />
            </IconButton>
          </Box>

        </Box>
      </Box>
    </Box>
  );
}
