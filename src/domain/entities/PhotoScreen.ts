// Photo Screen Entity
// Represents a photo gallery screen on a display tablet

// Type aliases
export type DisplayMode = 'slideshow' | 'mosaic' | 'single';
export type SlideshowTransition = 'fade' | 'slide' | 'none';
export type SlideshowOrder = 'sequential' | 'random';

export interface PhotoScreen {
  id: string;
  tabletId: string;
  householdId: string;
  name: string;
  displayMode: 'slideshow' | 'mosaic' | 'single';
  slideshowDuration: number; // in seconds (3, 5, 10, 15, 30)
  slideshowTransition: 'fade' | 'slide' | 'none';
  slideshowOrder: 'sequential' | 'random';
  showCaptions: boolean;
  createdAt: string; // ISO timestamp
  createdBy: string; // User ID
  updatedAt: string | null; // ISO timestamp
}

export interface Photo {
  id: string;
  photoScreenId: string;
  url: string;
  caption: string | null;
  order: number; // 0-indexed
  uploadedAt: string; // ISO timestamp
  updatedAt: string | null; // ISO timestamp
}

export interface PhotoScreenWithPhotos extends PhotoScreen {
  photos: Photo[];
}

// Input types for creation
export interface CreatePhotoScreenInput {
  tabletId: string;
  householdId: string;
  name: string;
  displayMode?: DisplayMode;
  slideshowDuration?: number;
  slideshowTransition?: SlideshowTransition;
  slideshowOrder?: SlideshowOrder;
  showCaptions?: boolean;
  createdBy: string;
}

export interface UpdatePhotoScreenInput {
  name?: string;
  displayMode?: DisplayMode;
  slideshowDuration?: number;
  slideshowTransition?: SlideshowTransition;
  slideshowOrder?: SlideshowOrder;
  showCaptions?: boolean;
}

export interface CreatePhotoInput {
  photoScreenId: string;
  url: string;
  caption?: string | null;
  order: number;
}

export interface UpdatePhotoInput {
  caption?: string | null;
  order?: number;
}

// Default values
export const DEFAULT_PHOTO_SCREEN_SETTINGS = {
  displayMode: 'slideshow' as const,
  slideshowDuration: 5,
  slideshowTransition: 'fade' as const,
  slideshowOrder: 'sequential' as const,
  showCaptions: false,
};

// Constants
export const MAX_PHOTO_SCREENS_PER_TABLET = 5;
export const MAX_PHOTOS_PER_SCREEN = 6;
export const MAX_PHOTO_CAPTION_LENGTH = 100;
export const MAX_PHOTO_SCREEN_NAME_LENGTH = 50;
export const MAX_PHOTO_SIZE_MB = 5;
export const TARGET_PHOTO_SIZE_MB = 1;
export const MAX_PHOTO_DIMENSION = 1920; // Max width or height for tablet display
