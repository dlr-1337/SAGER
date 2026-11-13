"""Gera o subconjunto da fonte Material Symbols Rounded só com os ícones usados pelo SAGER.

Uso, em frontend/ (rodado à mão, fora do build e da CI):
    pip install fonttools brotli
    python scripts/subset-icons.py

Lê a lista de src/fonts/material-symbols-rounded.json e a fonte de
node_modules/material-symbols/material-symbols-rounded.woff2. Fixa wght 500, GRAD 0 e opsz 24,
mantém o eixo FILL, retira as ligaduras de ícones fora da lista e grava
src/fonts/material-symbols-rounded-subset.woff2. O sha256 gravado no JSON cobre a fonte e a lista,
e e2e/icon-font.spec.ts o confere.
"""

import hashlib
import json
import string
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'node_modules' / 'material-symbols' / 'material-symbols-rounded.woff2'
LIST = ROOT / 'src' / 'fonts' / 'material-symbols-rounded.json'
OUTPUT = ROOT / 'src' / 'fonts' / 'material-symbols-rounded-subset.woff2'
LETTERS = string.ascii_lowercase + string.digits + '_'


def digest(font: bytes, icons: list[str]) -> str:
    return hashlib.sha256(font + '\n'.join(icons).encode()).hexdigest()


def main() -> None:
    data = json.loads(LIST.read_text(encoding='utf-8'))
    icons = sorted(set(data['icons']))
    font = TTFont(SOURCE)
    to_char = {glyph: chr(code) for code, glyph in font.getBestCmap().items()}

    # Mantém só as ligaduras que escrevem um ícone da lista; as demais sairiam no fechamento do GSUB.
    found = set()
    for lookup in font['GSUB'].table.LookupList.Lookup:
        for table in lookup.SubTable:
            table = getattr(table, 'ExtSubTable', table)
            if not hasattr(table, 'ligatures'):
                continue
            for first, ligatures in list(table.ligatures.items()):
                kept = []
                for ligature in ligatures:
                    name = ''.join(to_char.get(g, '\0') for g in [first, *ligature.Component])
                    if name in icons:
                        kept.append(ligature)
                        found.add(name)
                if kept:
                    table.ligatures[first] = kept
                else:
                    del table.ligatures[first]
    missing = sorted(set(icons) - found)
    if missing:
        raise SystemExit('Ícones que não existem na fonte de origem: ' + ', '.join(missing))

    options = subset.Options()
    options.layout_features = ['*']
    options.name_IDs = ['*']
    options.notdef_outline = True
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=[ord(c) for c in LETTERS])
    subsetter.subset(font)
    font = instancer.instantiateVariableFont(font, {'wght': 500, 'GRAD': 0, 'opsz': 24})
    font.flavor = 'woff2'
    # Mantém a data da fonte de origem: a mesma lista gera sempre o mesmo arquivo.
    font.recalcTimestamp = False
    font.save(OUTPUT)

    content = OUTPUT.read_bytes()
    data = {'icons': icons, 'sha256': digest(content, icons)}
    LIST.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
    print(f'{OUTPUT.name}: {len(content)} bytes, {len(icons)} ícones.')


if __name__ == '__main__':
    main()
