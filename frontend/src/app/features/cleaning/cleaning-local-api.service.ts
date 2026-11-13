import { Injectable } from '@angular/core';
import {
  CleaningAssessment,
  CleaningCorrection,
  CleaningFeedback,
  CleaningFilters,
  CleaningInput,
  CleaningPage,
  CleaningPolicy,
  CleaningRanking,
  MonthlyIndicator,
  OwnCleaningAssessment,
  RankingPeriod,
} from './cleaning-local.models';
import { validCriteria } from './cleaning-local.utils';
import {
  Guard,
  ReportingTransport,
  civilDate,
  identifier,
  instant,
  integer,
  nullableInteger,
  nullableNumber,
  nullableString,
  nullableUuid,
  numeric,
  query,
  record,
  uuid,
} from './reporting-local.transport';
const period = (value: unknown) => ['WEEK', 'MONTH', 'SEMESTER'].includes(String(value));
const score = (value: unknown) => numeric(value) && value >= 0 && value <= 10;
const weights = (value: unknown) =>
  record(value) &&
  Object.keys(value).length === 4 &&
  ['PISO', 'SUPERFICIES', 'RESIDUOS', 'ORGANIZACAO'].every((key) => value[key] === 0.25);
const feedback: Guard<CleaningFeedback> = (value): value is CleaningFeedback =>
  record(value) &&
  nullableNumber(value['previousScore']) &&
  score(value['newScore']) &&
  nullableNumber(value['delta']) &&
  (value['periodMean'] === null || score(value['periodMean'])) &&
  nullableInteger(value['position']) &&
  period(value['rankingReference']) &&
  civilDate(value['from']) &&
  civilDate(value['to']);
const ownBase: Guard<OwnCleaningAssessment> = (value): value is OwnCleaningAssessment =>
  record(value) &&
  uuid(value['id']) &&
  uuid(value['roomId']) &&
  typeof value['roomCode'] === 'string' &&
  instant(value['evaluatedAt']) &&
  civilDate(value['assessmentDate']) &&
  validCriteria(value['criteria']) &&
  score(value['score']) &&
  nullableString(value['observation']) &&
  integer(value['version']) &&
  feedback(value['feedback']);
const own: Guard<OwnCleaningAssessment> = (value): value is OwnCleaningAssessment =>
  ownBase(value) &&
  record(value) &&
  ['participants', 'residentName', 'revisions', 'recordedBy'].every((key) => !(key in value));
const assessment: Guard<CleaningAssessment> = (value): value is CleaningAssessment =>
  ownBase(value) &&
  record(value) &&
  uuid(value['accommodationId']) &&
  ['NOW', 'RETROACTIVE'].includes(String(value['timeMode'])) &&
  integer(value['policyVersion']) &&
  instant(value['recordedAt']) &&
  uuid(value['recordedBy']) &&
  Array.isArray(value['participants']) &&
  value['participants'].every(
    (item) =>
      record(item) &&
      uuid(item['allocationId']) &&
      uuid(item['residentId']) &&
      typeof item['residentName'] === 'string',
  ) &&
  Array.isArray(value['revisions']) &&
  value['revisions'].every(
    (item) =>
      record(item) &&
      integer(item['version']) &&
      validCriteria(item['criteria']) &&
      score(item['score']) &&
      nullableString(item['observation']) &&
      nullableString(item['reason']) &&
      instant(item['recordedAt']) &&
      uuid(item['recordedBy']),
  );
const policy: Guard<CleaningPolicy> = (value): value is CleaningPolicy =>
  record(value) &&
  integer(value['version']) &&
  weights(value['weights']) &&
  score(value['lowScoreThreshold']) &&
  value['zone'] === 'America/Sao_Paulo' &&
  instant(value['now']) &&
  civilDate(value['currentDate']);
const ranking: Guard<CleaningRanking> = (value): value is CleaningRanking =>
  record(value) &&
  period(value['period']) &&
  ['referenceDate', 'from', 'to'].every((key) => civilDate(value[key])) &&
  Array.isArray(value['items']) &&
  value['items'].every(
    (item) =>
      record(item) &&
      nullableUuid(item['roomId']) &&
      typeof item['roomCode'] === 'string' &&
      (item['mean'] === null || score(item['mean'])) &&
      nullableInteger(item['position']) &&
      nullableInteger(item['assessmentCount']) &&
      typeof item['own'] === 'boolean',
  );
const indicators: Guard<MonthlyIndicator[]> = (value): value is MonthlyIndicator[] =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      record(item) &&
      typeof item['month'] === 'string' &&
      /^\d{4}-(0[1-9]|1[0-2])$/.test(item['month']) &&
      ['unjustifiedAbsences', 'confirmedLateReturns', 'activeWarnings'].every((key) =>
        integer(item[key]),
      ),
  );
function page<T>(guard: Guard<T>): Guard<CleaningPage<T>> {
  return (value): value is CleaningPage<T> =>
    record(value) &&
    Array.isArray(value['items']) &&
    value['items'].every(guard) &&
    nullableInteger(value['nextCursor']);
}
@Injectable({ providedIn: 'root' })
export class CleaningLocalApiService {
  private readonly transport = new ReportingTransport();
  policy(): Promise<CleaningPolicy> {
    return this.transport.get('/limpeza/politica', policy);
  }
  list(
    filters: CleaningFilters = {},
    beforeSequence?: number,
  ): Promise<CleaningPage<CleaningAssessment>> {
    return this.transport.get(
      '/limpeza/avaliacoes' + query({ ...filters, limit: 25, beforeSequence }),
      page(assessment),
    );
  }
  get(id: string): Promise<CleaningAssessment> {
    return this.transport.get('/limpeza/avaliacoes/' + identifier(id), assessment);
  }
  ownList(
    from = '',
    to = '',
    beforeSequence?: number,
  ): Promise<CleaningPage<OwnCleaningAssessment>> {
    return this.transport.get(
      '/me/limpeza/avaliacoes' + query({ from, to, limit: 25, beforeSequence }),
      page(own),
    );
  }
  own(id: string): Promise<OwnCleaningAssessment> {
    return this.transport.get('/me/limpeza/avaliacoes/' + identifier(id), own);
  }
  create(input: CleaningInput & { idempotencyKey: string }): Promise<CleaningAssessment> {
    return this.transport.post('/limpeza/avaliacoes', input, assessment);
  }
  correct(id: string, input: CleaningCorrection): Promise<CleaningAssessment> {
    return this.transport.post(`/limpeza/avaliacoes/${identifier(id)}/corrigir`, input, assessment);
  }
  async ranking(
    period: RankingPeriod,
    referenceDate = '',
    resident = false,
  ): Promise<CleaningRanking> {
    const value = await this.transport.get(
      '/limpeza/ranking' + query({ period, referenceDate }),
      ranking,
    );
    if (
      resident &&
      value.items.some(
        (item) =>
          !item.own &&
          (item.roomId !== null || item.mean !== null || item.assessmentCount !== null),
      )
    )
      throw new Error('O servidor não confirmou a projeção privada do ranking.');
    return value;
  }
  indicators(from: string, to: string, residentId = ''): Promise<MonthlyIndicator[]> {
    if (residentId) identifier(residentId);
    return this.transport.get('/limpeza/indicadores' + query({ from, to, residentId }), indicators);
  }
}
