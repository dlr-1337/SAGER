import {
  ExitEligibility,
  ExitHistory,
  ShortExit,
  ShortExitInput,
  ShortExitStatus,
} from './operations-local.models';

export type SignatureStatus =
  'UNAVAILABLE' | 'PENDING' | 'VALID' | 'FAILED' | 'UNCERTAIN' | 'EXPIRED' | 'INVALIDATED';
export type InvitationMessageStatus =
  'UNAVAILABLE' | 'QUEUED' | 'ACCEPTED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'UNCERTAIN';
export interface LongExitInput extends ShortExitInput {
  guardianId: string;
}
export interface LongExitGuardian {
  id: string;
  name: string;
  relationship: string;
  phone: string | null;
  eligible: boolean;
  blockers: string[];
}
export interface LongExitEligibility extends ExitEligibility {
  guardians: LongExitGuardian[];
  providers: { clicksignEnabled: boolean; whatsappEnabled: boolean };
}
export interface ExitDocumentRevision {
  documentVersionId: string;
  revisionNumber: number;
  originalState: string;
  signedState: string;
}
export interface LongExitCapabilities {
  canEdit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canCancel: boolean;
  canDepart: boolean;
  canReturn: boolean;
  canResend: boolean;
  canReconcile: boolean;
  canDownloadOriginal: boolean;
  canDownloadSigned: boolean;
}
export interface LongExitHistory extends Omit<ExitHistory, 'status'> {
  status: ShortExitStatus;
  guardianId: string;
  documentVersionId: string | null;
}
export interface SignatureBinding {
  id: string;
  documentVersionId: string;
  guardianId: string;
  guardianName: string;
  status: SignatureStatus;
  messageStatus: InvitationMessageStatus;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
  signedAt: string | null;
  verifiedAt: string | null;
  failureCode: string | null;
  widgetAvailable: boolean;
}
export interface LongExit extends Omit<ShortExit, 'capabilities' | 'history'> {
  guardianId: string;
  guardianName: string;
  guardianRelationship: string;
  signatureStatus: SignatureStatus;
  messageStatus: InvitationMessageStatus;
  currentDocument: ExitDocumentRevision | null;
  bindings: SignatureBinding[];
  resendAvailableAt: string | null;
  remainingResends: number;
  signedAt: string | null;
  capabilities: LongExitCapabilities;
  history: LongExitHistory[];
}
