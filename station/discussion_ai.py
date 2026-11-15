"""Optional Groq explanations for the synthetic ASTRA station."""

import json
import logging
import os
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, Request, build_opener

from dotenv import dotenv_values


GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
ROOT = Path(__file__).resolve().parent
LOGGER = logging.getLogger('uvicorn.error')
TOPICS = ('observations', 'adjustment', 'plan')
FOLLOW_UPS = {
    'observations': 'Voulez-vous revoir votre dernière séance ?',
    'adjustment': 'Voulez-vous savoir si votre programme peut évoluer ?',
    'plan': 'Voulez-vous revoir votre programme en cours ?',
}
DEFAULT_NEXT = {'plan': 'observations', 'observations': 'adjustment', 'adjustment': 'plan'}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def discussion_reply(topic: str, verified_answer: str) -> dict:
    """The server keeps the original facts and selects the text of the follow-up."""
    answer = verified_answer
    mode = 'Réponse locale de démonstration'
    next_topic = DEFAULT_NEXT[topic]
    if os.environ.get('ASTRA_DEMO_DISCUSSION_AI') == '1':
        result = groq_explanation(topic, verified_answer)
        if result is not None:
            explanation, next_topic = result
            answer = f'{verified_answer}\n\n{explanation}'
            mode = 'Groq · explication de démonstration'
    return {
        'answer': answer, 'mode': mode,
        'follow_up': {'question': FOLLOW_UPS[next_topic], 'topic': next_topic},
    }


def groq_explanation(topic: str, verified_answer: str) -> tuple[str, str] | None:
    config = dotenv_values(ROOT.parent / '.env')
    key = (os.environ.get('ASTRA_LLM_API_KEY') or config.get('ASTRA_LLM_API_KEY') or '').strip()
    if not key.startswith('gsk_'):
        LOGGER.warning('ASTRA discussion: Groq key missing; local reply used.')
        return None
    model = os.environ.get('ASTRA_LLM_MODEL') or config.get('ASTRA_LLM_MODEL') or 'openai/gpt-oss-20b'
    next_topics = [candidate for candidate in TOPICS if candidate != topic]
    schema = {
        'type': 'object', 'additionalProperties': False,
        'properties': {'explanation': {'type': 'string'}, 'next_topic': {'type': 'string', 'enum': next_topics}},
        'required': ['explanation', 'next_topic'],
    }
    payload = {
        'model': model, 'temperature': 0.2, 'max_completion_tokens': 512,
        'messages': [
            {'role': 'system', 'content': (
                'Rédige en français une phrase courte qui aide un astronaute à comprendre le fait de simulation fourni. '
                'Ne donne aucun chiffre, aucune nouvelle mesure, aucun diagnostic et aucun conseil médical ou sportif. '
                'Ne change ni le programme ni son état de validation. Ne pose pas la question dans explanation. '
                'Dans next_topic, choisis le sujet de suivi le plus utile : observations (dernière séance), '
                'adjustment (raison ou possibilité de changement), plan (programme en cours).'
            )},
            {'role': 'user', 'content': json.dumps({'topic': topic, 'verified_fact': verified_answer}, ensure_ascii=False)},
        ],
        'response_format': {'type': 'json_schema', 'json_schema': {'name': 'astra_discussion', 'strict': True, 'schema': schema}},
    }
    request = Request(GROQ_URL, data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
                      headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json',
                               'User-Agent': 'ASTRA-Space-Demo/1.0'})
    try:
        with build_opener(NoRedirect()).open(request, timeout=8) as response:
            completion = json.load(response)['choices'][0]
        if completion['finish_reason'] != 'stop':
            return None
        result = json.loads(completion['message']['content'])
        explanation = result['explanation'].strip()
        next_topic = result['next_topic']
        if not 0 < len(explanation) <= 220 or any(char.isdigit() for char in explanation) or next_topic not in next_topics:
            return None
        return explanation, next_topic
    except HTTPError as exc:
        LOGGER.warning('ASTRA discussion: Groq HTTP %s; local reply used.', exc.code)
    except (OSError, ValueError, KeyError, IndexError, TypeError, AttributeError):
        LOGGER.warning('ASTRA discussion: Groq unavailable or invalid response; local reply used.')
    return None
