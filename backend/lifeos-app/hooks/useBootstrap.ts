// /hooks/useBootstrap.ts

import { useCallback, useState } from "react";
import { BASE_URL } from "../constants/config";

export function useBootstrap() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchBootstrap() {
    try {
      const res = await fetch(`${BASE_URL}/assistant/bootstrap`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.log("Bootstrap error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    await fetchBootstrap();
    setRefreshing(false);
  }

  return {
    data,
    loading,
    refreshing,
    refresh,
    fetchBootstrap,
  };
}
