"""Autonomous, synthetic ASTRA demonstration. Run separately from mission installations."""

import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from ipaddress import ip_address
from pathlib import Path
from threading import Lock

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import Literal

from discussion_ai import discussion_reply
from public_sessions import COOKIE, LIFETIME, Workspaces, using

ROOT = Path(__file__).resolve().parent
os.environ['ASTRA_KNOWLEDGE_PATH'] = str(ROOT / 'data' / 'nasa_knowledge.json')
os.environ['ASTRA_LLM_ALLOW_HEALTH_DATA'] = '0'
os.environ['ASTRA_DEMO_DISCUSSION_AI'] = '0'

from astra import main as core


PROFILES = {
    'ines': {'name': 'Inès Diallo', 'base': 100, 'maximum': 110, 'history': 2},
    'malik': {'name': 'Malik Chen', 'base': 80, 'maximum': 90, 'history': 1},
}
WORKSPACES = Workspaces()
WEB = ROOT / 'web'
LOCK = Lock()
ATTENTION = {
    'specialist_review': 'Au moins une séance demande une revue. Le programme en vigueur est conservé.',
    'maintain': 'La cible du plan est maintenue.',
    'insufficient_history': 'Les premières séances sont disponibles. Il faut trois séances comparables pour proposer une progression.',
    'progression_for_review': 'Trois séances comparables ont atteint la cible. Un ajustement peut être examiné à bord.',
}


def fail(status, message):
    raise HTTPException(status, message)


def create_workout(crew, number, target, ended_at):
    return core.ingest_workout_session(core.WorkoutSessionIn(
        astronaut_id=crew, equipment='CEVIS', exercise_name='cycling',
        external_session_id=f'cevis-{number}', source_module='cevis-demo',
        started_at=ended_at - timedelta(minutes=20), ended_at=ended_at, duration_s=1200,
        completed=True, quality='valid', heart_rate_avg_bpm=118 + number,
        power_w=target, cadence_rpm=72 + number, rpe_0_10=4,
        rpe_source='astronaut_self_report',
    ))


def seed():
    core.initialize()
    with core.connection() as con:
        con.executescript('''
        CREATE TABLE IF NOT EXISTS demo_schedule (
            astronaut_id TEXT PRIMARY KEY, period TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS demo_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT, astronaut_id TEXT NOT NULL,
            category TEXT NOT NULL, created_at TEXT NOT NULL,
            UNIQUE(astronaut_id, category)
        );
        ''')
    for crew, profile in PROFILES.items():
        with core.connection() as con:
            plan_exists = con.execute('SELECT 1 FROM training_plans WHERE astronaut_id=?', (crew,)).fetchone()
            crew_exists = con.execute('SELECT 1 FROM astronauts WHERE id=?', (crew,)).fetchone()
            con.execute('INSERT OR IGNORE INTO demo_schedule VALUES (?,?)', (crew, 'work'))
        if not crew_exists:
            core.create_astronaut(core.AstronautIn(id=crew, display_name=profile['name']))
        if not plan_exists:
            core.create_training_plan(core.TrainingPlanIn(
                astronaut_id=crew, equipment='CEVIS', exercise_name='cycling',
                effective_at=datetime.now(timezone.utc) - timedelta(days=30), target_metric='power_w',
                current_target=profile['base'], minimum_target=profile['base'] - 10,
                maximum_target=profile['maximum'], approved_increment=5, target_duration_s=1200,
                rpe_ceiling_0_10=6, specialist_reviewed_by='specialiste-demo',
            ))
        for number in range(1, profile['history'] + 1):
            with core.connection() as con:
                exists = con.execute('SELECT 1 FROM workout_sessions WHERE astronaut_id=? AND external_session_id=?',
                                     (crew, f'cevis-{number}')).fetchone()
            if not exists:
                create_workout(crew, number, profile['base'], datetime.now(timezone.utc) - timedelta(days=8-number))


@asynccontextmanager
async def lifespan(app):
    WORKSPACES.clear()
    with using(core.DATABASE_SCOPE, WORKSPACES.template.uri):
        seed()
    yield
    WORKSPACES.clear()


app = FastAPI(title='ASTRA Space · Version publique', lifespan=lifespan,
              docs_url=None, redoc_url=None, openapi_url=None)
app.mount('/static', StaticFiles(directory=ROOT / 'static'), name='static')
app.mount('/_expo', StaticFiles(directory=WEB / '_expo', check_dir=False), name='expo')
app.mount('/assets', StaticFiles(directory=WEB / 'assets', check_dir=False), name='assets')


@app.middleware('http')
async def browser_policy(request: Request, call_next):
    path = request.url.path
    origin = request.headers.get('origin')
    if path != '/healthz' and request.url.scheme != 'https' and not local_request(request):
        reply = JSONResponse({'detail': 'Une connexion HTTPS est requise.'}, status_code=403)
    elif request.method == 'POST' and origin and origin != str(request.base_url).rstrip('/'):
        reply = JSONResponse({'detail': 'Origine non autorisée.'}, status_code=403)
    elif path.startswith('/api/'):
        workspace, crew = WORKSPACES.get(request.cookies.get(COOKIE))
        request.state.workspace = workspace
        request.state.crew = crew
        if workspace is None:
            reply = await call_next(request)
        else:
            with using(core.DATABASE_SCOPE, workspace.uri):
                reply = await call_next(request)
    else:
        reply = await call_next(request)

    expo = not path.startswith(('/api/', '/static/')) and path not in {'/station', '/presentation'}
    csp = "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; img-src 'self' data: blob:;"
    if expo:
        csp += " style-src 'self' 'unsafe-inline'; font-src 'self' data:;"
    reply.headers['Content-Security-Policy'] = csp
    reply.headers['Referrer-Policy'] = 'no-referrer'
    reply.headers['X-Content-Type-Options'] = 'nosniff'
    if not path.startswith(('/_expo/', '/assets/')):
        reply.headers['Cache-Control'] = 'no-store'
    return reply


def local_request(request: Request) -> bool:
    if not request.client or request.url.hostname not in {'localhost', '127.0.0.1', '::1'}:
        return False
    try:
        return ip_address(request.client.host).is_loopback
    except ValueError:
        return False


@app.exception_handler(RequestValidationError)
async def hide_login_input(request: Request, exc: RequestValidationError):
    if request.url.path == '/api/login':
        return JSONResponse({'detail': 'Requête de connexion invalide.'}, status_code=422)
    return await request_validation_exception_handler(request, exc)


@app.get('/healthz')
def health():
    if not (WEB / 'index.html').is_file():
        fail(503, 'Le compagnon web est absent.')
    return {'status': 'ok', 'data': 'synthetic'}


@app.get('/station')
def index():
    return FileResponse(ROOT / 'static' / 'index.html')


@app.get('/presentation')
def presentation():
    return FileResponse(ROOT / 'static' / 'presentation.html')


class Login(BaseModel):
    crew: Literal['ines', 'malik']


@app.post('/api/login')
def login(body: Login, request: Request, response: Response):
    token = WORKSPACES.login(request.cookies.get(COOKIE), body.crew)
    if token is None:
        fail(503, 'Les sessions publiques sont temporairement complètes. Réessayez plus tard.')
    response.set_cookie(COOKIE, token, httponly=True,
                        secure=request.url.scheme == 'https', samesite='strict')
    return {'name': PROFILES[body.crew]['name']}


@app.post('/api/logout')
def logout(request: Request):
    WORKSPACES.logout(request.state.workspace)
    return {'ok': True}


def get_crew(request: Request):
    crew = request.state.crew
    if crew is None:
        fail(401, 'Choisissez un profil fictif pour ouvrir votre espace.')
    return crew


def latest_program(crew):
    with core.connection() as con:
        return con.execute('SELECT * FROM programs WHERE astronaut_id=? ORDER BY created_at DESC LIMIT 1', (crew,)).fetchone()


def state_for(crew):
    profile = PROFILES[crew]
    context = core.training_context(crew)
    candidate = context['candidate_sessions'][0]
    with core.connection() as con:
        rows = con.execute('SELECT ended_at, session_json FROM workout_sessions WHERE astronaut_id=? ORDER BY ended_at DESC', (crew,)).fetchall()
        period = con.execute('SELECT period FROM demo_schedule WHERE astronaut_id=?', (crew,)).fetchone()[0]
        reports = con.execute('SELECT id, category, created_at FROM demo_reports WHERE astronaut_id=? ORDER BY id DESC', (crew,)).fetchall()
    program = latest_program(crew)
    approved = program is not None and program['status'] == 'approved'
    active_target = profile['base']
    if approved:
        active_target = json.loads(program['content_json'])['training_plan'][0]['proposed_target']

    history = []
    for row in rows:
        workout = json.loads(row['session_json'])
        expected = active_target if approved and row['ended_at'] > program['decided_at'] else profile['base']
        if workout['quality'] != 'valid' or workout['rpe_0_10'] is None:
            status = 'À confirmer'
        elif workout['completed'] and workout['power_w'] >= expected and workout['duration_s'] >= 1200 and workout['rpe_0_10'] <= 6:
            status = 'Confirmée'
        else:
            status = 'À examiner'
        history.append({'ended_at': row['ended_at'], 'power_w': workout['power_w'], 'target_w': expected,
                        'duration_s': workout['duration_s'], 'heart_rate_avg_bpm': workout['heart_rate_avg_bpm'],
                        'rpe': workout['rpe_0_10'], 'status': status})
    count = sum(workout['status'] == 'Confirmée' for workout in history)
    age = 'Adulte' if count >= 5 else 'Jeune' if count >= 3 else 'Bébé'
    explanation = ATTENTION[candidate['status']] if not approved else 'Votre programme a été révisé à bord à partir des séances comparables.'
    return {
        'profile': {'id': crew, 'name': profile['name']}, 'synchronized_at': core.now(), 'equipment': 'CEVIS',
        'history': history, 'explanation': explanation, 'comparison_count': len(candidate['recent_sessions']),
        'program': {'status': program['status'] if program else 'initial', 'power_w': active_target,
                    'duration_s': candidate['target_duration_s'], 'validated_at': program['decided_at'] if approved else None},
        'companion': {'name': 'Nova', 'age': age, 'confirmed_sessions': count, 'next_stage_at': 3 if count < 3 else 5 if count < 5 else None,
                      'period': period, 'reminder_allowed': period == 'rest'},
        'reports': [dict(row) for row in reports],
        'family': [],
    }


@app.get('/api/me')
def my_space(crew=Depends(get_crew)):
    with LOCK:
        return state_for(crew)


class Question(BaseModel):
    topic: Literal['observations', 'adjustment', 'plan']


@app.post('/api/me/discussion')
def discussion(body: Question, crew=Depends(get_crew)):
    with LOCK:
        snapshot = state_for(crew)
    last = next(iter(snapshot['history']), None)
    plan = snapshot['program']
    if body.topic == 'observations':
        answer = (f"La dernière séance CEVIS a enregistré {last['power_w']:g} W, avec une cible de {last['target_w']:g} W et "
                  f"une durée rapportée de {last['duration_s'] // 60} min. État de suivi · {last['status']}." if last else 'Aucune séance disponible.')
    elif body.topic == 'adjustment':
        answer = snapshot['explanation']
        if plan['status'] == 'pending_approval':
            answer += ' La proposition attend une décision à bord. Votre programme actuel reste en vigueur.'
    else:
        answer = f"Votre séance de vélo CEVIS de démonstration est réglée à {plan['power_w']:g} W pour {plan['duration_s'] // 60} min."
    return discussion_reply(body.topic, answer)


class Report(BaseModel):
    category: Literal['Gêne signalée après une séance', 'Appareil indisponible', 'Demande de contact à bord']


@app.post('/api/me/report')
def report(body: Report, crew=Depends(get_crew)):
    with LOCK, core.connection() as con:
        cursor = con.execute('INSERT OR IGNORE INTO demo_reports(astronaut_id, category, created_at) VALUES (?,?,?)',
                             (crew, body.category, core.now()))
        record = con.execute('SELECT id, category, created_at FROM demo_reports WHERE astronaut_id=? AND category=?',
                             (crew, body.category)).fetchone()
        return {'report': dict(record), 'already_registered': cursor.rowcount == 0}


class StationAction(BaseModel):
    action: Literal['import', 'draft', 'specialist', 'approve', 'work', 'rest']
    sample: Literal[3, 4, 5] = 3


@app.get('/api/demo/reports')
def station_reports(_crew=Depends(get_crew)):
    with LOCK, core.connection() as con:
        reports = con.execute('SELECT id, astronaut_id, category, created_at FROM demo_reports ORDER BY id DESC').fetchall()
        return {'reports': [{**dict(row), 'name': PROFILES[row['astronaut_id']]['name']} for row in reports]}


@app.post('/api/demo/action')
def station_action(body: StationAction, crew=Depends(get_crew)):
    with LOCK:
        if body.action in {'work', 'rest'}:
            with core.connection() as con:
                con.execute('UPDATE demo_schedule SET period=? WHERE astronaut_id=?', (body.action, crew))
            message = 'Planning simulé mis à jour.'
        elif body.action == 'import':
            sample = f'cevis-{body.sample}'
            with core.connection() as con:
                existing = con.execute('SELECT 1 FROM workout_sessions WHERE astronaut_id=? AND external_session_id=?', (crew, sample)).fetchone()
            if existing:
                message = 'Séance déjà reçue. Le compteur est inchangé.'
            else:
                current = state_for(crew)['program']
                if body.sample > 3 and current['status'] != 'approved':
                    fail(409, 'Validez le programme simulé avant d’importer ses séances de suivi.')
                if body.sample == 5:
                    with core.connection() as con:
                        fourth = con.execute('SELECT 1 FROM workout_sessions WHERE astronaut_id=? AND external_session_id=?', (crew, 'cevis-4')).fetchone()
                    if not fourth:
                        fail(409, 'Importez d’abord la séance 4.')
                create_workout(crew, body.sample, current['power_w'], datetime.now(timezone.utc))
                message = f'Séance CEVIS {body.sample} reçue et associée à ce profil.'
        else:
            program = latest_program(crew)
            if body.action == 'draft':
                if program is not None:
                    fail(409, 'Un programme de démonstration existe déjà pour ce profil.')
                candidate = core.training_context(crew)['candidate_sessions'][0]
                if candidate['status'] != 'progression_for_review':
                    fail(409, 'Trois séances comparables sont nécessaires pour ce scénario.')
                core.draft_program(crew)
                message = 'Ajustement calculé à bord. Revue du spécialiste en attente.'
            else:
                if program is None:
                    fail(409, 'Calculez d’abord une proposition.')
                if body.action == 'specialist':
                    core.clinical_review(program['id'], core.ClinicalReviewIn(approver_id='specialiste-demo', decision='approved'))
                    message = 'Revue du spécialiste simulée. Approbation de mission en attente.'
                else:
                    core.approve(program['id'], core.DecisionIn(approver_id='responsable-demo'))
                    message = 'Programme simulé approuvé et publié dans l’espace de cet astronaute.'
        return {'message': message, 'state': state_for(crew)}


@app.get('/favicon.ico')
def favicon():
    return FileResponse(WEB / 'favicon.ico')


@app.get('/')
@app.get('/connexion')
@app.get('/chat')
@app.get('/programme')
@app.get('/signalement')
@app.get('/console')
@app.get('/jeu/{game_id}')
def companion():
    return FileResponse(WEB / 'index.html')
