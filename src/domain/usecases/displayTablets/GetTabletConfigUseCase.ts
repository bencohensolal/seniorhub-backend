import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { TabletDisplayConfig, ScreenConfig, PhotoGalleryScreenSettings } from '../../entities/TabletDisplayConfig.js';
import { NotFoundError } from '../../errors/DomainErrors.js';

interface GetTabletConfigInput {
  householdId: string;
  tabletId: string;
}

/**
 * Use case: Get complete tablet configuration including photo screens
 * 
 * This retrieves the tablet's base configuration and enriches it with
 * photo gallery screens created for this tablet.
 */
export class GetTabletConfigUseCase {
  constructor(private repository: HouseholdRepository) {}

  async execute(input: GetTabletConfigInput): Promise<TabletDisplayConfig | null> {
    const { householdId, tabletId } = input;

    // 1. Get the tablet with its base config
    const tablet = await this.repository.getDisplayTabletById(tabletId, householdId);
    
    if (!tablet) {
      throw new NotFoundError('Display tablet not found.');
    }

    // 2. Get the base config (could be null if not yet configured)
    let config = tablet.config as TabletDisplayConfig | null;

    // 3. Get all photo screens for this tablet
    const photoScreens = await this.repository.listPhotoScreens(tabletId, householdId);

    // 4. If we have photo screens, we need to inject them into the config
    if (photoScreens.length > 0) {
      // Initialize config if it doesn't exist
      if (!config) {
        config = {
          slideDuration: 10000,
          dataCacheDuration: 300000,
          dataRefreshInterval: 300000,
          screens: [],
        };
      }

      // Remove any existing photoGallery screens from config (we'll rebuild them)
      const nonPhotoScreens = config.screens.filter(s => s.type !== 'photoGallery');

      // Build photoGallery screen configs from database photo screens
      const photoGalleryScreens: ScreenConfig[] = photoScreens.map((photoScreen, index) => {
        const settings: PhotoGalleryScreenSettings = {
          id: photoScreen.id,
          name: photoScreen.name,
          photos: photoScreen.photos.map(photo => ({
            id: photo.id,
            url: photo.url,
            caption: photo.caption,
            order: photo.order,
            uploadedAt: photo.uploadedAt,
          })),
          displayMode: photoScreen.displayMode,
          slideshowDuration: photoScreen.slideshowDuration ?? undefined,
          slideshowTransition: photoScreen.slideshowTransition ?? undefined,
          slideshowOrder: photoScreen.slideshowOrder ?? undefined,
          showCaptions: photoScreen.showCaptions,
        };

        // Determine the order - photo screens should come after other screens
        // We'll assign orders starting after the highest existing order
        const maxExistingOrder = nonPhotoScreens.length > 0
          ? Math.max(...nonPhotoScreens.map(s => s.order))
          : -1;

        return {
          type: 'photoGallery' as const,
          enabled: true, // Photo screens are always enabled when they exist
          order: maxExistingOrder + 1 + index,
          settings,
        };
      });

      // Combine all screens
      config = {
        ...config,
        screens: [...nonPhotoScreens, ...photoGalleryScreens],
      };
    }

    return config;
  }
}
