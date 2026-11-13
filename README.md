# SAGER

**Gestão da residência estudantil do IF Goiano — Campus Urutaí: cadastros, quartos, chamada noturna, saídas, comunicação, limpeza e relatórios em um só sistema.**

O SAGER substitui controles em papel por registros digitais rastreáveis. É uma aplicação web responsiva, com interface Angular 22, API Spring Boot 4.1 em Java 21 e banco PostgreSQL 17. Toda permissão é conferida no servidor, e toda alteração fica na auditoria.

## Perfis

| Perfil | O que faz |
| --- | --- |
| Gestor | Mantém os cadastros, inclusive os supervisores, aloca residentes nos quartos e consulta limpeza, ranking e relatórios. |
| Supervisor | Mantém os cadastros, exceto supervisores, e cuida da rotina: chamada noturna, saídas e retornos, notificações, advertências, avisos, limpeza e conversas com responsáveis. |
| Residente | Consulta o que é seu: comunicações, avaliações de limpeza e ranking. O residente menor de idade também pede saídas. |

Não há cadastro público. O operador cria as contas pelo terminal, e o cadastro de residente ou de supervisor já cria a conta vinculada, com a senha escolhida.

## Uso por perfil

**Acesso.** Entre com a matrícula (ou SIAPE) e a senha. Se esquecer a senha, o residente usa **Esqueci minha senha**, que confere matrícula, nome, nascimento e, se houver responsável ativo, o nome de um deles; servidores procuram o operador. Muitas tentativas erradas bloqueiam o login por alguns minutos. Ao terminar, use **Sair**, principalmente em computador compartilhado.

**Gestor**

1. Em **Residentes**, **Responsáveis**, **Cursos**, **Supervisores** e **Quartos**, consulte e mantenha os cadastros. Confira matrícula, nascimento e responsáveis.
2. Para alocar ou transferir, abra o quarto ou o residente, confira a vaga e confirme. O histórico guarda a ocupação anterior.
3. Em **Limpeza** e **Ranking**, acompanhe as avaliações por período. Nota zero e falta de avaliação são coisas diferentes.
4. Em **Relatórios**, escolha o tipo, o período e os filtros e gere PDF e Excel. O arquivo traz o recorte daquele momento; para ver mudanças posteriores, gere outro.

O gestor não registra chamada, movimento físico nem decisão disciplinar.

**Supervisor**

1. Em **Chamada noturna**, confira a data e os residentes menores alocados, marque as presenças e finalize. Quem está fora com saída válida já aparece com ausência justificada; confira e corrija se preciso. Corrigir depois exige justificativa e preserva o registro original.
2. Em **Saídas e retornos**, analise os pedidos e registre a partida e o retorno reais. Na saída longa, confira antes a autorização do responsável, recebida pelo WhatsApp ou anexada, na revisão atual do documento. Aprovar é um passo separado. Mensagem enviada ou arquivo recebido não aprova nada.
3. Em **Notificações** e **Advertências**, analise a origem, as evidências e o motivo antes de emitir. Nenhuma ocorrência gera punição automática.
4. Em **Avisos**, confira destinatários e texto antes de publicar. Editar cria nova versão, e a ciência anterior não vale para ela.
5. Em **Limpeza**, escolha o quarto e o momento, dê nota de 0 a 10 nos quatro critérios e confira a média calculada.
6. Em **Conversas**, troque mensagens com os responsáveis pelo WhatsApp, quando a integração estiver ligada.

**Residente**

1. Em **Meu perfil**, confira seus dados. Vínculo errado é corrigido pelo operador.
2. Em **Minhas comunicações**, leia avisos e advertências. Confirme a ciência só depois de ler a versão apresentada. Ciência não é assinatura.
3. Em **Minha limpeza** e **Ranking**, veja as avaliações do seu quarto e a posição geral.
4. Se for menor de idade, use **Minhas saídas** para pedir uma saída e acompanhar o pedido. A aprovação não registra sua partida: quem registra é o supervisor.

**Quando algo dá errado**

- **Sessão encerrada:** entre de novo.
- **Sem permissão:** confira o perfil e procure o operador.
- **Registro alterado por outra pessoa:** atualize a tela e refaça a ação com os dados atuais. Nada é sobrescrito.
- **WhatsApp fora do ar:** o supervisor anexa a autorização à mão.
- **Relatório expirado:** gere outro; os arquivos ficam disponíveis por 24 horas.

A página **Ajuda** reúne orientações por perfil. A navegação funciona por teclado, e no celular o menu fica em **Menu**.

## Como rodar

Com Docker e Compose instalados, na raiz:

```bash
./sager up
./sager account create --matricula=TESTE-GESTOR --name='Gestor de Teste' --profile=gestor
```

O segundo comando pede a senha duas vezes. Abra http://127.0.0.1:4200/acesso e entre com a matrícula escolhida. Não existe senha padrão. `./sager down` para tudo sem apagar os dados. Os demais comandos estão em [docs/OPERACAO.md](docs/OPERACAO.md).

Para desenvolver a interface fora do Docker, com o [backend rodando no host](backend/README.md):

```bash
cd frontend
npm ci
npm start
```

## Como verificar

Em `frontend/`:

```bash
npm test -- --watch=false
npm run build
npm run test:e2e
```

Em `backend/`, com JDK 21 e Docker (no Windows, `.\mvnw.cmd`):

```bash
./mvnw -B -ntp verify
```

Na raiz, para conferir as specs e as changes:

```bash
openspec validate --all --strict
```

A CI roda os mesmos passos em cada pull request.

## Documentos

| Documento | Conteúdo |
| --- | --- |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Camadas, módulos, contrato da API, segurança, decisões e pendências institucionais. |
| [docs/OPERACAO.md](docs/OPERACAO.md) | Ambiente local com Docker, integração contínua e caminhos de produção. |
| [docs/whatsapp/OPERACAO.md](docs/whatsapp/OPERACAO.md) | Como ligar e operar o gateway de WhatsApp, e seus riscos. |
| [backend/README.md](backend/README.md) | Backend no host, perfis e comandos de conta. |
| [frontend/README.md](frontend/README.md) | Interface: instalação, comandos e organização das pastas. |
| [infra/production/README.md](infra/production/README.md) | Produção com Docker Compose, HTTPS, backup e restauração. |
| [infra/coolify/README.md](infra/coolify/README.md) | Homologação no Coolify. |
| [PRODUCT.md](PRODUCT.md) e [DESIGN.md](DESIGN.md) | Público, princípios e direção visual. |
| [AGENTS.md](AGENTS.md) | Regras de permissão e domínio e fluxo de trabalho com OpenSpec. |
| [openspec/specs](openspec/specs/) | Comportamento esperado de cada capacidade do sistema. |

Use só dados sintéticos em desenvolvimento, testes e capturas de tela. O WhatsApp usa um gateway auto-hospedado e não oficial, desligado por padrão, e o uso real depende de aceite da instituição. Os testes técnicos não substituem a homologação pela Assistência Estudantil e pela TI.
