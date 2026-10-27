/**
 * Sends the run-plan email through Azure Communication Services, using the same
 * connection string and sender address as the operational alerts.
 */
import { EmailClient, type EmailAttachment } from '@azure/communication-email';

export interface RunPlanEmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments: EmailAttachment[];
}

export type SendResult = { sent: true } | { sent: false; reason: string };

let client: EmailClient | null | undefined;

function getClient(): EmailClient | null {
  if (client !== undefined) return client;
  const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
  client = connectionString ? new EmailClient(connectionString) : null;
  return client;
}

export async function sendRunPlanEmail(message: RunPlanEmailMessage): Promise<SendResult> {
  const from = process.env.EMAIL_FROM_ADDRESS;
  const emailClient = getClient();
  if (!emailClient || !from) {
    return { sent: false, reason: 'Email is not configured on the server' };
  }
  try {
    const poller = await emailClient.beginSend({
      senderAddress: from,
      content: { subject: message.subject, html: message.html, plainText: message.text },
      recipients: { to: [{ address: message.to }] },
      attachments: message.attachments,
    });
    const result = await poller.pollUntilDone();
    if (result.status !== 'Succeeded') {
      return { sent: false, reason: `Email did not send (${result.status})` };
    }
    return { sent: true };
  } catch (error) {
    console.error('[runPlanEmail] send failed:', error);
    return { sent: false, reason: 'Email could not be sent right now' };
  }
}
