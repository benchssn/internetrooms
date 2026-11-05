import { useEffect, useState } from "react";
import {
  isAssetStoreAvailable,
  listAssets,
  subscribeToAssets,
  type AssetSummary,
} from "../storage/assetStore";

export interface AssetListState {
  available: boolean;
  assets: AssetSummary[];
  loading: boolean;
}

/** Live list of uploaded images in IndexedDB. */
export function useAssetList(): AssetListState {
  const available = isAssetStoreAvailable();
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [loading, setLoading] = useState(available);

  useEffect(() => {
    if (!available) return;
    let cancelled = false;
    const refresh = () => {
      listAssets()
        .then((list) => {
          if (!cancelled) setAssets(list);
        })
        .catch(() => {
          if (!cancelled) setAssets([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    refresh();
    const unsubscribe = subscribeToAssets(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [available]);

  return { available, assets, loading };
}
