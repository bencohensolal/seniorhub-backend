import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { JournalEntryRepository } from '../../repositories/JournalEntryRepository.js';

export interface WeeklySummaryData {
  householdName: string;
  periodStart: string;
  periodEnd: string;
  journalCount: number;
  journalHighlights: Array<{ content: string; authorName: string; createdAt: string }>;
  tasksCreated: number;
  tasksCompleted: number;
  appointmentsCount: number;
  todosCompleted: number;
  title: string;
  body: string;
}

interface GenerateWeeklySummaryInput {
  householdId: string;
}

export class GenerateWeeklySummaryUseCase {
  constructor(
    private readonly householdRepository: HouseholdRepository,
    private readonly journalRepository: JournalEntryRepository,
  ) {}

  async execute(input: GenerateWeeklySummaryInput): Promise<WeeklySummaryData> {
    const { householdId } = input;

    // Calculate previous full week: Monday 00:00 to Sunday 23:59
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
    const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - daysToLastMonday - 7);
    lastMonday.setHours(0, 0, 0, 0);

    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    lastSunday.setHours(23, 59, 59, 999);

    const periodStart = lastMonday.toISOString();
    const periodEnd = lastSunday.toISOString();

    // Fetch household info
    const overview = await this.householdRepository.getOverviewById(householdId);
    const householdName = overview?.household.name ?? 'Foyer';

    // Fetch journal entries for the period
    const allJournalEntries = await this.journalRepository.listByHousehold(householdId, {
      archived: false,
    });
    const periodEntries = allJournalEntries.filter((entry) => {
      const entryDate = new Date(entry.createdAt);
      return entryDate >= lastMonday && entryDate <= lastSunday;
    });
    const journalCount = periodEntries.length;

    // Get the 3 most recent entries (already sorted by createdAt desc from repo)
    const recentEntries = periodEntries.slice(0, 3);

    // Resolve author names for highlights
    const members = await this.householdRepository.listHouseholdMembers(householdId);
    const memberMap = new Map(members.map((m) => [m.userId, `${m.firstName} ${m.lastName}`]));

    const journalHighlights = recentEntries.map((entry) => ({
      content: entry.content.length > 100 ? entry.content.slice(0, 100) + '...' : entry.content,
      authorName: memberMap.get(entry.authorId) ?? 'Membre',
      createdAt: entry.createdAt,
    }));

    // Fetch tasks for the period
    const allTasks = await this.householdRepository.listHouseholdTasks(householdId, {
      fromDate: periodStart,
      toDate: periodEnd,
    });
    const tasksCreated = allTasks.length;
    const tasksCompleted = allTasks.filter((t) => t.status === 'completed').length;

    // Fetch appointments in the period
    const occurrences = await this.householdRepository.listAllHouseholdOccurrencesInRange(
      householdId,
      periodStart,
      periodEnd,
    );
    const appointmentsCount = occurrences.length;

    // Fetch caregiver todos
    const allTodos = await this.householdRepository.listCaregiverTodos(householdId, {
      status: 'completed',
    });
    const todosCompleted = allTodos.filter((todo) => {
      if (!todo.completedAt) return false;
      const completedDate = new Date(todo.completedAt);
      return completedDate >= lastMonday && completedDate <= lastSunday;
    }).length;

    // Format dates for the title
    const formatDate = (d: Date) =>
      d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    const title = `Résumé de la semaine du ${formatDate(lastMonday)} au ${formatDate(lastSunday)}`;

    // Build plain text body for push notification
    const bodyParts: string[] = [];
    bodyParts.push(`${journalCount} entrée(s) journal`);
    bodyParts.push(`${tasksCompleted}/${tasksCreated} tâches complétées`);
    bodyParts.push(`${appointmentsCount} rendez-vous`);
    bodyParts.push(`${todosCompleted} to-do(s) complété(s)`);
    const body = bodyParts.join(' | ');

    return {
      householdName,
      periodStart,
      periodEnd,
      journalCount,
      journalHighlights,
      tasksCreated,
      tasksCompleted,
      appointmentsCount,
      todosCompleted,
      title,
      body,
    };
  }
}
