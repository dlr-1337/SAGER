# Data Architecture & Persistence Layer

O backend usa PostgreSQL com migrations Flyway e acesso JDBC explícito via
`JdbcTemplate`; não há entidades JPA/Hibernate detectadas. O schema contém aproximadamente
52 tabelas, distribuídas entre identidade, gestão, operações, saúde, disciplina,
comunicações, integrações, relatórios e controles técnicos.

## Database Configuration

| Service/Module | DB Type | Profile | Driver | Connection | Migration Tool |
|---|---|---|---|---|---|
| Backend inteiro | PostgreSQL | local, production e migration | PostgreSQL JDBC | JDBC configurado por ambiente | Flyway |
| Sessão HTTP | PostgreSQL | local e production | PostgreSQL JDBC | Spring Session JDBC | Flyway V2 |

O schema é administrado pelas migrations SQL; o ORM não gera nem altera tabelas.
As tabelas `SPRING_SESSION` e `SPRING_SESSION_ATTRIBUTES` são infraestrutura do
Spring Session e não devem ser misturadas com as tabelas de domínio.

## Data Ownership per Service

| Service | Tables Owned | ORM Framework | Caching | Notes |
|---|---|---|---|---|
| Auth | `sager_local_account`, `SPRING_SESSION`, `SPRING_SESSION_ATTRIBUTES`, `sager_login_rate_bucket` | JDBC | Nenhum | Autenticação, sessão e rate limit efêmero |
| Management | `sager_supervisor`, `sager_resident`, `sager_guardian`, `sager_accommodation`, `sager_accommodation_unit`, `sager_room`, `sager_room_allocation` | JDBC | Nenhum | Cadastro e histórico de alocação |
| Operations | `sager_night_call`, `sager_night_call_mark`, `sager_night_call_mark_history`, `sager_short_exit`, `sager_short_exit_history`, `sager_long_exit`, `sager_long_exit_history` | JDBC | Nenhum | Operações com histórico e regras temporais próprias |
| Health | `sager_health_grant`, `sager_health_care_assignment`, `sager_health_note`, `sager_health_revision`, `sager_health_share`, `sager_health_custody` | JDBC | Nenhum | Fronteira de acesso separada para PHI |
| Integrations | `sager_document_version`, `sager_signature_binding`, `sager_whatsapp_attempt`, `sager_long_exit_resend`, `sager_integration_task`, `sager_webhook_inbox` | JDBC | Nenhum | Outbox/inbox, leases e idempotência de provedores |
| Discipline | `sager_discipline_policy`, `sager_occurrence`, `sager_occurrence_revision`, `sager_discipline_notification`, `sager_notification_event`, `sager_warning`, `sager_commitment_term`, `sager_commitment_basis`, `sager_discipline_idempotency` | JDBC | Nenhum | Evidências derivadas e trilhas imutáveis |
| Communications | `sager_notice`, `sager_notice_draft_recipient`, `sager_communication`, `sager_communication_recipient` | JDBC | Nenhum | Publicação e recibos de leitura |
| Cleaning and Reports | `sager_cleaning_policy`, `sager_cleaning_assessment`, `sager_cleaning_participant`, `sager_cleaning_revision`, `sager_report_snapshot`, `sager_report_expired_snapshot`, `sager_report_export` | JDBC | Nenhum | Snapshots imutáveis e jobs de exportação |
| Audit | `sager_audit_event` | JDBC | Nenhum | Retenção permanente e mutação bloqueada |
| Legacy/future identity | `sager_identity`, `sager_identity_profile` | JDBC | Nenhum | Criadas na V1; sem uso produtivo encontrado no código atual |

## Entity Model

<!-- mermaid-checked: every attribute is `<type> <name> [<key>] ["<description>"]` with at most one of PK/FK/UK, no \n in descriptions, no {} in descriptions, every relationship label is double-quoted -->
~~~mermaid
erDiagram
    Accommodation ||--o{ AccommodationUnit : "contains"
    Accommodation ||--o{ Room : "has"
    AccommodationUnit ||--o{ Room : "groups"
    Resident ||--o{ Guardian : "has"
    Resident ||--o{ RoomAllocation : "receives"
    Room ||--o{ RoomAllocation : "hosts"
    Resident ||--o{ ShortExit : "requests"
    Resident ||--o{ LongExit : "requests"
    Guardian ||--o{ LongExit : "authorizes"
    LongExit ||--o{ DocumentVersion : "versions"
    LongExit ||--o{ SignatureBinding : "signs"
    Resident ||--o{ HealthNote : "has"
    HealthGrant ||--o{ CareAssignment : "covers"
    Resident ||--o{ CareAssignment : "receives"
    HealthNote ||--o{ HealthRevision : "revisions"
    HealthNote ||--o{ HealthShare : "shares"
    Resident ||--o{ NightCallMark : "is marked"
    NightCall ||--o{ NightCallMark : "records"
    Resident ||--o{ Occurrence : "generates"
    Occurrence ||--o{ Warning : "supports"
    Warning ||--o{ CommitmentBasis : "supports"
    CommitmentTerm ||--o{ CommitmentBasis : "contains"
    Notice ||--o{ Communication : "publishes"
    Communication ||--o{ CommunicationRecipient : "targets"
    Resident ||--o{ CommunicationRecipient : "receives"
    Room ||--o{ CleaningAssessment : "is assessed"
    CleaningAssessment ||--o{ CleaningParticipant : "freezes"
    Resident ||--o{ CleaningParticipant : "participates"
    ReportSnapshot ||--o{ ReportExport : "exports"
    LocalAccount ||--o{ HealthGrant : "holds"
    Resident o|--o| LocalAccount : "may link"
    Supervisor o|--o| LocalAccount : "may link"
    Accommodation {
        string id PK
        string code UK
        string name
        int version
    }
    AccommodationUnit {
        string id PK
        string accommodationId FK
        string code
        string name
    }
    Room {
        string id PK
        string accommodationId FK
        string unitId FK
        string number
        int capacity
        string situation
    }
    Resident {
        string id PK
        string enrollment UK
        string name
        date birthDate
        string course
    }
    Guardian {
        string id PK
        string residentId FK
        string name
        string relationship
        string phone
    }
    RoomAllocation {
        string id PK
        string residentId FK
        string roomId FK
        datetime startedAt
        datetime endedAt
    }
    LocalAccount {
        string id PK
        string email UK
        string profile
        boolean active
    }
    Supervisor {
        string id PK
        string institutionalId UK
        string name
        string email
    }
    ShortExit {
        string id PK
        string residentId FK
        string status
        datetime requestedDepartureAt
        datetime expectedReturnAt
    }
    LongExit {
        string id PK
        string residentId FK
        string guardianId FK
        string status
        string currentDocumentVersionId FK
    }
    DocumentVersion {
        string id PK
        string exitId FK
        int revisionNumber
        string originalFileId UK
        string signedFileId UK
    }
    SignatureBinding {
        string id PK
        string exitId FK
        string documentVersionId FK
        string guardianId FK
        string status
    }
    HealthGrant {
        string id PK
        string accountId FK
        string profession
        datetime startedAt
        datetime endedAt
    }
    CareAssignment {
        string id PK
        string residentId FK
        string professionalGrantId FK
        string accountId FK
    }
    HealthNote {
        string id PK
        string residentId FK
        string authorAccountId FK
        string authorGrantId FK
        string category
    }
    HealthRevision {
        string id PK
        string noteId FK
        int version
        string body
    }
    HealthShare {
        string id PK
        string noteId FK
        string recipientGrantId FK
        string recipientAssignmentId FK
    }
    NightCall {
        string id PK
        string accommodationId FK
        date referenceDate
        string status
        datetime openedAt
    }
    NightCallMark {
        string id PK
        string callId FK
        string residentId FK
        string mark
        string authorizedExitId
    }
    Occurrence {
        string id PK
        string residentId FK
        string sourceType
        string sourceId
        boolean valid
    }
    Warning {
        string id PK
        string residentId FK
        string occurrenceId FK
        string notificationId FK
        string status
    }
    CommitmentTerm {
        string id PK
        string residentId FK
        string basisHash UK
        string status
    }
    CommitmentBasis {
        string termId PK "also FK to CommitmentTerm"
        string warningId PK "also FK to Warning"
    }
    Notice {
        string id PK
        string title
        string status
    }
    Communication {
        string id PK
        string kind
        string sourceId
        string status
    }
    CommunicationRecipient {
        string communicationId PK "also FK to Communication"
        string residentId PK "also FK to Resident"
        datetime readAt
    }
    CleaningAssessment {
        string id PK
        string roomId FK
        date assessmentDate
        decimal score
        int policyVersion FK
    }
    CleaningParticipant {
        string assessmentId PK "also FK to CleaningAssessment"
        string residentId PK "also FK to Resident"
    }
    ReportSnapshot {
        string id PK
        string ownerId
        string catalogCode
        datetime expiresAt
    }
    ReportExport {
        string id PK
        string snapshotId FK
        string format
        string status
    }
    AuditEvent {
        string id PK
        string resource
        string resourceId
        string action
        datetime occurredAt
    }
~~~

### Local account cardinality and exclusivity

`sager_local_account.resident_id` and `sager_local_account.supervisor_id` are
nullable foreign keys with separate `UNIQUE` constraints, as defined in
`V12__local_account_links.sql`. Therefore, each resident can have zero or one
linked local account, and each supervisor can have zero or one linked local
account. A local account may be unlinked, or linked to exactly one resident or
one supervisor.

The `sager_local_account_single_link` check constraint rejects an account that
has both `resident_id` and `supervisor_id` populated. The additional profile
checks require resident links to use the `residente` profile and supervisor
links to use either `gestor` or `supervisor`. These constraints are part of the
identity boundary and must be preserved in any schema cleanup.

O acesso é transacional e baseado em JDBC. Não foram encontrados caches de aplicação,
second-level cache ou repositories JPA; os serviços consultam diretamente suas tabelas
e usam `FOR UPDATE`, índices parciais e constraints para concorrência.

## Key Repository Methods

| Service | Repository | Notable Methods | Purpose |
|---|---|---|---|
| Management | `ResidentRepository`, `GuardianRepository`, `AllocationRepository` | Busca por ID, enrollment, residente ativo e histórico de alocação | CRUD e agregações de gestão |
| Operations | `ShortExitRepository`, `LongExitRepository`, `NightCallRepository` | Busca por residente/status, locks, expiração e marcações | Decisão operacional e jobs |
| Integrations | `IntegrationRepository`, `IntegrationTransactions` | Claim de tarefas, inbox pendente, tentativas e reenvio | Outbox/inbox e idempotência |
| Audit | `AuditRepository` | Paginação por resource, actor, request e sequence | Consulta do log permanente |
| Health | `HealthRepository` | Busca de grants, assignments, notas e compartilhamentos | Enforce de isolamento de saúde |
| Reports | `ReportService`, `ReportExportJobs` | Snapshot, export claim e expiração | Relatórios reproduzíveis |
| Discipline | `DisciplineService`, `DisciplineEvidenceService` | Ocorrências por fonte, notificações, warnings e termos | Evidência derivada e recorrência |

## Caching Strategy

Não há camada de cache declarada. O sistema usa tabelas de snapshot, filas persistentes,
índices e locks transacionais em vez de cache. Essa decisão é adequada para auditoria e
dados sensíveis; qualquer cache futuro deverá ter TTL, invalidação e controle de autorização
explícitos, especialmente para saúde.

## Data Ownership Boundaries

Há um banco compartilhado com separação lógica por módulos. A separação é feita por
foreign keys, serviços e regras de autorização, não por schemas PostgreSQL separados.
Os módulos consultam diretamente tabelas de outros módulos quando precisam de evidências
ou agregações, por exemplo residente, sala, alocação e ocorrências. Não há microserviços
nem chamadas REST internas para acesso a dados.

As tabelas de histórico, inbox, outbox e idempotência não são duplicação acidental:
elas representam estados, snapshots ou garantias operacionais diferentes. A tabela de
auditoria é global, imutável e deliberadamente não referencia linhas de domínio para
preservar retenção permanente.

### Data Classification & Sensitivity

| Entity | Sensitive Fields | Classification (PII/PHI/PCI/None) | Controls in Place |
|---|---|---|---|
| Resident | name, enrollment, birthDate, course | PII | Autorização por perfil e auditoria; sem criptografia de campo/masking detectados |
| Guardian | name, phone, relationship | PII | Acesso por gestão/operação; sem criptografia de campo/masking detectados |
| LocalAccount | email, passwordHash | PII | Hash de senha, sessão JDBC e rate limit; sem masking detectado |
| HealthNote and HealthRevision | body, category, author and resident links | PHI | Grant, assignment, share/custody, imutabilidade e rota própria; sem criptografia de campo detectada |
| LongExit and DocumentVersion | guardian data, reasons, original and signed files | PII | Snapshot imutável, hash, controle de acesso e retenção; sem criptografia de campo detectada |
| AuditEvent | actorId, resourceId, changedFields | PII/operational | Retenção permanente e bloqueio de update/delete |
| Payment data | None found | None | Não detectado |

## Findings and Consolidation Recommendation

### Keep separate

- `sager_short_exit` e `sager_long_exit`: têm a mesma família de campos, mas limites,
  aprovação, assinatura de responsável e invariantes diferentes. Fundi-las agora
  aumentaria colunas nulas, `CHECK`s condicionais e risco de autorização.
- Tabelas `*_history`, `*_revision`, `sager_audit_event` e `sager_notification_event`:
  são trilhas imutáveis com granularidades e consumidores diferentes. Um event store
  genérico perderia constraints e tornaria consultas/auditoria mais frágeis.
- Saúde (`grant`, `assignment`, `note`, `revision`, `share`, `custody`): a fragmentação
  é intencional para separar PHI, concessão profissional e compartilhamento.
- `SPRING_SESSION*`, inbox/outbox, rate limit e idempotência: são infraestrutura técnica,
  não entidades de negócio.

### Candidates for a later cleanup

1. `sager_identity` e `sager_identity_profile` parecem legado ou preparação para um
   provedor externo: o código produtivo atual usa `sager_local_account`. Confirmar a
   necessidade institucional; se não houver roadmap, descontinuar em migration própria
   após remover o teste de existência e qualquer integração, nunca apagando V1.
2. `sager_report_expired_snapshot` é um índice de tombstone para diferenciar “não existe”
   de “expirou”. Pode ser substituído por uma estratégia de retenção/estado em
   `sager_report_snapshot`, mas só depois de validar concorrência, mensagens de API e job
   de limpeza.
3. Os campos denormalizados `resident_name`, `enrollment`, `guardian_name`, `room_code`
   e similares em operações preservam snapshots históricos. Não removê-los sem criar uma
   tabela explícita de snapshot; caso contrário, relatórios antigos mudariam quando o
   cadastro atual fosse editado.
4. As migrations podem receber uma futura consolidação documental, mas não devem ser
   reescritas nem apagadas em ambientes que já executaram Flyway. Alterações devem ser
   novas migrations versionadas e acompanhadas de testes de migração.

**Conclusão:** eu manteria as tabelas separadas neste momento. O schema está grande
porque modela históricos, segurança, integrações e regras de retenção; a maior economia
segura não é fundir tabelas, e sim confirmar se a identidade externa da V1 ainda é
necessária e revisar o tombstone de snapshots. Uma consolidação ampla de saídas ou
históricos reduziria a quantidade de tabelas, mas pioraria isolamento, integridade e
manutenção.
