# Design

## Decisões

### 1. README como vitrine e documentos por público

O README responde em uma página o que é o sistema, o que ele faz, como é montado, como rodar e onde está o resto. O passo a passo por perfil vai para `docs/MANUAL.md`, e o método e os padrões vão para `docs/DESENVOLVIMENTO.md`. O README tem uma tabela com documento, público e conteúdo.

- **Alternativa rejeitada:** um README único com tudo. Passaria de 600 linhas e repetiria a arquitetura, a operação e o AGENTS.md.
- **Alternativa rejeitada:** um site de documentação (MkDocs ou Docusaurus). Mais uma ferramenta para manter, sem ganho para um repositório que já é lido no GitHub.

### 2. Licença de uso restrito em português

`LICENSE` com "todos os direitos reservados" (Lei 9.609/1998 e Lei 9.610/1998), a lista do que é proibido sem autorização escrita, ressalvados os usos que a lei já permite, e três usos permitidos: o IF Goiano, com licença irrevogável para instalar, usar, manter, corrigir e adaptar o sistema para a Assistência Estudantil, em infraestrutura própria ou contratada e com manutenção por quem atue em seu nome; a orientação e a banca, para avaliar; e o que os Termos de Serviço do GitHub exigem de um repositório público (ver e fazer fork na plataforma). Componentes de terceiros e a marca do IF Goiano ficam fora; a licença da fonte de ícones (Apache-2.0) passa a acompanhar o arquivo dela. Se a lei, norma do IF Goiano ou contrato dispuser de outra forma sobre a titularidade, essa disposição prevalece.

- **Alternativa rejeitada:** licença aberta (MIT, Apache-2.0, GPL). Todas permitem que qualquer pessoa use o código, o contrário do que o dono pediu.
- **Alternativa rejeitada:** nenhum arquivo de licença. Sem licença o uso já é proibido por lei, mas o leitor não sabe disso, e o IF Goiano não teria permissão escrita para usar e manter o sistema.
- **Alternativa rejeitada:** titularidade só do IF Goiano. Depende de norma ou contrato que o dono não apresentou; a licença diz que, se houver, ela prevalece.
- **Alternativa rejeitada:** licença revogável a qualquer momento. Tiraria do IF Goiano a segurança de continuar operando o sistema depois de implantá-lo com dados reais.

### 3. Branches: apagar o mesclado e arquivar o resto em tags

Branch mesclada na `main` é apagada no GitHub e no PC. Branch com commits fora da `main` vira a tag anotada `arquivo/<branch>`, enviada ao GitHub, e só então é apagada: o histórico continua recuperável com `git switch -c <branch> arquivo/<branch>`. As worktrees antigas têm as mudanças sem commit salvas em `backups/arquivo-branches-2026-11-14/` (fora do Git) antes de sair. As branches com pull request aberto ficam.

- **Alternativa rejeitada:** apagar tudo o que não está na `main`. Perderia os 41 commits sem equivalente na `main` que agora estão nas tags.
- **Alternativa rejeitada:** manter as branches. São 37 nomes no GitHub, a maioria de setembro e outubro, que escondem o que está ativo.

### 4. Fatos conferidos na fonte

Números e afirmações do README e dos documentos novos (requisitos, regras, casos de uso, SUS, versões, comandos, caminhos, rótulos de tela) foram conferidos na monografia, no `pom.xml`, no `package.json`, nas specs e no código. Onde o sistema vai além da monografia (login por usuário, faixa etária, conclusão do curso, conversas pelo WhatsApp, migrações depois da V21), o README diz isso. Números que envelhecem rápido, como a quantidade de testes, ficam de fora.

- **Alternativa rejeitada:** citar a quantidade de testes no README. Muda a cada change e ficaria errada sem ninguém perceber.

## Pendências

- **Instituição:** confirmar com o Núcleo de Inovação Tecnológica do IF Goiano se a política de inovação atribui a titularidade do SAGER ao Instituto, se algum autor tinha bolsa ou estágio ligado ao desenvolvimento e se o software deve ser registrado no INPI. Registrado em `docs/ARQUITETURA.md`, "Operação e regras de uso".
- **Dono:** o texto da licença não passou por revisão jurídica.
- **Dono:** decidir se o repositório continua público. A licença protege o código, mas só um repositório privado impede que outros o vejam; o Coolify precisaria de uma chave de deploy.
- **Dono e coautor:** decidir os pull requests 16 e 17, abertos em 06/10/2026.
