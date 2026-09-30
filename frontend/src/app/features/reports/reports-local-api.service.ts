import { Injectable } from '@angular/core';
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
  query,
  record,
  uuid,
} from '../cleaning/reporting-local.transport';
import {
  ReportCatalog,
  ReportColumn,
  ReportExport,
  ReportFilters,
  ReportInput,
  ReportMonthly,
  ReportRows,
  ReportSnapshot,
  ReportSummary,
} from './reports-local.models';
import { reportLabels } from './reports-local.utils';
const columnKeys = new Set([
  'id',
  'date',
  'type',
  'status',
  'residentId',
  'residentName',
  'roomCode',
  'score',
  'category',
  'sourceType',
]);
const columns = (value: unknown): value is ReportColumn[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    (item) =>
      record(item) &&
      columnKeys.has(String(item['key'])) &&
      typeof item['label'] === 'string' &&
      ['UUID', 'DATE', 'STRING', 'DECIMAL'].includes(String(item['type'])),
  ) &&
  new Set(value.map((item) => item.key)).size === value.length;
const code = (value: unknown) => typeof value === 'string' && Object.hasOwn(reportLabels, value);
const counts = (value: unknown) => record(value) && Object.values(value).every(integer);
const summary: Guard<ReportSummary> = (value): value is ReportSummary =>
  record(value) &&
  ['totalRows', 'unjustifiedAbsences', 'confirmedLateReturns', 'activeWarnings'].every((key) =>
    integer(value[key]),
  ) &&
  counts(value['countsByType']) &&
  counts(value['countsByStatus']) &&
  nullableNumber(value['cleaningMean']);
const monthly: Guard<ReportMonthly> = (value): value is ReportMonthly =>
  summary(value) &&
  record(value) &&
  typeof value['month'] === 'string' &&
  /^\d{4}-(0[1-9]|1[0-2])$/.test(value['month']);
const filters: Guard<ReportFilters> = (value): value is ReportFilters =>
  record(value) &&
  civilDate(value['from']) &&
  civilDate(value['to']) &&
  ['accommodationId', 'roomId', 'residentId'].every((key) => nullableUuid(value[key])) &&
  nullableString(value['status']);
const catalog: Guard<ReportCatalog> = (value): value is ReportCatalog =>
  record(value) &&
  integer(value['version']) &&
  ['maxPeriodDays', 'maxRows', 'defaultPageSize', 'maxPageSize', 'expiresAfterHours'].every(
    (key) => integer(value[key]) && Number(value[key]) > 0,
  ) &&
  Array.isArray(value['items']) &&
  value['items'].every(
    (item) =>
      record(item) &&
      code(item['code']) &&
      typeof item['title'] === 'string' &&
      Array.isArray(item['statuses']) &&
      item['statuses'].every((status) => typeof status === 'string') &&
      columns(item['columns']),
  );
const snapshot: Guard<ReportSnapshot> = (value): value is ReportSnapshot =>
  record(value) &&
  uuid(value['id']) &&
  code(value['catalogCode']) &&
  integer(value['catalogVersion']) &&
  filters(value['filters']) &&
  columns(value['columns']) &&
  integer(value['rowCount']) &&
  summary(value['summary']) &&
  value['summary'].totalRows === value['rowCount'] &&
  Array.isArray(value['monthly']) &&
  value['monthly'].every(monthly) &&
  typeof value['contentHash'] === 'string' &&
  /^[0-9a-f]{64}$/i.test(value['contentHash']) &&
  instant(value['asOf']) &&
  instant(value['expiresAt']);
const rows: Guard<ReportRows> = (value): value is ReportRows =>
  record(value) &&
  uuid(value['snapshotId']) &&
  ['offset', 'limit', 'total'].every((key) => integer(value[key])) &&
  nullableInteger(value['nextOffset']) &&
  Array.isArray(value['items']) &&
  value['items'].every(
    (row) =>
      record(row) &&
      Object.keys(row).every(
        (key) => columnKeys.has(key) || key === 'roomId' || key === 'accommodationId',
      ) &&
      uuid(row['id']) &&
      civilDate(row['date']) &&
      typeof row['type'] === 'string' &&
      typeof row['status'] === 'string' &&
      ['residentId', 'roomId', 'accommodationId'].every((key) => nullableUuid(row[key])) &&
      ['residentName', 'roomCode', 'category', 'sourceType'].every((key) =>
        nullableString(row[key]),
      ) &&
      nullableNumber(row['score']),
  );
const job: Guard<ReportExport> = (value): value is ReportExport =>
  record(value) &&
  uuid(value['id']) &&
  uuid(value['snapshotId']) &&
  ['PDF', 'XLSX'].includes(String(value['format'])) &&
  ['PENDING', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED'].includes(String(value['status'])) &&
  instant(value['createdAt']) &&
  instant(value['expiresAt']) &&
  integer(value['attempts']) &&
  nullableString(value['errorCode']) &&
  (value['document'] === null ||
    (record(value['document']) &&
      uuid(value['document']['id']) &&
      typeof value['document']['sha256'] === 'string' &&
      /^[0-9a-f]{64}$/i.test(value['document']['sha256']) &&
      integer(value['document']['size']) &&
      typeof value['document']['state'] === 'string')) &&
  (value['status'] !== 'READY' || value['document'] !== null);
@Injectable({ providedIn: 'root' })
export class ReportsLocalApiService {
  private readonly transport = new ReportingTransport();
  catalog(): Promise<ReportCatalog> {
    return this.transport.get('/relatorios/catalogo', catalog);
  }
  create(input: ReportInput & { idempotencyKey: string }): Promise<ReportSnapshot> {
    return this.transport.post('/relatorios/consultas', input, snapshot);
  }
  get(id: string): Promise<ReportSnapshot> {
    return this.transport.get('/relatorios/consultas/' + identifier(id), snapshot);
  }
  async rows(id: string, offset = 0): Promise<ReportRows> {
    const value = await this.transport.get(
      `/relatorios/consultas/${identifier(id)}/linhas` + query({ offset, limit: 20 }),
      rows,
    );
    if (
      value.snapshotId !== id ||
      value.offset !== offset ||
      value.limit !== 20 ||
      value.items.length > 20 ||
      (value.nextOffset !== null && (value.nextOffset <= offset || value.nextOffset > value.total))
    )
      throw new Error('O servidor não confirmou a página da consulta.');
    return value;
  }
  async requestExport(snapshotId: string, format: 'PDF' | 'XLSX'): Promise<ReportExport> {
    const value = await this.transport.post(
      `/relatorios/consultas/${identifier(snapshotId)}/exportacoes`,
      { format },
      job,
    );
    if (value.snapshotId !== snapshotId || value.format !== format)
      throw new Error('O servidor não confirmou a exportação desta consulta.');
    return value;
  }
  getExport(id: string): Promise<ReportExport> {
    return this.transport.get('/relatorios/exportacoes/' + identifier(id), job);
  }
  async download(id: string, format: 'PDF' | 'XLSX'): Promise<Blob> {
    const mime =
      format === 'PDF'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const response = await this.transport.response(
      `/relatorios/exportacoes/${identifier(id)}/arquivo`,
      undefined,
      mime,
    );
    if (response.headers.get('content-type')?.split(';')[0].trim() !== mime)
      throw new Error('O servidor não retornou o formato solicitado.');
    const blob = await response.blob();
    if (!blob.size) throw new Error('O arquivo retornado está vazio.');
    return blob;
  }
}
