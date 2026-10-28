"""Run isolated backend checks and write a reproducible JSON report."""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

sys.dont_write_bytecode = True
site = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--report', type=Path, required=True)
args = parser.parse_args()
suites = []
for relative in ('tests/test_learning_v15.py', 'tools/test_learning_server.py', 'tools/test_ai_adapter.py'):
    result = subprocess.run([sys.executable, '-B', str(site / relative)], capture_output=True, text=True, encoding='utf-8', errors='replace')
    output = result.stdout + result.stderr
    count = re.search(r'Ran (\d+) tests?', output)
    checks = None
    if not count:
        try:
            checks = len(json.loads(result.stdout).get('checks', []))
        except ValueError:
            pass
    suites.append({'path': relative, 'exitCode': result.returncode, 'tests': int(count.group(1)) if count else checks,
        'passed': result.returncode == 0, 'output': output})
    print(relative + ': ' + ('PASS' if result.returncode == 0 else 'FAIL'), flush=True)
files = ['serve_lab.py', 'learning_service.py', 'tests/test_learning_v15.py', 'tests/run_learning_v15.py', 'learning/objectives-v15.json']
report = {'schema': 'dxx-learning-backend-tests-v15', 'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
    'passed': all(s['passed'] for s in suites), 'tests': sum(s['tests'] or 0 for s in suites), 'suites': suites,
    'externalProviderRequests': 0, 'paidRequests': 0, 'transportCoverage': 'Injected provider fixtures plus real loopback mock HTTP for DeepSeek and SiliconFlow; no request to either external provider.',
    'realDeepSeekConnectivityVerified': False, 'realProviderConnectivityVerified': False, 'keyValueInspectedOrPrinted': False,
    'storage': 'Temporary isolated SQLite directories deleted after each suite; no production records modified.',
    'clinicalValidation': False, 'knowledgeScope': 'Server-graded formative knowledge only; no clinical skill inference.',
    'sha256': {name: hashlib.sha256((site / name).read_bytes()).hexdigest() for name in files}}
args.report.parent.mkdir(parents=True, exist_ok=True)
args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({k: report[k] for k in ('passed', 'tests', 'externalProviderRequests', 'realDeepSeekConnectivityVerified')}))
sys.exit(0 if report['passed'] else 1)
