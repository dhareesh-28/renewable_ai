import json

path = r'C:\Users\dhare\.gemini\antigravity\brain\7e6f0ddb-2d6b-4841-a421-294180c510fd\.system_generated\logs\transcript_full.jsonl'
with open(path, 'r', encoding='utf-8') as f:
    lines = [json.loads(line) for line in f if '"USER_INPUT"' in line]

print(f"Total user inputs: {len(lines)}")
for item in lines[-3:]:
    print("=" * 60)
    print(f"Step {item['step_index']}:")
    print(item.get('content', ''))

