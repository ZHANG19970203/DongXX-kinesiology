"""Verify new navigation events with the unchanged collector, using isolated data."""
import http.client
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import serve_lab


class NavigationEvents(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {'DEEPSEEK_API_KEY':'', 'SILICONFLOW_API_KEY':''})
        self.environment.start()
        self.log = patch.object(serve_lab.LabHandler, 'log_message', lambda *args: None)
        self.log.start()
        self.temporary = tempfile.TemporaryDirectory(prefix='dxx-v16-navigation-')
        def forbidden(*args):
            raise AssertionError('No provider may be called by navigation tests.')
        self.server = serve_lab.create_server(0, self.temporary.name, token='navigation-test-token', testing=True, provider_transport=forbidden)
        self.worker = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.worker.start()
        self.session = {'id':'navigation-fixture', 'caseId':'cai', 'startedAt':'2026-10-18T00:00:00.000Z', 'student':None}
        self.event = {'id':'navigation-jump-1', 'sessionId':self.session['id'], 'type':'student_navigation_jump',
            'at':'2026-10-18T00:00:01.000Z', 'payload':{'source':'clinic3d-v16-navigation',
            'fromNode':'welcome', 'toNode':'pressure_intro', 'fromAct':'act1', 'toAct':'act6',
            'missedStages':['act2','act3','act4','act5'], 'restoredBookmark':False,
            'sessionPreserved':True, 'notClinicalSkillAssessment':True, 'scope':'navigation_only_no_assessment_credit'}}

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.worker.join(3)
        self.temporary.cleanup()
        self.log.stop()
        self.environment.stop()

    def request(self, path, data=None, teacher=False, token=None):
        headers = {'Content-Type':'application/json'}
        if teacher: headers['X-Teacher-Token']='navigation-test-token'
        if token: headers['X-Learner-Token']=token
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_address[1], timeout=8)
        connection.request('POST' if data is not None else 'GET', path, json.dumps(data).encode() if data is not None else None, headers)
        response = connection.getresponse()
        result = json.loads(response.read())
        status = response.status
        connection.close()
        return status, result

    def test_actual_navigation_payload_is_accepted_once_and_preserved(self):
        batch = {'session':self.session,'events':[self.event]}
        first = self.request('/api/learning/events', batch)
        second = self.request('/api/learning/events', batch)
        self.assertEqual(first[0], 200)
        self.assertEqual(first[1]['accepted'], 1)
        self.assertEqual(second[1]['duplicates'], 1)
        status, detail = self.request('/api/learning/sessions/' + self.session['id'], teacher=True)
        self.assertEqual(status, 200)
        self.assertEqual(len(detail['events']), 1)
        self.assertEqual(detail['events'][0]['payload'], self.event['payload'])
        self.assertNotEqual(detail['events'][0]['receivedAt'], self.event['at'])

    def test_jump_never_counts_as_learning_completion_or_knowledge_score(self):
        self.request('/api/learning/events', {'session':self.session,'events':[self.event]})
        _, detail = self.request('/api/teacher/learning?sessionId=' + self.session['id'], teacher=True)
        self.assertEqual(detail['activity']['eventCount'], 1)
        self.assertEqual(detail['activity']['learningCompleteCount'], 0)
        self.assertEqual(detail['assessments'], [])
        self.assertIsNone(detail['assessmentSummary']['latestPost'])
        self.assertEqual(detail['usage']['providerAttempted'], 0)
        _, overview = self.request('/api/teacher/learning', teacher=True)
        self.assertEqual(overview['totals']['legacySessionsNotEnrolled'], 1)
        self.assertEqual(overview['sessionSummary']['objectiveDenominator'], 0)
        self.assertIsNone(overview['sessionSummary']['rate'])

    def test_enrolled_learner_keeps_attempts_separate_from_jump_events(self):
        status, start = self.request('/api/learning/start', {'session':self.session})
        self.assertEqual(status, 200)
        self.request('/api/learning/events', {'session':self.session,'events':[self.event]})
        status, state = self.request('/api/learning/state?sessionId=' + self.session['id'], token=start['accessToken'])
        self.assertEqual(status, 200)
        self.assertTrue(state['learningEnabled'])
        self.assertEqual(state['dataKind'], 'test')
        self.assertEqual(state['assessments'], [])
        self.assertEqual(state['activity']['learningCompleteCount'], 0)
        self.assertEqual(state['conversations'], [])


if __name__=='__main__':
    target = Path(sys.argv[1]) if len(sys.argv)>1 else None
    program = unittest.main(argv=[sys.argv[0]], verbosity=2, exit=False)
    if target:
        target.parent.mkdir(parents=True, exist_ok=True)
        site = Path(__file__).resolve().parents[1]
        report = {'schema':'dxx-navigation-event-tests-v16', 'generatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),
            'passed':program.result.wasSuccessful(), 'total':program.result.testsRun,
            'checks':unittest.defaultTestLoader.getTestCaseNames(NavigationEvents),
            'collectorCodeChangedForV16':False, 'externalRequests':0, 'paidRequests':0,
            'method':'Real loopback HTTP and isolated temporary SQLite; legacy collector accepts student_navigation_jump by existing lowercase event type validation. No live learner records or credentials accessed.',
            'analytics':'A navigation event counts as an event only; no learningCompleteCount, assessment, knowledge score or provider use is fabricated.',
            'sha256':{name:hashlib.sha256((site/name).read_bytes()).hexdigest() for name in ['serve_lab.py','learning_service.py','tests/test_navigation_events_v16.py']}}
        target.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    sys.exit(0 if program.result.wasSuccessful() else 1)
