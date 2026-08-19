/* Componentes de UI compartilhados */

const ICONS = {
  dash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
  clients:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  logs:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>',
  logout:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  cam:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>',
  shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  link:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
};

function logoHTML(){
  return `<div class="logo">
    <img src="../assets/logo-vegas.png" alt="Vegas"
      onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">
    <div class="fallback" style="display:none">V</div>
    <div class="brand"><b>Vegas Vigilância</b><span>Central CFTV</span></div>
  </div>`;
}

function renderSidebar(active){
  const nome = localStorage.getItem('vegas_nome') || 'Operadora';
  const items = [
    ['dashboard.html','dash','Dashboard','dash'],
    ['clientes.html','clients','Clientes','clients'],
    ['historico.html','logs','Histórico','logs']
  ];
  const nav = items.map(([href,ico,label,key])=>
    `<a class="nav-item ${active===key?'active':''}" href="${href}">${ICONS[ico]}<span>${label}</span></a>`
  ).join('');
  const el = document.getElementById('sidebar');
  el.innerHTML = `
    ${logoHTML()}
    ${nav}
    <div class="spacer"></div>
    <div class="user-box">Conectada como<b>${escapeHTML(nome)}</b></div>
    <div class="nav-item" onclick="logout()">${ICONS.logout}<span>Sair</span></div>
  `;
}

function toggleMenu(){
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
}

function showLoading(v){ document.getElementById('loading').classList.toggle('show', v); }

function toast(msg, type='ok'){
  let t = document.getElementById('toast');
  if(!t){ t=document.createElement('div'); t.id='toast';
    t.style.cssText='position:fixed;bottom:24px;right:24px;z-index:400;padding:14px 20px;border-radius:10px;font-size:14px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.4);transition:.3s;transform:translateY(80px);opacity:0';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.background = type==='err' ? '#ef4444' : (type==='info'?'#0ea5e9':'#22c55e');
  t.style.color = '#fff';
  requestAnimationFrame(()=>{ t.style.transform='translateY(0)'; t.style.opacity='1'; });
  clearTimeout(t._h);
  t._h = setTimeout(()=>{ t.style.transform='translateY(80px)'; t.style.opacity='0'; }, 2800);
}

function escapeHTML(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* Shell HTML padrão para páginas internas (injeta sidebar+overlay+loading) */
function appShell(){
  return `
  <div class="app">
    <aside class="sidebar" id="sidebar"></aside>
    <div class="sidebar-overlay" id="overlay" onclick="toggleMenu()"></div>
    <main class="main" id="main"></main>
  </div>
  <div class="loading" id="loading"><div class="spinner"></div></div>`;
}
