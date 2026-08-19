/*************************************************************************
 * VEGAS VIGILÂNCIA — CENTRAL CFTV  |  Backend (Google Apps Script)
 *
 * Este arquivo roda DENTRO do Google (servidor). O navegador nunca vê
 * as credenciais nem os segredos. Ele expõe uma API via doGet/doPost.
 *
 * Como publicar (resumo — detalhes no README):
 *   1. Crie uma Planilha Google.
 *   2. Extensões > Apps Script, cole este código.
 *   3. Rode a função `setup()` uma vez (cria abas e usuário admin).
 *   4. Implantar > Nova implantação > Tipo: App da Web
 *        Executar como: Eu
 *        Quem tem acesso: Qualquer pessoa
 *   5. Copie a URL /exec e cole em frontend/js/config.js
 *************************************************************************/

// ====== CONFIGURAÇÃO ======
// Troque este valor por uma frase longa e aleatória. Serve para assinar tokens.
const SECRET_KEY = 'TROQUE_ESTA_CHAVE_POR_UMA_FRASE_LONGA_E_ALEATORIA_2024';

// Validade do link do técnico, em minutos.
const LINK_TTL_MIN = 30;

// Validade da sessão da operadora, em horas.
const SESSION_TTL_H = 12;

// Nomes das abas
const SH_CLIENTES = 'Clientes';
const SH_USUARIOS = 'Usuarios';
const SH_TOKENS   = 'Tokens';
const SH_LOGS     = 'Logs';
const SH_SESSOES  = 'Sessoes';

// ====== SETUP (rodar UMA vez) ======
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  ensureSheet_(ss, SH_CLIENTES, [
    'ID','NumeroCliente','Nome','Endereco','Marca','Modelo','Tipo',
    'Canais','CamerasInstaladas','CamerasFuncionando','UsuarioCFTV','SenhaCFTV',
    'IP_URL','Porta','Foto','Observacoes','ObsTecnicas','Status',
    'DataCadastro','UltimaAtualizacao'
  ]);
  ensureSheet_(ss, SH_USUARIOS, ['Usuario','SenhaHash','Nome','Ativo']);
  ensureSheet_(ss, SH_TOKENS,   ['Token','ClienteID','CriadoEm','ExpiraEm','Status','CriadoPor']);
  ensureSheet_(ss, SH_LOGS,     ['DataHora','Operadora','Acao','ClienteID','Detalhe']);
  ensureSheet_(ss, SH_SESSOES,  ['SessionToken','Usuario','CriadoEm','ExpiraEm']);

  // Cria usuário admin padrão se a aba estiver vazia
  const us = ss.getSheetByName(SH_USUARIOS);
  if (us.getLastRow() < 2) {
    us.appendRow(['admin', hash_('vegas123'), 'Administrador', 'SIM']);
  }
  SpreadsheetApp.getUi && Logger.log('Setup concluído. Usuário: admin / senha: vegas123 (troque depois!)');
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.getRange(1,1,1,headers.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

// ====== ROTEADOR HTTP ======
function doGet(e)  { return handle_(e); }
function doPost(e) { return handle_(e); }

function handle_(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    let body = {};
    if (e && e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); } catch (_) {}
    }
    const req = Object.assign({}, params, body);
    const action = req.action || '';

    // Ações públicas (não exigem sessão)
    if (action === 'login')       return json_(login_(req));
    if (action === 'tecnico')     return json_(tecnicoView_(req));   // acesso via token temporário

    // Ações protegidas (exigem sessão válida da operadora)
    const sess = checkSession_(req.session);
    if (!sess.ok) return json_({ ok:false, error:'NAO_AUTORIZADO' });
    const user = sess.usuario;

    switch (action) {
      case 'logout':       return json_(logout_(req.session));
      case 'list':         return json_(listClientes_(req));
      case 'get':          return json_(getCliente_(req, user));
      case 'create':       return json_(createCliente_(req, user));
      case 'update':       return json_(updateCliente_(req, user));
      case 'delete':       return json_(deleteCliente_(req, user));
      case 'genLink':      return json_(genLink_(req, user));
      case 'revoke':       return json_(revokeLink_(req, user));
      case 'logs':         return json_(getLogs_(req));
      case 'stats':        return json_(getStats_(req));
      default:             return json_({ ok:false, error:'ACAO_DESCONHECIDA' });
    }
  } catch (err) {
    return json_({ ok:false, error:'ERRO_SERVIDOR', detail:String(err) });
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ====== AUTENTICAÇÃO ======
function login_(req) {
  const u = String(req.usuario||'').trim();
  const p = String(req.senha||'');
  if (!u || !p) return { ok:false, error:'DADOS_FALTANDO' };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rows = ss.getSheetByName(SH_USUARIOS).getDataRange().getValues();
  for (let i=1; i<rows.length; i++) {
    const [usr, hashSenha, nome, ativo] = rows[i];
    if (String(usr) === u && String(ativo).toUpperCase() === 'SIM' && hash_(p) === String(hashSenha)) {
      const token = createSession_(u);
      log_(u, 'LOGIN', '', '');
      return { ok:true, session:token, nome:nome, usuario:u };
    }
  }
  return { ok:false, error:'CREDENCIAIS_INVALIDAS' };
}

function createSession_(usuario) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SH_SESSOES);
  const token = randToken_(32);
  const now = new Date();
  const exp = new Date(now.getTime() + SESSION_TTL_H*3600*1000);
  sh.appendRow([token, usuario, now, exp]);
  return token;
}

function checkSession_(token) {
  if (!token) return { ok:false };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rows = ss.getSheetByName(SH_SESSOES).getDataRange().getValues();
  const now = new Date();
  for (let i=1; i<rows.length; i++) {
    if (String(rows[i][0]) === String(token)) {
      const exp = new Date(rows[i][3]);
      if (now < exp) return { ok:true, usuario:rows[i][1] };
      return { ok:false };
    }
  }
  return { ok:false };
}

function logout_(token) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SH_SESSOES);
  const rows = sh.getDataRange().getValues();
  for (let i=rows.length-1; i>=1; i--) {
    if (String(rows[i][0]) === String(token)) sh.deleteRow(i+1);
  }
  return { ok:true };
}

// ====== CLIENTES (CRUD) ======
function listClientes_(req) {
  const data = readClientes_();
  const q = String(req.q||'').toLowerCase().trim();
  let list = data.map(c => ({
    ID:c.ID, NumeroCliente:c.NumeroCliente, Nome:c.Nome, Marca:c.Marca,
    Modelo:c.Modelo, Tipo:c.Tipo, Canais:c.Canais,
    CamerasInstaladas:c.CamerasInstaladas, CamerasFuncionando:c.CamerasFuncionando,
    Status:c.Status
  }));
  if (q) {
    list = list.filter(c =>
      Object.values(c).some(v => String(v).toLowerCase().includes(q))
    );
  }
  return { ok:true, clientes:list };
}

function getCliente_(req, user) {
  const c = findCliente_(req.id);
  if (!c) return { ok:false, error:'NAO_ENCONTRADO' };
  log_(user, 'VER_CREDENCIAIS', c.ID, 'Abriu detalhes do cliente');
  return { ok:true, cliente:c };
}

function createCliente_(req, user) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SH_CLIENTES);
  const c = req.cliente || {};
  const id = 'C' + Utilities.formatDate(new Date(),'GMT-3','yyyyMMddHHmmss');
  const now = new Date();
  sh.appendRow([
    id, s_(c.NumeroCliente), s_(c.Nome), s_(c.Endereco), s_(c.Marca), s_(c.Modelo),
    s_(c.Tipo), s_(c.Canais), s_(c.CamerasInstaladas), s_(c.CamerasFuncionando),
    s_(c.UsuarioCFTV), s_(c.SenhaCFTV), s_(c.IP_URL), s_(c.Porta), s_(c.Foto),
    s_(c.Observacoes), s_(c.ObsTecnicas), c.Status||'Ativo', now, now
  ]);
  log_(user, 'CADASTRO', id, 'Cliente ' + s_(c.NumeroCliente));
  return { ok:true, id:id };
}

function updateCliente_(req, user) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SH_CLIENTES);
  const rows = sh.getDataRange().getValues();
  const c = req.cliente || {};
  for (let i=1; i<rows.length; i++) {
    if (String(rows[i][0]) === String(req.id)) {
      const r = i+1;
      const map = {
        2:c.NumeroCliente,3:c.Nome,4:c.Endereco,5:c.Marca,6:c.Modelo,7:c.Tipo,
        8:c.Canais,9:c.CamerasInstaladas,10:c.CamerasFuncionando,11:c.UsuarioCFTV,
        12:c.SenhaCFTV,13:c.IP_URL,14:c.Porta,15:c.Foto,16:c.Observacoes,
        17:c.ObsTecnicas,18:c.Status
      };
      Object.keys(map).forEach(col => {
        if (map[col] !== undefined) sh.getRange(r, Number(col)).setValue(map[col]);
      });
      sh.getRange(r, 20).setValue(new Date());
      log_(user, 'ATUALIZACAO', req.id, '');
      return { ok:true };
    }
  }
  return { ok:false, error:'NAO_ENCONTRADO' };
}

function deleteCliente_(req, user) {
  // Desativa (não apaga) — mais seguro para auditoria.
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SH_CLIENTES);
  const rows = sh.getDataRange().getValues();
  for (let i=1; i<rows.length; i++) {
    if (String(rows[i][0]) === String(req.id)) {
      sh.getRange(i+1, 18).setValue('Inativo');
      sh.getRange(i+1, 20).setValue(new Date());
      log_(user, 'DESATIVACAO', req.id, '');
      return { ok:true };
    }
  }
  return { ok:false, error:'NAO_ENCONTRADO' };
}

function readClientes_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rows = ss.getSheetByName(SH_CLIENTES).getDataRange().getValues();
  const head = rows[0];
  const out = [];
  for (let i=1; i<rows.length; i++) {
    const o = {};
    head.forEach((h,j) => o[h] = rows[i][j]);
    out.push(o);
  }
  return out;
}

function findCliente_(id) {
  return readClientes_().filter(c => String(c.ID) === String(id))[0] || null;
}

// ====== LINK TEMPORÁRIO DO TÉCNICO ======
function genLink_(req, user) {
  const c = findCliente_(req.id);
  if (!c) return { ok:false, error:'NAO_ENCONTRADO' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SH_TOKENS);
  const token = randToken_(24);
  const now = new Date();
  const exp = new Date(now.getTime() + LINK_TTL_MIN*60*1000);
  sh.appendRow([token, c.ID, now, exp, 'ATIVO', user]);
  log_(user, 'GEROU_LINK', c.ID, 'Token ' + token.substring(0,6) + '…');
  return { ok:true, token:token, expiraEm:exp.toISOString(), ttlMin:LINK_TTL_MIN,
           numero:c.NumeroCliente, nome:c.Nome };
}

function revokeLink_(req, user) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SH_TOKENS);
  const rows = sh.getDataRange().getValues();
  for (let i=1; i<rows.length; i++) {
    if (String(rows[i][0]) === String(req.token)) {
      sh.getRange(i+1, 5).setValue('REVOGADO');
      log_(user, 'REVOGOU_LINK', rows[i][1], 'Token ' + String(req.token).substring(0,6) + '…');
      return { ok:true };
    }
  }
  return { ok:false, error:'NAO_ENCONTRADO' };
}

// View do técnico: valida token e devolve SÓ o necessário (sem sessão).
function tecnicoView_(req) {
  const token = String(req.token||'');
  if (!token) return { ok:false, error:'SEM_TOKEN' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SH_TOKENS);
  const rows = sh.getDataRange().getValues();
  const now = new Date();
  for (let i=1; i<rows.length; i++) {
    if (String(rows[i][0]) === token) {
      const clienteID = rows[i][1];
      const exp = new Date(rows[i][3]);
      const status = String(rows[i][4]);
      if (status === 'REVOGADO') return { ok:false, error:'REVOGADO' };
      if (now >= exp) { sh.getRange(i+1,5).setValue('EXPIRADO'); return { ok:false, error:'EXPIRADO' }; }
      const c = findCliente_(clienteID);
      if (!c) return { ok:false, error:'NAO_ENCONTRADO' };
      // marca como utilizado (mantém ATIVO até expirar)
      if (status !== 'UTILIZADO') { sh.getRange(i+1,5).setValue('UTILIZADO'); }
      log_('TECNICO', 'ACESSO_TECNICO', clienteID, 'Token ' + token.substring(0,6) + '…');
      // Devolve apenas dados operacionais necessários ao técnico
      return { ok:true, expiraEm:exp.toISOString(), cliente:{
        NumeroCliente:c.NumeroCliente, Nome:c.Nome, Endereco:c.Endereco,
        Marca:c.Marca, Modelo:c.Modelo, Tipo:c.Tipo, Canais:c.Canais,
        CamerasInstaladas:c.CamerasInstaladas, CamerasFuncionando:c.CamerasFuncionando,
        UsuarioCFTV:c.UsuarioCFTV, SenhaCFTV:c.SenhaCFTV, IP_URL:c.IP_URL,
        Porta:c.Porta, Foto:c.Foto, ObsTecnicas:c.ObsTecnicas
      }};
    }
  }
  return { ok:false, error:'INVALIDO' };
}

// ====== LOGS / STATS ======
function log_(operadora, acao, clienteID, detalhe) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.getSheetByName(SH_LOGS).appendRow([new Date(), operadora, acao, clienteID, detalhe]);
}

function getLogs_(req) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rows = ss.getSheetByName(SH_LOGS).getDataRange().getValues();
  const out = [];
  for (let i=rows.length-1; i>=1 && out.length<200; i--) {
    out.push({ DataHora:rows[i][0], Operadora:rows[i][1], Acao:rows[i][2],
               ClienteID:rows[i][3], Detalhe:rows[i][4] });
  }
  return { ok:true, logs:out };
}

function getStats_(req) {
  const clientes = readClientes_();
  const ativos = clientes.filter(c => String(c.Status) !== 'Inativo');
  const totalCanais = ativos.reduce((a,c)=>a + (Number(c.Canais)||0), 0);
  const totalCameras = ativos.reduce((a,c)=>a + (Number(c.CamerasInstaladas)||0), 0);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tok = ss.getSheetByName(SH_TOKENS).getDataRange().getValues();
  const now = new Date();
  let linksAtivos=0, linksExpirados=0;
  for (let i=1;i<tok.length;i++){
    const exp=new Date(tok[i][3]), st=String(tok[i][4]);
    if (st==='REVOGADO'||st==='EXPIRADO'||now>=exp) linksExpirados++;
    else linksAtivos++;
  }
  const ultimos = clientes.slice(-5).reverse().map(c=>({NumeroCliente:c.NumeroCliente,Nome:c.Nome,ID:c.ID}));
  return { ok:true, stats:{
    totalClientes:clientes.length, clientesAtivos:ativos.length,
    totalEquipamentos:ativos.length, totalCameras:totalCameras, totalCanais:totalCanais,
    linksAtivos:linksAtivos, linksExpirados:linksExpirados, ultimosClientes:ultimos
  }};
}

// ====== UTILS ======
function s_(v){ return (v===undefined||v===null)?'':v; }
function randToken_(n){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let t=''; const rnd=Utilities.getUuid().replace(/-/g,'');
  for (let i=0;i<n;i++){ t+=chars.charAt((rnd.charCodeAt(i%rnd.length)+i)%chars.length); }
  return t;
}
function hash_(str){
  const raw=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str+SECRET_KEY);
  return raw.map(b=>('0'+(b&0xFF).toString(16)).slice(-2)).join('');
}

/*************************************************************************
 * UTILITÁRIO PARA TROCAR A SENHA
 * Como usar:
 *   1. Troque 'MinhaNovaSenha123' pela senha que você quer.
 *   2. No topo, selecione a função gerarMinhaSenha e clique em Executar.
 *   3. Veja o "Registro de execução": copie o hash que aparecer.
 *   4. Na planilha, aba Usuarios, cole esse hash na coluna SenhaHash
 *      da linha do usuário. Pronto — entre com a senha nova (não o hash).
 *************************************************************************/
function gerarMinhaSenha() {
  const senhaNova = 'MinhaNovaSenha123';   // <-- troque aqui
  Logger.log('Hash da senha (copie a linha abaixo):');
  Logger.log(hash_(senhaNova));
}
