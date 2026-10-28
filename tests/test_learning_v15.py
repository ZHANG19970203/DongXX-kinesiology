"""Isolated HTTP/SQLite contract tests; never call the external provider."""
import concurrent.futures
import contextlib
import hashlib
import http.client
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
import uuid
import urllib.request

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import serve_lab
import learning_service as service


KEY = 'sk-fixture-OnlyForLocalTests123456'


def success(payload, key, timeout):
    return {'choices': [{'message': {'content': '这是合成教学讨论，请比较证据与推断。'}, 'finish_reason': 'stop'}],
            'usage': {'prompt_tokens': 100, 'completion_tokens': 20, 'total_tokens': 120}}


class BackendTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'DEEPSEEK_API_KEY': '', 'SILICONFLOW_API_KEY': ''})
        self.env.start()
        self.log = patch.object(serve_lab.LabHandler, 'log_message', lambda *a: None)
        self.log.start()
        self.temp = tempfile.TemporaryDirectory(prefix='dxx-v15-test-')
        self.calls = []
        def transport(payload, key, timeout):
            self.calls.append((payload, key, timeout))
            return success(payload, key, timeout)
        self.server = serve_lab.create_server(0, self.temp.name, token='test-teacher-token', testing=True, provider_transport=transport)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.server.server_address[1]
        self.bank = self.server.learning.bank()
        self.answers = {q['id']: q['correctOption'] for q in self.bank['items']}

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(3)
        self.temp.cleanup()
        self.env.stop()
        self.log.stop()

    def request(self, path, data=None, token=None, teacher=False, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=8)
        request_headers = {'Content-Type': 'application/json'}
        if token:
            request_headers['X-Learner-Token'] = token
        if teacher:
            request_headers['X-Teacher-Token'] = 'test-teacher-token'
        request_headers.update(headers or {})
        connection.request('POST' if data is not None else 'GET', path,
            json.dumps(data, ensure_ascii=False).encode('utf-8') if data is not None else None, request_headers)
        response = connection.getresponse()
        raw = response.read()
        status = response.status
        connection.close()
        try:
            value = json.loads(raw)
        except ValueError:
            value = raw.decode('utf-8', errors='replace')
        return status, value

    def start(self, sid=None, student=None):
        session = {'id': sid or str(uuid.uuid4()), 'caseId': 'cai', 'startedAt': '2026-10-18T01:00:00.000Z', 'student': student}
        status, result = self.request('/api/learning/start', {'session': session})
        self.assertEqual(status, 200, result)
        return session, result['accessToken']

    def assessment(self, session, token, kind='post', answers=None, rid=None):
        return self.request('/api/learning/assessment', {'session': session, 'requestId': rid or str(uuid.uuid4()),
            'kind': kind, 'answers': self.answers if answers is None else answers}, token)

    def discussion(self, session, token, **kw):
        data = {'session': session, 'requestId': str(uuid.uuid4()), 'objectiveId': 'O6', 'mode': 'deepen',
                'message': '为什么峰值合成图不能标为同一时刻的COP？', 'consent': True, **kw}
        return self.request('/api/learning/discussion', data, token)

    def enable(self):
        status, data = self.request('/api/teacher/ai-config', {'apiKey': KEY, 'enabled': True}, teacher=True)
        self.assertEqual(status, 200, data)

    def test_curriculum_hides_answers_and_static_bank(self):
        status, bank = self.request('/api/learning/curriculum')
        self.assertEqual(status, 200)
        self.assertEqual(len(bank['items']), 16)
        self.assertNotIn('correctOption', json.dumps(bank))
        self.assertNotIn('explanation', json.dumps(bank))
        for path in ['/learning/objectives-v15.json', '/docs/objectives-v15.json', '/clinic3d/docs/objectives-v15.json', '/learning/%6Fbjectives-v15.json']:
            self.assertEqual(self.request(path)[0], 404)
        self.assertEqual(self.calls, [])

    def test_start_token_resume_cross_session_and_hash(self):
        session, token = self.start()
        other, other_token = self.start()
        self.assertEqual(self.request('/api/learning/start', {'session': session})[0], 401)
        self.assertEqual(self.request('/api/learning/start', {'session': session}, token)[1]['accessToken'], token)
        self.assertEqual(self.request('/api/learning/state?sessionId=' + other['id'], token=token)[0], 401)
        self.assertEqual(self.assessment(other, token)[0], 401)
        status, state = self.request('/api/learning/state?sessionId=' + session['id'], token=token)
        self.assertEqual(status, 200)
        self.assertEqual(state['dataKind'], 'test')
        with self.server.store.connect() as connection:
            row = connection.execute('SELECT token_hash FROM learning_sessions WHERE session_id=?', (session['id'],)).fetchone()
        self.assertEqual(row[0], hashlib.sha256(token.encode()).hexdigest())
        self.assertNotIn(token, json.dumps(state))

    def test_legacy_records_preserved_and_can_enroll(self):
        session = {'id': 'legacy-1', 'caseId': 'cai', 'startedAt': '2026-10-18T01:00:00Z', 'student': None}
        event = {'id': 'event-1', 'sessionId': 'legacy-1', 'type': 'clinic3d_task_completed', 'at': session['startedAt'], 'payload': {'task': 'rom'}}
        self.assertEqual(self.request('/api/learning/events', {'session': session, 'events': [event]})[0], 200)
        before = self.request('/api/learning/sessions/legacy-1', teacher=True)[1]
        status, start = self.request('/api/learning/start', {'session': session})
        self.assertEqual(status, 200)
        self.assertEqual(self.request('/api/learning/sessions/legacy-1', teacher=True)[1], before)
        self.assertEqual(start['state']['assessments'], [])
        self.assertIsNone(start['state']['assessmentSummary']['latestPost'])

    def test_assessment_scores_complete_first_latest_and_duplicate(self):
        session, token = self.start()
        first_base = self.assessment(session, token, 'baseline')[1]['assessment']
        wrong = {q['id']: next(o['id'] for o in q['options'] if o['id'] != q['correctOption']) for q in self.bank['items']}
        self.assessment(session, token, 'baseline', wrong)
        first_post = self.assessment(session, token, answers=wrong)[1]['assessment']
        rid = str(uuid.uuid4())
        status, latest = self.assessment(session, token, rid=rid)
        duplicate_status, duplicate = self.assessment(session, token, rid=rid)
        self.assertEqual((status, duplicate_status), (200, 200))
        self.assertEqual(latest['assessment'], duplicate['assessment'])
        self.assertTrue(duplicate['duplicate'])
        self.assertEqual(latest['assessment']['score']['correct'], 16)
        self.assertTrue(all(x['status'] == 'achieved' for x in latest['assessment']['objectives']))
        self.assertEqual(latest['assessmentSummary']['baseline']['id'], first_base['id'])
        self.assertEqual(latest['assessmentSummary']['firstPost']['id'], first_post['id'])
        self.assertEqual(latest['assessmentSummary']['latestPost']['id'], latest['assessment']['id'])
        self.assertEqual(latest['assessmentSummary']['postAttempts'], 2)
        self.assertEqual(self.assessment(session, token, answers=wrong, rid=rid)[0], 409)

    def test_partial_is_not_zero_or_complete_and_no_client_score(self):
        session, token = self.start()
        status, data = self.assessment(session, token, answers={'O1-Q1': self.answers['O1-Q1']})
        self.assertEqual(status, 200)
        a = data['assessment']
        self.assertEqual(a['answered'], 1)
        self.assertFalse(a['complete'])
        self.assertIsNone(a['score']['rate'])
        self.assertEqual(a['score']['total'], 16)
        self.assertEqual(a['objectives'][0]['status'], 'partial')
        self.assertEqual(a['objectives'][1]['status'], 'not_assessed')
        self.assertIsNone(a['items'][1]['correct'])
        self.assertIsNone(data['assessmentSummary']['latestPost'])
        bad = {'session': session, 'requestId': 'forged-score', 'kind': 'post', 'answers': self.answers, 'score': 100}
        self.assertEqual(self.request('/api/learning/assessment', bad, token)[0], 422)
        self.assertEqual(self.assessment(session, token, answers={'unknown': 'a'})[0], 422)
        self.assertEqual(self.assessment(session, token, answers={'O1-Q1': 'z'})[0], 422)
        self.assertEqual(self.assessment(session, token, answers={'O1-Q1': {}})[0], 422)

    def test_teacher_config_auth_same_origin_and_no_auto_call_or_secret(self):
        self.assertEqual(self.request('/api/teacher/ai-config')[0], 401)
        self.assertEqual(self.request('/api/teacher/ai-config', {'apiKey': KEY})[0], 401)
        self.assertEqual(self.request('/api/teacher/ai-config', {'apiKey': KEY}, teacher=True, headers={'Origin': 'https://evil.example'})[0], 403)
        self.assertEqual(self.request('/api/teacher/ai-config', {'endpoint': 'http://evil.example'}, teacher=True)[0], 422)
        self.enable()
        _, config = self.request('/api/teacher/ai-config', teacher=True)
        self.assertEqual(config['keySource'], 'config_file')
        self.assertTrue(config['configured'])
        self.assertFalse(config['liveVerified'])
        self.assertNotIn(KEY, json.dumps(config))
        self.assertNotIn('apiKey', config)
        self.request('/api/learning/curriculum')
        self.request('/api/learning/status')
        self.assertEqual(self.calls, [])
        self.assertFalse(Path(self.server.learning.config_path).is_relative_to(serve_lab.ROOT))
        self.assertEqual(self.request('/ai-config.json')[0], 404)

    def test_environment_takes_precedence_and_clear_file_cannot_clear_env(self):
        self.enable()
        with patch.dict(os.environ, {'DEEPSEEK_API_KEY': 'sk-fixture-63f3755fcc88175a'}):
            status, result = self.request('/api/teacher/ai-config', {'clearKey': True}, teacher=True)
            self.assertEqual(status, 200)
            self.assertEqual(result['keySource'], 'environment')
            self.assertTrue(result['configured'])
        self.assertFalse(self.server.learning.ai_config()['configured'])

    def test_no_key_503_is_real_failure_not_fake_reply(self):
        session, token = self.start()
        status, result = self.discussion(session, token)
        self.assertEqual(status, 503)
        self.assertEqual(result['errorCode'], 'ai_not_configured')
        _, state = self.request('/api/learning/state?sessionId=' + session['id'], token=token)
        conversation = state['conversations'][0]
        self.assertEqual([m['role'] for m in conversation['messages']], ['user'])
        self.assertIsNone(conversation['turns'][0]['reply'])
        self.assertEqual(state['usage']['succeeded'], 0)
        self.assertEqual(state['usage']['failed'], 1)
        self.assertEqual(state['usage']['unknownUsageCount'], 1)
        self.assertEqual(self.calls, [])

    def test_success_payload_minimal_redacted_bounded_and_state(self):
        self.enable()
        student = {'name': '测试姓名甲', 'studentId': 'STUDENT-SECRET-999', 'teacher': '教师专用名称乙'}
        session, token = self.start(student=student)
        rid = str(uuid.uuid4())
        status, data = self.discussion(session, token, requestId=rid, message='我是测试姓名甲 STUDENT-SECRET-999 教师专用名称乙，' + KEY + '。COP是什么？')
        self.assertEqual(status, 200, data)
        self.assertEqual(data['status'], 'succeeded')
        self.assertEqual(len(self.calls), 1)
        payload = self.calls[0][0]
        serialized = json.dumps(payload, ensure_ascii=False)
        for secret in [*student.values(), KEY, token, session['id']]:
            self.assertNotIn(secret, serialized)
        self.assertEqual(payload['thinking'], {'type': 'disabled'})
        self.assertEqual(payload['max_tokens'], 640)
        self.assertEqual(payload['model'], 'deepseek-flash')
        self.assertNotIn('user_id', payload)
        _, state = self.request('/api/learning/state?sessionId=' + session['id'], token=token)
        self.assertEqual([m['role'] for m in state['conversations'][0]['messages']], ['user', 'assistant'])
        self.assertEqual(state['usage']['promptTokens'], 100)
        self.assertEqual(state['usage']['completionTokens'], 20)
        self.assertEqual(state['identityKind'], 'registered')
        self.assertNotIn(KEY, json.dumps(state))
        self.assertNotIn(KEY.encode(), Path(self.server.store.path).read_bytes())

    def test_provider_error_and_unsafe_output_do_not_leak_secret(self):
        self.enable()
        session, token = self.start()
        def fail(*a):
            raise RuntimeError('Authorization Bearer ' + KEY)
        self.server.learning.transport = fail
        status, data = self.discussion(session, token)
        self.assertEqual(status, 502)
        self.assertNotIn(KEY, json.dumps(data))
        self.assertEqual(data['status'], 'failed')
        def echo(*a):
            raw = success(*a)
            raw['choices'][0]['message']['content'] = '不要输出凭据 ' + KEY
            return raw
        self.server.learning.transport = echo
        status, data = self.discussion(session, token)
        self.assertEqual(status, 200)
        self.assertNotIn(KEY, data['reply'])
        _, detail = self.request('/api/teacher/learning?sessionId=' + session['id'], teacher=True)
        self.assertEqual(detail['usage']['succeeded'], 1)
        self.assertEqual(detail['usage']['failed'], 1)
        self.assertNotIn(KEY, json.dumps(detail))

    def test_inflight_retry_does_not_bill_twice_and_conflicting_body_rejected(self):
        self.enable()
        session, token = self.start()
        entered, release = threading.Event(), threading.Event()
        def slow(payload, key, timeout):
            self.calls.append((payload, key, timeout))
            entered.set()
            self.assertTrue(release.wait(5))
            return success(payload, key, timeout)
        self.server.learning.transport = slow
        rid = str(uuid.uuid4())
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            pending = executor.submit(self.discussion, session, token, requestId=rid)
            self.assertTrue(entered.wait(3))
            status, duplicate = self.discussion(session, token, requestId=rid)
            self.assertEqual(status, 202)
            self.assertEqual(duplicate['status'], 'pending')
            self.assertEqual(self.discussion(session, token, requestId=rid, message='不同内容')[0], 409)
            release.set()
            first = pending.result(timeout=5)
        repeated = self.discussion(session, token, requestId=rid)
        self.assertEqual(first[1]['reply'], repeated[1]['reply'])
        self.assertTrue(repeated[1]['duplicate'])
        self.assertEqual(len(self.calls), 1)

    def test_other_session_cannot_continue_or_read_conversation(self):
        self.enable()
        session, token = self.start()
        other, other_token = self.start()
        _, first = self.discussion(session, token)
        self.assertEqual(self.discussion(other, other_token, conversationId=first['conversationId'])[0], 404)
        self.assertEqual(self.request('/api/teacher/learning?sessionId=' + session['id'], token=other_token)[0], 401)
        self.assertEqual(self.discussion(session, token, conversationId=first['conversationId'], mode='extend')[0], 409)
        self.assertEqual(len(self.calls), 1)

    def test_discussion_limits_and_input_validation(self):
        self.enable()
        session, token = self.start()
        self.assertEqual(self.discussion(session, token, message='x' * 1501)[0], 422)
        self.assertEqual(self.discussion(session, token, consent=False)[0], 422)
        with patch.dict(service.LIMITS, {'maxRequestsPerSession': 1}):
            self.assertEqual(self.discussion(session, token)[0], 200)
            status, data = self.discussion(session, token)
            self.assertEqual(status, 429)
            self.assertEqual(data['errorCode'], 'discussion_limit_reached')
        self.assertEqual(len(self.calls), 1)

    def test_teacher_test_explicit_consent_and_idempotency_no_live_claim(self):
        self.enable()
        self.assertEqual(self.calls, [])
        self.assertEqual(self.request('/api/teacher/ai-test', {'requestId': 't1', 'consentToCharge': False}, teacher=True)[0], 422)
        self.assertEqual(self.calls, [])
        body = {'requestId': 't2', 'consentToCharge': True}
        self.assertEqual(self.request('/api/teacher/ai-test', body)[0], 401)
        status, result = self.request('/api/teacher/ai-test', body, teacher=True)
        self.assertEqual(status, 200)
        self.assertFalse(result['liveVerified'])
        self.assertEqual(self.calls[0][0]['max_tokens'], 32)
        self.assertTrue(self.request('/api/teacher/ai-test', body, teacher=True)[1]['duplicate'])
        self.assertEqual(len(self.calls), 1)

    def test_feedback_auth_validation_dedupe_and_teacher(self):
        session, token = self.start()
        body = {'session': session, 'requestId': 'feedback-1', 'rating': 4, 'category': 'content', 'text': '解释可更短。', 'consent': True}
        self.assertEqual(self.request('/api/learning/feedback', body)[0], 401)
        status, result = self.request('/api/learning/feedback', body, token)
        self.assertEqual(status, 200)
        self.assertTrue(self.request('/api/learning/feedback', body, token)[1]['duplicate'])
        self.assertEqual(self.request('/api/learning/feedback', {**body, 'rating': 3}, token)[0], 409)
        self.assertEqual(self.request('/api/learning/feedback', {**body, 'requestId': 'f2', 'rating': True}, token)[0], 422)
        detail = self.request('/api/teacher/learning?sessionId=' + session['id'], teacher=True)[1]
        self.assertEqual(len(detail['feedback']), 1)
        self.assertEqual(detail['feedback'][0]['text'], '解释可更短。')

    def test_teacher_denominators_partial_and_registered_dedup(self):
        student = {'name': '张同学', 'studentId': 'S001', 'teacher': '林老师'}
        one, token_one = self.start(student=student)
        two, token_two = self.start(student=student)
        guest, token_guest = self.start()
        self.assessment(one, token_one)
        self.assessment(two, token_two, answers={'O1-Q1': self.answers['O1-Q1']})
        status, overview = self.request('/api/teacher/learning', teacher=True)
        self.assertEqual(status, 200)
        self.assertEqual(overview['totals']['learningSessions'], 3)
        self.assertEqual(overview['totals']['registeredSessions'], 2)
        self.assertEqual(overview['sessionSummary']['objectiveDenominator'], 8)
        self.assertEqual(overview['sessionSummary']['untestedSessions'], 2)
        self.assertEqual(overview['objectives'][0]['latestPost']['tested'], 1)
        self.assertEqual(overview['objectives'][0]['latestPost']['partial'], 1)
        self.assertEqual(overview['objectives'][0]['latestPost']['notAssessed'], 2)
        self.assertEqual(overview['objectives'][0]['latestPost']['rate'], 1)
        self.assertEqual(len(overview['registeredLearners']), 1)
        self.assertEqual(overview['registeredLearners'][0]['sessionCount'], 2)
        self.assertEqual(overview['registeredSummary']['test']['registeredLearners'], 1)
        self.assertEqual(overview['registeredSummary']['test']['objectiveDenominator'], 8)
        self.assertEqual(overview['cohorts']['classroom']['summary']['eligibleSessions'], 0)

    def test_restart_pending_becomes_unknown_without_replay(self):
        session, token = self.start()
        data = {'session': session, 'requestId': 'interrupted', 'objectiveId': 'O6', 'mode': 'deepen', 'message': '未完成请求', 'consent': True}
        with self.server.store.connect() as connection:
            self.server.learning.save_request(connection, session['id'], 'interrupted', 'discussion', self.server.learning.fingerprint(data), None, service.now(), 'pending', 202)
        new = service.LearningService(self.server.store, serve_lab.ROOT, self.temp.name, serve_lab.load_cases, testing=True, transport=success)
        result, status = new.discuss(data, token)
        self.assertEqual(status, 409)
        self.assertEqual(result['status'], 'unknown')
        self.assertEqual(result['errorCode'], 'interrupted_unknown')
        self.assertEqual(self.calls, [])

    def test_unknown_usage_is_not_zero_success(self):
        self.enable()
        session, token = self.start()
        def missing_usage(*args):
            result = success(*args)
            result.pop('usage')
            return result
        self.server.learning.transport = missing_usage
        self.assertEqual(self.discussion(session, token)[0], 200)
        _, state = self.request('/api/learning/state?sessionId=' + session['id'], token=token)
        self.assertEqual(state['usage']['succeeded'], 1)
        self.assertEqual(state['usage']['unknownUsageCount'], 1)
        self.assertIsNone(state['conversations'][0]['turns'][0]['usage'])

    def test_actual_mock_http_transport_fixed_endpoint_and_auth(self):
        """Exercise real HTTP parsing without an external request or configurable URL."""
        self.enable()
        session, token = self.start()
        received = []
        class MockProvider(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass
            def do_POST(self):
                received.append({'path': self.path, 'auth': self.headers.get('Authorization'),
                    'payload': json.loads(self.rfile.read(int(self.headers['Content-Length'])))})
                raw = json.dumps(success(None, None, None), ensure_ascii=False).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)
        upstream = ThreadingHTTPServer(('127.0.0.1', 0), MockProvider)
        worker = threading.Thread(target=upstream.serve_forever, daemon=True)
        worker.start()
        real_build = urllib.request.build_opener
        destinations = []
        class TestOnlyProxy:
            def open(self, request, timeout):
                destinations.append(request.full_url)
                # This rewrite exists only in this test. The production API has
                # no endpoint field and official_transport remains fixed HTTPS.
                request.full_url = f'http://127.0.0.1:{upstream.server_address[1]}/chat/completions'
                return real_build(service.NoRedirect()).open(request, timeout=timeout)
        self.server.learning.transport = service.official_transport
        try:
            with patch.object(urllib.request, 'build_opener', return_value=TestOnlyProxy()):
                status, result = self.discussion(session, token)
            self.assertEqual(status, 200, result)
            self.assertEqual(destinations, [service.ENDPOINT])
            self.assertEqual(received[0]['auth'], 'Bearer ' + KEY)
            self.assertEqual(received[0]['payload']['model'], 'deepseek-flash')
        finally:
            upstream.shutdown()
            upstream.server_close()
            worker.join(3)

    def test_http_redirect_is_rejected_without_following_or_leaking(self):
        self.enable()
        session, token = self.start()
        class RedirectProvider(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass
            def do_POST(self):
                self.rfile.read(int(self.headers['Content-Length']))
                self.send_response(307)
                self.send_header('Location', 'https://must-never-be-requested.invalid/' + KEY)
                self.send_header('Content-Length', '0')
                self.end_headers()
        upstream = ThreadingHTTPServer(('127.0.0.1', 0), RedirectProvider)
        worker = threading.Thread(target=upstream.serve_forever, daemon=True)
        worker.start()
        real_build = urllib.request.build_opener
        class TestOnlyProxy:
            def open(self, request, timeout):
                request.full_url = f'http://127.0.0.1:{upstream.server_address[1]}/chat/completions'
                return real_build(service.NoRedirect()).open(request, timeout=timeout)
        self.server.learning.transport = service.official_transport
        try:
            with patch.object(urllib.request, 'build_opener', return_value=TestOnlyProxy()):
                status, result = self.discussion(session, token)
            self.assertEqual(status, 502)
            self.assertEqual(result['errorCode'], 'upstream_http_error')
            self.assertNotIn(KEY, json.dumps(result))
        finally:
            upstream.shutdown()
            upstream.server_close()
            worker.join(3)

    def test_activity_uses_server_receive_times_and_deduped_completions(self):
        session, token = self.start()
        event = {'id': 'completion-1', 'sessionId': session['id'], 'type': 'clinic3d_learning_complete',
                 'at': '2020-01-01T00:00:00Z', 'payload': {'caseId': 'cai'}}
        batch = {'session': session, 'events': [event]}
        self.assertEqual(self.request('/api/learning/events', batch)[0], 200)
        self.assertEqual(self.request('/api/learning/events', batch)[1]['duplicates'], 1)
        self.assessment(session, token, answers={})
        _, detail = self.request('/api/teacher/learning?sessionId=' + session['id'], teacher=True)
        self.assertEqual(detail['activity']['eventCount'], 1)
        self.assertEqual(detail['activity']['learningCompleteCount'], 1)
        self.assertNotEqual(detail['activity']['firstReceivedAt'], event['at'])
        self.assertLessEqual(detail['activity']['firstReceivedAt'], detail['activity']['lastReceivedAt'])
        self.assertEqual(detail['assessmentSummary']['postPartialAttempts'], 1)
        self.assertEqual(detail['assessmentSummary']['baselinePartialAttempts'], 0)

    def test_siliconflow_config_exact_model_and_public_provider(self):
        status, result = self.request('/api/teacher/ai-config', {
            'provider': 'siliconflow', 'model': 'deepseek-ai/DeepSeek-V4.1-Flash', 'apiKey': KEY, 'enabled': True}, teacher=True)
        self.assertEqual(status, 200, result)
        self.assertEqual(result['provider'], 'siliconflow')
        self.assertEqual(result['providerLabel'], '硅基流动（DeepSeek）')
        self.assertEqual(result['endpoint'], 'https://api.siliconflow.cn/v1/chat/completions')
        self.assertEqual(result['model'], 'deepseek-ai/DeepSeek-V4.1-Flash')
        self.assertIn('deepseek-ai/DeepSeek-V4-Flash', result['allowedModels'])
        self.assertEqual(result['allowedProviders'], ['deepseek', 'siliconflow'])
        self.assertNotIn(KEY, json.dumps(result))
        self.assertEqual(self.request('/api/learning/curriculum')[1]['ai']['provider'], 'siliconflow')
        self.assertEqual(self.request('/api/learning/status')[1]['ai']['provider'], 'siliconflow')
        session, token = self.start()
        self.assertEqual(self.request('/api/learning/state?sessionId=' + session['id'], token=token)[1]['ai']['provider'], 'siliconflow')
        self.assertEqual(self.calls, [])

    def test_provider_model_allowlist_no_silent_substitution_or_url(self):
        self.assertEqual(self.request('/api/teacher/ai-config', {'provider': 'siliconflow'}, teacher=True)[0], 422)
        for body in [
            {'provider': 'unknown', 'model': 'deepseek-flash'},
            {'provider': 'siliconflow', 'model': 'deepseek-flash'},
            {'provider': 'deepseek', 'model': 'deepseek-ai/DeepSeek-V4.1-Flash'},
            {'provider': 'siliconflow', 'model': 'deepseek-ai/DeepSeek-V4.1-Flash', 'endpoint': 'https://evil.invalid'},
            {'provider': 'siliconflow', 'model': 'deepseek-ai/Unverified-Alias'},
        ]:
            self.assertEqual(self.request('/api/teacher/ai-config', body, teacher=True)[0], 422)
        self.assertEqual(self.server.learning.ai_config()['provider'], 'deepseek')
        self.assertEqual(self.server.learning.ai_config()['model'], 'deepseek-flash')
        self.assertEqual(self.calls, [])

    def test_provider_credentials_are_not_forwarded_to_different_recipient(self):
        self.enable()
        with patch.dict(os.environ, {'DEEPSEEK_API_KEY': 'sk-fixture-6edc6ab66a6b1354'}):
            status, result = self.request('/api/teacher/ai-config', {'provider': 'siliconflow',
                'model': 'deepseek-ai/DeepSeek-V4.1-Flash', 'enabled': True}, teacher=True)
            self.assertEqual(status, 200)
            self.assertFalse(result['configured'])
            self.assertEqual(result['keySource'], 'none')
            session, token = self.start()
            self.assertEqual(self.discussion(session, token, provider='siliconflow')[0], 503)
            self.assertEqual(self.calls, [])
            with patch.dict(os.environ, {'SILICONFLOW_API_KEY': 'sk-fixture-1064e71dfbda3e02'}):
                self.assertEqual(self.discussion(session, token, provider='siliconflow')[0], 200)
                self.assertEqual(self.calls[0][1], 'sk-fixture-1064e71dfbda3e02')

    def test_siliconflow_payload_history_provider_and_no_fake_model_fallback(self):
        self.request('/api/teacher/ai-config', {'provider': 'siliconflow', 'model': 'deepseek-ai/DeepSeek-V4.1-Flash',
            'apiKey': KEY, 'enabled': True}, teacher=True)
        session, token = self.start()
        status, result = self.discussion(session, token, provider='siliconflow')
        self.assertEqual(status, 200, result)
        payload = self.calls[0][0]
        self.assertEqual(payload['model'], 'deepseek-ai/DeepSeek-V4.1-Flash')
        self.assertIs(payload['enable_thinking'], False)
        self.assertNotIn('thinking', payload)
        self.assertFalse(payload['stream'])
        self.assertEqual(result['provider'], 'siliconflow')
        _, detail = self.request('/api/teacher/learning?sessionId=' + session['id'], teacher=True)
        self.assertEqual(detail['conversations'][0]['turns'][0]['provider'], 'siliconflow')
        self.assertEqual(detail['conversations'][0]['turns'][0]['model'], 'deepseek-ai/DeepSeek-V4.1-Flash')

    def test_provider_changed_after_consent_is_409_and_never_sent(self):
        self.enable()
        session, token = self.start()
        status, result = self.discussion(session, token, provider='siliconflow')
        self.assertEqual(status, 409)
        self.assertEqual(result['errorCode'], 'provider_changed')
        self.assertEqual(self.calls, [])
        self.assertEqual(self.server.learning.state(session['id'], token)['conversations'], [])
        self.assertEqual(self.discussion(session, token, provider='deepseek')[0], 200)

    def test_provider_model_key_changes_invalidate_only_matching_live_test(self):
        self.enable()
        # Seed only a fixture credential hash, never an actual provider request.
        config = self.server.learning.config
        config.update({'liveVerified': True, 'testedCredentialHash': service.LearningService.token_hash(KEY),
            'testedModel': 'deepseek-flash', 'testedProvider': 'deepseek'})
        self.assertTrue(self.server.learning.ai_config()['liveVerified'])
        self.request('/api/teacher/ai-config', {'model': 'deepseek-flash', 'enabled': False}, teacher=True)
        self.assertTrue(self.server.learning.ai_config()['liveVerified'])
        self.request('/api/teacher/ai-config', {'model': 'deepseek-v4-pro'}, teacher=True)
        self.assertFalse(self.server.learning.ai_config()['liveVerified'])
        config.update({'liveVerified': True, 'testedCredentialHash': service.LearningService.token_hash(KEY),
            'testedModel': 'deepseek-v4-pro', 'testedProvider': 'deepseek'})
        self.request('/api/teacher/ai-config', {'provider': 'siliconflow', 'model': 'deepseek-ai/DeepSeek-V4.1-Flash', 'apiKey': KEY}, teacher=True)
        self.assertFalse(self.server.learning.ai_config()['liveVerified'])
        config.update({'liveVerified': True, 'testedCredentialHash': service.LearningService.token_hash(KEY),
            'testedModel': 'deepseek-ai/DeepSeek-V4.1-Flash', 'testedProvider': 'siliconflow'})
        self.assertTrue(self.server.learning.ai_config()['liveVerified'])
        self.request('/api/teacher/ai-config', {'apiKey': 'sk-fixture-d0f55eb7ef6192e0'}, teacher=True)
        self.assertFalse(self.server.learning.ai_config()['liveVerified'])

    def test_legacy_config_without_provider_and_old_turn_schema_preserved(self):
        self.enable()
        session, token = self.start()
        self.discussion(session, token)
        with self.server.store.connect() as connection:
            connection.execute('ALTER TABLE learning_turns DROP COLUMN provider')
        self.server.learning.config_path.write_text(json.dumps({'model': 'deepseek-flash', 'enabled': True, 'maxTokens': 640, 'apiKey': KEY}), encoding='utf-8')
        migrated = service.LearningService(self.server.store, serve_lab.ROOT, self.temp.name, serve_lab.load_cases, testing=True, transport=success)
        self.assertEqual(migrated.ai_config()['provider'], 'deepseek')
        self.assertTrue(migrated.ai_config()['configured'])
        detail = migrated.state(session['id'], token)
        self.assertEqual(len(detail['conversations'][0]['turns']), 1)
        self.assertEqual(detail['conversations'][0]['turns'][0]['provider'], 'deepseek')
        self.assertEqual(detail['conversations'][0]['turns'][0]['status'], 'succeeded')

    def test_actual_siliconflow_mock_http_endpoint_and_request(self):
        self.request('/api/teacher/ai-config', {'provider': 'siliconflow', 'model': 'deepseek-ai/DeepSeek-V4.1-Flash',
            'apiKey': KEY, 'enabled': True}, teacher=True)
        session, token = self.start()
        received, destinations = [], []
        class MockProvider(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass
            def do_POST(self):
                received.append(json.loads(self.rfile.read(int(self.headers['Content-Length']))))
                raw = json.dumps(success(None, None, None)).encode()
                self.send_response(200)
                self.send_header('Content-Length', str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)
        upstream = ThreadingHTTPServer(('127.0.0.1', 0), MockProvider)
        worker = threading.Thread(target=upstream.serve_forever, daemon=True)
        worker.start()
        real_build = urllib.request.build_opener
        class TestOnlyProxy:
            def open(self, request, timeout):
                destinations.append(request.full_url)
                request.full_url = f'http://127.0.0.1:{upstream.server_address[1]}/v1/chat/completions'
                return real_build(service.NoRedirect()).open(request, timeout=timeout)
        self.server.learning.transport = None
        try:
            with patch.object(urllib.request, 'build_opener', return_value=TestOnlyProxy()):
                status, result = self.discussion(session, token, provider='siliconflow')
            self.assertEqual(status, 200, result)
            self.assertEqual(destinations, ['https://api.siliconflow.cn/v1/chat/completions'])
            self.assertEqual(received[0]['model'], 'deepseek-ai/DeepSeek-V4.1-Flash')
            self.assertIs(received[0]['enable_thinking'], False)
            self.assertNotIn('thinking', received[0])
        finally:
            upstream.shutdown()
            upstream.server_close()
            worker.join(3)


if __name__ == '__main__':
    unittest.main(verbosity=2)
