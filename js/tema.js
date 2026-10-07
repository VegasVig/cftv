/* Tema claro / escuro — carregado no <head> de todas as páginas.
   Padrão: escuro. A escolha fica salva no navegador. */
(function () {
  var KEY = 'vegas_tema';
  var SOL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var LUA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z"/></svg>';

  function salvo() {
    try { return localStorage.getItem(KEY) === 'claro' ? 'light' : 'dark'; } catch (e) { return 'dark'; }
  }
  function aplicar(t) { document.documentElement.setAttribute('data-theme', t); }
  function claro() { return document.documentElement.getAttribute('data-theme') === 'light'; }

  // Aplica antes de desenhar a página (evita "piscar" no tema errado)
  aplicar(salvo());

  function atualizarBotoes() {
    var c = claro();
    var botoes = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < botoes.length; i++) {
      var b = botoes[i];
      var rotulo = c ? 'Modo escuro' : 'Modo claro';
      b.setAttribute('aria-label', 'Ativar ' + rotulo.toLowerCase());
      b.setAttribute('title', 'Ativar ' + rotulo.toLowerCase());
      var ico = b.querySelector('.tema-ico'); if (ico) ico.innerHTML = c ? LUA : SOL;
      var txt = b.querySelector('.tema-txt'); if (txt) txt.textContent = rotulo;
    }
  }

  window.alternarTema = function () {
    var novo = claro() ? 'dark' : 'light';
    try { localStorage.setItem(KEY, novo === 'light' ? 'claro' : 'escuro'); } catch (e) {}
    aplicar(novo);
    atualizarBotoes();
  };

  // Botão para a barra lateral (páginas internas)
  window.temaBotaoHTML = function () {
    return '<button type="button" class="nav-item tema-nav" data-theme-toggle onclick="alternarTema()">' +
      '<span class="tema-ico"></span><span class="tema-txt"></span></button>';
  };
  window.atualizarBotoesTema = atualizarBotoes;

  // Login e página do técnico: botão flutuante no canto superior direito
  document.addEventListener('DOMContentLoaded', function () {
    var cl = document.body.classList;
    if (cl.contains('login-body') || cl.contains('tech-body')) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tema-fab';
      b.setAttribute('data-theme-toggle', '');
      b.innerHTML = '<span class="tema-ico"></span>';
      b.onclick = window.alternarTema;
      document.body.appendChild(b);
    }
    atualizarBotoes();
  });
})();
