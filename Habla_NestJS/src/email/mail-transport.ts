import * as nodemailer from 'nodemailer';

type MailAddress = string | { name?: string; address: string };

export type MailAttachment = {
  filename?: string;
  content?: string | Buffer;
  contentType?: string;
  path?: string;
};

export type MailOptions = {
  from?: MailAddress;
  to?: MailAddress | MailAddress[];
  cc?: MailAddress | MailAddress[];
  bcc?: MailAddress | MailAddress[];
  replyTo?: MailAddress;
  subject?: string;
  html?: string;
  text?: string;
  attachments?: MailAttachment[];
};

export type MailTransport = {
  sendMail(options: MailOptions): Promise<unknown>;
  verify(): Promise<unknown>;
};

const RESEND_URL = 'https://api.resend.com/emails';

// Render (plan gratuito) bloquea las conexiones SMTP salientes: los correos fallaban con
// "Connection timeout". Con RESEND_API_KEY los correos salen por la API HTTPS de Resend;
// sin ella se mantiene el envío SMTP de siempre (útil en local).
export function createMailTransport(smtpConfig: object): MailTransport {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    return nodemailer.createTransport(
      smtpConfig as any,
    ) as unknown as MailTransport;
  }

  return {
    verify: () => Promise.resolve(true),
    sendMail: async (options) => {
      const response = await fetch(RESEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || formatAddress(options.from),
          to: toList(options.to),
          cc: toList(options.cc),
          bcc: toList(options.bcc),
          reply_to: options.replyTo
            ? formatAddress(options.replyTo)
            : undefined,
          subject: options.subject,
          html: options.html,
          text: options.text,
          attachments: options.attachments
            ?.filter(
              (attachment) =>
                attachment.content !== undefined || attachment.path,
            )
            .map((attachment) => ({
              filename: attachment.filename,
              content:
                attachment.content === undefined
                  ? undefined
                  : Buffer.isBuffer(attachment.content)
                    ? attachment.content.toString('base64')
                    : Buffer.from(attachment.content).toString('base64'),
              path:
                attachment.content === undefined ? attachment.path : undefined,
              content_type: attachment.contentType,
            })),
        }),
        signal: AbortSignal.timeout(20_000),
      });

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 300);
        throw new Error(
          `Resend rechazó el correo (${response.status}): ${detail}`,
        );
      }

      return response.json();
    },
  };
}

function formatAddress(value?: MailAddress): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value.name ? `${value.name} <${value.address}>` : value.address;
}

function toList(value?: MailAddress | MailAddress[]): string[] | undefined {
  if (!value) return undefined;
  const list = (Array.isArray(value) ? value : [value])
    .map(formatAddress)
    .filter((item): item is string => !!item)
    .flatMap((item) =>
      item
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
    );
  return list.length ? list : undefined;
}
