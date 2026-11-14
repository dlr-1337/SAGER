## Context

Motivação em proposal.md. Estado atual, conferido no código:

- A conta local guarda um único identificador de login (`sager_local_account.enrollment`). Para o residente ele é a matrícula; para o supervisor é o valor de `institutionalId` do cadastro (matrícula ou SIAPE); para o gestor é o que o operador passa em `--matricula=` no comando de contas.
- A página de acesso (`portal.pages.ts`) mostra "Matrícula", "Entre com sua matrícula e a senha do SAGER.", "Informe sua matrícula e senha." e "Matrícula ou senha errada...". O 401 do servidor (`SecurityConfiguration`) diz "Matrícula ou senha inválidos.". O 429 do limite diz "Muitas tentativas. Aguarde e tente novamente." e não cita matrícula.
- O cadastro de supervisor mostra "Matrícula ou SIAPE (usada para entrar)", e o servidor responde "Matrícula já utilizada por uma conta." e "Matrícula ou SIAPE já cadastrada." nos conflitos.
- `passwordProblem` (frontend) e `hashAndClear` (backend) dizem "A senha não pode ser igual à matrícula." para qualquer perfil, inclusive no cadastro do supervisor.
- A monografia diz "login por matrícula e senha" (cap4.tex:36, :107, :199, :216, :360, :396; cap5.tex:128, :157, :159, :163; cap6.tex:71; cap8.tex:137) e as figuras `25_seq_login.png` e `12_classes_gestao.png` têm "matrícula" no login e na classe Conta local.

## Goals / Non-Goals

**Goals:**

- Quem não é residente não vê "matrícula" como nome do seu login.
- O residente continua sabendo que entra com a matrícula.
- Mensagens do servidor sobre o login de qualquer perfil usam "usuário".

**Non-Goals:**

- Renomear campos da API, colunas, migrações ou opções do comando de contas.
- Mudar como o login é conferido, o limite de tentativas ou a recuperação de senha.
- Mudar textos sobre a matrícula do residente.

## Decisions

### D1. "Usuário" só no texto; nomes internos ficam

O rótulo e as mensagens mudam; o parâmetro `matricula` do `POST /api/v1/auth/login`, `enrollment`, `institutionalId`, a coluna e o `--matricula=` do terminal ficam. O resumo da rota na documentação da API passa a "Entrar com usuário e senha".
*Rejeitada:* renomear o parâmetro para `usuario` (ou `username`). Quebraria clientes e testes, exigiria aceitar os dois nomes durante a troca e não muda nada para quem usa a tela.

### D2. Uma dica curta para o residente, ligada ao campo

O campo "Usuário" leva o texto "Residente: use sua matrícula." ligado por `aria-describedby`, visível sempre.
*Rejeitada:* rótulo "Usuário ou matrícula". Volta a sugerir que gestor e supervisor têm matrícula.
*Rejeitada:* só um `placeholder`. Some ao digitar e não é lido de forma confiável por leitores de tela.

### D3. Mensagem 401 única e neutra

O servidor responde "Usuário ou senha inválidos." e a tela mostra "Usuário ou senha errados. Confira e tente de novo. Se continuar, clique em Esqueci minha senha.", iguais para conta inexistente, inativa e senha errada.
*Rejeitada:* mensagem diferente por perfil. O servidor não sabe o perfil de uma conta inexistente, e distinguir revelaria se ela existe.

### D4. Supervisor: "Usuário" no lugar de "Matrícula ou SIAPE"

Cadastro, edição, detalhe, busca e conflitos (servidor e demonstração) dizem "usuário". A regra do valor (4 a 20 letras, números ou hífen) não muda, e o SIAPE continua aceito como usuário.
*Rejeitada:* manter "Matrícula ou SIAPE" no cadastro. É exatamente o termo que o dono pediu para tirar do login do supervisor.

### D5. Senha igual ao login: mensagem conforme o campo

No frontend, `passwordRules` recebe a mensagem: o cadastro do supervisor diz "A senha não pode ser igual ao usuário."; o cadastro e a recuperação do residente continuam com "à matrícula". No backend, `hashAndClear` serve a todos os perfis e passa a dizer "A senha não pode ser igual ao usuário.", que também é verdade para o residente; a tela do residente não mostra essa mensagem do servidor (o 400 vira a mensagem geral do formulário).
*Rejeitada:* "usuário" em todas as telas. No formulário do residente o campo se chama "Matrícula", e a mensagem citaria um campo que não existe ali.

### D6. Comando de contas do terminal sem mudança

A ajuda, o cabeçalho "UUID | matrícula | ..." e "Matrícula atribuída." continuam, coerentes com `--matricula=` e `assign-enrollment`. As mensagens gerais de conta que o terminal também mostra ("Já existe uma conta com esse usuário ou e-mail.", "Usuário já utilizado por outra conta.", "Usuário deve ter entre 1 e 64 caracteres...") passam a "usuário", porque valem para qualquer perfil e chegam também à API.
*Rejeitada:* renomear a opção para `--usuario=`. Quebraria os procedimentos do operador e `docs/OPERACAO.md`.

### D7. Matrícula fictícia no formato do IF na demonstração de relatórios

A demonstração de relatórios gera `20241012020190` + número de 2 dígitos (16 dígitos, ano 2024, 5º dígito 1), no lugar de `DEMO-00n`, que não passaria na regra de matrícula de residente.
*Rejeitada:* manter `DEMO-00n`. Mostra na demonstração uma matrícula que o sistema recusaria.

## Risks / Trade-offs

- A monografia passa a divergir do sistema até o dono atualizar o texto e as duas figuras. → O relatório da change traz cada trecho com a frase sugerida.
- Clientes da API que comparem a mensagem do 401 com o texto antigo mudam de resultado. → O código `invalid_credentials` não muda; só a mensagem.

## O que o dono ou a instituição ainda decide

- Aprovar e aplicar na monografia as frases sugeridas (RF001, cap. 4, 5, 6 e 8) e refazer `25_seq_login.png` (passos 1, 3 e 4) e `12_classes_gestao.png` (atributo da Conta local).
- Se o usuário do supervisor deve ser sempre o SIAPE ou pode ser outro identificador; hoje vale qualquer valor de 4 a 20 letras, números ou hífen.
- Se o `AGENTS.md` deve trocar "All roles log in with enrollment" por "usuário"; a frase segue correta para o dado guardado e não foi alterada.
