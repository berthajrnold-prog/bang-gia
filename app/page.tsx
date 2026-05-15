"use client";

import { useState, useMemo, useEffect } from "react";
import { PriceTable, type PriceRow } from "@/components/PriceTable";
import { ScrapeButton } from "@/components/ScrapeButton";
import { FilterDropdown } from "@/components/FilterDropdown";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type FilterType = "iPhone" | "Android";

const STORAGE_KEY = "bang-gia:last-scrape";

interface PersistedState {
  rows: PriceRow[];
  timestamp: string;
}

// Sort storage values naturally: 64GB < 128GB < 256GB < 512GB < 1TB
function sortStorage(a: string, b: string): number {
  const parse = (s: string) => {
    const m = s.match(/^(\d+(?:\.\d+)?)\s*(GB|TB)?/i);
    if (!m) return 0;
    const n = parseFloat(m[1]);
    return m[2]?.toUpperCase() === "TB" ? n * 1024 : n;
  };
  return parse(a) - parse(b);
}

export default function HomePage() {
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [lastScrape, setLastScrape] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("iPhone");
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [storageFilter, setStorageFilter] = useState<string[]>([]);

  // Hydrate from localStorage first (fast), then fetch latest from server (cross-device)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedState;
        if (parsed.rows && parsed.timestamp) {
          setRows(parsed.rows);
          setLastScrape(parsed.timestamp);
        }
      }
    } catch {
      // ignore corrupted localStorage
    }

    // Fetch server cache to share data across devices
    fetch("/api/latest")
      .then((r) => r.json())
      .then((data: { rows?: PriceRow[]; timestamp?: string }) => {
        const serverRows = data.rows;
        const serverTs = data.timestamp;
        if (serverRows && serverRows.length > 0 && serverTs) {
          setLastScrape((prev) => {
            const isNewer = !prev || new Date(serverTs).getTime() > new Date(prev).getTime();
            if (isNewer) {
              setRows(serverRows);
              try {
                localStorage.setItem(
                  STORAGE_KEY,
                  JSON.stringify({ rows: serverRows, timestamp: serverTs } satisfies PersistedState)
                );
              } catch {}
              return serverTs;
            }
            return prev;
          });
        }
      })
      .catch(() => {
        // ignore — fall back to localStorage only
      });
  }, []);

  function handleScrapeComplete(newRows: PriceRow[], timestamp: string) {
    setRows(newRows);
    setLastScrape(timestamp);
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ rows: newRows, timestamp } satisfies PersistedState)
      );
    } catch {
      // localStorage might be disabled or full — silently ignore
    }
  }

  // Compute available options from current category
  const { products, types, storages } = useMemo(() => {
    const inCategory = rows.filter((r) => r.category === filter);
    const productSet = new Set<string>();
    const typeSet = new Set<string>();
    const storageSet = new Set<string>();
    for (const r of inCategory) {
      if (r.product) productSet.add(r.product);
      if (r.type) typeSet.add(r.type);
      if (r.storage) storageSet.add(r.storage);
    }
    return {
      products: Array.from(productSet).sort(),
      types: Array.from(typeSet).sort(),
      storages: Array.from(storageSet).sort(sortStorage),
    };
  }, [rows, filter]);

  // Apply all filters
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (r.category !== filter) return false;
      if (search && !r.product.toLowerCase().includes(search.toLowerCase())) return false;
      if (productFilter.length > 0 && !productFilter.includes(r.product)) return false;
      if (typeFilter.length > 0 && !typeFilter.includes(r.type)) return false;
      if (storageFilter.length > 0 && !storageFilter.includes(r.storage)) return false;
      return true;
    });
  }, [rows, filter, search, productFilter, typeFilter, storageFilter]);

  function clearAllFilters() {
    setSearch("");
    setProductFilter([]);
    setTypeFilter([]);
    setStorageFilter([]);
  }

  const hasActiveFilters =
    search.length > 0 ||
    productFilter.length > 0 ||
    typeFilter.length > 0 ||
    storageFilter.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bảng giá điện thoại</h1>
            {lastScrape && (
              <p className="text-sm text-muted-foreground mt-1">
                Cào lần cuối:{" "}
                {new Date(lastScrape).toLocaleString("vi-VN", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
            )}
          </div>
          <ScrapeButton onComplete={handleScrapeComplete} />
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-md border p-1">
            {(["iPhone", "Android"] as FilterType[]).map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setFilter(f);
                  // Clear filters when switching category since options differ
                  setProductFilter([]);
                  setTypeFilter([]);
                  setStorageFilter([]);
                }}
                className="text-sm"
              >
                {f}
              </Button>
            ))}
          </div>
          <Input
            placeholder="Tìm sản phẩm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-56"
          />
        </div>

        {/* Attribute filters */}
        {rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown
              label="Sản phẩm"
              options={products}
              selected={productFilter}
              onChange={setProductFilter}
            />
            <FilterDropdown
              label="Loại"
              options={types}
              selected={typeFilter}
              onChange={setTypeFilter}
            />
            <FilterDropdown
              label="Dung lượng"
              options={storages}
              selected={storageFilter}
              onChange={setStorageFilter}
            />
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-xs h-9 text-muted-foreground hover:text-foreground"
              >
                Xóa tất cả lọc
              </Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {filteredRows.length} kết quả
            </span>
          </div>
        )}

        {/* Legend */}
        {rows.length > 0 && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="text-red-500">↑</span> Giá tăng
            </span>
            <span className="flex items-center gap-1">
              <span className="text-green-500">↓</span> Giá giảm
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-sm bg-green-600 text-white text-[9px] font-bold">R</span>{" "}
              Rẻ nhất trong hàng
            </span>
          </div>
        )}

        {/* Price table */}
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <p className="text-lg font-medium">Chưa có dữ liệu giá</p>
            <p className="text-sm mt-1">Bấm &quot;Cào giá ngay&quot; để lấy giá từ các cửa hàng.</p>
          </div>
        ) : (
          <PriceTable rows={filteredRows} filter={filter} search="" />
        )}
      </div>
    </div>
  );
}
