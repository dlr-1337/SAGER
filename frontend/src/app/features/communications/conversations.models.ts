export type MessageKind = 'TEXT' | 'IMAGE' | 'AUDIO' | 'DOCUMENT';
export type MessageDirection = 'IN' | 'OUT';
export type MessageOrigin =
  'WEBHOOK' | 'RECONCILIATION' | 'SUPERVISOR' | 'DEVICE' | 'AUTHORIZATION';
export type MediaState = 'NONE' | 'PENDING' | 'STORED' | 'FAILED';
export type DeliveryStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'UNCERTAIN';
export type SessionUnavailableReason =
  'gateway_disabled' | 'session_not_ready' | 'gateway_unreachable';

export interface ConversationPage<T> {
  items: T[];
  nextCursor: string | null;
}
export interface GuardianLink {
  id: string;
  name: string;
  relationship: string;
  phone: string | null;
  residentId: string;
  residentName: string;
}
export interface MessagePreview {
  direction: MessageDirection;
  kind: MessageKind;
  body: string | null;
  deliveryStatus: string | null;
  sentAt: string;
}
export interface Conversation {
  id: string;
  chatId: string;
  phone: string | null;
  linked: boolean;
  guardians: GuardianLink[];
  lastMessage: MessagePreview | null;
  unreadCount: number;
  lastMessageAt: string | null;
}
export interface ConversationMessage {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  origin: MessageOrigin;
  kind: MessageKind;
  body: string | null;
  mediaState: MediaState;
  mediaFailureCode: string | null;
  mediaType: string | null;
  mediaFilename: string | null;
  mediaSize: number;
  deliveryStatus: DeliveryStatus | null;
  failureCode: string | null;
  sentAt: string;
  linkable: boolean;
}
export interface OpenExit {
  id: string;
  version: number;
  residentId: string;
  residentName: string;
  guardianId: string;
  guardianName: string;
  requestedDepartureAt: string;
  expectedReturnAt: string;
}
export interface SessionView {
  available: boolean;
  /** Comes live from the gateway, unfiltered: an unknown value must not break the screen. */
  status: string;
  linkedAt: string | null;
  lastEventAt: string | null;
  canSend: boolean;
  unavailableReason: SessionUnavailableReason | null;
}
