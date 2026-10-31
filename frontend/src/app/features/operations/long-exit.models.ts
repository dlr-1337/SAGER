import {
  ExitEligibility,
  ExitHistory,
  ShortExit,
  ShortExitInput,
  ShortExitStatus,
} from './operations-local.models';

export type SignatureStatus =
  'UNAVAILABLE' | 'PENDING' | 'VALID' | 'FAILED' | 'UNCERTAIN' | 'EXPIRED' | 'INVALIDATED';
export type DocumentMessageStatus =
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
  providers: { whatsappEnabled: boolean };
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
  canAttachAuthorization: boolean;
  canDownloadOriginal: boolean;
  canDownloadSigned: boolean;
}
export interface LongExitHistory extends Omit<ExitHistory, 'status'> {
  status: ShortExitStatus;
  guardianId: string;
  documentVersionId: string | null;
}
export interface AuthorizationBinding {
  id: string;
  documentVersionId: string;
  guardianId: string;
  guardianName: string;
  status: SignatureStatus;
  messageStatus: DocumentMessageStatus;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
  signedAt: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  verifiedByName: string | null;
  failureCode: string | null;
}
export interface AuthorizationFile {
  id: string;
  documentVersionId: string;
  bindingId: string;
  origin: 'WHATSAPP' | 'MANUAL';
  state: 'CANDIDATE' | 'ACCEPTED' | 'REFUSED';
  mediaType: string;
  size: number;
  sha256: string;
  senderPhone: string | null;
  senderDivergent: boolean;
  receivedAt: string;
  decidedBy: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
}
export interface ReceivedFile {
  messageId: string;
  senderPhone: string | null;
  fromGuardian: boolean;
  mediaState: 'STORED' | 'FAILED';
  failureCode: string | null;
  mediaType: string | null;
  size: number;
  receivedAt: string;
}
export interface LongExit extends Omit<ShortExit, 'capabilities' | 'history'> {
  guardianId: string;
  guardianName: string;
  guardianRelationship: string;
  signatureStatus: SignatureStatus;
  messageStatus: DocumentMessageStatus;
  currentDocument: ExitDocumentRevision | null;
  bindings: AuthorizationBinding[];
  authorizationFiles: AuthorizationFile[];
  whatsappAvailable: boolean;
  deliveryUnconfirmed: boolean;
  resendAvailableAt: string | null;
  remainingResends: number;
  signedAt: string | null;
  capabilities: LongExitCapabilities;
  history: LongExitHistory[];
}
