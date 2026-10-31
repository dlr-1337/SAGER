## Why

O texto "De 12 a 72 caracteres; no máximo 72 bytes" é incompreensível para quem usa o SAGER: residentes adolescentes e servidores sem prática com computador. Doze caracteres também é mais do que o próprio SUAP pede (8), e nenhum campo de senha permite ver o que foi digitado, o que causa erro de digitação em quem digita devagar.

## What Changes

- Mínimo de 8 caracteres, sem exigir letra maiúscula, número ou símbolo.
- Recusa só do óbvio: sequências, um caractere repetido, lista curta de senhas comuns e a própria matrícula.
- Limite técnico de 72 bytes do bcrypt continua, com mensagem simples, sem citar bytes, e sem cortar o texto em silêncio.
- Botão de mostrar e ocultar em todos os campos de senha, inclusive no login.
- Contas existentes não mudam: o banco guarda só o hash e o login não reaplica a política.

**Risco aceito pelo dono do produto:** 8 caracteres é mais fraco que os 12 anteriores. A proteção restante é o limite de tentativas de login. A política de senha segue sujeita à validação da TI (PRD:177 e Especificação:251).

**Fora do escopo:** tela de troca de senha pelo próprio usuário, medidor de força.

## Capabilities

### New Capabilities

- `password-policy`: regras de senha e campos de senha com opção de mostrar.

### Modified Capabilities

Nenhuma.

## Impact

- `LocalAccountProvisioningService`, `ResidentRecoveryService`, `OpenApiConfiguration`.
- Novo `shared/password-rules.ts` e componente de campo de senha; `resident-form`, `recovery.page`, `portal.pages`.
- `backend/README.md`, `docs/DOCKER.md`.
