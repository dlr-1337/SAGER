# Cadastro: o que as fontes do IF Goiano sustentam

Base das regras de `registration-validation`, levantada em 31/10/2026. Registra só o padrão, nunca nome ou valor de pessoa real. Evidência técnica não substitui a decisão institucional: a AE/TI ainda precisa confirmar o que está na última seção.

## Regras adotadas

| Campo | Regra | Motivo |
|---|---|---|
| Matrícula de residente | 15 a 17 posições, começando pelo ano, com letras maiúsculas depois do ano; ano nunca futuro | Cobre os formatos públicos. Não decodifica campus nem curso |
| Identificação de supervisor | 4 a 20 letras, números ou hífen, preservando zeros à esquerda | SIAPE tem zeros à esquerda; terceirizado pode não ter SIAPE |
| E-mail de residente | Opcional; se preenchido, termina em `@estudante.ifgoiano.edu.br` | A conta depende de ativação e, para menor, de autorização |
| E-mail de supervisor | Obrigatório, de qualquer domínio válido, com dica para `@ifgoiano.edu.br` | Terceirizado só tem e-mail institucional se a função exigir |
| Nome | Duas palavras significativas, só com letras, apóstrofo e hífen | Lei 6.015, art. 55 |
| Curso | Obrigatório na criação e na edição | Decisão do dono do produto |
| Nascimento | Data válida, de 10 a 100 anos no dia civil de São Paulo | Barra data sem sentido; faixa a confirmar |
| Telefone de responsável | Obrigatório, com DDD; celular de 11 dígitos tem 9 depois do DDD | Decisão do dono do produto |
| Vínculo de responsável | Precisa ter letras | Barra valor sem sentido, como "12" |
| Capacidade de quarto | Opcional; se preenchida, de 1 a 20 | Barra erro de digitação; limite a confirmar |

As regras valem só para valor novo ou alterado. O login, a recuperação de senha e o comando de contas do operador não recebem regra de formato.

## Matrícula

- **Login:** o SUAP usa o número de matrícula, e a senha continuou a do Q-Acadêmico na migração, com acesso completo desde janeiro de 2024 ([IF Goiano](https://ifgoiano.edu.br/home/index.php/component/content/article/176-destaque-rio-verde/24421-renovacao-de-matricula-passa-a-ser-feita-pelo-suap-academico.html)).
- **Sem regra oficial:** nenhum documento público explica dígitos ou composição.

| Formato | Quantidade | Onde |
|---|---|---|
| 15 posições, `99999AAAA999999` | 315 valores nas 12 listas, ingressos de 2015 a 2017 | Técnico integrado de Trindade ([página](https://ifgoiano.edu.br/home/index.php/documentos-trin/4759-listagem-de-2017-numero-de-matricula-curso-tecnico-integrado), [exemplo](https://suap.ifgoiano.edu.br/media/documentos/arquivos/AUT_-_1%C2%BA_ANO.PDF)) |
| 16 dígitos | 17 valores, ingressos de 2016 a 2024 | Atas de TC em Urutaí, Rio Verde, Ceres, Morrinhos, Campos Belos, Posse e Trindade ([Ceres](https://repositorio.ifgoiano.edu.br/riserver/api/core/bitstreams/83456fb7-4eea-46a0-b2b2-ae4d80816e0d/content), [Posse](https://repositorio.ifgoiano.edu.br/riserver/api/core/bitstreams/2883d5b2-537f-4ceb-884a-308c02f24f56/content), [Trindade](https://repositorio.ifgoiano.edu.br/riserver/api/core/bitstreams/c727e3b7-0768-4e80-bc01-f659f2888cf6/content)) |
| 17 dígitos | 1 documento | Rio Verde, ingresso de 2015 ([ata](https://repositorio.ifgoiano.edu.br/riserver/api/core/bitstreams/77a4e607-44e2-4e6f-838a-b96e587f1bc0/content)); origem desconhecida |

O [regulamento de TC de Rio Verde](https://www.ifgoiano.edu.br/home/images/RV/2024/JANEIRO/Regulamento_TC_IF_Goiano_Rio_Verde_2023.pdf) traz máscaras de 16, 13 e 7 posições. São genéricas e não comprovam formato.

**Por isso a mensagem de erro é "Confira a matrícula no SUAP."** e não cita quantidade: a maioria da amostra de residentes tem 15 posições, e os 16 dígitos vêm de outro público.

**Inferência, sem documento oficial:** nos 16 dígitos, `AAAA P CC N CCC D SSSS` parece ser ano, período, campus, nível, curso, um dígito desconhecido e sequência. O SAGER não usa essa leitura.

## E-mail

- **Domínios:** a [Norma 04, rev. 06, de 23/03/2020](https://suap.ifgoiano.edu.br/media/documentos/arquivos/Norma_04-IN04-CGSIC-IFGoiano_-_E-mail_institucional.pdf), item 5.1, cita `ifgoiano.edu.br` e `estudante.ifgoiano.edu.br` juntos. A divisão por público é inferência a partir da [notícia de Ceres](https://www.ifgoiano.edu.br/home/index.php/servidores/169-destaque-ceres/14454-e-mail-institucional-e-liberado-para-estudantes-do-if-goiano.html).
- **Padrão:** `nome.sobrenome` (item 6.3). Nome composto (6.4) e numeral (6.4.1) mostram que não se deve exigir exatamente um ponto.
- **Acesso:** é preciso cadastrar no SUAP e esperar cerca de 2 horas ([guia](https://ifgoiano.edu.br/pdf/infografico_email.pdf)). Menor precisa de autorização dos responsáveis (5.1-d); terceirizado só tem conta se a função exigir (5.1-e).
- **Uso:** os itens 2.2 e 2.3 da Norma tornam obrigatório usar e acompanhar o e-mail em assuntos institucionais, e a sanção do item 2.3.1 fala só de servidor. O Regulamento Disciplinar (Resolução CONSUP 420, de 03/03/2026, art. 10, IV) traz o dever de manter o acesso ativo. A frase "não é obrigatório" da notícia de 2020 não serve como regra atual.

Manter o campo opcional no SAGER continua defensável, porque a conta depende de ativação e de autorização. Decisão a confirmar com a AE/TI.

## SIAPE

- 7 dígitos, com zeros à esquerda ([UFSCar](https://www.ufscar.br/documentos/siape_cpf.pdf), fonte universitária, não gov.br).
- O SAGER só limita tamanho e caracteres: um supervisor terceirizado pode não ter SIAPE.

## Nome

- **Lei 6.015, art. 55:** o nome compreende prenome e sobrenome ([Planalto](https://www.planalto.gov.br/ccivil_03/leis/l6015compilada.htm)).
- **W3C:** recomenda aceitar hífen, apóstrofo e espaço, não exigir sobrenome e não tratar uma letra como inicial ([W3C](https://www.w3.org/International/questions/qa-personal-names)). A regra adotada diverge nestes dois últimos pontos **por decisão do dono do produto**: recusa nome de uma palavra, "Maria S" e "J. Silva".
- **Quem fica de fora:** estrangeiro de nome único, sobrenome igual a partícula ("Minh Do") e "João Silva Jr." com ponto ("João Silva Jr" passa). Um nome falso bem escrito também passa: formato não comprova identidade.
- **Responsável:** o nome salvo não é reescrito, porque a assinatura o compara exatamente.

## O que segue sem confirmação

Peça à AE/TI:

1. **Matrícula atual de técnico integrado:** só há evidência pública até 2017, justamente o público das residências. Só há um valor de 2024 e nenhum de 2025 ou 2026, então não se sabe se o SUAP mudou o formato. Com um exemplo real, a faixa pode ser apertada.
2. **Vigência da Norma 04, rev. 06:** é a versão listada na [página de Segurança da Informação](https://ifgoiano.edu.br/home/index.php/seguranca-da-informacao.html), mas pode haver revisão mais nova.
3. **Regulamento Disciplinar de 2026:** consultado só em PDF, sem URL pública nem a resolução em outra fonte.
4. **SIAPE como usuário no IF Goiano:** visto só em trecho de buscador; o manual não abriu. Dígito verificador e 8 dígitos de pensionista seguem sem fonte oficial.
5. **Faixa de idade de 10 a 100 anos:** escolha técnica para barrar datas sem sentido. A AE pode definir outra.
6. **Limite de 20 vagas por quarto:** idem.
7. **Nome social:** o [Decreto 8.727/2016, art. 3º](https://www2.camara.leg.br/legin/fed/decret/2016/decreto-8727-28-abril-2016-782951-publicacaooriginal-150197-pe.html), exige o campo em destaque na administração federal autárquica, e o SAGER não o tem. Decisão institucional.

Formato também não comprova vínculo com o IF Goiano: isso exige a integração com o SUAP, que segue adiada.

**Não verificado:** vigência atual do Decreto 8.727, Iporá, Hidrolândia, Cristalina, Catalão, Ipameri, tela autenticada do SUAP e qualquer registro real de Urutaí.
