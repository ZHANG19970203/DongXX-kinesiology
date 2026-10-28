"""Loopback-only teaching demo: static site, learning events, and teacher review.

Run: python serve_lab.py [--port 8771] [--data-dir OUTSIDE_SITE]
Teacher access uses an ephemeral local token, not a school identity system.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager
import datetime as dt
import hmac
import json
import mimetypes
import math
import os
from pathlib import Path
import re
import secrets
import socket
import sqlite3
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlsplit

sys.dont_write_bytecode = True
from learning_service import LearningService, ServiceError

ROOT = Path(__file__).resolve().parent
sys.dont_write_bytecode = True
ID_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}\Z")
TYPE_RE = re.compile(r"[a-z][a-z0-9_]{0,63}\Z")
MAX_BODY = 262144
MAX_EVENTS = 100
STATIC_SUFFIXES = {'.html', '.css', '.js', '.json', '.csv', '.txt', '.svg', '.png',
                   '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.glb', '.gltf', '.bin',
                   '.mp4', '.webm', '.woff', '.woff2', '.ttf', '.pdf', '.md', '.cmd', '.py', '.mjs'}
PUBLIC_DOCUMENTS = {'/.nojekyll', '/assembly/licenses/SOMAKINE_DATA_LICENSE', '/assembly/licenses/SOMAKINE_NOTICE'}
STATIC_SUFFIXES.update({'.cjs', '.ps1', '.mp3'})


class APIError(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def dumps(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), sort_keys=True)


def text_field(value, label, maximum, minimum=0):
    if not isinstance(value, str) or not minimum <= len(value) <= maximum:
        raise APIError(422, f'{label} 必须为 {minimum}–{maximum} 个字符的文字。')
    if any(ord(c) < 32 and c not in '\n\r\t' for c in value):
        raise APIError(422, f'{label} 包含非法控制字符。')
    return value


def identifier(value, label):
    if not isinstance(value, str) or not ID_RE.fullmatch(value):
        raise APIError(422, f'{label} 格式无效。')
    return value


def timestamp(value, label):
    text_field(value, label, 48, 10)
    try:
        result = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
        if result.tzinfo is None or not 2020 <= result.year <= 2100:
            raise ValueError()
    except ValueError:
        raise APIError(422, f'{label} 必须为带时区的 ISO 日期。')
    return value


def json_shape(value, depth=0, budget=None):
    if budget is None:
        budget = [0]
    budget[0] += 1
    if depth > 10 or budget[0] > 2500:
        raise APIError(422, '事件内容过于复杂。')
    if isinstance(value, dict):
        if len(value) > 80:
            raise APIError(422, '事件字段过多。')
        for k, v in value.items():
            text_field(k, '字段名', 80, 1)
            json_shape(v, depth + 1, budget)
    elif isinstance(value, list):
        if len(value) > 300:
            raise APIError(422, '事件列表过长。')
        for item in value:
            json_shape(item, depth + 1, budget)
    elif isinstance(value, str):
        text_field(value, '事件文字', 6000)
    elif isinstance(value, float) and not math.isfinite(value):
        raise APIError(422, '事件数值必须有限。')
    elif value is not None and not isinstance(value, (int, float, bool)):
        raise APIError(422, '事件内容类型无效。')


def load_cases():
    try:
        raw = json.loads((ROOT / 'clinic' / 'cases.json').read_text(encoding='utf-8-sig'))
        return {c['id']: c for c in raw['cases']}
    except (OSError, ValueError, KeyError, TypeError):
        raise APIError(503, '案例资料暂不可用，请检查 clinic/cases.json。')


def choice_ids(case, field):
    if field == 'interviewed':
        return {x['id'] for x in case.get('questions', [])}
    if field == 'exams':
        return {x['id'] for x in case.get('exams', [])}
    if field == 'evidence':
        return {x['id'] for x in case.get('evidence', [])}
    if field == 'explanations':
        return {x['id'] for x in case.get('explanation', {}).get('points', [])}
    return {x['id'] for x in case.get('plan', {}).get('options', [])}


def validate_completion(payload, case):
    if payload.get('caseId') != case['id']:
        raise APIError(422, '完成记录的 caseId 与会话不一致。')
    for field in ('interviewed', 'exams', 'evidence', 'explanations', 'plan'):
        values = payload.get(field)
        if not isinstance(values, list) or len(values) > 80 or any(not isinstance(x, str) for x in values):
            raise APIError(422, f'{field} 必须为有限的 ID 列表。')
        if len(values) != len(set(values)) or not set(values) <= choice_ids(case, field):
            raise APIError(422, f'{field} 包含重复或未知选项。')
    text_field(payload.get('reflection'), 'reflection', 6000)
    seconds = payload.get('durationSeconds')
    if isinstance(seconds, bool) or not isinstance(seconds, (int, float)) or not 0 <= seconds <= 604800:
        raise APIError(422, 'durationSeconds 必须在 0–604800 之间。')
    coverage = payload.get('coverage')
    if not isinstance(coverage, dict):
        raise APIError(422, 'coverage 必须为对象。')
    essential = {q['id'] for q in case.get('questions', []) if q.get('essential')}
    expected = {'asked': len(payload['interviewed']),
                'essentialAsked': len(set(payload['interviewed']) & essential),
                'essentialTotal': len(essential)}
    if any(type(coverage.get(k)) is not int or coverage[k] != v for k, v in expected.items()):
        raise APIError(422, 'coverage 与病例及问诊 ID 不一致。')


def validate_event_payload(event, case):
    kind, payload = event['type'], event['payload']
    if kind == 'learning_active_interval':
        from usage_service import valid_interval
        if valid_interval(payload) is None:
            raise APIError(422, '学习时段需为有效且不超过30秒的可见活动区间。')
    if kind in ('student_message', 'patient_message'):
        text_field(payload.get('text'), 'payload.text', 6000, 1)
    if 'questionId' in payload and payload['questionId'] is not None:
        if not isinstance(payload['questionId'], str) or payload['questionId'] not in choice_ids(case, 'interviewed'):
            raise APIError(422, '未知问诊问题 ID。')
    if kind == 'question_asked' and payload.get('questionId') not in choice_ids(case, 'interviewed'):
        raise APIError(422, 'question_asked 需包含已知 questionId。')
    if kind in ('exam_selected', 'exam_explained', 'exam_completed'):
        if not isinstance(payload.get('examId'), str) or payload['examId'] not in choice_ids(case, 'exams'):
            raise APIError(422, '未知检查 ID。')
    if kind == 'exam_explained':
        text_field(payload.get('text'), '检查前解释', 6000, 1)
    if kind == 'exam_completed':
        if type(payload.get('appropriate')) is not bool:
            raise APIError(422, '检查 appropriate 需为布尔值。')
        text_field(payload.get('result'), '检查结果', 6000, 1)
    for event_type, field, choices in [('evidence_toggled', 'evidenceId', 'evidence'),
                                      ('explanation_toggled', 'explanationId', 'explanations'),
                                      ('plan_toggled', 'planId', 'plan')]:
        if kind == event_type:
            if not isinstance(payload.get(field), str) or payload[field] not in choice_ids(case, choices):
                raise APIError(422, f'未知 {field}。')
            if type(payload.get('selected')) is not bool:
                raise APIError(422, 'selected 需为布尔值。')
    if kind == 'encounter_complete':
        validate_completion(payload, case)


def validate_batch(data):
    if not isinstance(data, dict) or set(data) != {'session', 'events'}:
        raise APIError(422, '请求需包含 session 和 events。')
    session = data['session']
    if not isinstance(session, dict) or set(session) - {'id', 'caseId', 'startedAt', 'student'}:
        raise APIError(422, 'session 字段无效。')
    identifier(session.get('id'), 'session.id')
    cases = load_cases()
    case_id = session.get('caseId')
    if not isinstance(case_id, str) or case_id not in cases:
        raise APIError(422, '未知案例。')
    timestamp(session.get('startedAt'), 'session.startedAt')
    student = session.get('student')
    if student is not None:
        if not isinstance(student, dict) or set(student) != {'name', 'studentId', 'teacher'}:
            raise APIError(422, 'student 需为 null 或姓名、学号、教师三个字段。')
        for key, maximum in [('name', 80), ('studentId', 80), ('teacher', 100)]:
            text_field(student.get(key), 'student.' + key, maximum)
    events = data['events']
    if not isinstance(events, list) or not 1 <= len(events) <= MAX_EVENTS:
        raise APIError(422, f'events 需包含 1–{MAX_EVENTS} 条事件。')
    seen = set()
    for event in events:
        if not isinstance(event, dict) or set(event) != {'id', 'sessionId', 'type', 'at', 'payload'}:
            raise APIError(422, '事件字段无效。')
        identifier(event.get('id'), 'event.id')
        if event['id'] in seen:
            raise APIError(422, '同一批次含重复事件 ID。')
        seen.add(event['id'])
        if event.get('sessionId') != session['id']:
            raise APIError(422, 'event.sessionId 与 session.id 不一致。')
        if not isinstance(event['type'], str) or not TYPE_RE.fullmatch(event['type']):
            raise APIError(422, '事件 type 格式无效。')
        timestamp(event.get('at'), 'event.at')
        if not isinstance(event['payload'], dict):
            raise APIError(422, 'event.payload 必须为对象。')
        json_shape(event['payload'])
        if event['payload'].get('caseId', case_id) != case_id:
            raise APIError(422, '事件 caseId 与会话不一致。')
        validate_event_payload(event, cases[case_id])
    return session, events


class LearningStore:
    def __init__(self, path):
        self.path = Path(path)
        with self.connect() as connection:
            connection.executescript('''
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY, case_id TEXT NOT NULL, started_at TEXT NOT NULL,
                    student_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS events (
                    id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id),
                    type TEXT NOT NULL, at TEXT NOT NULL, payload_json TEXT NOT NULL,
                    received_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS events_session ON events(session_id, at);
                CREATE INDEX IF NOT EXISTS sessions_case ON sessions(case_id, updated_at);
            ''')

    @contextmanager
    def connect(self):
        connection = sqlite3.connect(str(self.path), timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute('PRAGMA foreign_keys=ON')
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def save(self, session, events):
        received = now()
        student_json = dumps(session.get('student'))
        inserted = duplicates = 0
        with self.connect() as connection:
            connection.execute('BEGIN IMMEDIATE')
            existing = connection.execute('SELECT * FROM sessions WHERE id=?', (session['id'],)).fetchone()
            if existing:
                if existing['case_id'] != session['caseId'] or existing['started_at'] != session['startedAt']:
                    raise APIError(409, '该会话 ID 已关联其他案例或开始时间。')
                if existing['student_json'] not in ('null', student_json) and student_json != 'null':
                    raise APIError(409, '该会话已有不同的演示身份；请创建新会话。')
            else:
                connection.execute('INSERT INTO sessions VALUES (?,?,?,?,?,?)',
                    (session['id'], session['caseId'], session['startedAt'], student_json, received, received))
            for event in events:
                payload_json = dumps(event['payload'])
                original = connection.execute('SELECT * FROM events WHERE id=?', (event['id'],)).fetchone()
                if original:
                    if (original['session_id'], original['type'], original['at'], original['payload_json']) != (
                            session['id'], event['type'], event['at'], payload_json):
                        raise APIError(409, '事件 ID 已存在且内容不同。')
                    duplicates += 1
                else:
                    connection.execute('INSERT INTO events VALUES (?,?,?,?,?,?)',
                        (event['id'], session['id'], event['type'], event['at'], payload_json, received))
                    inserted += 1
            if inserted:
                connection.execute('UPDATE sessions SET updated_at=?, student_json=? WHERE id=?',
                    (received, existing['student_json'] if existing and student_json == 'null' else student_json,
                     session['id']))
        return {'accepted': inserted, 'duplicates': duplicates, 'sessionId': session['id']}

    def detail(self, session_id):
        with self.connect() as connection:
            row = connection.execute('SELECT * FROM sessions WHERE id=?', (session_id,)).fetchone()
            if not row:
                raise APIError(404, '会话不存在。')
            records = connection.execute('SELECT * FROM events WHERE session_id=? ORDER BY at,received_at,id',
                                         (session_id,)).fetchall()
        session = {'id': row['id'], 'caseId': row['case_id'], 'startedAt': row['started_at'],
                   'student': json.loads(row['student_json']), 'updatedAt': row['updated_at']}
        events = [{'id': x['id'], 'sessionId': x['session_id'], 'type': x['type'], 'at': x['at'],
                   'payload': json.loads(x['payload_json']), 'receivedAt': x['received_at']} for x in records]
        events.sort(key=lambda x: (dt.datetime.fromisoformat(x['at'].replace('Z', '+00:00')),
                                   x['receivedAt'], x['id']))
        return {'session': session, 'events': events}

    def summaries(self, case_id=None, limit=200, offset=0):
        where, args = (' WHERE case_id=?', [case_id]) if case_id else ('', [])
        with self.connect() as connection:
            total = connection.execute('SELECT COUNT(*) FROM sessions' + where, args).fetchone()[0]
            rows = connection.execute('SELECT id FROM sessions' + where +
                ' ORDER BY updated_at DESC,id LIMIT ? OFFSET ?', args + [limit, offset]).fetchall()
        cases = load_cases()
        sessions = []
        for row in rows:
            detail = self.detail(row['id'])
            summary = dict(detail['session'])
            complete = [e for e in detail['events'] if e['type'] == 'encounter_complete']
            latest = complete[-1] if complete else None
            case = cases.get(summary['caseId'], {})
            essential = {q['id'] for q in case.get('questions', []) if q.get('essential')}
            asked = set()
            for event in detail['events']:
                payload = event['payload']
                question_id = payload.get('questionId')
                if question_id and ('question' in event['type'] or 'interview' in event['type'] or 'answer' in event['type']):
                    asked.add(question_id)
            summary.update({'eventCount': len(detail['events']), 'completed': bool(latest),
                'completedAt': latest['at'] if latest else None,
                'coverage': latest['payload']['coverage'] if latest else {
                    'asked': len(asked), 'essentialAsked': len(asked & essential), 'essentialTotal': len(essential)},
                'durationSeconds': latest['payload']['durationSeconds'] if latest else None})
            sessions.append(summary)
        return {'sessions': sessions, 'total': total, 'offset': offset, 'limit': limit,
                'scope': '本机演示学习记录；身份为自行填写；覆盖率不是临床能力评分。'}


class LabHandler(BaseHTTPRequestHandler):
    server_version = 'LocalLearningLab/1.0'

    def log_message(self, format, *args):
        # Request queries can contain secrets pasted by a user; never log them.
        safe = urlsplit(self.path).path
        sys.stderr.write(f'{self.client_address[0]} {self.command} {safe} {getattr(self, "response_status", "")}\n')

    def send_response(self, code, message=None):
        self.response_status = code
        super().send_response(code, message)

    def common_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Frame-Options', 'SAMEORIGIN' if urlsplit(self.path).path.startswith(('/posture/','/topics/','/painting/','/lab/')) else 'DENY')

    def json_response(self, value, status=200):
        body = dumps(value).encode('utf-8')
        self.send_response(status)
        self.common_headers()
        if getattr(self, '_set_cookie', None):
            self.send_header('Set-Cookie', self._set_cookie)
            self._set_cookie = None
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)
        remaining = getattr(self, '_discard_body', 0)
        if remaining:
            # Deliver the rejection before closing a socket with an unread upload.
            # A short bounded drain avoids TCP resets for ordinary oversize batches.
            self.wfile.flush()
            try:
                self.connection.shutdown(socket.SHUT_WR)
                self.connection.settimeout(0.2)
                while remaining > 0:
                    chunk = self.rfile.read(min(remaining, 65536))
                    if not chunk:
                        break
                    remaining -= len(chunk)
            except OSError:
                pass
            self.close_connection = True

    def check_origin(self):
        allowed = self.server.allowed_origins
        host = self.headers.get('Host', '')
        if 'http://' + host not in allowed:
            raise APIError(403, '仅接受本机站点请求。')
        origin = self.headers.get('Origin')
        if origin is not None and origin != 'http://' + host:
            raise APIError(403, '不接受跨站请求。')

    def require_teacher(self):
        self.check_origin()
        if self.server.private.valid(self.headers.get('Cookie')):
            return
        if self.server.private.configured():
            raise APIError(401, '请使用教师工号、姓名和个人密码登录。')
        token = self.headers.get('X-Teacher-Token', '')
        authorization = self.headers.get('Authorization', '')
        if authorization.startswith('Bearer '):
            token = authorization[7:]
        if not token or not hmac.compare_digest(token.encode('utf-8'), self.server.teacher_token.encode('utf-8')):
            raise APIError(401, '需要本次启动生成的教师令牌；请打开终端中的教师链接。')

    def read_json(self, maximum):
        self.check_origin()
        if self.headers.get('Transfer-Encoding'):
            raise APIError(400, '不支持分块请求。')
        content_type = self.headers.get('Content-Type', '').split(';', 1)[0].strip().lower()
        if content_type != 'application/json':
            raise APIError(415, '请求必须使用 application/json。')
        raw_length = self.headers.get('Content-Length')
        try:
            length = int(raw_length)
        except (TypeError, ValueError):
            raise APIError(411, '需要有效的 Content-Length。')
        if length < 1 or length > maximum:
            self._discard_body = min(max(0, length), 1048576)
            raise APIError(413, '请求内容超出大小限制。')
        self.connection.settimeout(10)
        raw = self.rfile.read(length)
        if len(raw) != length:
            raise APIError(400, '请求内容不完整。')
        try:
            return json.loads(raw.decode('utf-8'), parse_constant=lambda x: (_ for _ in ()).throw(ValueError(x)))
        except (UnicodeError, ValueError, RecursionError):
            raise APIError(400, 'JSON 格式无效。')

    def do_POST(self):
        try:
            path = urlsplit(self.path).path
            if path in ('/api/teacher/login', '/api/teacher/setup'):
                data = self.read_json(4000)
                result, self._set_cookie = self.server.private.auth(data, self.client_address[0], path.endswith('/setup'))
                self.json_response(result)
            elif path == '/api/teacher/logout':
                self.read_json(100)
                self._set_cookie = self.server.private.logout(self.headers.get('Cookie'))
                self.json_response({'signedOut': True})
            elif path == '/api/teacher/comment':
                self.require_teacher()
                self.json_response(self.server.private.comment(self.read_json(10000)))
            elif path == '/api/learning/painting':
                result,status=self.server.painting.run(self.read_json(180000),self.headers.get('X-Learner-Token',''))
                self.json_response(result,status)
            elif path == '/api/learning/certificate':
                self.json_response(self.server.painting.certificate(self.read_json(32000)))
            elif path in ('/api/learning/start', '/api/learning/assessment', '/api/learning/discussion', '/api/learning/feedback', '/api/learning/soap'):
                data = self.read_json(20000)
                token = self.headers.get('X-Learner-Token', '')
                if path.endswith('/start'):
                    self.json_response(self.server.learning.start(data, token))
                else:
                    method = {'assessment': self.server.learning.assess, 'discussion': self.server.learning.discuss,
                              'feedback': self.server.learning.feedback, 'soap': self.server.learning.soap.run}[path.rsplit('/', 1)[1]]
                    result, status = method(data, token)
                    self.json_response(result, status)
            elif path in ('/api/teacher/ai-config', '/api/teacher/ai-test'):
                self.require_teacher()
                data = self.read_json(4000)
                if path.endswith('/ai-config'):
                    self.json_response(self.server.learning.configure(data))
                else:
                    result, status = self.server.learning.ai_test(data)
                    self.json_response(result, status)
            elif path == '/api/learning/events':
                session, events = validate_batch(self.read_json(MAX_BODY))
                self.json_response(self.server.store.save(session, events))
            elif path == '/api/encounter/ask':
                data = self.read_json(3000)
                if not isinstance(data, dict) or set(data) != {'caseId', 'question'}:
                    raise APIError(400, '请求需包含 caseId 和 question。')
                try:
                    question = text_field(data.get('question'), 'question', 500, 1).strip()
                except APIError as error:
                    raise APIError(400, error.message)
                if not question:
                    raise APIError(400, '请输入问诊问题。')
                cases = load_cases()
                if not isinstance(data.get('caseId'), str) or data['caseId'] not in cases:
                    raise APIError(400, '未知案例。')
                try:
                    import ai_adapter
                except ImportError:
                    raise APIError(503, '问诊适配模块尚未就绪。')
                self.json_response(ai_adapter.answer_question(cases[data['caseId']], question))
            else:
                raise APIError(404, '接口不存在。')
        except APIError as error:
            self.json_response({'error': error.message}, error.status)
        except ServiceError as error:
            self.json_response(error.body, error.status)
        except (sqlite3.Error, OSError, TimeoutError):
            self.json_response({'error': '本机存储或请求暂不可用，请稍后重试。'}, 503)
        except Exception as error:
            sys.stderr.write('Local API error: ' + type(error).__name__ + '\n')
            self.json_response({'error': '本机服务处理失败；未返回未验证的结果。'}, 500)

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        try:
            url = urlsplit(self.path)
            path = url.path
            if path == '/api/teacher/auth-status':
                self.check_origin()
                self.json_response(self.server.private.status(self.headers.get('Cookie')))
            elif path == '/api/teacher/storage':
                self.require_teacher()
                self.json_response(self.server.private.storage())
            elif path == '/api/teacher/backup.zip':
                self.require_teacher()
                body = self.server.private.archive()
                self.send_response(200); self.common_headers()
                self.send_header('Content-Type', 'application/zip')
                self.send_header('Content-Disposition', 'attachment; filename="dongxiaoxue-private-backup.zip"')
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Content-Length', str(len(body))); self.end_headers()
                if self.command != 'HEAD': self.wfile.write(body)
            elif path == '/api/teacher/experience':
                self.require_teacher()
                with self.server.store.connect() as c:
                    certs=[dict(r) for r in c.execute('SELECT id,owner_json,scope,evidence_hash,evidence_json,issued_at FROM experience_certificates ORDER BY issued_at DESC')]
                    rows=[dict(r) for r in c.execute('SELECT a.session_id,a.kind,a.muscle,a.side,a.result_json,a.received_at,l.identity_json FROM painting_attempts a LEFT JOIN learning_sessions l ON l.session_id=a.session_id ORDER BY a.received_at DESC LIMIT 5000')]
                self.json_response({'certificates':certs,'painting':rows,'paintingLimit':5000})
            elif path == '/api/learning/status':
                self.check_origin()
                ai = self.server.learning.ai_config()
                configured = ai['configured']
                self.json_response({'collectorEnabled': True, 'localOnly': True,
                    'mode': 'local_demo', 'llmConfigured': configured, 'llmConnected': ai['liveVerified'],
                    'provider': ai['provider'], 'providerLabel': ai['providerLabel'], 'model': ai['model'],
                    'llmStatus': 'verified_by_teacher_test' if ai['liveVerified'] else 'configured_not_probed' if configured else 'not_configured',
                    'identityAuthentication': False,
                    'ai': ai, 'notice': '本机演示；教师令牌不是学校身份认证。状态读取不会发送模型请求。'})
            elif path == '/api/learning/curriculum':
                self.check_origin()
                self.json_response(self.server.learning.curriculum())
            elif path == '/api/learning/state':
                self.check_origin()
                query = parse_qs(url.query)
                self.json_response(self.server.learning.state(query.get('sessionId', [''])[0], self.headers.get('X-Learner-Token', '')))
            elif path == '/api/teacher/ai-config':
                self.require_teacher()
                self.json_response(self.server.learning.ai_config())
            elif path == '/api/teacher/learning':
                self.require_teacher()
                query = parse_qs(url.query)
                sid = query.get('sessionId', [None])[0]
                if sid is not None:
                    identifier(sid, 'sessionId')
                self.json_response(self.server.learning.detail(sid) if sid else self.server.learning.overview())
            elif path == '/api/teacher/export.xlsx':
                self.require_teacher()
                from excel_export import generate
                try:
                    body = generate(self.server)
                except (RuntimeError, OSError, TimeoutError) as error:
                    raise APIError(503, 'Excel导出未完成；可先导出原始JSON，稍后重试。')
                self.send_response(200)
                self.common_headers()
                self.send_header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                self.send_header('Content-Disposition', 'attachment; filename="dongxiaoxue-learning.xlsx"')
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                if self.command != 'HEAD': self.wfile.write(body)
            elif path == '/api/teacher/usage':
                self.require_teacher()
                from usage_service import report
                self.json_response(report(self.server, parse_qs(url.query).get('full',['0'])[0]=='1'))
            elif path == '/api/learning/sessions':
                self.require_teacher()
                query = parse_qs(url.query)
                case_id = query.get('caseId', [None])[0]
                if case_id and case_id not in load_cases():
                    raise APIError(422, '未知案例。')
                try:
                    limit = int(query.get('limit', ['200'])[0])
                    offset = int(query.get('offset', ['0'])[0])
                except ValueError:
                    raise APIError(422, '分页参数无效。')
                if not 1 <= limit <= 500 or not 0 <= offset <= 100000:
                    raise APIError(422, '分页范围无效。')
                self.json_response(self.server.store.summaries(case_id, limit, offset))
            elif path.startswith('/api/learning/sessions/'):
                self.require_teacher()
                session_id = unquote(path[len('/api/learning/sessions/'):])
                identifier(session_id, 'sessionId')
                self.json_response(self.server.store.detail(session_id))
            elif path.startswith('/api/'):
                raise APIError(404, '接口不存在。')
            else:
                self.static_file(path)
        except APIError as error:
            self.json_response({'error': error.message}, error.status)
        except ServiceError as error:
            self.json_response(error.body, error.status)
        except (OSError, sqlite3.Error):
            self.json_response({'error': '本机资源暂不可用。'}, 503)
        except Exception as error:
            sys.stderr.write('Local read error: ' + type(error).__name__ + '\n')
            self.json_response({'error': '数据读取暂未完成，请重试；原记录不会被删除。'}, 500)

    def static_file(self, path):
        decoded = unquote(path)
        # The student API omits answer keys until a formal submission. Keep the
        # source bank available to the local server and distributable teacher
        # package, but do not accidentally serve its answers as a public asset.
        if decoded.replace('\\', '/').lower().rstrip('/') in ('/learning/objectives-v15.json', '/docs/objectives-v15.json', '/clinic3d/docs/objectives-v15.json'):
            raise APIError(404, '文件不存在。')
        public_deploy_marker = decoded == '/.nojekyll'
        public_document = decoded in PUBLIC_DOCUMENTS
        parts = decoded.replace('\\', '/').split('/')
        if '\x00' in decoded or (not public_deploy_marker and any(p in ('.', '..') or p.startswith('.') for p in parts if p)):
            raise APIError(404, '文件不存在。')
        candidate = (ROOT / decoded.lstrip('/')).resolve()
        if not candidate.is_relative_to(ROOT):
            raise APIError(404, '文件不存在。')
        if candidate.is_dir():
            if not path.endswith('/'):
                self.send_response(301)
                self.common_headers()
                self.send_header('Location', path + '/')
                self.send_header('Content-Length', '0')
                self.end_headers()
                return
            candidate = candidate / 'index.html'
        if not candidate.is_file() or (candidate.suffix.lower() not in STATIC_SUFFIXES and not public_document):
            raise APIError(404, '文件不存在。')
        # Resolve again after index selection to reject symlinks outside the site.
        if not candidate.resolve().is_relative_to(ROOT):
            raise APIError(404, '文件不存在。')
        size = candidate.stat().st_size
        start, end, partial = 0, size - 1, False
        requested = self.headers.get('Range')
        if requested:
            match = re.fullmatch(r'bytes=(\d*)-(\d*)', requested.strip())
            valid = bool(match and (match[1] or match[2]))
            if valid:
                if match[1]:
                    start = int(match[1]); end = min(int(match[2]), size-1) if match[2] else size-1
                else:
                    suffix = int(match[2]); start = max(0, size-suffix)
                    valid = suffix > 0
                valid = valid and 0 <= start <= end < size
            if not valid:
                self.send_response(416); self.common_headers()
                self.send_header('Content-Range', f'bytes */{size}')
                self.send_header('Content-Length', '0'); self.end_headers(); return
            partial = True
        self.send_response(206 if partial else 200)
        self.common_headers()
        self.send_header('Accept-Ranges', 'bytes')
        if partial: self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        mime = mimetypes.guess_type(str(candidate))[0] or 'application/octet-stream'
        if mime.startswith('text/') or mime in ('application/javascript', 'application/json'):
            mime += '; charset=utf-8'
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(end-start+1))
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        if self.command != 'HEAD':
            with candidate.open('rb') as source:
                source.seek(start); remaining = end-start+1
                while remaining:
                    chunk = source.read(min(65536, remaining))
                    if not chunk: break
                    self.wfile.write(chunk); remaining -= len(chunk)


def create_server(port=8771, data_dir=None, token=None, testing=False, provider_transport=None):
    if data_dir is None:
        base = Path(os.environ.get('LOCALAPPDATA') or os.environ.get('XDG_DATA_HOME') or Path.home() / '.local' / 'share')
        data_dir = base / 'DongXueXiaoLab'
    data_dir = Path(data_dir).expanduser().resolve()
    if data_dir.is_relative_to(ROOT):
        raise ValueError('数据目录必须位于静态站点目录之外。')
    data_dir.mkdir(parents=True, exist_ok=True)
    if os.name != 'nt':
        data_dir.chmod(0o700)
    database = data_dir / 'learning.sqlite3'
    store = LearningStore(database)
    if os.name != 'nt':
        database.chmod(0o600)
    server = ThreadingHTTPServer(('127.0.0.1', port), LabHandler)
    server.daemon_threads = True
    server.teacher_token = token or secrets.token_urlsafe(32)
    server.store = store
    server.learning = LearningService(store, ROOT, data_dir, load_cases, testing=testing, transport=provider_transport)
    from painting_service import PaintingService
    server.painting = PaintingService(server.learning)
    from private_access import PrivateAccess
    server.private = PrivateAccess(server)
    server.private.write_entry()
    if not testing:
        server.private.backup()
        import threading
        def periodic_backup():
            while not getattr(server, '_backup_stop', threading.Event()).wait(3600):
                try: server.private.backup()
                except Exception: sys.stderr.write('Automatic backup failed; please check storage.\n')
        server._backup_stop = threading.Event()
        old_close = server.server_close
        def close_with_backup_stop():
            server._backup_stop.set(); old_close()
        server.server_close = close_with_backup_stop
        threading.Thread(target=periodic_backup, daemon=True).start()
    actual_port = server.server_address[1]
    server.allowed_origins = {f'http://127.0.0.1:{actual_port}', f'http://localhost:{actual_port}'}
    return server


def main():
    parser = argparse.ArgumentParser(description='人体运动学虚拟实验室：本机学习事件服务与教师看板')
    parser.add_argument('--port', type=int, default=8771)
    parser.add_argument('--data-dir', type=Path)
    parser.add_argument('--test-data', action='store_true', help='明确把新学习会话标为测试数据；请配合独立数据目录')
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('port 必须在 1–65535 之间。')
    try:
        server = create_server(args.port, args.data_dir, testing=args.test_data)
    except (OSError, ValueError, sqlite3.Error) as error:
        parser.exit(1, f'无法启动本机服务：{error}\n')
    base = f'http://127.0.0.1:{server.server_address[1]}'
    print(f'学生入口：{base}/', flush=True)
    entry=server.private.write_entry()
    print(f'教师专用入口文件：{entry}', flush=True)
    print(f'学习记录位置：{server.store.path}', flush=True)
    print('教师工号026870；首次从专用文件设置个人密码。学生身份尚未接入学校认证。', flush=True)
    print('关闭此进程即停止收集；Ctrl+C 退出。数据库和教师密码设置跨重启保留。', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
