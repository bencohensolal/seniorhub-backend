import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { JournalEntryRepository } from '../../repositories/JournalEntryRepository.js';
import { HouseholdAccessValidator, PlanLimitGuard } from '../shared/index.js';
import { PdfReportService } from '../../../services/PdfReportService.js';
import type { ReportData } from '../../../services/PdfReportService.js';
import { NotFoundError } from '../../errors/index.js';

export class GenerateHouseholdReportUseCase {
  private readonly accessValidator: HouseholdAccessValidator;
  private readonly planLimitGuard: PlanLimitGuard;

  constructor(
    private readonly repository: HouseholdRepository,
    private readonly journalRepository: JournalEntryRepository,
  ) {
    this.accessValidator = new HouseholdAccessValidator(repository);
    this.planLimitGuard = new PlanLimitGuard(repository);
  }

  async execute(input: {
    householdId: string;
    requesterUserId: string;
    fromDate: string; // ISO date (YYYY-MM-DD)
    toDate: string; // ISO date (YYYY-MM-DD)
  }): Promise<Buffer> {
    // 1. Check plan feature access
    await this.planLimitGuard.ensurePlanFeature({
      householdId: input.householdId,
      requiredPlan: 'serenite',
      feature: 'pdf_reports',
    });

    // 2. Validate membership
    await this.accessValidator.ensureMember(input.requesterUserId, input.householdId);

    // 3. Fetch household info
    const overview = await this.repository.getOverviewById(input.householdId);
    if (!overview) {
      throw new NotFoundError('Household not found.');
    }
    const householdName = overview.household.name;

    // 4. Fetch all data in parallel
    const [members, emergencyContacts, allJournalEntries, allTasks, allAppointments] = await Promise.all([
      this.repository.listHouseholdMembers(input.householdId),
      this.repository.listEmergencyContacts(input.householdId),
      this.journalRepository.listByHousehold(input.householdId, { limit: 500 }),
      this.repository.listHouseholdTasks(input.householdId, { status: 'completed' }),
      this.repository.listHouseholdAppointments(input.householdId),
    ]);

    // 5. Build member ID -> name map for author attribution
    const memberNameMap = new Map<string, string>();
    for (const member of members) {
      memberNameMap.set(member.userId, `${member.firstName} ${member.lastName}`);
      memberNameMap.set(member.id, `${member.firstName} ${member.lastName}`);
    }

    // 6. Filter by date range
    const fromTimestamp = new Date(input.fromDate).getTime();
    const toTimestamp = new Date(input.toDate + 'T23:59:59.999Z').getTime();

    const filteredJournal = allJournalEntries.filter((entry) => {
      const ts = new Date(entry.createdAt).getTime();
      return ts >= fromTimestamp && ts <= toTimestamp;
    });

    const filteredTasks = allTasks.filter((task) => {
      if (!task.completedAt) return false;
      const ts = new Date(task.completedAt).getTime();
      return ts >= fromTimestamp && ts <= toTimestamp;
    });

    const filteredAppointments = allAppointments.filter((appt) => {
      const ts = new Date(appt.date).getTime();
      return ts >= fromTimestamp && ts <= toTimestamp;
    });

    // 7. Map to report data
    const reportData: ReportData = {
      householdName,
      fromDate: input.fromDate,
      toDate: input.toDate,
      generatedAt: new Date().toISOString(),
      members: members.map((m) => ({
        firstName: m.firstName,
        lastName: m.lastName,
        role: m.role,
      })),
      emergencyContacts: emergencyContacts.map((c) => ({
        name: c.name,
        phone: c.phone,
        relationship: c.relationship,
      })),
      journalEntries: filteredJournal.map((entry) => ({
        content: entry.content,
        category: entry.category,
        authorName: memberNameMap.get(entry.authorId) ?? 'Inconnu',
        createdAt: entry.createdAt,
      })),
      completedTasks: filteredTasks.map((task) => ({
        title: task.title,
        completedAt: task.completedAt,
        completedByName: task.completedBy ? (memberNameMap.get(task.completedBy) ?? null) : null,
      })),
      appointments: filteredAppointments.map((appt) => ({
        title: appt.title,
        date: appt.date,
        time: appt.time,
        locationName: appt.locationName,
      })),
    };

    // 8. Generate PDF
    return PdfReportService.generate(reportData);
  }
}
