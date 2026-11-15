## Context

Motivação em proposal.md. O aviso fica num cartão de `local-home.page.ts`, mostrado só ao residente maior de idade (`maiorDeIdade` da conta). O teste `local-home.page.spec.ts` e o e2e `operations-local.spec.ts` conferem o texto exato.

## Goals / Non-Goals

**Goals:** mostrar o horário decidido na reunião.

**Non-Goals:** controlar o horário de saída e volta do maior de idade.

## Decisions

### D1. Só o texto muda

A frase passa a "Maiores de idade podem sair do IF até 23h e voltar a partir das 6h.", sem botão nem registro, como já define o requisito.
*Rejeitada:* registrar saída e volta do maior de idade. A instituição não pediu controle, e `AGENTS.md` mantém o maior de idade fora das saídas.

## O que a instituição e o operador ainda decidem

- A instituição confirma o horário (até 23h para sair, a partir das 6h para voltar) no regulamento das residências.
