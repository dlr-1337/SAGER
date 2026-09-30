import { MonthlyIndicator } from '../cleaning/cleaning-local.models';
export type ReportCode =
  | 'PRESENCA'
  | 'SAIDAS'
  | 'LIMPEZA'
  | 'OCORRENCIAS'
  | 'NOTIFICACOES'
  | 'ADVERTENCIAS'
  | 'TERMOS'
  | 'CONSOLIDADO';
export type ReportFormat = 'PDF' | 'XLSX';
export type ReportColumnKey =
  | 'id'
  | 'date'
  | 'type'
  | 'status'
  | 'residentId'
  | 'residentName'
  | 'roomCode'
  | 'score'
  | 'category'
  | 'sourceType';
export interface ReportColumn {
  key: ReportColumnKey;
  label: string;
  type: 'UUID' | 'DATE' | 'STRING' | 'DECIMAL';
}
export interface ReportCatalogItem {
  code: ReportCode;
  title: string;
  statuses: string[];
  columns: ReportColumn[];
}
export interface ReportCatalog {
  version: number;
  items: ReportCatalogItem[];
  maxPeriodDays: number;
  maxRows: number;
  defaultPageSize: number;
  maxPageSize: number;
  expiresAfterHours: number;
}
export interface ReportFilters {
  from: string;
  to: string;
  accommodationId: string | null;
  roomId: string | null;
  residentId: string | null;
  status: string | null;
}
export interface ReportSummary {
  totalRows: number;
  countsByType: Record<string, number>;
  countsByStatus: Record<string, number>;
  cleaningMean: number | null;
  unjustifiedAbsences: number;
  confirmedLateReturns: number;
  activeWarnings: number;
}
export interface ReportMonthly extends MonthlyIndicator, ReportSummary {}
export interface ReportSnapshot {
  id: string;
  catalogCode: ReportCode;
  catalogVersion: number;
  filters: ReportFilters;
  columns: ReportColumn[];
  rowCount: number;
  summary: ReportSummary;
  monthly: ReportMonthly[];
  contentHash: string;
  asOf: string;
  expiresAt: string;
}
export interface ReportRow {
  id: string;
  date: string;
  type: string;
  status: string;
  residentId: string | null;
  residentName: string | null;
  roomId: string | null;
  roomCode: string | null;
  accommodationId: string | null;
  score: number | null;
  category: string | null;
  sourceType: string | null;
}
export interface ReportRows {
  snapshotId: string;
  offset: number;
  limit: number;
  nextOffset: number | null;
  total: number;
  items: ReportRow[];
}
export interface ReportExport {
  id: string;
  snapshotId: string;
  format: ReportFormat;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'EXPIRED';
  createdAt: string;
  expiresAt: string;
  attempts: number;
  errorCode: string | null;
  document: { id: string; sha256: string; size: number; state: string } | null;
}
export interface ReportInput {
  catalogCode: ReportCode;
  filters: {
    from: string;
    to: string;
    accommodationId?: string;
    roomId?: string;
    residentId?: string;
    status?: string;
  };
}
