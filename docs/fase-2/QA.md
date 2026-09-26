# QA da primeira fatia da Fase 2

**Data:** 26/09/2026. **Escopo:** cadastro funcional de supervisores em ambiente
`local`, somente com dados sintéticos. Esta prova não homologa os demais cadastros
da Fase 2 nem a identidade institucional.

| Verificação              | Evidência                                                                                         | Resultado                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend                  | `.\mvnw.cmd -B -ntp clean verify` em `backend/`, Temurin 21 e PostgreSQL 17.11 via Testcontainers | 15 testes, 0 falhas; Flyway V1–V4 aplicadas.                                                                                               |
| Segurança e concorrência | Testes HTTP reais em porta aleatória                                                              | Gestor autorizado; anônimo e outros perfis negados; CSRF obrigatório; 400, 404 e 409 testados; versão obsoleta não sobrescreve o registro. |
| Conta de acesso          | SQL após POST/PUT de supervisor                                                                   | Número de contas locais não aumentou; cadastro funcional não cria credencial.                                                              |
| Angular                  | `npm run build` e `npm test -- --watch=false`                                                     | Build e 25 testes unitários passaram.                                                                                                      |
| Navegador focado         | Playwright de supervisores e auditoria de rotas, com API simulada                                 | 3 casos de supervisores e 2 de rotas passaram.                                                                                             |
| Regressão de navegador   | `npx playwright test --grep-invert "captura telas centrais"` em `frontend/`, sem backend          | 28/28 jornadas passaram; a captura visual que sobrescreve imagens rastreadas foi excluída.                                                 |
| Integração real          | PostgreSQL descartável, backend na porta 8080 e Angular na porta 4200                             | Gestor sintético criou e editou supervisor pelo navegador; POST 201, PUT 200; consulta e recarga mostraram dados persistidos.              |
| Reinício e conflito      | Backend reiniciado sobre o mesmo banco; duas abas editaram a mesma versão                         | Registro permaneceu acessível após reinício; a edição obsoleta foi recusada e a tela carregou a versão atual.                              |

O banco de prova foi publicado somente em `127.0.0.1:55433`. A conta foi criada
pela CLI com senha inserida em console oculto. A captura da tela de detalhe foi
inspecionada: mostrava “Login local”, “Dados fictícios” e “Este cadastro não cria
credenciais”. Todos os nomes, identificações e e-mails da prova usam exemplos
sintéticos; nenhuma credencial ou dado real foi versionado. Ao final, o contêiner
descartável foi parado e removido automaticamente, sem tocar em volumes existentes.

**Limites:** a unicidade da identificação funcional reproduz o protótipo, sujeita
à definição da AE/TI; o registro de supervisor não representa sua identidade
institucional nem o provisiona para login. Os demais cadastros e o mapa ainda usam
os serviços demonstrativos. As pendências D01, D02, D15, D19 e D22 estão no
[registro da fase](README.md).
