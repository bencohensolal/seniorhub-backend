import PDFDocument from 'pdfkit';

export interface ReportData {
  householdName: string;
  fromDate: string; // ISO
  toDate: string; // ISO
  generatedAt: string; // ISO
  members: Array<{ firstName: string; lastName: string; role: string }>;
  emergencyContacts: Array<{ name: string; phone: string; relationship: string | null }>;
  journalEntries: Array<{ content: string; category: string; authorName: string; createdAt: string }>;
  completedTasks: Array<{ title: string; completedAt: string | null; completedByName: string | null }>;
  appointments: Array<{ title: string; date: string; time: string; locationName: string | null }>;
}

const PRIMARY_COLOR = '#6366F1';
const LIGHT_BG = '#EEF2FF';
const TEXT_COLOR = '#1F2937';
const MUTED_COLOR = '#6B7280';
const TABLE_HEADER_BG = '#E0E7FF';

const ROLE_LABELS: Record<string, string> = {
  senior: 'Senior',
  caregiver: 'Aidant',
  family: 'Famille',
  intervenant: 'Intervenant',
};

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  mood: 'Humeur',
  meal: 'Repas',
  outing: 'Sortie',
  visit: 'Visite',
  incident: 'Incident',
  care: 'Soin',
  other: 'Autre',
};

function formatDateFR(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatTimeFR(iso: string): string {
  const d = new Date(iso);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatDateTimeFR(iso: string): string {
  return `${formatDateFR(iso)} ${formatTimeFR(iso)}`;
}

function groupByDay(entries: ReportData['journalEntries']): Map<string, ReportData['journalEntries']> {
  const grouped = new Map<string, ReportData['journalEntries']>();
  for (const entry of entries) {
    const dayKey = formatDateFR(entry.createdAt);
    if (!grouped.has(dayKey)) {
      grouped.set(dayKey, []);
    }
    grouped.get(dayKey)!.push(entry);
  }
  return grouped;
}

export class PdfReportService {
  static async generate(data: ReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        bufferPages: true,
        info: {
          Title: `Rapport - ${data.householdName}`,
          Author: 'SeniorHub',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ─── Cover page ───
      drawCoverPage(doc, data);

      // ─── Members section ───
      if (data.members.length > 0) {
        doc.addPage();
        drawSectionHeader(doc, 'Membres du foyer');
        drawMembersTable(doc, data.members);
      }

      // ─── Emergency contacts section ───
      if (data.emergencyContacts.length > 0) {
        ensureSpace(doc, 150);
        drawSectionHeader(doc, 'Contacts d\'urgence');
        drawEmergencyContactsTable(doc, data.emergencyContacts);
      }

      // ─── Journal section ───
      if (data.journalEntries.length > 0) {
        doc.addPage();
        drawSectionHeader(doc, 'Journal');
        drawJournalEntries(doc, data.journalEntries);
      }

      // ─── Tasks section ───
      if (data.completedTasks.length > 0) {
        doc.addPage();
        drawSectionHeader(doc, 'Taches completees');
        drawTasksTable(doc, data.completedTasks);
      }

      // ─── Appointments section ───
      if (data.appointments.length > 0) {
        ensureSpace(doc, 150);
        drawSectionHeader(doc, 'Rendez-vous');
        drawAppointmentsTable(doc, data.appointments);
      }

      doc.end();
    });
  }
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  const pageHeight = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > pageHeight) {
    doc.addPage();
  }
}

function drawCoverPage(doc: PDFKit.PDFDocument, data: ReportData): void {
  const pageWidth = doc.page.width;
  const centerX = pageWidth / 2;

  // Top accent bar
  doc.rect(0, 0, pageWidth, 6).fill(PRIMARY_COLOR);

  // Title block
  doc.moveDown(8);
  doc.font('Helvetica-Bold').fontSize(32).fillColor(PRIMARY_COLOR);
  doc.text('Rapport du Foyer', { align: 'center' });

  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(20).fillColor(TEXT_COLOR);
  doc.text(data.householdName, { align: 'center' });

  // Decorative line
  doc.moveDown(1.5);
  const lineY = doc.y;
  doc.moveTo(centerX - 60, lineY).lineTo(centerX + 60, lineY).lineWidth(2).strokeColor(PRIMARY_COLOR).stroke();

  // Period
  doc.moveDown(2);
  doc.font('Helvetica').fontSize(14).fillColor(MUTED_COLOR);
  doc.text(`Periode : ${formatDateFR(data.fromDate)} - ${formatDateFR(data.toDate)}`, { align: 'center' });

  // Generated date
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor(MUTED_COLOR);
  doc.text(`Genere le ${formatDateTimeFR(data.generatedAt)}`, { align: 'center' });

  // Footer branding
  doc.font('Helvetica-Bold').fontSize(10).fillColor(PRIMARY_COLOR);
  doc.text('SeniorHub', 50, doc.page.height - 60, { align: 'center' });
}

function drawSectionHeader(doc: PDFKit.PDFDocument, title: string): void {
  doc.font('Helvetica-Bold').fontSize(18).fillColor(PRIMARY_COLOR);
  doc.text(title);
  doc.moveDown(0.3);

  // Underline
  const lineY = doc.y;
  doc.moveTo(50, lineY).lineTo(250, lineY).lineWidth(2).strokeColor(PRIMARY_COLOR).stroke();
  doc.moveDown(0.8);
}

function drawTableHeader(doc: PDFKit.PDFDocument, columns: Array<{ label: string; x: number; width: number }>): void {
  const y = doc.y;
  const rowHeight = 22;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // Header background
  doc.rect(doc.page.margins.left, y, pageWidth, rowHeight).fill(TABLE_HEADER_BG);

  doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT_COLOR);
  for (const col of columns) {
    doc.text(col.label, col.x, y + 6, { width: col.width, ellipsis: true });
  }

  doc.y = y + rowHeight + 2;
}

function drawTableRow(doc: PDFKit.PDFDocument, cells: Array<{ text: string; x: number; width: number }>, isAlternate: boolean): void {
  const y = doc.y;
  const rowHeight = 20;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  if (isAlternate) {
    doc.rect(doc.page.margins.left, y, pageWidth, rowHeight).fill('#F9FAFB');
  }

  doc.font('Helvetica').fontSize(9).fillColor(TEXT_COLOR);
  for (const cell of cells) {
    doc.text(cell.text, cell.x, y + 5, { width: cell.width, ellipsis: true });
  }

  doc.y = y + rowHeight;
}

function drawMembersTable(doc: PDFKit.PDFDocument, members: ReportData['members']): void {
  const left = doc.page.margins.left;
  const columns = [
    { label: 'Nom', x: left, width: 250 },
    { label: 'Role', x: left + 260, width: 200 },
  ];

  drawTableHeader(doc, columns);

  members.forEach((member, i) => {
    ensureSpace(doc, 25);
    drawTableRow(doc, [
      { text: `${member.firstName} ${member.lastName}`, x: left, width: 250 },
      { text: ROLE_LABELS[member.role] ?? member.role, x: left + 260, width: 200 },
    ], i % 2 === 1);
  });

  doc.moveDown(1);
}

function drawEmergencyContactsTable(doc: PDFKit.PDFDocument, contacts: ReportData['emergencyContacts']): void {
  const left = doc.page.margins.left;
  const columns = [
    { label: 'Nom', x: left, width: 170 },
    { label: 'Telephone', x: left + 180, width: 140 },
    { label: 'Relation', x: left + 330, width: 160 },
  ];

  drawTableHeader(doc, columns);

  contacts.forEach((contact, i) => {
    ensureSpace(doc, 25);
    drawTableRow(doc, [
      { text: contact.name, x: left, width: 170 },
      { text: contact.phone, x: left + 180, width: 140 },
      { text: contact.relationship ?? '-', x: left + 330, width: 160 },
    ], i % 2 === 1);
  });

  doc.moveDown(1);
}

function drawJournalEntries(doc: PDFKit.PDFDocument, entries: ReportData['journalEntries']): void {
  const grouped = groupByDay(entries);

  for (const [dayLabel, dayEntries] of grouped) {
    ensureSpace(doc, 80);

    // Day header
    doc.font('Helvetica-Bold').fontSize(12).fillColor(TEXT_COLOR);
    doc.text(dayLabel);
    doc.moveDown(0.3);

    for (const entry of dayEntries) {
      ensureSpace(doc, 60);

      const time = formatTimeFR(entry.createdAt);
      const categoryLabel = CATEGORY_LABELS[entry.category] ?? entry.category;

      // Entry header line: time + author + category badge
      const y = doc.y;

      doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED_COLOR);
      doc.text(`${time} - ${entry.authorName}`, 55, y);

      // Category badge
      const badgeX = 300;
      const badgeWidth = doc.font('Helvetica').fontSize(8).widthOfString(categoryLabel) + 12;
      doc.roundedRect(badgeX, y - 1, badgeWidth, 14, 3).fill(LIGHT_BG);
      doc.font('Helvetica').fontSize(8).fillColor(PRIMARY_COLOR);
      doc.text(categoryLabel, badgeX + 6, y + 2);

      doc.y = y + 18;

      // Entry content
      doc.font('Helvetica').fontSize(9).fillColor(TEXT_COLOR);
      doc.text(entry.content, 55, doc.y, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 10,
      });

      doc.moveDown(0.6);

      // Separator
      const sepY = doc.y;
      doc.moveTo(55, sepY).lineTo(doc.page.width - doc.page.margins.right, sepY)
        .lineWidth(0.5).strokeColor('#E5E7EB').stroke();
      doc.moveDown(0.4);
    }

    doc.moveDown(0.5);
  }
}

function drawTasksTable(doc: PDFKit.PDFDocument, tasks: ReportData['completedTasks']): void {
  const left = doc.page.margins.left;
  const columns = [
    { label: 'Tache', x: left, width: 230 },
    { label: 'Completee le', x: left + 240, width: 110 },
    { label: 'Completee par', x: left + 360, width: 130 },
  ];

  drawTableHeader(doc, columns);

  tasks.forEach((task, i) => {
    ensureSpace(doc, 25);
    drawTableRow(doc, [
      { text: task.title, x: left, width: 230 },
      { text: task.completedAt ? formatDateFR(task.completedAt) : '-', x: left + 240, width: 110 },
      { text: task.completedByName ?? '-', x: left + 360, width: 130 },
    ], i % 2 === 1);
  });

  doc.moveDown(1);
}

function drawAppointmentsTable(doc: PDFKit.PDFDocument, appointments: ReportData['appointments']): void {
  const left = doc.page.margins.left;
  const columns = [
    { label: 'Rendez-vous', x: left, width: 180 },
    { label: 'Date', x: left + 190, width: 90 },
    { label: 'Heure', x: left + 290, width: 60 },
    { label: 'Lieu', x: left + 360, width: 130 },
  ];

  drawTableHeader(doc, columns);

  appointments.forEach((appt, i) => {
    ensureSpace(doc, 25);
    drawTableRow(doc, [
      { text: appt.title, x: left, width: 180 },
      { text: formatDateFR(appt.date), x: left + 190, width: 90 },
      { text: appt.time, x: left + 290, width: 60 },
      { text: appt.locationName ?? '-', x: left + 360, width: 130 },
    ], i % 2 === 1);
  });

  doc.moveDown(1);
}
