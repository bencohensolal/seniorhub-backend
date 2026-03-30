// Text Screen Entity
// Represents a text-based screen on a display tablet

export type FontFamily = 'sans-serif' | 'serif' | 'monospace';
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';
export type TextAlign = 'left' | 'center' | 'right';
export type BackgroundType = 'solid' | 'gradient';
export type GradientDirection = 'to-bottom' | 'to-right' | 'to-bottom-right';
export type TextAnimation = 'none' | 'fade-in' | 'slide-up' | 'zoom-in';

export interface TextScreen {
  id: string;
  tabletId: string;
  householdId: string;
  title: string;
  body: string | null;
  order: number;
  fontFamily: FontFamily;
  fontSize: FontSize;
  textColor: string;
  textAlign: TextAlign;
  backgroundType: BackgroundType;
  backgroundColor: string;
  backgroundColorEnd: string | null;
  gradientDirection: GradientDirection;
  icon: string | null;
  animation: TextAnimation;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
}

export interface CreateTextScreenInput {
  tabletId: string;
  householdId: string;
  title: string;
  body?: string | null;
  order?: number;
  fontFamily?: FontFamily;
  fontSize?: FontSize;
  textColor?: string;
  textAlign?: TextAlign;
  backgroundType?: BackgroundType;
  backgroundColor?: string;
  backgroundColorEnd?: string | null;
  gradientDirection?: GradientDirection;
  icon?: string | null;
  animation?: TextAnimation;
  createdBy: string;
}

export interface UpdateTextScreenInput {
  title?: string;
  body?: string | null;
  order?: number;
  fontFamily?: FontFamily;
  fontSize?: FontSize;
  textColor?: string;
  textAlign?: TextAlign;
  backgroundType?: BackgroundType;
  backgroundColor?: string;
  backgroundColorEnd?: string | null;
  gradientDirection?: GradientDirection;
  icon?: string | null;
  animation?: TextAnimation;
}

// Default values
export const DEFAULT_TEXT_SCREEN_SETTINGS = {
  fontFamily: 'sans-serif' as const,
  fontSize: 'medium' as const,
  textColor: '#1E293B',
  textAlign: 'center' as const,
  backgroundType: 'solid' as const,
  backgroundColor: '#FFFFFF',
  backgroundColorEnd: null,
  gradientDirection: 'to-bottom' as const,
  icon: null,
  animation: 'none' as const,
};

// Constants
export const MAX_TEXT_SCREEN_TITLE_LENGTH = 100;
export const MAX_TEXT_SCREEN_BODY_LENGTH = 2000;
