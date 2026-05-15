"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink, TrendingDown, TrendingUp, Minus } from "lucide-react";

export interface PriceRow {
  product: string;
  type: string;
  storage: string;
  shop: string;
  price: string | null;
  link: string | null;
  category: string;
  priceChange: string;
  scrapeError?: string | null;
}

interface GroupedProduct {
  product: string;
  type: string;
  storage: string;
  category: string;
  shops: Record<string, { price: string | null; link: string | null; priceChange: string; scrapeError?: string | null }>;
}

const IPHONE_SHOPS = ["Asmart", "Di Động Xanh", "Click Buy", "Chung Mobile"];
const ANDROID_SHOPS = ["Asmart", "Mobile City", "Click Buy", "Alo Việt"];

function groupRows(rows: PriceRow[], category: string): GroupedProduct[] {
  const shops = category === "iPhone" ? IPHONE_SHOPS : ANDROID_SHOPS;
  const map = new Map<string, GroupedProduct>();

  for (const row of rows) {
    if (row.category !== category) continue;
    const key = `${row.product}|${row.type}|${row.storage}`;
    if (!map.has(key)) {
      map.set(key, {
        product: row.product,
        type: row.type,
        storage: row.storage,
        category: row.category,
        shops: Object.fromEntries(shops.map((s) => [s, { price: null, link: null, priceChange: "", scrapeError: null }])),
      });
    }
    const g = map.get(key)!;
    g.shops[row.shop] = { price: row.price, link: row.link, priceChange: row.priceChange, scrapeError: row.scrapeError ?? null };
  }

  return Array.from(map.values());
}

function findCheapest(shops: GroupedProduct["shops"]): string | null {
  let min: number | null = null;
  let minShop: string | null = null;
  for (const [shop, { price }] of Object.entries(shops)) {
    if (!price) continue;
    const num = parseInt(price.replace(/\./g, ""), 10);
    if (min === null || num < min) {
      min = num;
      minShop = shop;
    }
  }
  return minShop;
}

function PriceCell({
  price,
  link,
  priceChange,
  isCheapest,
  scrapeError,
}: {
  price: string | null;
  link: string | null;
  priceChange: string;
  isCheapest: boolean;
  scrapeError?: string | null;
}) {
  if (!price && !link) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        {isCheapest && price && (
          <Badge variant="default" className="text-xs px-1 py-0 bg-green-600 hover:bg-green-600">
            Rẻ nhất
          </Badge>
        )}
        {price ? (
          <span className={`font-medium text-sm ${isCheapest ? "text-green-700" : ""}`}>
            {price}đ
          </span>
        ) : (
          <Badge
            variant="destructive"
            className="text-[10px] px-1 py-0"
            title={scrapeError ?? "Không cào được giá"}
          >
            Lỗi cào
          </Badge>
        )}
        {priceChange === "up" && <TrendingUp className="w-3 h-3 text-red-500" />}
        {priceChange === "down" && <TrendingDown className="w-3 h-3 text-green-500" />}
        {priceChange === "same" && <Minus className="w-3 h-3 text-gray-400" />}
      </div>
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:underline flex items-center gap-0.5"
        >
          Xem sản phẩm <ExternalLink className="w-2.5 h-2.5" />
        </a>
      )}
    </div>
  );
}

function ProductTable({
  rows,
  category,
}: {
  rows: PriceRow[];
  category: "iPhone" | "Android";
}) {
  const shops = category === "iPhone" ? IPHONE_SHOPS : ANDROID_SHOPS;
  const grouped = groupRows(rows, category);

  if (grouped.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-4 text-center">
        Chưa có dữ liệu — bấm &quot;Cào giá&quot; để bắt đầu.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-36">Sản phẩm</TableHead>
            <TableHead className="w-24">Loại</TableHead>
            <TableHead className="w-24">Bộ nhớ</TableHead>
            {shops.map((s) => (
              <TableHead key={s} className="min-w-36">
                {s}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {grouped.map((g) => {
            const cheapestShop = findCheapest(g.shops);
            return (
              <TableRow key={`${g.product}-${g.type}-${g.storage}`}>
                <TableCell className="font-medium">{g.product}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {g.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{g.storage}</TableCell>
                {shops.map((shop) => (
                  <TableCell key={shop}>
                    <PriceCell
                      price={g.shops[shop]?.price ?? null}
                      link={g.shops[shop]?.link ?? null}
                      priceChange={g.shops[shop]?.priceChange ?? ""}
                      isCheapest={cheapestShop === shop && !!g.shops[shop]?.price}
                      scrapeError={g.shops[shop]?.scrapeError ?? null}
                    />
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function PriceTable({
  rows,
  filter,
  search,
}: {
  rows: PriceRow[];
  filter: "iPhone" | "Android";
  search: string;
}) {
  const filtered = rows.filter((r) => {
    if (r.category !== filter) return false;
    if (search && !r.product.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          {filter === "iPhone" ? "🍎 iPhone" : "🤖 Android"}
        </h2>
        <ProductTable rows={filtered} category={filter} />
      </section>
    </div>
  );
}
