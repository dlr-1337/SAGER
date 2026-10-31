## Why

Os cadastros aceitam dados sem sentido: nome de uma palavra só, matrícula "1", qualquer e-mail, data de nascimento de 1900. O responsável pode ser salvo com telefone que depois bloqueia a saída longa. O curso é opcional, mas o dono do produto definiu que é obrigatório.

**O que a pesquisa encontrou** (fontes em `docs/fase-0/CADASTRO_IFGOIANO.md`):
- **E-mail:** o domínio `estudante.ifgoiano.edu.br` está certo, com o padrão `nome.sobrenome`. Nem todo estudante tem conta: ela depende de ativação no SUAP e, para menor, de autorização do responsável. Por isso o e-mail continua opcional, mas com domínio obrigatório quando preenchido.
- **Matrícula:** o IF Goiano não publica o formato. Há 315 matrículas públicas de técnico integrado com 15 posições (`99999AAAA999999`) e 17 de graduação com 16 dígitos, além de um caso com 17. A regra é por faixa, sem decodificar campus nem curso.
- **Nome:** a Lei 6.015, art. 55, sustenta prenome e sobrenome. Recusar uma palavra só contraria a recomendação do W3C, por decisão do dono.

## What Changes

- **BREAKING:** curso passa a ser obrigatório em POST e PUT de residente. Residentes antigos sem curso continuam legíveis, mas precisam informar ao editar, como a data de nascimento na V10.
- Nome completo com pelo menos duas palavras significativas.
- Matrícula de residente: 15 a 17 posições começando pelo ano, nunca no futuro. Supervisor: 4 a 20 posições.
- E-mail de residente, se preenchido, termina em `@estudante.ifgoiano.edu.br`. E-mail de supervisor continua obrigatório, em qualquer domínio válido, com dica para o institucional, porque terceirizados podem não ter.
- Nascimento: idade de 10 a 100 anos, em `America/Sao_Paulo`.
- Telefone do responsável obrigatório, formato brasileiro, com máscara na tela.
- Vínculo do responsável com letras; capacidade do quarto de 1 a 20; textos só com espaços são recusados no próprio campo.
- Formato só vale para valor novo ou alterado: uma edição não relacionada não trava por causa de dado antigo.

**Fora do escopo:** decodificar campus e curso da matrícula, checar vínculo com o SUAP, CHECK novo no banco, correção em massa, campo de nome social.

## Capabilities

### New Capabilities

- `registration-validation`: validação de nome, matrícula, e-mail, nascimento, telefone, curso e demais campos de cadastro.

### Modified Capabilities

Nenhuma.

## Impact

- `ResidentService`, `SupervisorService`, `GuardianService`, `RoomService`, testes de integração e fixtures com nome de uma palavra.
- Novo `shared/field-rules.ts`; `resident-form`, `supervisor-form`, `guardians.pages`, `resident-detail`, `room-form`, formulários de saída, advertência e aviso.
- `AGENTS.md` (curso e e-mail), `backend/README.md`, `docs/fase-0/DECISOES.md`, `docs/fase-2/PACOTE_AE_TI.md`, `docs/fase-2/QA.md`.
- Comando de provisionamento e login não recebem a regra de formato.

## Open Questions

- Pedir à AE/TI uma matrícula real de técnico integrado atual: só há evidência pública até 2017. Com ela, a faixa pode ser apertada.
- O Decreto 8.727/2016 exige campo de nome social na administração federal, e o SAGER não tem. Decisão institucional.
