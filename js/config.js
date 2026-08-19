
const API_URL = 'https://script.google.com/macros/s/AKfycby3hZrR4jNmVDImAVDO5PJMt38Zwd4-2rMJ3uArx28_k5ZUKUvkftrs1iyTmsYweMVluw/exec';

/* Helper único de chamada à API. */
async function api(action, data = {}) {
  const session = localStorage.getItem('vegas_session') || '';
  const payload = Object.assign({ action, session }, data);
  const res = await fetch(API_URL, {
    method: 'POST',
    // text/plain evita preflight CORS com Apps Script
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow'
  });
  return res.json();
}

/* Guarda de sessão para páginas internas. */
function requireSession() {
  if (!localStorage.getItem('vegas_session')) {
    location.href = 'index.html';
  }
}

function logout() {
  api('logout').finally(() => {
    localStorage.removeItem('vegas_session');
    localStorage.removeItem('vegas_nome');
    location.href = 'index.html';
  });
}
