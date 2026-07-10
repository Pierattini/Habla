type EmailAction = {
  label: string;
  url: string;
  variant?: 'primary' | 'success';
};

type EmailTemplateOptions = {
  title: string;
  preview?: string;
  body: string;
  action?: EmailAction;
};

const BRAND_PURPLE = '#c400f5';
const BRAND_PURPLE_DARK = '#8b2cf5';
const BRAND_TEXT = '#20172f';
const BRAND_MUTED = '#6f6780';
const BRAND_PANEL = '#fbf5ff';
const BRAND_BORDER = '#eadcf6';
const PAGE_BG = '#f6f4fa';
const SUPPORT_EMAIL = 'soporte@turedpro.com';
const PUBLIC_DOMAIN = 'turedpro.com';

export function buildConectaEmail(options: EmailTemplateOptions): string {
  const preview = options.preview || options.title;
  const actionHtml = options.action
    ? conectaButton(
        options.action.url,
        options.action.label,
        options.action.variant,
      )
    : '';

  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeEmailHtml(options.title)}</title>
  </head>
  <body style="margin:0; padding:0; background:${PAGE_BG}; color:${BRAND_TEXT}; font-family:Arial, Helvetica, sans-serif; -webkit-font-smoothing:antialiased;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent; line-height:1px; font-size:1px;">
      ${escapeEmailHtml(preview)}
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background:${PAGE_BG}; margin:0; padding:0;">
      <tr>
        <td align="center" style="padding:32px 14px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:600px; margin:0 auto;">
            <tr>
              <td align="center" style="padding:0 4px 16px;">
                ${buildLogoHeaderHtml()}
              </td>
            </tr>

            <tr>
              <td style="background:#ffffff; border:1px solid ${BRAND_BORDER}; border-radius:24px; overflow:hidden; box-shadow:0 18px 46px rgba(70,42,105,0.10);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="height:6px; background:linear-gradient(90deg, ${BRAND_PURPLE} 0%, ${BRAND_PURPLE_DARK} 100%); font-size:0; line-height:0;">
                      &nbsp;
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:34px 34px 10px;">
                      <div style="margin:0 0 12px; color:${BRAND_PURPLE_DARK}; font-size:13px; line-height:1.3; font-weight:900; letter-spacing:.08em; text-transform:uppercase;">
                        Notificacion Conecta
                      </div>
                      <h1 style="margin:0; color:${BRAND_TEXT}; font-size:30px; line-height:1.16; font-weight:900; letter-spacing:0;">
                        ${escapeEmailHtml(options.title)}
                      </h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 34px 28px;">
                      <div style="font-size:16px; line-height:1.65; color:${BRAND_TEXT};">
                        ${options.body}
                      </div>

                      ${actionHtml}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:22px 18px 0;">
                <p style="margin:0 0 8px; color:${BRAND_MUTED}; font-size:13px; line-height:1.55;">
                  Este correo fue enviado automaticamente por Conecta. Para proteger tu informacion,
                  gestiona tus citas y mensajes dentro de la plataforma.
                </p>
                <p style="margin:0; color:${BRAND_MUTED}; font-size:12px; line-height:1.6;">
                  &copy; Conecta
                  <span style="color:#d6c8e7;">&nbsp;|&nbsp;</span>
                  <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PURPLE_DARK}; text-decoration:none; font-weight:800;">${SUPPORT_EMAIL}</a>
                  <span style="color:#d6c8e7;">&nbsp;|&nbsp;</span>
                  <a href="https://${PUBLIC_DOMAIN}" style="color:${BRAND_PURPLE_DARK}; text-decoration:none; font-weight:800;">${PUBLIC_DOMAIN}</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

function buildLogoHeaderHtml(): string {
  const logoUrl = getPublicLogoUrl();

  if (!logoUrl) {
    return `
      <div style="font-size:26px; line-height:1.15; font-weight:900; color:${BRAND_PURPLE_DARK}; text-align:center;">
        Conecta
      </div>
      <div style="padding-top:5px; font-size:12px; line-height:1.3; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:${BRAND_MUTED}; text-align:center;">
        Gestion de citas
      </div>
    `;
  }

  return `
    <img src="${escapeEmailHtml(logoUrl)}" width="180" alt="Conecta" style="display:block; width:180px; max-width:80%; height:auto; margin:0 auto; border:0; outline:none; text-decoration:none;">
  `;
}

function getPublicLogoUrl(): string {
  const logoUrl = String(process.env.EMAIL_LOGO_URL || '').trim();

  if (!/^https?:\/\//i.test(logoUrl)) {
    return '';
  }

  return logoUrl;
}

export function conectaButton(
  url: string,
  label: string,
  variant: 'primary' | 'success' = 'primary',
): string {
  if (!url) return '';

  const background = variant === 'success' ? '#20c767' : BRAND_PURPLE_DARK;

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 4px;">
      <tr>
        <td align="center" style="border-radius:14px; background:${background}; box-shadow:0 12px 26px rgba(139,44,245,0.22);">
          <a href="${escapeEmailHtml(url)}" style="display:inline-block; padding:15px 24px; min-width:170px; color:#ffffff; text-decoration:none; border-radius:14px; font-size:15px; line-height:1.2; font-weight:900; text-align:center;">
            ${escapeEmailHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

export function conectaInfoCard(content: string): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0; border:1px solid ${BRAND_BORDER}; border-radius:18px; background:${BRAND_PANEL};">
      <tr>
        <td style="padding:18px;">
          ${content}
        </td>
      </tr>
    </table>
  `;
}

export function emailRow(label: string, value: string): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 12px;">
      <tr>
        <td style="padding:0; color:${BRAND_MUTED}; font-size:12px; line-height:1.35; font-weight:900; text-transform:uppercase; letter-spacing:.05em;">
          ${escapeEmailHtml(label)}
        </td>
      </tr>
      <tr>
        <td style="padding:3px 0 0; color:${BRAND_TEXT}; font-size:15px; line-height:1.45; font-weight:800; word-break:break-word;">
          ${escapeEmailHtml(value)}
        </td>
      </tr>
    </table>
  `;
}

export function escapeEmailHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
