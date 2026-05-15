"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import type { PriceRow } from "./PriceTable";

interface Props {
  onComplete: (rows: PriceRow[], timestamp: string) => void;
}

export function ScrapeButton({ onComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");

  async function handleScrape() {
    setLoading(true);
    setProgress("Đang cào giá...");

    try {
      const res = await fetch("/api/scrape", { method: "POST" });
      const json = await res.json();

      if (json.ok) {
        setProgress(`Xong! Cào được ${json.count} giá.`);
        const rows: PriceRow[] = (json.data ?? []).map((d: {
          product: string;
          type: string;
          storage: string;
          shop: string;
          price: string | null;
          link: string | null;
          category: string;
          priceChange: string;
          scrapeError?: string | null;
        }) => ({
          product: d.product,
          type: d.type,
          storage: d.storage,
          shop: d.shop,
          price: d.price,
          link: d.link,
          category: d.category,
          priceChange: d.priceChange,
          scrapeError: d.scrapeError ?? null,
        }));
        onComplete(rows, json.timestamp);
      } else {
        setProgress(`Lỗi: ${json.error}`);
      }
    } catch (err) {
      setProgress(`Lỗi kết nối: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={handleScrape} disabled={loading} size="default">
        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Đang cào..." : "Cào giá ngay"}
      </Button>
      {progress && (
        <span className="text-sm text-muted-foreground">{progress}</span>
      )}
    </div>
  );
}
