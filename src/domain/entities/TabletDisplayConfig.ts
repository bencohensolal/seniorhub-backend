// Display Tablet Configuration Types
// These types define the structure for configuring display tablets

export type ScreenType =
  | 'summary'
  | 'datetime'
  | 'appointments'
  | 'tasks'
  | 'weekCalendar'
  | 'monthCalendar'
  | 'photoGallery'
  | 'textScreen';

export type TabletLanguage = 'en' | 'fr';

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
  | MonthCalendarScreenSettings
  | PhotoGalleryScreenSettings
  | TextScreenSettings;

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
  startDay: 0 | 1 | 'today'; // 0=Sunday, 1=Monday, 'today'=rolling 7 days
  displayMode: 'compact' | 'detailed';
  showWeekNumber: boolean;
}

// Month Calendar screen settings
export interface MonthCalendarScreenSettings {
  displayMode: 'compact' | 'detailed';
  showWeekNumbers: boolean;
  highlightToday: boolean;
}

// Photo Gallery screen settings
export interface PhotoItem {
  id: string; // UUID unique pour la photo
  url: string; // URL publique de la photo uploadée
  caption?: string | null; // Légende optionnelle (max 100 caractères)
  order: number; // Ordre d'affichage (0-indexed)
  uploadedAt: string; // ISO timestamp
}

export interface PhotoGalleryScreenSettings {
  id: string; // UUID unique pour l'écran photo
  name: string; // Nom de l'écran (ex: "Vacances 2025")
  photos: PhotoItem[]; // Liste des photos (1-6)
  displayMode: 'slideshow' | 'mosaic' | 'single'; // Mode d'affichage
  slideshowDuration?: number; // Durée par photo en secondes (3, 5, 10, 15, 30)
  slideshowTransition?: 'fade' | 'slide' | 'none'; // Type de transition
  slideshowOrder?: 'sequential' | 'random'; // Ordre d'affichage
  showCaptions: boolean; // Afficher les légendes des photos
}

// Text screen settings
export interface TextScreenSettings {
  id: string;
  title: string;
  body: string | null;
  fontFamily: 'sans-serif' | 'serif' | 'monospace';
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  textColor: string;
  textAlign: 'left' | 'center' | 'right';
  backgroundType: 'solid' | 'gradient';
  backgroundColor: string;
  backgroundColorEnd: string | null;
  gradientDirection: 'to-bottom' | 'to-right' | 'to-bottom-right';
  icon: string | null;
  animation: 'none' | 'fade-in' | 'slide-up' | 'zoom-in';
}

// Main tablet display configuration
export interface TabletDisplayConfig {
  // General settings
  slideDuration: number; // milliseconds (default: 10000)
  dataCacheDuration: number; // milliseconds (default: 300000)
  dataRefreshInterval: number; // milliseconds (default: 300000)
  kioskModeEnabled: boolean;
  language: TabletLanguage;
  tapToAdvanceEnabled: boolean;
  showCountdownEnabled: boolean;

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
  kioskModeEnabled: false,
  language: 'en',
  tapToAdvanceEnabled: false,
  showCountdownEnabled: false,
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
