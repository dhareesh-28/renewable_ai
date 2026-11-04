import json

with open('renewable_ai/models/forecast_metrics.json') as f:
    fc = json.load(f)

print('Feature importances:')
for item in fc.get('feature_importances', []):
    print(f"  {item}")

samples = fc.get('test_samples', [])
print('\nTest samples count:', len(samples))
if samples:
    print('Sample 0:', samples[0])
