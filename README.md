# Vegas Vigilância — Central CFTV

Sistema web para o setor de monitoramento CFTV da Vegas Vigilância.
As operadoras cadastram e consultam os sistemas de câmeras dos clientes e
geram **links temporários de 30 minutos** para técnicos acessarem os dados
de um cliente específico.

**Arquitetura escolhida (segura e gratuita):**

- **Frontend** (esta interface) → hospedado no **GitHub Pages**.
- **Backend** → **Google Apps Script** (roda dentro do Google, guarda as
  credenciais, gera e valida os tokens, registra os logs).
- **Banco de dados** → **Google Sheets**.

As senhas dos equipamentos e a chave secreta **nunca** ficam no navegador —
elas vivem no Apps Script e só são liberadas mediante sessão válida ou token
temporário válido.

---

## Estrutura

```
vegas-cftv/
├── assets/
│   └── logo-vegas.png        ← coloque a logo real aqui
├── frontend/
│   ├── index.html            ← login
│   ├── dashboard.html        ← indicadores
│   ├── clientes.html         ← lista, cadastro, detalhes, gerar link
│   ├── tecnico.html          ← página do técnico (acesso por token)
│   ├── historico.html        ← log de acessos
│   ├── css/style.css
│   └── js/
│       ├── config.js         ← URL da API (você edita)
│       └── ui.js
├── backend/
│   └── Codigo.gs             ← cole no Google Apps Script
└── README.md
```

---

## Passo 1 — Criar a planilha e o backend

1. Acesse https://sheets.google.com e crie uma **planilha em branco**.
   Dê o nome que quiser (ex.: `Vegas CFTV — Base`).
2. No menu, vá em **Extensões → Apps Script**.
3. Apague o conteúdo padrão e **cole todo o conteúdo de `backend/Codigo.gs`**.
4. No topo do arquivo, troque o valor de `SECRET_KEY` por uma frase longa e
   aleatória sua (isso protege os tokens). Guarde-a; não precisa compartilhar.
5. Clique em **Salvar** (ícone de disquete).
6. No seletor de função (barra do topo), escolha **`setup`** e clique em
   **Executar**. Autorize o acesso quando o Google pedir (é a sua própria conta).
   - Isso cria as abas `Clientes`, `Usuarios`, `Tokens`, `Logs`, `Sessoes`
     e um usuário inicial **admin / vegas123**.

## Passo 2 — Publicar a API

1. No Apps Script, clique em **Implantar → Nova implantação**.
2. Em "Selecionar tipo" (engrenagem), escolha **App da Web**.
3. Configure:
   - **Executar como:** Eu (sua conta).
   - **Quem tem acesso:** Qualquer pessoa.
4. Clique em **Implantar** e **copie a URL** que termina em `/exec`.

> Sempre que editar o `Codigo.gs`, use **Implantar → Gerenciar implantações →
> editar (lápis) → Nova versão** para publicar as mudanças na mesma URL.

## Passo 3 — Conectar o frontend

1. Abra `frontend/js/config.js`.
2. Substitua o valor de `API_URL` pela URL `/exec` que você copiou:

   ```js
   const API_URL = 'https://script.google.com/macros/s/AKfy.../exec';
   ```

## Passo 4 — Adicionar a logo

Coloque o arquivo da logo em `assets/logo-vegas.png`.
(Enquanto não existir, o sistema mostra um "V" dourado no lugar.)

## Passo 5 — Publicar o frontend no GitHub Pages

1. Crie um repositório no GitHub e envie **todo o conteúdo desta pasta**.
2. No repositório: **Settings → Pages**.
3. Em "Build and deployment", **Source: Deploy from a branch**,
   selecione a branch `main` e a pasta `/root`. Salve.
4. Aguarde 1–2 minutos. O GitHub mostra a URL pública, algo como:
   `https://SEU-USUARIO.github.io/vegas-cftv/frontend/index.html`

> Se preferir a URL mais curta, mova o conteúdo de `frontend/` para a raiz do
> repositório e ajuste os caminhos `../assets/` para `assets/` nos HTML.

---

## Primeiro acesso

- Usuário: **admin**
- Senha: **vegas123**

**Troque a senha imediatamente:** abra a planilha, aba `Usuarios`, e na coluna
`SenhaHash` cole o hash da nova senha. Para gerar o hash, no Apps Script rode
temporariamente `Logger.log(hash_('SUA_NOVA_SENHA'))` e copie o resultado.
Para criar mais operadoras, adicione novas linhas em `Usuarios`
(`Usuario`, `SenhaHash`, `Nome`, `Ativo=SIM`).

---

## Como funciona o link do técnico

1. A operadora abre um cliente e clica em **Gerar acesso para técnico**.
2. O backend cria um **token aleatório**, guarda na aba `Tokens` com a hora de
   expiração (30 min) e devolve só o token. **Nenhum dado do cliente vai na URL.**
3. A operadora copia o link ou envia pelo WhatsApp (a mensagem **não** inclui a senha).
4. O técnico abre `tecnico.html?t=TOKEN`. O backend valida o token e a expiração
   e só então libera os dados daquele cliente.
5. Após 30 minutos — ou se a operadora clicar em **Revogar acesso** — o link
   para de funcionar. Toda geração, uso e revogação fica registrada em `Logs`.

---

## Segurança — o que está protegido

- Chave secreta e senhas de CFTV ficam **no Apps Script**, nunca no navegador.
- Ações administrativas exigem **sessão válida** (token de sessão com validade).
- O link do técnico usa **token aleatório**, validado no servidor, com
  expiração e revogação.
- Consultas de credenciais e acessos técnicos são **registrados em log**.

**Limitação honesta:** o Google Sheets não é criptografado em repouso pela
aplicação — a proteção vem do controle de acesso à sua conta Google e à API.
Para dados muito sensíveis em escala, considere migrar o backend para um banco
com criptografia no futuro. Para o uso descrito, esta arquitetura é adequada e
cumpre a separação frontend/backend exigida.

---

## Testes recomendados (faça na ordem)

1. Login com admin/vegas123.
2. Cadastrar um cliente com foto.
3. Ver na lista e abrir **Ver informações**.
4. Mostrar/copiar senha.
5. **Gerar acesso para técnico** → abrir o link em aba anônima → conferir dados.
6. Clicar em **Revogar** → recarregar o link do técnico → deve bloquear.
7. Conferir a aba **Histórico**.
8. Abrir no celular e checar os cards responsivos.
