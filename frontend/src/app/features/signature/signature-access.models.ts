import { SignatureStatus } from '../operations/long-exit.models';

export interface SignatureAccess {
  bindingId: string;
  documentVersionId: string;
  revisionNumber: number;
  residentName: string;
  enrollment: string;
  guardianName: string;
  guardianRelationship: string;
  requestedDepartureAt: string;
  expectedReturnAt: string;
  reason: string;
  notes: string | null;
  signatureStatus: SignatureStatus;
  expiresAt: string;
  now: string;
  widget: {
    available: boolean;
    signerId: string | null;
    environment: string | null;
    libraryVersion: string;
  };
}
export function clicksignEnvironmentOrigin(environment: string | null): string | null {
  if (environment === 'sandbox') return 'https://sandbox.clicksign.com';
  if (environment === 'production') return 'https://app.clicksign.com';
  return null;
}
