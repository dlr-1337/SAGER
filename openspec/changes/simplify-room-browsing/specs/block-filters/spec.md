# Spec Delta

## REMOVED Requirements

### Requirement: Cascata de seleção

**Reason**: Duplicava a regra de `room-filters` "Quarto dependente do alojamento e do bloco": as duas pediam que as opções seguissem a seleção superior e que a troca limpasse o quarto. A única parte própria, limpar a casa ou bloco ao trocar o alojamento, passou para aquele requisito, com o mesmo cenário.

**Migration**: Consultar `room-filters` "Quarto dependente do alojamento e do bloco"; o comportamento das telas não muda.
