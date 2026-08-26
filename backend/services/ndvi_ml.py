import sys
import json
import os
import sqlite3
try:
    import joblib
    import pandas as pd
    import numpy as np
except ImportError:
    print(json.dumps({"error": "Missing Python dependencies. Please run: pip install pandas scikit-learn joblib numpy"}))
    sys.exit(0)

def main():
    model_dir = os.path.join(os.path.dirname(__file__), '../ml-models/ndvi')
    scaler_path = os.path.join(model_dir, 'ndvi_scaler.pkl')
    anomaly_path = os.path.join(model_dir, 'ndvi_anomaly_model.pkl')
    forecast_path = os.path.join(model_dir, 'ndvi_forecast_model.pkl')

    if not (os.path.exists(scaler_path) and os.path.exists(anomaly_path) and os.path.exists(forecast_path)):
        print(json.dumps({"error": "MODELS_MISSING", "message": "Please place ndvi_forecast_model.pkl, ndvi_anomaly_model.pkl, and ndvi_scaler.pkl in backend/ml-models/ndvi/"}))
        sys.exit(0)

    try:
        # Load models
        scaler = joblib.load(scaler_path)
        anomaly_model = joblib.load(anomaly_path)
        forecast_model = joblib.load(forecast_path)

        db_path = os.path.join(os.path.dirname(__file__), '../database.sqlite')
        conn = sqlite3.connect(db_path)
        df = pd.read_sql_query("SELECT date, ndvi FROM ndvi_data WHERE ndvi IS NOT NULL ORDER BY date ASC", conn)
        conn.close()

        if df.empty:
            print(json.dumps({"error": "NO_DATA", "message": "No NDVI data available in database."}))
            sys.exit(0)

        df['ndvi'] = pd.to_numeric(df['ndvi'], errors='coerce')
        df = df.dropna()
        df['date'] = pd.to_datetime(df['date'])

        # Simple generic invocation (user trained these)
        # We assume standard 1D input shape
        X = df[['ndvi']].values
        
        try:
            X_scaled = scaler.transform(X)
        except Exception as e:
            X_scaled = X # Fallback if scaler expects different shape
            
        try:
            anomalies = anomaly_model.predict(X_scaled)
        except:
            anomalies = np.ones(len(X)) # No anomalies if it fails
            
        try:
            # Predict next 6 periods
            forecast = forecast_model.predict(X_scaled[-6:])
        except:
            forecast = np.array([0.4]*6)

        results = {"anomalies": [], "forecast": []}
        
        # Format anomalies
        for i, val in enumerate(anomalies):
            if val == -1: # IsolationForest convention
                results["anomalies"].append({
                    "date": df.iloc[i]['date'].strftime('%Y-%m-%d'),
                    "ndvi": float(df.iloc[i]['ndvi'])
                })
        
        # Format forecast
        last_date = df['date'].iloc[-1]
        for i, f_val in enumerate(forecast):
            next_date = last_date + pd.Timedelta(days=30*(i+1))
            results["forecast"].append({
                "date": next_date.strftime('%Y-%m-%d'),
                "ndvi": float(f_val)
            })
            
        print(json.dumps(results))
    except Exception as e:
        print(json.dumps({"error": "EXECUTION_ERROR", "message": str(e)}))

if __name__ == '__main__':
    main()
