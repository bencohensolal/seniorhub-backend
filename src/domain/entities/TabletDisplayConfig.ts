// Display Tablet Configuration Types
// These types define the structure for configuring display tablets

export type ScreenType = 
  | 'summary' 
  | 'datetime' 
  | 'appointments' 
  | 'tasks' 
  | 'weekCalendar' 
  | 'monthCalendar';

// Base screen configuration
export interface ScreenConfig {
  type: ScreenType;
  enabled: boolean;
  order: number; // 0-indexed position in rotation
  settings?: ScreenSettings;
}

// Union type for all possible screen settings
export type ScreenSettings =
  | SummaryScreenSettings
  | DateTimeScreenSettings
  | AppointmentsScreenSettings
  | TasksScreenSettings
  | WeekCalendarScreenSettings
  | MonthCalendarScreenSettings;

// Summary screen settings
export interface SummaryScreenSettings {
  appointmentsPeriodDays: 7 | 14 | 30;
  showTasksCount: boolean;
  showAppointmentsCount: boolean;
}

// DateTime screen settings
export interface DateTimeScreenSettings {
  timeFormat: '12h' | '24h';
  dateFormat: 'short' | 'long' | 'full';
  textColor: string; // Hex color (e.g., #FFFFFF)
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  showSeconds: boolean;
}

// Appointments screen settings
export interface AppointmentsScreenSettings {
  maxAppointments: 2 | 4 | 6 | 8;
  fontSize: 'auto' | 'small' | 'medium' | 'large';
  showLocation: boolean;
  showCaregiver: boolean;
  periodDays: 7 | 14 | 30;
}

// Tasks screen settings
export interface TasksScreenSettings {
  periodDays: 0 | 1 | 3 | 7; // 0 = today only
  maxTasks: number;
  fontSize: 'auto' | 'small' | 'medium' | 'large';
  showPriority: boolean;
  filterByCategory: string[]; // Empty = all categories
  sortBy: 'dueDate' | 'priority' | 'category';
}

// Week Calendar screen settings
export interface WeekCalendarScreenSettings {
  startDay: 0 | 1; // 0=Sunday, 1=Monday
  displayMode: 'compact' | 'detailed';
  showWeekNumber: boolean;
}

// Month Calendar screen settings
export interface MonthCalendarScreenSettings {
  displayMode: 'compact' | 'detailed';
  showWeekNumbers: boolean;
  highlightToday: boolean;
}

// Main tablet display configuration
export interface TabletDisplayConfig {
  // General settings
  slideDuration: number; // milliseconds (default: 10000)
  dataCacheDuration: number; // milliseconds (default: 300000)
  dataRefreshInterval: number; // milliseconds (default: 300000)
  
  // Screen configurations
  screens: ScreenConfig[];
  
  // Metadata
  lastUpdated?: string; // ISO timestamp
}

// Default configuration values
export const DEFAULT_TABLET_CONFIG: TabletDisplayConfig = {
  slideDuration: 10000,
  dataCacheDuration: 300000,
  dataRefreshInterval: 300000,
  screens: [
    {
      type: 'summary',
      enabled: true,
      order: 0,
      settings: {
        appointmentsPeriodDays: 7,
        showTasksCount: true,
        showAppointmentsCount: true,
      } as SummaryScreenSettings,
    },
    {
      type: 'datetime',
      enabled: true,
      order: 1,
      settings: {
        timeFormat: '24h',
        dateFormat: 'long',
        textColor: '#FFFFFF',
        fontSize: 'xlarge',
        showSeconds: true,
      } as DateTimeScreenSettings,
    },
    {
      type: 'appointments',
      enabled: true,
      order: 2,
      settings: {
        maxAppointments: 4,
        fontSize: 'auto',
        showLocation: true,
        showCaregiver: true,
        periodDays: 7,
      } as AppointmentsScreenSettings,
    },
    {
      type: 'tasks',
      enabled: true,
      order: 3,
      settings: {
        periodDays: 0,
        maxTasks: 5,
        fontSize: 'auto',
        showPriority: true,
        filterByCategory: [],
        sortBy: 'dueDate',
      } as TasksScreenSettings,
    },
    {
      type: 'weekCalendar',
      enabled: true,
      order: 4,
      settings: {
        startDay: 1,
        displayMode: 'detailed',
        showWeekNumber: true,
      } as WeekCalendarScreenSettings,
    },
    {
      type: 'monthCalendar',
      enabled: true,
      order: 5,
      settings: {
        displayMode: 'detailed',
        showWeekNumbers: true,
        highlightToday: true,
      } as MonthCalendarScreenSettings,
    },
  ],
};
