import type { WeeklySummaryData } from '../../domain/usecases/reports/GenerateWeeklySummaryUseCase.js';

export function buildWeeklySummaryEmail(data: WeeklySummaryData): { subject: string; html: string } {
  const subject = `${data.title} — ${data.householdName}`;

  const highlightsHtml = data.journalHighlights.length > 0
    ? data.journalHighlights.map((h) => {
        const date = new Date(h.createdAt).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
        });
        return `
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #E5E7EB;">
              <p style="margin: 0 0 4px 0; font-size: 13px; color: #6B7280;">${escapeHtml(h.authorName)} &middot; ${date}</p>
              <p style="margin: 0; font-size: 15px; color: #1F2937;">${escapeHtml(h.content)}</p>
            </td>
          </tr>`;
      }).join('')
    : `
          <tr>
            <td style="padding: 16px; text-align: center; color: #9CA3AF; font-size: 14px;">
              Aucune entrée cette semaine.
            </td>
          </tr>`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F3F4F6;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color: #6366F1; padding: 28px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #FFFFFF;">Résumé hebdomadaire</h1>
              <p style="margin: 8px 0 0 0; font-size: 15px; color: #C7D2FE;">${escapeHtml(data.householdName)}</p>
            </td>
          </tr>

          <!-- Period -->
          <tr>
            <td style="padding: 20px 24px 8px 24px; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #6B7280;">
                Semaine du ${formatDateFr(data.periodStart)} au ${formatDateFr(data.periodEnd)}
              </p>
            </td>
          </tr>

          <!-- Stats Cards -->
          <tr>
            <td style="padding: 16px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding: 6px;">
                    ${statCard('\uD83D\uDCD3', String(data.journalCount), 'entrée(s) journal')}
                  </td>
                  <td width="50%" style="padding: 6px;">
                    ${statCard('\u2705', `${data.tasksCompleted}/${data.tasksCreated}`, 'tâches complétées')}
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding: 6px;">
                    ${statCard('\uD83D\uDCC5', String(data.appointmentsCount), 'rendez-vous')}
                  </td>
                  <td width="50%" style="padding: 6px;">
                    ${statCard('\uD83D\uDCCB', String(data.todosCompleted), 'to-dos complétés')}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Journal Highlights -->
          <tr>
            <td style="padding: 8px 24px 4px 24px;">
              <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: #1F2937;">Dernières entrées du journal</h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 24px 16px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden;">
                ${highlightsHtml}
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 8px 24px 28px 24px; text-align: center;">
              <a href="https://seniorhub.app" style="display: inline-block; padding: 14px 32px; background-color: #6366F1; color: #FFFFFF; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                Ouvrir SeniorHub
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 24px; background-color: #F9FAFB; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="margin: 0; font-size: 12px; color: #9CA3AF;">
                Cet email est envoyé automatiquement chaque lundi.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

function statCard(emoji: string, value: string, label: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F9FAFB; border-radius: 8px; border: 1px solid #E5E7EB;">
      <tr>
        <td style="padding: 14px 12px; text-align: center;">
          <p style="margin: 0; font-size: 22px;">${emoji}</p>
          <p style="margin: 4px 0 2px 0; font-size: 22px; font-weight: 700; color: #6366F1;">${escapeHtml(value)}</p>
          <p style="margin: 0; font-size: 12px; color: #6B7280;">${escapeHtml(label)}</p>
        </td>
      </tr>
    </table>`;
}

function formatDateFr(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
