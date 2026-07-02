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
const LOGO_URL = 'https://conecta.app/assets/conecta-logo-transparent.png';

export function buildConectaEmail(options: EmailTemplateOptions): string {
  const preview = options.preview || options.title;
  const actionHtml = options.action
    ? conectaButton(options.action.url, options.action.label, options.action.variant)
    : '';

  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeEmailHtml(options.title)}</title>
  </head>
  <body style="margin:0; padding:0; background:#f7f0fb; color:${BRAND_TEXT}; font-family:Arial, Helvetica, sans-serif;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
      ${escapeEmailHtml(preview)}
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f0fb; margin:0; padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; background:#ffffff; border-radius:28px; overflow:hidden; box-shadow:0 18px 45px rgba(139,44,245,0.14);">
            <tr>
              <td align="center" style="padding:34px 28px 18px; background:linear-gradient(135deg,#fff7ff 0%,#f6e7ff 100%);">
                <img src="${LOGO_URL}" width="220" alt="Conecta" style="display:block; width:220px; max-width:80%; height:auto; margin:0 auto 16px;">
                <div style="font-size:13px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:${BRAND_PURPLE_DARK};">
                  Conecta
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:30px 34px 18px;">
                <h1 style="margin:0 0 18px; color:${BRAND_TEXT}; font-size:28px; line-height:1.15; font-weight:900;">
                  ${escapeEmailHtml(options.title)}
                </h1>

                <div style="font-size:16px; line-height:1.65; color:${BRAND_TEXT};">
                  ${options.body}
                </div>

                ${actionHtml}
              </td>
            </tr>

            <tr>
              <td style="padding:0 34px 34px;">
                <div style="border-top:1px solid #f0ddff; padding-top:22px;">
                  <p style="margin:0 0 8px; color:${BRAND_TEXT}; font-size:14px; font-weight:800;">
                    Equipo Conecta
                  </p>
                  <p style="margin:0 0 16px; color:${BRAND_MUTED}; font-size:13px; line-height:1.55;">
                    Este correo fue enviado automaticamente por Conecta. Para proteger a pacientes y profesionales, gestiona tus citas y mensajes dentro de la plataforma.
                  </p>
                  <p style="margin:0; color:${BRAND_MUTED}; font-size:12px;">
                    <a href="https://conecta.app" style="color:${BRAND_PURPLE_DARK}; text-decoration:none; font-weight:800;">conecta.app</a>
                    <span style="color:#d7c3e8;">&nbsp;|&nbsp;</span>
                    Conecta con lo que importa
                  </p>
                </div>
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

export function conectaButton(
  url: string,
  label: string,
  variant: 'primary' | 'success' = 'primary',
): string {
  if (!url) return '';

  const background = variant === 'success'
    ? 'linear-gradient(135deg,#20c767 0%,#16a34a 100%)'
    : `linear-gradient(135deg,${BRAND_PURPLE} 0%,${BRAND_PURPLE_DARK} 100%)`;

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px 0 4px;">
      <tr>
        <td style="border-radius:16px; background:${background}; box-shadow:0 12px 26px rgba(196,0,245,0.24);">
          <a href="${escapeEmailHtml(url)}" style="display:inline-block; padding:15px 24px; color:#ffffff; text-decoration:none; border-radius:16px; font-size:15px; font-weight:900;">
            ${escapeEmailHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

export function conectaInfoCard(content: string): string {
  return `
    <div style="margin:20px 0; padding:18px; border:1px solid #efd6ff; border-radius:18px; background:${BRAND_PANEL};">
      ${content}
    </div>
  `;
}

export function emailRow(label: string, value: string): string {
  return `
    <p style="margin:0 0 12px; color:${BRAND_TEXT};">
      <span style="display:block; color:${BRAND_MUTED}; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.05em;">${escapeEmailHtml(label)}</span>
      <strong style="font-size:15px;">${escapeEmailHtml(value)}</strong>
    </p>
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
