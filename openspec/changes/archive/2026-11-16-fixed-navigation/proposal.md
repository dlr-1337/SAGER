## Why

O dono pediu que o cabeçalho e o menu fiquem sempre à vista. Hoje, em telas com muitos dados (por exemplo, o ranking), o menu lateral sobe junto com a página. "Sair" e "SAGER · Campus Urutaí" ficam no fim da página, e o cabeçalho some depois de rolar. Na tela de acesso de produção, celulares menores rolam o formulário:

- em 360 por 640 px, a página tem 814 px de altura;
- em 1280 por 720 px, sobram 53 px.

A regra de `AGENTS.md` pede telas simples e o desenho responsivo aprovado. O requisito "Nova tela começa no topo" (`tab-navigation`) continua.

## What Changes

- **Telas internas:**
  - o cabeçalho, com a marca, "Sair" e "Menu", fica parado no topo da janela;
  - no computador, o menu lateral fica parado logo abaixo do cabeçalho, com a altura da janela;
  - só a lista de itens do menu rola quando não cabe, e "Sair" fica sempre ao pé dele;
  - no celular, "Menu" fica sempre à vista, e a gaveta continua como está.
- **Rolagem:** a página continua rolando pela janela, e um item focado não fica escondido sob o cabeçalho.
- **Tela de acesso:**
  - usa a altura visível da janela (`100dvh`);
  - em telas estreitas ou baixas, fica mais compacta: menos espaço, sem a linha "Assistência Estudantil · Campus Urutaí", que repete a marca do cabeçalho;
  - cabe sem rolar a partir de 360 por 640 px no celular e de 1024 por 600 px no computador;
  - em telas menores, a página ainda rola.
- O e2e `tab-scroll.spec.ts` rola até as abas descontando o cabeçalho fixo.

**Fora do escopo:**
- trancar a rolagem da tela de acesso: o teclado do celular e o zoom precisam dela;
- telas próprias da demonstração (RF027);
- mudar a marca do IF Goiano ou o conteúdo das telas.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `simple-screens`: novos requisitos "Cabeçalho e menu sempre à vista" e "Acesso sem rolar".

## Impact

- **Frontend:**
  - `src/app/app.scss`: cabeçalho e menu fixos;
  - `features/portal/portal.pages.ts`: estilos da tela de acesso;
  - e2e `fixed-navigation.spec.ts` (novo) e `tab-scroll.spec.ts`.
- **Backend, API e banco:** sem mudança.
