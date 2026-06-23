import { Injectable } from '@nestjs/common';

export type ContactProtectionReason =
  | 'PHONE'
  | 'EMAIL'
  | 'URL'
  | 'SOCIAL'
  | 'CONTACT_PHRASE';

export type ContactProtectionResult =
  | {
      blocked: true;
      reason: ContactProtectionReason;
    }
  | {
      blocked: false;
    };

@Injectable()
export class ContactProtectionService {
  private readonly patterns: Array<{
    reason: ContactProtectionReason;
    regex: RegExp;
  }> = [
    {
      reason: 'EMAIL',
      regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    },
    {
      reason: 'URL',
      regex:
        /\b(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|cl|net|org|io|app|es|co|me|dev|info|online)\b)/i,
    },
    {
      reason: 'SOCIAL',
      regex:
        /(?:^|\s)@[a-z0-9._-]{3,}|instagram\.com|t\.me|wa\.me|whatsapp|facebook\.com|linkedin\.com|telegram|instagram|facebook|linkedin/i,
    },
    {
      reason: 'CONTACT_PHRASE',
      regex:
        /ll[aá]mame|mi n[uú]mero|escr[ií]beme|cont[aá]ctame|h[aá]blame por whatsapp|te dejo mi n[uú]mero|agr[eé]game/i,
    },
    {
      reason: 'PHONE',
      regex:
        /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?){2,}\d{3,4}/,
    },
  ];

  containsRestrictedContent(message?: string | null): ContactProtectionResult {
    const text = message?.trim();

    if (!text) {
      return { blocked: false };
    }

    for (const pattern of this.patterns) {
      if (pattern.regex.test(text)) {
        return {
          blocked: true,
          reason: pattern.reason,
        };
      }
    }

    return { blocked: false };
  }
}
