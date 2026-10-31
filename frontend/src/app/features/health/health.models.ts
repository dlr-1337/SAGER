export type HealthProfession = 'MEDICINA' | 'ENFERMAGEM' | 'PSICOLOGIA';
export type HealthCategory = 'GENERAL' | 'PSYCHOLOGICAL' | 'SHARED_SUMMARY';

export interface HealthPage<T> {
  items: T[];
  nextCursor: string | number | null;
  totalCount: number;
}

export interface HealthAccount {
  id: string;
  name: string;
  email: string | null;
  matricula?: string | null;
  profile: string;
}

export interface ProfessionalGrant {
  id: string;
  sequence: number;
  accountId: string;
  accountName: string;
  profession: HealthProfession;
  registrationNumber: string;
  registrationRegion: string;
  verifiedBy: string;
  verifiedAt: string;
  verificationReason: string;
  startedAt: string;
  endedAt: string | null;
  version: number;
}

export interface HealthCapabilities {
  professionalGrant: ProfessionalGrant | null;
  canAdministerAccess: boolean;
  canAccessOwnRecord: boolean;
}

export interface CareAssignment {
  id: string;
  sequence: number;
  residentId: string;
  residentName: string;
  professionalGrantId: string;
  accountId: string;
  accountName: string;
  profession: HealthProfession;
  startedAt: string;
  endedAt: string | null;
  createdBy: string;
  reason: string;
  version: number;
}

export interface HealthAuthor {
  id: string;
  name: string;
}

export interface HealthCustody {
  id: string;
  sequence: number;
  residentId: string;
  sourceAuthorAccountId: string;
  sourceAuthorName: string;
  recipientGrantId: string;
  recipientAccountName: string;
  createdBy: string;
  createdAt: string;
  reason: string;
  endedAt: string | null;
  version: number;
}

export interface HealthResident {
  id: string;
  name: string;
  enrollment: string;
  birthDate: string | null;
  lastRecordedAt: string | null;
  reviewAfter: string | null;
}

export interface HealthProfessional {
  accountId: string;
  grantId: string;
  careAssignmentId: string;
  name: string;
  profession: HealthProfession;
}

export interface HealthNoteSummary {
  id: string;
  sequence: number;
  residentId: string;
  category: HealthCategory;
  authorAccountId: string;
  authorName: string;
  authorProfession: HealthProfession;
  authorRegistrationNumber: string;
  authorRegistrationRegion: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  relatedNoteId: string | null;
  canCorrect: boolean;
  canShare: boolean;
  custodyAccess: boolean;
}

export interface HealthShare {
  id: string;
  recipientGrantId: string;
  recipientCareAssignmentId: string;
  recipientName: string;
  profession: HealthProfession;
  createdAt: string;
  endedAt: string | null;
  version: number;
}

export interface HealthNote extends HealthNoteSummary {
  body: string;
  shares: HealthShare[];
}

export interface HealthRevision {
  id: string;
  noteId: string;
  version: number;
  body: string;
  reason: string | null;
  recordedAt: string;
  recordedBy: string;
}

export interface HealthExport {
  exportId: string;
  generatedAt: string;
  requestId: string;
  resident: HealthResident;
  notes: unknown[];
}

export const professionLabels: Record<HealthProfession, string> = {
  MEDICINA: 'Medicina',
  ENFERMAGEM: 'Enfermagem',
  PSICOLOGIA: 'Psicologia',
};

export const categoryLabels: Record<HealthCategory, string> = {
  GENERAL: 'Registro de saúde',
  PSYCHOLOGICAL: 'Registro psicológico',
  SHARED_SUMMARY: 'Resumo multiprofissional',
};

export function categoriesFor(profession: HealthProfession): HealthCategory[] {
  return profession === 'PSICOLOGIA'
    ? ['PSYCHOLOGICAL', 'SHARED_SUMMARY']
    : ['GENERAL', 'SHARED_SUMMARY'];
}

export const allCategories: HealthCategory[] = ['GENERAL', 'PSYCHOLOGICAL', 'SHARED_SUMMARY'];
