"""Standard-library integration checks. Uses temporary storage, creates no demo users.

Run from any directory: python tools/test_learning_server.py
"""
import concurrent.futures
import copy
import http.client
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest

sys.dont_write_bytecode = True
SITE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SITE))
spec = importlib.util.spec_from_file_location('serve_lab', SITE / 'serve_lab.py')
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)


class LearningServerChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory(prefix='dxx-learning-test-')
        cls.server = lab.create_server(0, cls.temporary.name, token='teacher-test-only-token')
        cls.port = cls.server.server_address[1]
        cls.worker = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.worker.start()
        cls.cases = lab.load_cases()
        cls.case = next(iter(cls.cases.values()))

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.worker.join(3)
        cls.temporary.cleanup()

    def request(self, method, path, data=None, headers=None, raw=None):
        request_headers = dict(headers or {})
        body = raw
        if data is not None:
            body = json.dumps(data, ensure_ascii=False).encode('utf-8')
            request_headers.setdefault('Content-Type', 'application/json')
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=10)
        try:
            connection.request(method, path, body=body, headers=request_headers)
            response = connection.getresponse()
            content = response.read()
            try:
                value = json.loads(content)
            except (ValueError, UnicodeError):
                value = content
            return response.status, value
        finally:
            connection.close()

    def batch(self, suffix, kind='encounter_start', payload=None):
        session_id = 'session.' + suffix
        return {'session': {'id': session_id, 'caseId': self.case['id'],
                'startedAt': '2026-10-18T00:00:00Z', 'student': None},
                'events': [{'id': 'event.' + suffix, 'sessionId': session_id, 'type': kind,
                'at': '2026-10-18T00:00:01Z', 'payload': payload if payload is not None else {'caseId': self.case['id']}}]}

    def completion(self):
        essential = [q['id'] for q in self.case['questions'] if q.get('essential')]
        return {'caseId': self.case['id'], 'interviewed': essential, 'exams': [],
                'evidence': [self.case['evidence'][0]['id']], 'explanations': [], 'plan': [],
                'reflection': '仅为自动化接口验证，临时数据库会删除。',
                'coverage': {'asked': len(essential), 'essentialAsked': len(essential), 'essentialTotal': len(essential)},
                'durationSeconds': 120}

    def test_public_status_has_no_identity_or_records(self):
        code, data = self.request('GET', '/api/learning/status')
        self.assertEqual(code, 200)
        self.assertTrue(data['collectorEnabled'])
        self.assertTrue(data['localOnly'])
        self.assertFalse(data['llmConnected'])
        self.assertFalse(data['identityAuthentication'])
        self.assertNotIn('sessions', data)

    def test_guest_event_and_idempotent_retry(self):
        batch = self.batch('idempotent')
        code, first = self.request('POST', '/api/learning/events', batch)
        code2, second = self.request('POST', '/api/learning/events', batch)
        self.assertEqual((code, code2), (200, 200))
        self.assertEqual((first['accepted'], second['accepted'], second['duplicates']), (1, 0, 1))
        code, detail = self.request('GET', '/api/learning/sessions/session.idempotent', headers={'Authorization': 'Bearer teacher-test-only-token'})
        self.assertEqual(code, 200)
        self.assertIsNone(detail['session']['student'])
        self.assertEqual(len(detail['events']), 1)

    def test_concurrent_duplicate_is_atomic(self):
        batch = self.batch('parallel')
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            responses = list(pool.map(lambda _: self.request('POST', '/api/learning/events', batch), range(6)))
        self.assertTrue(all(code == 200 for code, _ in responses))
        self.assertEqual(sum(data['accepted'] for _, data in responses), 1)
        self.assertEqual(sum(data['duplicates'] for _, data in responses), 5)

    def test_conflicting_id_rolls_back_whole_batch(self):
        batch = self.batch('conflict')
        self.assertEqual(self.request('POST', '/api/learning/events', batch)[0], 200)
        changed = copy.deepcopy(batch)
        changed['events'].insert(0, dict(changed['events'][0], id='event.must-rollback'))
        changed['events'][1]['payload']['extra'] = 'changed'
        self.assertEqual(self.request('POST', '/api/learning/events', changed)[0], 409)
        _, detail = self.request('GET', '/api/learning/sessions/session.conflict', headers={'X-Teacher-Token': 'teacher-test-only-token'})
        self.assertEqual(len(detail['events']), 1)

    def test_mismatched_session_rejected(self):
        batch = self.batch('mismatch')
        batch['events'][0]['sessionId'] = 'another.session'
        self.assertEqual(self.request('POST', '/api/learning/events', batch)[0], 422)

    def test_illegal_session_and_unknown_case_rejected(self):
        batch = self.batch('bad-id')
        batch['session']['id'] = '../private'
        self.assertEqual(self.request('POST', '/api/learning/events', batch)[0], 422)
        batch = self.batch('bad-case')
        batch['session']['caseId'] = 'not-a-case'
        self.assertEqual(self.request('POST', '/api/learning/events', batch)[0], 422)

    def test_malformed_payload_and_unknown_question_rejected(self):
        batch = self.batch('bad-payload')
        batch['events'][0]['payload'] = 'not an object'
        self.assertEqual(self.request('POST', '/api/learning/events', batch)[0], 422)
        self.assertEqual(self.request('POST', '/api/learning/events', self.batch('bad-question', 'question_asked', {'questionId': 'invented'}))[0], 422)

    def test_completion_accepts_real_evidence_id(self):
        code, value = self.request('POST', '/api/learning/events', self.batch('complete-real-evidence', 'encounter_complete', self.completion()))
        self.assertEqual(code, 200, value)
        _, records = self.request('GET', '/api/learning/sessions?caseId=' + self.case['id'], headers={'X-Teacher-Token': 'teacher-test-only-token'})
        summary = next(s for s in records['sessions'] if s['id'] == 'session.complete-real-evidence')
        self.assertTrue(summary['completed'])
        self.assertEqual(summary['coverage']['essentialAsked'], summary['coverage']['essentialTotal'])

    def test_completion_rejects_fabricated_evidence_and_coverage(self):
        payload = self.completion()
        payload['evidence'] = ['fabricated-id']
        self.assertEqual(self.request('POST', '/api/learning/events', self.batch('bad-evidence', 'encounter_complete', payload))[0], 422)
        payload = self.completion()
        payload['coverage']['essentialAsked'] = 0
        self.assertEqual(self.request('POST', '/api/learning/events', self.batch('bad-coverage', 'encounter_complete', payload))[0], 422)

    def test_teacher_reads_require_header_token(self):
        for path in ['/api/learning/sessions', '/api/learning/sessions/session.idempotent', '/api/learning/sessions?token=teacher-test-only-token']:
            self.assertEqual(self.request('GET', path)[0], 401)
        self.assertEqual(self.request('GET', '/api/learning/sessions', headers={'X-Teacher-Token': 'wrong'})[0], 401)
        self.assertEqual(self.request('GET', '/api/learning/sessions', headers={'X-Teacher-Token': 'wrong-é'})[0], 401)

    def test_cross_origin_and_non_json_rejected(self):
        batch = self.batch('origin')
        self.assertEqual(self.request('POST', '/api/learning/events', batch, {'Origin': 'https://untrusted.example'})[0], 403)
        self.assertEqual(self.request('POST', '/api/learning/events', batch, {'Origin': 'null'})[0], 403)
        self.assertEqual(self.request('POST', '/api/learning/events', batch, {'Origin': f'http://localhost:{self.port}'})[0], 403)
        self.assertEqual(self.request('POST', '/api/learning/events', batch, {'Content-Type': 'text/plain'})[0], 415)

    def test_malformed_json_nonfinite_and_oversize_rejected(self):
        self.assertEqual(self.request('POST', '/api/learning/events', headers={'Content-Type': 'application/json'}, raw=b'{broken')[0], 400)
        batch = self.batch('nonfinite')
        batch['events'][0]['payload']['value'] = float('inf')
        self.assertEqual(self.request('POST', '/api/learning/events', batch)[0], 400)
        self.assertEqual(self.request('POST', '/api/learning/events', headers={'Content-Type': 'application/json'}, raw=b' ' * (lab.MAX_BODY + 1))[0], 413)

    def test_static_traversal_database_and_hidden_files_blocked(self):
        secret = SITE / '.learning-test-secret.txt'
        database = SITE / 'learning-test.sqlite3'
        secret.write_text('private-test-value', encoding='utf-8')
        database.write_text('private-test-database', encoding='utf-8')
        try:
            for path in ['/%2e%2e/README.md', '/..%5cREADME.md', '/.learning-test-secret.txt', '/learning-test.sqlite3', '/.env', '/api/learning/sessions/..%2Fprivate']:
                code, content = self.request('GET', path, headers={'X-Teacher-Token': 'teacher-test-only-token'})
                self.assertIn(code, (404, 422), (path, code))
                self.assertNotIn(b'private-test', content if isinstance(content, bytes) else json.dumps(content).encode())
            self.assertEqual(self.request('GET', '/teacher/')[0], 200)
            self.assertEqual(self.request('GET', '/README.md')[0], 200)
            self.assertEqual(self.request('GET', '/.nojekyll')[0], 200)
            self.assertEqual(self.request('GET', '/assembly/licenses/SOMAKINE_DATA_LICENSE')[0], 200)
            self.assertEqual(self.request('GET', '/assembly/licenses/SOMAKINE_NOTICE')[0], 200)
            self.assertEqual(self.request('GET', '/assembly/tools/REBUILD_GEOMETRY.ps1')[0], 200)
        finally:
            secret.unlink(missing_ok=True)
            database.unlink(missing_ok=True)

    def test_data_directory_cannot_be_inside_site(self):
        with self.assertRaises(ValueError):
            lab.create_server(0, SITE / 'private-learning-data')

    def test_question_api_is_grounded_and_validated(self):
        import os
        from unittest.mock import patch
        question = self.case['questions'][0]
        with patch.dict(os.environ, {'DEEPSEEK_API_KEY': ''}):
            code, value = self.request('POST', '/api/encounter/ask', {'caseId': self.case['id'], 'question': question['label']})
        self.assertEqual(code, 200, value)
        self.assertEqual(value['questionId'], question['id'])
        self.assertEqual(value['answer'], question['answer'])
        self.assertEqual(value['mode'], 'local_rules')
        self.assertEqual(self.request('POST', '/api/encounter/ask', {'caseId': self.case['id'], 'question': 'x' * 501})[0], 400)
        self.assertEqual(self.request('POST', '/api/encounter/ask', {'caseId': 'unknown', 'question': '你好'})[0], 400)


if __name__ == '__main__':
    unittest.main(verbosity=2)
