export type CommunicationFolder =
  | "inbox"
  | "sent"
  | "drafts"
  | "tickets"
  | "archived"
  | "notifications";

export type EmailThreadRow = {
  id: string;
  subject: string;
  customer_email: string;
  customer_name: string | null;
  status: string;
  is_starred: boolean;
  last_message_at: string;
  created_at: string;
  unread_count?: number;
  last_preview?: string | null;
};

export type EmailRow = {
  id: string;
  thread_id: string;
  direction: "inbound" | "outbound";
  sender_email: string;
  recipient_email: string;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  status: string;
  attachments: EmailAttachment[] | null;
  is_read: boolean;
  created_at: string;
  sent_at: string | null;
  scheduled_at: string | null;
};

export type EmailAttachment = {
  name: string;
  url?: string;
  content_type?: string;
  size?: number;
};

export type AdminNotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  entity_id: string | null;
  action_link: string | null;
  is_read: boolean;
  created_at: string;
};

export type SupportTicketRow = {
  id: string;
  investor_email: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
};

export type TicketReplyRow = {
  id: string;
  ticket_id: string;
  sender: string;
  message: string;
  created_at: string;
};

export type AdminNoteRow = {
  id: string;
  investor_id: string;
  note: string;
  created_by: string | null;
  created_at: string;
};
