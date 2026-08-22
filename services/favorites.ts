import { supabase } from '@/utils/supabase';

/**
 * Fetch all favorite listing IDs for a user.
 */
export async function fetchUserFavoriteIds(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('listing_id')
      .eq('user_id', userId);

    if (error) {
      console.error('[fetchUserFavoriteIds] error:', error);
      return [];
    }

    return (data || []).map((item: { listing_id: string }) => item.listing_id);
  } catch (err) {
    console.error('[fetchUserFavoriteIds] unexpected error:', err);
    return [];
  }
}

/**
 * Toggle a listing favorite state for a user.
 * Returns true if the item is now favorited, false if unfavorited.
 */
export async function toggleFavoriteListing(
  userId: string,
  listingId: string,
  currentlyFavorited: boolean
): Promise<boolean> {
  try {
    if (currentlyFavorited) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('listing_id', listingId);

      if (error) {
        console.error('[toggleFavoriteListing] delete error:', error);
        throw error;
      }
      return false;
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: userId, listing_id: listingId });

      if (error) {
        console.error('[toggleFavoriteListing] insert error:', error);
        throw error;
      }
      return true;
    }
  } catch (err) {
    console.error('[toggleFavoriteListing] unexpected error:', err);
    return currentlyFavorited;
  }
}
