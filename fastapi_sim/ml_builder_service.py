"""
ML Builder Service
Comprehensive ML pipeline for model building through chat interface
"""
import pandas as pd
import numpy as np
import joblib
import pickle
import io
import base64
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path
import json

# ML Libraries
from sklearn.model_selection import train_test_split, cross_val_score, KFold
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.linear_model import LinearRegression, Ridge, Lasso, ElasticNet
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor, AdaBoostRegressor
from sklearn.metrics import (
    mean_squared_error, mean_absolute_error, r2_score,
    accuracy_score, precision_score, recall_score, f1_score,
    classification_report, confusion_matrix
)

# Advanced ML
try:
    from xgboost import XGBRegressor, XGBClassifier
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False

try:
    from lightgbm import LGBMRegressor, LGBMClassifier
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False

try:
    from catboost import CatBoostRegressor, CatBoostClassifier
    HAS_CATBOOST = True
except ImportError:
    HAS_CATBOOST = False

# Hyperparameter tuning
try:
    import optuna
    HAS_OPTUNA = True
except ImportError:
    HAS_OPTUNA = False

# SHAP for model interpretability
try:
    import shap
    HAS_SHAP = True
except ImportError:
    HAS_SHAP = False

# Visualization
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import seaborn as sns

# Session storage for datasets and models
class MLSession:
    """Manages ML session data for a user"""
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.dataset: Optional[pd.DataFrame] = None
        self.dataset_name: str = ""
        self.X_train: Optional[pd.DataFrame] = None
        self.X_test: Optional[pd.DataFrame] = None
        self.y_train: Optional[pd.Series] = None
        self.y_test: Optional[pd.Series] = None
        self.target_column: Optional[str] = None
        self.feature_columns: List[str] = []
        self.scaler: Optional[StandardScaler] = None
        self.models: Dict[str, Any] = {}
        self.model_results: Dict[str, Dict] = {}
        self.best_model_name: Optional[str] = None
        
# Global session storage (in production, use Redis or database)
sessions: Dict[str, MLSession] = {}

def get_session(session_id: str) -> MLSession:
    """Get or create ML session"""
    if session_id not in sessions:
        sessions[session_id] = MLSession(session_id)
    return sessions[session_id]

def load_dataset(session_id: str, data: Any, filename: str) -> Dict:
    """Load dataset from CSV, Excel, or JSON"""
    session = get_session(session_id)
    
    try:
        # Handle different file types
        if isinstance(data, str):
            # Base64 encoded file
            file_content = base64.b64decode(data)
            file_obj = io.BytesIO(file_content)
        else:
            file_obj = data
            
        # Read based on file extension
        if filename.endswith('.csv'):
            df = pd.read_csv(file_obj)
        elif filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(file_obj)
        elif filename.endswith('.json'):
            df = pd.read_json(file_obj)
        else:
            return {"error": "Unsupported file format. Use CSV, Excel, or JSON"}
        
        session.dataset = df
        session.dataset_name = filename
        
        return {
            "success": True,
            "filename": filename,
            "rows": len(df),
            "columns": len(df.columns),
            "column_names": df.columns.tolist(),
            "dtypes": df.dtypes.astype(str).to_dict(),
            "memory_usage": f"{df.memory_usage(deep=True).sum() / 1024:.2f} KB"
        }
    except Exception as e:
        return {"error": f"Failed to load dataset: {str(e)}"}

def analyze_dataset(session_id: str) -> Dict:
    """Comprehensive dataset analysis"""
    session = get_session(session_id)
    
    if session.dataset is None:
        return {"error": "No dataset loaded. Please upload a dataset first."}
    
    df = session.dataset
    
    try:
        analysis = {
            "basic_info": {
                "shape": df.shape,
                "columns": df.columns.tolist(),
                "dtypes": df.dtypes.astype(str).to_dict(),
                "memory_usage": f"{df.memory_usage(deep=True).sum() / 1024:.2f} KB"
            },
            "missing_values": df.isnull().sum().to_dict(),
            "missing_percentage": (df.isnull().sum() / len(df) * 100).to_dict(),
            "descriptive_stats": df.describe().to_dict(),
            "numeric_columns": df.select_dtypes(include=[np.number]).columns.tolist(),
            "categorical_columns": df.select_dtypes(include=['object', 'category']).columns.tolist(),
            "unique_counts": {col: int(df[col].nunique()) for col in df.columns},
            "duplicate_rows": int(df.duplicated().sum())
        }
        
        return {"success": True, "analysis": analysis}
    except Exception as e:
        return {"error": f"Analysis failed: {str(e)}"}

def univariate_analysis(session_id: str, column: str) -> Dict:
    """Univariate analysis for a specific column"""
    session = get_session(session_id)
    
    if session.dataset is None:
        return {"error": "No dataset loaded"}
    
    df = session.dataset
    
    if column not in df.columns:
        return {"error": f"Column '{column}' not found in dataset"}
    
    try:
        col_data = df[column]
        
        # Generate histogram/distribution plot
        fig, ax = plt.subplots(figsize=(10, 6))
        
        if pd.api.types.is_numeric_dtype(col_data):
            # Numeric column - histogram
            ax.hist(col_data.dropna(), bins=30, edgecolor='black', alpha=0.7)
            ax.set_title(f'Distribution of {column}')
            ax.set_xlabel(column)
            ax.set_ylabel('Frequency')
            
            stats = {
                "mean": float(col_data.mean()),
                "median": float(col_data.median()),
                "std": float(col_data.std()),
                "min": float(col_data.min()),
                "max": float(col_data.max()),
                "q1": float(col_data.quantile(0.25)),
                "q3": float(col_data.quantile(0.75)),
                "skewness": float(col_data.skew()),
                "kurtosis": float(col_data.kurtosis())
            }
        else:
            # Categorical column - bar plot
            value_counts = col_data.value_counts()
            ax.bar(range(len(value_counts)), value_counts.values)
            ax.set_xticks(range(len(value_counts)))
            ax.set_xticklabels(value_counts.index, rotation=45, ha='right')
            ax.set_title(f'Value Counts of {column}')
            ax.set_ylabel('Count')
            
            stats = {
                "unique_values": int(col_data.nunique()),
                "most_common": str(col_data.mode()[0]) if len(col_data.mode()) > 0 else None,
                "value_counts": value_counts.head(10).to_dict()
            }
        
        # Convert plot to base64
        buffer = io.BytesIO()
        plt.tight_layout()
        plt.savefig(buffer, format='png', dpi=100, bbox_inches='tight')
        buffer.seek(0)
        plot_base64 = base64.b64encode(buffer.read()).decode()
        plt.close()
        
        return {
            "success": True,
            "column": column,
            "stats": stats,
            "plot": plot_base64
        }
    except Exception as e:
        return {"error": f"Univariate analysis failed: {str(e)}"}

def bivariate_analysis(session_id: str, col1: str, col2: str) -> Dict:
    """Bivariate analysis between two columns"""
    session = get_session(session_id)
    
    if session.dataset is None:
        return {"error": "No dataset loaded"}
    
    df = session.dataset
    
    if col1 not in df.columns or col2 not in df.columns:
        return {"error": "One or both columns not found"}
    
    try:
        fig, ax = plt.subplots(figsize=(10, 6))
        
        data1 = df[col1].dropna()
        data2 = df[col2].dropna()
        
        # Both numeric - scatter plot
        if pd.api.types.is_numeric_dtype(data1) and pd.api.types.is_numeric_dtype(data2):
            valid_data = df[[col1, col2]].dropna()
            ax.scatter(valid_data[col1], valid_data[col2], alpha=0.5)
            ax.set_xlabel(col1)
            ax.set_ylabel(col2)
            ax.set_title(f'{col1} vs {col2}')
            
            # Calculate correlation
            correlation = valid_data[col1].corr(valid_data[col2])
            stats = {"correlation": float(correlation)}
        else:
            # At least one categorical - grouped bar plot
            cross_tab = pd.crosstab(df[col1], df[col2])
            cross_tab.plot(kind='bar', ax=ax)
            ax.set_title(f'{col1} vs {col2}')
            ax.set_xlabel(col1)
            ax.set_ylabel('Count')
            ax.legend(title=col2)
            plt.xticks(rotation=45, ha='right')
            stats = {"cross_tabulation": cross_tab.to_dict()}
        
        # Convert plot to base64
        buffer = io.BytesIO()
        plt.tight_layout()
        plt.savefig(buffer, format='png', dpi=100, bbox_inches='tight')
        buffer.seek(0)
        plot_base64 = base64.b64encode(buffer.read()).decode()
        plt.close()
        
        return {
            "success": True,
            "columns": [col1, col2],
            "stats": stats,
            "plot": plot_base64
        }
    except Exception as e:
        return {"error": f"Bivariate analysis failed: {str(e)}"}

def correlation_analysis(session_id: str) -> Dict:
    """Correlation analysis with heatmap"""
    session = get_session(session_id)
    
    if session.dataset is None:
        return {"error": "No dataset loaded"}
    
    df = session.dataset
    
    try:
        # Get only numeric columns
        numeric_df = df.select_dtypes(include=[np.number])
        
        if numeric_df.empty:
            return {"error": "No numeric columns found for correlation analysis"}
        
        # Calculate correlation matrix
        corr_matrix = numeric_df.corr()
        
        # Create heatmap
        fig, ax = plt.subplots(figsize=(12, 10))
        sns.heatmap(corr_matrix, annot=True, fmt='.2f', cmap='coolwarm', 
                    center=0, square=True, ax=ax, cbar_kws={'shrink': 0.8})
        ax.set_title('Correlation Heatmap')
        plt.tight_layout()
        
        # Convert plot to base64
        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', dpi=100, bbox_inches='tight')
        buffer.seek(0)
        plot_base64 = base64.b64encode(buffer.read()).decode()
        plt.close()
        
        # Find highly correlated pairs
        high_corr = []
        for i in range(len(corr_matrix.columns)):
            for j in range(i+1, len(corr_matrix.columns)):
                if abs(corr_matrix.iloc[i, j]) > 0.7:
                    high_corr.append({
                        "feature1": corr_matrix.columns[i],
                        "feature2": corr_matrix.columns[j],
                        "correlation": float(corr_matrix.iloc[i, j])
                    })
        
        return {
            "success": True,
            "correlation_matrix": corr_matrix.to_dict(),
            "high_correlations": high_corr,
            "plot": plot_base64
        }
    except Exception as e:
        return {"error": f"Correlation analysis failed: {str(e)}"}

def split_dataset(session_id: str, target_column: str, test_size: float = 0.2, 
                  random_state: int = 42, feature_columns: Optional[List[str]] = None) -> Dict:
    """Split dataset into train and test sets"""
    session = get_session(session_id)
    
    if session.dataset is None:
        return {"error": "No dataset loaded"}
    
    df = session.dataset
    
    if target_column not in df.columns:
        return {"error": f"Target column '{target_column}' not found"}
    
    try:
        # Select features
        if feature_columns is None:
            # Use all columns except target
            feature_columns = [col for col in df.columns if col != target_column]
        
        # Filter to numeric columns only
        numeric_features = df[feature_columns].select_dtypes(include=[np.number]).columns.tolist()
        
        X = df[numeric_features]
        y = df[target_column]
        
        # Handle missing values
        X = X.fillna(X.mean())
        y = y.fillna(y.mean() if pd.api.types.is_numeric_dtype(y) else y.mode()[0])
        
        # Split
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state
        )
        
        # Store in session
        session.X_train = X_train
        session.X_test = X_test
        session.y_train = y_train
        session.y_test = y_test
        session.target_column = target_column
        session.feature_columns = numeric_features
        
        return {
            "success": True,
            "target_column": target_column,
            "feature_columns": numeric_features,
            "train_size": len(X_train),
            "test_size": len(X_test),
            "train_test_ratio": f"{100*(1-test_size):.0f}/{100*test_size:.0f}"
        }
    except Exception as e:
        return {"error": f"Dataset split failed: {str(e)}"}

def train_model(session_id: str, model_type: str, **kwargs) -> Dict:
    """Train a machine learning model"""
    session = get_session(session_id)
    
    if session.X_train is None:
        return {"error": "Dataset not split. Please split the dataset first."}
    
    try:
        # Select model based on type
        models_map = {
            "linear_regression": LinearRegression(),
            "ridge": Ridge(**kwargs),
            "lasso": Lasso(**kwargs),
            "elastic_net": ElasticNet(**kwargs),
            "decision_tree": DecisionTreeRegressor(**kwargs),
            "random_forest": RandomForestRegressor(**kwargs),
            "gradient_boosting": GradientBoostingRegressor(**kwargs),
            "adaboost": AdaBoostRegressor(**kwargs),
        }
        
        if HAS_XGBOOST:
            models_map["xgboost"] = XGBRegressor(**kwargs)
        
        if HAS_LIGHTGBM:
            models_map["lightgbm"] = LGBMRegressor(**kwargs)
        
        if HAS_CATBOOST:
            models_map["catboost"] = CatBoostRegressor(verbose=False, **kwargs)
        
        if model_type not in models_map:
            return {"error": f"Unknown model type: {model_type}. Available: {list(models_map.keys())}"}
        
        model = models_map[model_type]
        
        # Train model
        model.fit(session.X_train, session.y_train)
        
        # Make predictions
        y_train_pred = model.predict(session.X_train)
        y_test_pred = model.predict(session.X_test)
        
        # Calculate metrics
        train_metrics = {
            "rmse": float(np.sqrt(mean_squared_error(session.y_train, y_train_pred))),
            "mae": float(mean_absolute_error(session.y_train, y_train_pred)),
            "r2": float(r2_score(session.y_train, y_train_pred))
        }
        
        test_metrics = {
            "rmse": float(np.sqrt(mean_squared_error(session.y_test, y_test_pred))),
            "mae": float(mean_absolute_error(session.y_test, y_test_pred)),
            "r2": float(r2_score(session.y_test, y_test_pred))
        }
        
        # Cross-validation
        cv_scores = cross_val_score(model, session.X_train, session.y_train, 
                                    cv=5, scoring='r2')
        
        # Feature importance (if available)
        feature_importance = None
        if hasattr(model, 'feature_importances_'):
            importance_dict = dict(zip(session.feature_columns, model.feature_importances_))
            feature_importance = sorted(importance_dict.items(), key=lambda x: x[1], reverse=True)
            feature_importance = [{"feature": f, "importance": float(imp)} for f, imp in feature_importance]
        elif hasattr(model, 'coef_'):
            importance_dict = dict(zip(session.feature_columns, np.abs(model.coef_)))
            feature_importance = sorted(importance_dict.items(), key=lambda x: x[1], reverse=True)
            feature_importance = [{"feature": f, "importance": float(imp)} for f, imp in feature_importance]
        
        # Store model
        session.models[model_type] = model
        session.model_results[model_type] = {
            "train_metrics": train_metrics,
            "test_metrics": test_metrics,
            "cv_scores": cv_scores.tolist(),
            "feature_importance": feature_importance
        }
        
        return {
            "success": True,
            "model_type": model_type,
            "train_metrics": train_metrics,
            "test_metrics": test_metrics,
            "cv_mean": float(cv_scores.mean()),
            "cv_std": float(cv_scores.std()),
            "feature_importance": feature_importance
        }
    except Exception as e:
        return {"error": f"Model training failed: {str(e)}"}

def tune_hyperparameters(session_id: str, model_type: str, n_trials: int = 50) -> Dict:
    """Hyperparameter tuning using Optuna"""
    if not HAS_OPTUNA:
        return {"error": "Optuna not installed. Install with: pip install optuna"}
    
    session = get_session(session_id)
    
    if session.X_train is None:
        return {"error": "Dataset not split. Please split the dataset first."}
    
    try:
        def objective(trial):
            params = {}
            
            if model_type == "random_forest":
                params = {
                    'n_estimators': trial.suggest_int('n_estimators', 10, 300),
                    'max_depth': trial.suggest_int('max_depth', 2, 32),
                    'min_samples_split': trial.suggest_int('min_samples_split', 2, 20),
                    'min_samples_leaf': trial.suggest_int('min_samples_leaf', 1, 10),
                }
                model = RandomForestRegressor(**params, random_state=42)
            
            elif model_type == "xgboost" and HAS_XGBOOST:
                params = {
                    'n_estimators': trial.suggest_int('n_estimators', 10, 300),
                    'max_depth': trial.suggest_int('max_depth', 2, 10),
                    'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.3),
                    'subsample': trial.suggest_float('subsample', 0.6, 1.0),
                    'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
                }
                model = XGBRegressor(**params, random_state=42)
            
            elif model_type == "gradient_boosting":
                params = {
                    'n_estimators': trial.suggest_int('n_estimators', 10, 300),
                    'max_depth': trial.suggest_int('max_depth', 2, 10),
                    'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.3),
                    'subsample': trial.suggest_float('subsample', 0.6, 1.0),
                }
                model = GradientBoostingRegressor(**params, random_state=42)
            
            else:
                raise ValueError(f"Hyperparameter tuning not supported for {model_type}")
            
            # Cross-validation score
            scores = cross_val_score(model, session.X_train, session.y_train, cv=3, scoring='r2')
            return scores.mean()
        
        # Run optimization
        study = optuna.create_study(direction='maximize', study_name=f'{model_type}_tuning')
        study.optimize(objective, n_trials=n_trials, show_progress_bar=False)
        
        best_params = study.best_params
        best_score = study.best_value
        
        # Train final model with best params
        result = train_model(session_id, model_type, **best_params)
        
        if "success" in result:
            result["best_hyperparameters"] = best_params
            result["best_cv_score"] = float(best_score)
            result["n_trials"] = n_trials
        
        return result
    except Exception as e:
        return {"error": f"Hyperparameter tuning failed: {str(e)}"}

def shap_analysis(session_id: str, model_name: str, max_samples: int = 100) -> Dict:
    """SHAP analysis for model interpretability"""
    if not HAS_SHAP:
        return {"error": "SHAP not installed. Install with: pip install shap"}
    
    session = get_session(session_id)
    
    if model_name not in session.models:
        return {"error": f"Model '{model_name}' not found. Train a model first."}
    
    try:
        model = session.models[model_name]
        
        # Sample data for SHAP (can be slow on large datasets)
        X_sample = session.X_test.head(max_samples)
        
        # Create explainer
        explainer = shap.Explainer(model, session.X_train)
        shap_values = explainer(X_sample)
        
        # Summary plot
        fig, ax = plt.subplots(figsize=(10, 8))
        shap.summary_plot(shap_values, X_sample, show=False)
        plt.tight_layout()
        
        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', dpi=100, bbox_inches='tight')
        buffer.seek(0)
        summary_plot = base64.b64encode(buffer.read()).decode()
        plt.close()
        
        # Feature importance from SHAP
        shap_importance = np.abs(shap_values.values).mean(axis=0)
        feature_importance = [
            {"feature": feat, "shap_importance": float(imp)}
            for feat, imp in sorted(zip(session.feature_columns, shap_importance), 
                                   key=lambda x: x[1], reverse=True)
        ]
        
        return {
            "success": True,
            "model_name": model_name,
            "feature_importance": feature_importance,
            "summary_plot": summary_plot
        }
    except Exception as e:
        return {"error": f"SHAP analysis failed: {str(e)}"}

def download_model(session_id: str, model_name: str, format: str = "joblib") -> Dict:
    """Download trained model as pickle or joblib"""
    session = get_session(session_id)
    
    if model_name not in session.models:
        return {"error": f"Model '{model_name}' not found"}
    
    try:
        model = session.models[model_name]
        
        # Serialize model
        buffer = io.BytesIO()
        if format == "joblib":
            joblib.dump(model, buffer)
        elif format == "pickle":
            pickle.dump(model, buffer)
        else:
            return {"error": "Format must be 'joblib' or 'pickle'"}
        
        buffer.seek(0)
        model_bytes = base64.b64encode(buffer.read()).decode()
        
        return {
            "success": True,
            "model_name": model_name,
            "format": format,
            "filename": f"{model_name}.{format}",
            "data": model_bytes
        }
    except Exception as e:
        return {"error": f"Model download failed: {str(e)}"}

def get_model_summary(session_id: str) -> Dict:
    """Get summary of all trained models"""
    session = get_session(session_id)
    
    return {
        "session_id": session_id,
        "dataset_loaded": session.dataset is not None,
        "dataset_name": session.dataset_name,
        "dataset_shape": session.dataset.shape if session.dataset is not None else None,
        "split_done": session.X_train is not None,
        "target_column": session.target_column,
        "feature_columns": session.feature_columns,
        "trained_models": list(session.models.keys()),
        "model_results": session.model_results
    }
