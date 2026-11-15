const el = (id) => document.getElementById(id);
const stamp = (date) => new Intl.DateTimeFormat('fr', {dateStyle: 'medium', timeStyle: 'short'}).format(new Date(date));
let snapshot = null;
let dismissed = false;

async function api(path, {method = 'GET', body} = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(`/api/${path}`, {method, headers, body: body && JSON.stringify(body)});
  if (response.status === 401 && snapshot) showLogin();
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const messages = {
      'Specialist review required before mission approval': 'La revue du spécialiste doit précéder l’approbation à bord.',
      'Program already decided': 'Ce programme a déjà reçu une décision.',
      'No pending specialist review': 'La revue du spécialiste a déjà été enregistrée.'
    };
    throw new Error(messages[data.detail] || (typeof data.detail === 'string' ? data.detail : 'Impossible de terminer cette action.'));
  }
  return response.json();
}

function showLogin() {
  snapshot = null;
  dismissed = false;
  el('workspace').hidden = true;
  el('logout').hidden = true;
  el('signin').hidden = false;
  for (const id of ['conversation', 'station-reports', 'station-message', 'report-message', 'photo-message', 'cat-reaction']) {
    el(id).textContent = '';
  }
  el('photo').value = '';
  el('photo-preview').removeAttribute('src');
  document.querySelectorAll('details').forEach((details) => { details.open = false; });
  switchTab('follow');
}

function notice(message = '') {
  el('status').textContent = message;
  el('status').hidden = !message;
}

function switchTab(tab) {
  for (const name of ['follow', 'cat']) {
    el(name).hidden = name !== tab;
    el(`${name}-tab`).setAttribute('aria-pressed', String(name === tab));
  }
}

function showReports(id, reports, station = false) {
  el(id).replaceChildren(...reports.map((entry) => {
    const item = document.createElement('li');
    item.textContent = `${station ? `${entry.name} · ` : ''}${entry.category} · ${stamp(entry.created_at)}`;
    return item;
  }));
}

function render(data) {
  if (snapshot && snapshot.companion.period !== data.companion.period) dismissed = false;
  snapshot = data;
  el('workspace').hidden = false;
  el('logout').hidden = false;
  el('signin').hidden = true;
  el('profile-name').textContent = data.profile.name;
  el('sync').textContent = `Station connectée · ${stamp(data.synchronized_at)}`;
  const last = data.history[0];
  el('session-date').textContent = last ? `${stamp(last.ended_at)} · ${last.status}` : 'Aucune séance disponible';
  el('power').textContent = last ? `${last.power_w} W` : '—';
  el('target').textContent = last ? `${last.target_w} W` : '—';
  el('effort').textContent = last?.rpe != null ? `${last.rpe} / 10` : 'À confirmer';
  el('measures-extra').textContent = last ? `${last.duration_s / 60} min · Fréquence cardiaque moyenne ${last.heart_rate_avg_bpm ?? 'inconnue'}${last.heart_rate_avg_bpm != null ? ' bpm' : ''}` : '';
  const count = data.comparison_count;
  el('summary').textContent = `${count} séance${count > 1 ? 's comparables' : ' comparable'}. ${data.explanation}`;
  el('history').replaceChildren(...data.history.map((workout) => {
    const row = document.createElement('tr');
    for (const value of [stamp(workout.ended_at), `${workout.power_w} W`, `${workout.target_w} W`, workout.status]) {
      row.insertCell().textContent = value;
    }
    return row;
  }));
  const program = data.program;
  el('plan-values').textContent = `${program.power_w} W · ${program.duration_s / 60} min`;
  el('plan-status').textContent = program.status === 'approved' ? `Validé à bord · ${stamp(program.validated_at)}`
    : program.status === 'pending_approval' ? 'Proposition en attente. Votre plan actuel reste en vigueur.' : 'Plan individuel de départ';
  const buddy = data.companion;
  el('cat-age').textContent = buddy.age;
  el('cat-portrait').dataset.age = buddy.age;
  el('cat-icon').textContent = {Bébé: '🐱', Jeune: '😺', Adulte: '🐈'}[buddy.age];
  const confirmed = buddy.confirmed_sessions;
  el('cat-progress').value = confirmed;
  const nextAge = buddy.age === 'Bébé' ? 'jeune' : 'adulte';
  el('cat-progress-text').textContent = `${confirmed} séance${confirmed === 1 ? ' confirmée' : 's confirmées'}${buddy.next_stage_at ? ` · Stade ${nextAge} à ${buddy.next_stage_at} séances` : ' · Dernier stade atteint'}`;
  el('reminder-status').textContent = buddy.reminder_allowed ? 'Période de repos' : 'Période de travail · Rappels suspendus';
  el('reminder').hidden = !buddy.reminder_allowed || dismissed;
  el('reminder-text').textContent = `Consultez votre séance CEVIS prévue à ${program.power_w} W pour ${program.duration_s / 60} min.`;
  showReports('my-reports', data.reports);
  refreshPhoto();
}

async function refresh() {
  const profile = snapshot?.profile.id;
  try {
    const latest = await api('me');
    if (snapshot?.profile.id !== profile) return;
    render(latest);
    notice();
  } catch (error) {
    if (snapshot) {
      el('sync').textContent = `Dernière synchronisation · ${stamp(snapshot.synchronized_at)}`;
      el('reminder').hidden = true;
      notice(`La station est momentanément indisponible. ${error.message}`);
    }
  }
}

el('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  el('login-message').textContent = '';
  try {
    await api('login', {method: 'POST', body: {crew: el('crew').value}});
    render(await api('me'));
    notice();
  } catch (error) {
    el('login-message').textContent = error.message;
  }
});

el('logout').addEventListener('click', async () => {
  try {
    await api('logout', {method: 'POST'});
    showLogin();
  } catch (error) {
    notice(error.message);
  }
});

el('follow-tab').addEventListener('click', () => switchTab('follow'));
el('cat-tab').addEventListener('click', () => switchTab('cat'));

document.querySelectorAll('[data-topic]').forEach((button) => {
  button.addEventListener('click', async () => {
    const profile = snapshot?.profile.id;
    button.disabled = true;
    try {
      const reply = await api('me/discussion', {method: 'POST', body: {topic: button.dataset.topic}});
      if (snapshot?.profile.id !== profile) return;
      const question = document.createElement('p');
      question.className = 'question';
      question.textContent = button.textContent;
      const answer = document.createElement('p');
      answer.textContent = reply.answer;
      el('conversation').append(question, answer);
    } catch (error) {
      notice(error.message);
    } finally {
      button.disabled = false;
    }
  });
});

el('report-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const profile = snapshot?.profile.id;
  try {
    const reply = await api('me/report', {method: 'POST', body: {category: el('report-kind').value}});
    if (snapshot?.profile.id !== profile) return;
    el('report-message').textContent = reply.already_registered ? 'Ce signalement est déjà dans la file de bord.' : 'Signalement enregistré dans la file de bord.';
    await refresh();
  } catch (error) {
    el('report-message').textContent = error.message;
  }
});

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', async () => {
    if (!snapshot) return;
    const profile = snapshot.profile.id;
    const buttons = document.querySelectorAll('[data-action]');
    buttons.forEach((item) => { item.disabled = true; });
    try {
      const reply = await api('demo/action', {method: 'POST', body: {action: button.dataset.action, sample: Number(button.dataset.sample || 3)}});
      if (snapshot?.profile.id !== profile) return;
      render(reply.state);
      el('station-message').textContent = reply.message;
    } catch (error) {
      el('station-message').textContent = error.message;
    } finally {
      buttons.forEach((item) => { item.disabled = false; });
    }
  });
});

el('station-reports-button').addEventListener('click', async () => {
  const profile = snapshot?.profile.id;
  try {
    const reply = await api('demo/reports', {});
    if (snapshot?.profile.id !== profile) return;
    showReports('station-reports', reply.reports, true);
    el('station-message').textContent = reply.reports.length ? 'File de bord actualisée.' : 'La file de bord est vide.';
  } catch (error) {
    el('station-message').textContent = error.message;
  }
});

el('dismiss-reminder').addEventListener('click', () => {
  dismissed = true;
  el('reminder').hidden = true;
});

function react(message) {
  const icon = el('cat-icon');
  icon.classList.remove('reacting');
  requestAnimationFrame(() => requestAnimationFrame(() => icon.classList.add('reacting')));
  el('cat-reaction').textContent = message;
}

el('pet').addEventListener('click', () => react('Nova ferme les yeux et ronronne.'));
el('play').addEventListener('click', () => react('Nova bondit et attrape sa balle.'));

const photoKey = (profile) => `astra-demo-photo-${profile}`;

function refreshPhoto() {
  let url = null;
  try { url = localStorage.getItem(photoKey(snapshot.profile.id)); } catch { /* Browsers can disable local storage. */ }
  if (url) el('photo-preview').src = url;
  else el('photo-preview').removeAttribute('src');
  el('photo-frame').hidden = !url;
  el('remove-photo').hidden = !url;
}

el('photo').addEventListener('change', (event) => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file || !snapshot) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
    el('photo-message').textContent = 'Choisissez une image JPEG, PNG ou WebP de 2 Mo au maximum.';
    return;
  }
  const profile = snapshot.profile.id;
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    if (snapshot?.profile.id !== profile) return;
    const preview = new Image();
    preview.addEventListener('load', () => {
      if (snapshot?.profile.id !== profile) return;
      try {
        localStorage.setItem(photoKey(profile), reader.result);
        refreshPhoto();
        el('photo-message').textContent = 'Photo ajoutée à ce profil.';
      } catch {
        el('photo-message').textContent = 'Le navigateur ne peut pas conserver cette photo.';
      }
    });
    preview.addEventListener('error', () => { el('photo-message').textContent = 'Cette image est illisible.'; });
    preview.src = reader.result;
  });
  reader.addEventListener('error', () => { el('photo-message').textContent = 'Lecture de la photo impossible.'; });
  reader.readAsDataURL(file);
});

el('remove-photo').addEventListener('click', () => {
  try {
    localStorage.removeItem(photoKey(snapshot.profile.id));
    refreshPhoto();
    el('photo-message').textContent = 'Photo retirée.';
  } catch {
    el('photo-message').textContent = 'Impossible de retirer cette photo.';
  }
});

refresh();
setInterval(() => { if (snapshot) refresh(); }, 15000);
