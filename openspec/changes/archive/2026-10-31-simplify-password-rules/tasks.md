## 1. Backend

- [x] 1.1 Aplicar a nova regra em `hashAndClear`, recebendo a matrícula, sem revelar existência de conta na recuperação; verificar com testes para 7, 8, 72 e 73 bytes, sequência, repetição, lista e matrícula.
- [x] 1.2 Atualizar `OpenApiConfiguration`, `backend/README.md` e `docs/DOCKER.md`; verificar em `ApiFoundationIntegrationTest` e por leitura.

## 2. Frontend

- [x] 2.1 Criar `shared/password-rules.ts`, com as mesmas regras do backend; verificar com spec.
- [x] 2.2 Criar campo de senha com botão de mostrar, fora do `label`, escondendo `::-ms-reveal`; verificar com spec e axe.
- [x] 2.3 Aplicar em `portal.pages`, `recovery.page` e `resident-form`, removendo `maxlength`; verificar com specs e com `e2e/local-auth.spec.ts`, usando seletores exatos.
