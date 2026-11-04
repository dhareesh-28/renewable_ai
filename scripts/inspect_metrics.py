import json

with open('renewable_ai/models/forecast_metrics.json') as f:
    fc = json.load(f)
print('Forecast keys:', list(fc.keys()))
print('Model metrics:', fc.get('model_metrics'))
print('Baseline metrics:', fc.get('baseline_metrics'))
if 'feature_importance' in fc:
    print('Feature importance count:', len(fc['feature_importance']))
    print('Sample features:', list(fc['feature_importance'].items())[:5])
if 'scatter_sample' in fc:
    print('Scatter sample count:', len(fc['scatter_sample']))
    print('Scatter point 0:', fc['scatter_sample'][0])

with open('renewable_ai/models/fault_metrics.json') as f:
    flt = json.load(f)
print('\nFault keys:', list(flt.keys()))
for k, v in flt.items():
    print(f"{k}: {v}")

