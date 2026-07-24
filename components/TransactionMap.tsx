"use client";

// 地圖找房主畫面：Leaflet 地圖 + 篩選列 + 地址成交歷史側欄

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  Circle,
  Popup,
  Tooltip,
  useMapEvents,
} from "react-leaflet";
import L, { type Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  type TransactionPoint,
  type AddressDetail,
  type CommunityMapHit,
  type AreaStatsResult,
  TAICHUNG_DISTRICTS,
  BUILDING_TYPES,
} from "@/lib/types";
import CommunitySearch from "./CommunitySearch";
import { floorLabel } from "@/lib/floors";
import { TAICHUNG_AREAS, matchArea, distanceKm } from "@/lib/areas";

// 台中車站附近作為初始中心
const INITIAL_CENTER: [number, number] = [24.1439, 120.6794];
const INITIAL_ZOOM = 14;

// 社區圖示顯示的最小縮放層級（太遠會滿版圖示蓋住點位）
const COMMUNITY_MIN_ZOOM = 15;

const buildingIcon = L.divIcon({
  html: '<div style="font-size:20px;line-height:20px;filter:drop-shadow(0 1px 1px rgba(0,0,0,.35))">🏢</div>',
  className: "",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

interface Filters {
  district: string;
  buildingType: string;
  priceMin: string; // 萬元
  priceMax: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: Filters = {
  district: "",
  buildingType: "",
  priceMin: "",
  priceMax: "",
  dateFrom: "",
  dateTo: "",
};

/** 每坪單價 → 標記顏色（綠=低、橘=中、紅=高） */
function priceColor(unitPricePerPing: number | null): string {
  if (!unitPricePerPing) return "#94a3b8";
  const wan = unitPricePerPing / 10000;
  if (wan < 15) return "#22c55e";
  if (wan < 25) return "#eab308";
  if (wan < 35) return "#f97316";
  return "#ef4444";
}

function formatWan(price: number): string {
  return `${Math.round(price / 10000).toLocaleString()} 萬`;
}

function MapEvents({ onMoveEnd, onZoom }: { onMoveEnd: (map: LeafletMap) => void; onZoom: (z: number) => void }) {
  const map = useMapEvents({
    moveend: () => onMoveEnd(map),
    zoomend: () => onZoom(map.getZoom()),
  });
  return null;
}

export default function TransactionMap() {
  const [points, setPoints] = useState<TransactionPoint[]>([]);
  const [communities, setCommunities] = useState<CommunityMapHit[]>([]);
  const [highlightedArea, setHighlightedArea] = useState<null | (typeof TAICHUNG_AREAS)[number]>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [detail, setDetail] = useState<AddressDetail | null>(null);
  const [areaStats, setAreaStats] = useState<AreaStatsResult | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);
  const [prevView, setPrevView] = useState<null | { lat: number; lng: number; zoom: number }>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(INITIAL_ZOOM);
  const [showAreas, setShowAreas] = useState<boolean>(true);
  const [mapReady, setMapReady] = useState(false);
  const filteredCommunities = communities.filter((c) => {
    if (!highlightedArea) return true;
    if (c.latitude === null || c.longitude === null) return false;
    return distanceKm(c.latitude, c.longitude, highlightedArea.latitude, highlightedArea.longitude) <= highlightedArea.radiusKm;
  });

  const loadPoints = useCallback(async (map: LeafletMap) => {
    const b = map.getBounds();
    const bbox = `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;
    const f = filters;
    const params = new URLSearchParams({ bbox });
    if (f.district) params.set("district", f.district);
    if (f.buildingType) params.set("buildingType", f.buildingType);
    if (f.priceMin) params.set("priceMin", f.priceMin);
    if (f.priceMax) params.set("priceMax", f.priceMax);
    if (f.dateFrom) params.set("dateFrom", f.dateFrom);
    if (f.dateTo) params.set("dateTo", f.dateTo);

    setLoading(true);
    try {
      // 社區圖示只在中高縮放層級載入，避免遠距離滿版圖示
      const communityReq =
        map.getZoom() >= COMMUNITY_MIN_ZOOM
          ? fetch(`/api/communities/map?bbox=${bbox}`)
          : null;
      const res = await fetch(`/api/transactions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPoints(data.points);
      }
      if (communityReq) {
        const cres = await communityReq;
        if (cres.ok) setCommunities((await cres.json()).communities);
      } else {
        setCommunities([]);
      }
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // 篩選條件變更時重新載入目前視野
  useEffect(() => {
    if (mapRef.current) loadPoints(mapRef.current);
  }, [loadPoints]);

  const openAddress = useCallback(async (normalizedAddress: string | null) => {
    if (!normalizedAddress) return;
    const res = await fetch(`/api/address?q=${encodeURIComponent(normalizedAddress)}`);
    if (res.ok) setDetail(await res.json());
  }, []);

  // 點擊生活圈後放大並高亮範圍（並記錄先前視角）
  const openArea = useCallback((area: (typeof TAICHUNG_AREAS)[number]) => {
    if (!mapRef.current) return;
    const z = mapRef.current.getZoom();
    const c = mapRef.current.getCenter();
    setPrevView({ lat: c.lat, lng: c.lng, zoom: z });
    mapRef.current.setView([area.latitude, area.longitude], 17);
    setHighlightedArea(area);
  }, []);

  const clearHighlightedArea = useCallback(() => {
    if (prevView && mapRef.current) {
      mapRef.current.setView([prevView.lat, prevView.lng], prevView.zoom);
    }
    setHighlightedArea(null);
    setPrevView(null);
  }, [prevView]);

  useEffect(() => {
    if (!highlightedArea) {
      setAreaStats(null);
      setStatsError(null);
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;

    setStatsLoading(true);
    setStatsError(null);

    fetch(`/api/areas/stats?area=${encodeURIComponent(highlightedArea.name)}`, { signal })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setAreaStats(data);
      })
      .catch((err) => {
        if (!signal.aborted) {
          setStatsError(err?.message ?? "取得資料失敗");
        }
      })
      .finally(() => {
        if (!signal.aborted) setStatsLoading(false);
      });

    return () => controller.abort();
  }, [highlightedArea]);

  // Add a Leaflet control with "回行政區" and show/hide areas toggle
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const container = L.DomUtil.create("div", "leaflet-bar");
    container.style.display = "flex";
    container.style.gap = "8px";
    container.style.padding = "6px";

    const btnBack = L.DomUtil.create("button", "", container) as HTMLButtonElement;
    btnBack.title = "回行政區";
    btnBack.innerHTML = "🔙";
    btnBack.style.background = "#f59e0b";
    btnBack.style.color = "white";
    btnBack.style.border = "none";
    btnBack.style.padding = "6px 8px";
    btnBack.style.borderRadius = "8px";
    btnBack.onclick = (e) => {
      e.preventDefault();
      clearHighlightedArea();
    };

    const btnToggle = L.DomUtil.create("button", "", container) as HTMLButtonElement;
    btnToggle.title = "顯示/隱藏生活圈";
    btnToggle.style.background = "white";
    btnToggle.style.border = "1px solid #e5e7eb";
    btnToggle.style.padding = "6px 8px";
    btnToggle.style.borderRadius = "8px";
    btnToggle.onclick = (e) => {
      e.preventDefault();
      setShowAreas((s) => !s);
    };

    const CustomControl = (L.Control as any).extend({
      options: { position: "topright" },
      onAdd: function () {
        return container;
      },
    });

    const controlInstance = new CustomControl();
    map.addControl(controlInstance);
    setMapReady(true);

    return () => {
      map.removeControl(controlInstance);
    };
  }, [clearHighlightedArea]);

  useEffect(() => {
    if (!mapReady) return;
    const button = mapRef.current?.getContainer().querySelector('button[title="顯示/隱藏生活圈"]');
    if (button) {
      button.textContent = showAreas ? "隱藏生活圈" : "顯示生活圈";
    }
  }, [showAreas, mapReady]);

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="flex h-screen flex-col">
      {/* 篩選列 */}
      <header className="z-[1000] flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 text-sm shadow-sm">
        <span className="mr-2 text-base font-bold text-slate-800">
          hometool <span className="font-normal text-slate-400">台中實價地圖</span>
        </span>
        <CommunitySearch
          onArea={(lat, lng) => mapRef.current?.setView([lat, lng], 15)}
        />
        <select
          className="rounded border border-slate-300 px-2 py-1"
          value={filters.district}
          onChange={(e) => set({ district: e.target.value })}
        >
          <option value="">全部行政區</option>
          {TAICHUNG_DISTRICTS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select
          className="rounded border border-slate-300 px-2 py-1"
          value={filters.buildingType}
          onChange={(e) => set({ buildingType: e.target.value })}
        >
          <option value="">全部類型</option>
          {BUILDING_TYPES.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
        <span className="flex items-center gap-1">
          總價
          <input
            type="number"
            placeholder="下限"
            className="w-20 rounded border border-slate-300 px-2 py-1"
            value={filters.priceMin}
            onChange={(e) => set({ priceMin: e.target.value })}
          />
          ~
          <input
            type="number"
            placeholder="上限"
            className="w-20 rounded border border-slate-300 px-2 py-1"
            value={filters.priceMax}
            onChange={(e) => set({ priceMax: e.target.value })}
          />
          萬
        </span>
        <span className="flex items-center gap-1">
          成交日
          <input
            type="date"
            className="rounded border border-slate-300 px-2 py-1"
            value={filters.dateFrom}
            onChange={(e) => set({ dateFrom: e.target.value })}
          />
          ~
          <input
            type="date"
            className="rounded border border-slate-300 px-2 py-1"
            value={filters.dateTo}
            onChange={(e) => set({ dateTo: e.target.value })}
          />
        </span>
        <span className="ml-auto text-slate-500">
          {loading ? "載入中…" : `顯示 ${points.length} 筆`}
        </span>
      </header>

      <div className="relative flex-1">
        <MapContainer
          center={INITIAL_CENTER}
          zoom={INITIAL_ZOOM}
          className="h-full w-full"
          ref={(m) => {
            if (m && !mapRef.current) {
              mapRef.current = m;
              loadPoints(m);
            }
          }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapEvents onMoveEnd={loadPoints} onZoom={(z) => setCurrentZoom(z)} />
          {/* 生活圈（例如：勤美 / 草悟道）標記 - 可點擊放大並高亮；僅在高縮放或與行政區過濾相容時顯示 */}
          {(showAreas && (mapRef.current ? currentZoom >= COMMUNITY_MIN_ZOOM : true)) &&
            TAICHUNG_AREAS.filter((a) => {
              if (!filters.district) return true;
              // 若 area 含 district 屬性則比對，否則視為可顯示
              // @ts-ignore
              return (a as any).district ? (a as any).district === filters.district : true;
            }).map((a) => (
              <Marker
                key={a.name}
                position={[a.latitude, a.longitude]}
                icon={L.divIcon({
                  html: `<div style="font-size:12px;padding:4px 6px;background:#fff;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,.2);font-weight:600">${a.name}</div>`,
                  className: "",
                  iconSize: [120, 24],
                  iconAnchor: [60, 12],
                })}
                eventHandlers={{ click: () => openArea(a) }}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  <div className="text-xs">{a.name}</div>
                </Tooltip>
              </Marker>
            ))}
          {points
            .filter((p) => {
              if (!highlightedArea) return true;
              return distanceKm(p.latitude, p.longitude, highlightedArea.latitude, highlightedArea.longitude) <= highlightedArea.radiusKm;
            })
            .map((p) => (
            <CircleMarker
              key={p.serialNo}
              center={[p.latitude, p.longitude]}
              radius={7}
              pathOptions={{
                color: "#ffffff",
                weight: 1.5,
                fillColor: priceColor(p.unitPricePerPing),
                fillOpacity: 0.85,
              }}
              eventHandlers={{ click: () => openAddress(p.normalizedAddress) }}
            >
              <Tooltip>
                <div className="text-xs">
                  <div className="font-bold">{p.address}</div>
                  <div>
                    {p.transactionDate.slice(0, 10)}｜{p.buildingType ?? "—"}
                  </div>
                  <div>
                    {formatWan(p.totalPrice)}
                    {p.unitPricePerPing
                      ? `｜${(p.unitPricePerPing / 10000).toFixed(1)} 萬/坪`
                      : ""}
                    {p.areaPing ? `｜${p.areaPing} 坪` : ""}
                  </div>
                </div>
              </Tooltip>
            </CircleMarker>
          ))}
          {/* 社區建築物圖示（點擊出摘要卡） */}
          {communities
            .filter((c) => c.latitude !== null && c.longitude !== null)
            .filter((c) => {
              if (!highlightedArea) return true;
              return distanceKm(c.latitude!, c.longitude!, highlightedArea.latitude, highlightedArea.longitude) <= highlightedArea.radiusKm;
            })
            .map((c) => (
              <Marker
                key={c.id}
                position={[c.latitude!, c.longitude!]}
                icon={buildingIcon}
              >
                <Popup>
                  <div className="text-xs" style={{ minWidth: 150 }}>
                    <div className="text-sm font-bold text-slate-800">
                      {c.name}
                      <span className="ml-1 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-normal text-slate-500">
                        {c.source === "address" ? "中古" : "預售"}
                      </span>
                    </div>
                    <div className="mt-0.5 text-slate-500">
                      {c.district}
                      {c.households ? `｜${c.households} 戶` : ""}
                    </div>
                    <div className="mt-0.5 text-slate-700">
                      {c.txCount} 筆
                      {c.avgUnitPricePerPing
                        ? `｜${(c.avgUnitPricePerPing / 10000).toFixed(1)} 萬/坪`
                        : ""}
                    </div>
                    <a
                      href={`/community/${c.id}`}
                      className="mt-1 inline-block font-medium text-blue-600 hover:underline"
                    >
                      社區分析 →
                    </a>
                  </div>
                </Popup>
              </Marker>
            ))}

          {/* 高亮圓（選定生活圈） */}
          {highlightedArea && (
            <Circle
              center={[highlightedArea.latitude, highlightedArea.longitude]}
              radius={highlightedArea.radiusKm * 1000}
              pathOptions={{ color: "#f59e0b", weight: 3, fillColor: "#fef3c7", fillOpacity: 0.35 }}
            />
          )}
        </MapContainer>

        {/* 地圖控制按鈕（由 Leaflet control 提供） */}

        {/* 圖例 */}
        <div className="absolute bottom-4 left-4 z-[1000] rounded bg-white/95 px-3 py-2 text-xs shadow">
          <div className="mb-1 font-bold text-slate-700">每坪單價</div>
          {[
            ["#22c55e", "15 萬以下"],
            ["#eab308", "15 ~ 25 萬"],
            ["#f97316", "25 ~ 35 萬"],
            ["#ef4444", "35 萬以上"],
            ["#94a3b8", "無單價資料"],
          ].map(([color, label]) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              {label}
            </div>
          ))}
        </div>

        {/* 圈內社區清單（點擊生活圈後顯示） */}
        {highlightedArea && (
          <aside className="absolute left-4 top-28 z-[1100] w-80 max-w-[85vw] rounded bg-white shadow p-3 space-y-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800">{highlightedArea.name}</div>
                <div className="text-xs text-slate-500">生活圈半徑 {highlightedArea.radiusKm} km</div>
              </div>
              <button className="text-sm text-slate-500" onClick={clearHighlightedArea}>關閉</button>
            </div>

            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
              {statsLoading ? (
                <div className="text-slate-500">載入生活圈統計...</div>
              ) : statsError ? (
                <div className="text-sm text-rose-600">{statsError}</div>
              ) : areaStats ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div className="rounded bg-white p-2 shadow-sm">
                      <div className="font-bold text-slate-800">{areaStats.stats.txCount ?? 0}</div>
                      <div>交易筆數</div>
                    </div>
                    <div className="rounded bg-white p-2 shadow-sm">
                      <div className="font-bold text-slate-800">{areaStats.communityCount}</div>
                      <div>社區家數</div>
                    </div>
                    <div className="rounded bg-white p-2 shadow-sm">
                      <div className="font-bold text-slate-800">{areaStats.stats.avgUnitPricePerPing ? `${(areaStats.stats.avgUnitPricePerPing / 10000).toFixed(1)} 萬` : '—'}</div>
                      <div>平均每坪</div>
                    </div>
                    <div className="rounded bg-white p-2 shadow-sm">
                      <div className="font-bold text-slate-800">{areaStats.stats.medianTotalPrice ? `${Math.round(areaStats.stats.medianTotalPrice / 10000).toLocaleString()} 萬` : '—'}</div>
                      <div>中位總價</div>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="font-semibold text-slate-700">價格趨勢</div>
                    <div className="space-y-1">
                      {(() => {
                        const maxValue = Math.max(
                          1,
                          ...areaStats.series.map((row) => row.avgUnitPricePerPing ?? 0)
                        );
                        return areaStats.series.slice(-8).map((row) => (
                          <div key={row.month} className="flex items-center gap-2">
                            <div className="w-14 text-slate-600">{row.month}</div>
                            <div className="h-3 flex-1 rounded bg-slate-200">
                              <div
                                className="h-3 rounded bg-amber-500"
                                style={{ width: `${Math.min(100, ((row.avgUnitPricePerPing ?? 0) / maxValue) * 100)}%` }}
                              />
                            </div>
                            <div className="w-16 text-right text-slate-700">
                              {row.avgUnitPricePerPing ? `${(row.avgUnitPricePerPing / 10000).toFixed(1)}w` : '—'}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <div className="rounded bg-white p-2 shadow-sm">
                      <div className="font-semibold text-slate-700">1 年平均</div>
                      <div>{areaStats.compare.avg1y ? `${(areaStats.compare.avg1y / 10000).toFixed(1)} 萬` : '—'}</div>
                      <div className="text-slate-400">{areaStats.compare.cnt1y ?? 0} 筆</div>
                    </div>
                    <div className="rounded bg-white p-2 shadow-sm">
                      <div className="font-semibold text-slate-700">5 年平均</div>
                      <div>{areaStats.compare.avg5y ? `${(areaStats.compare.avg5y / 10000).toFixed(1)} 萬` : '—'}</div>
                      <div className="text-slate-400">{areaStats.compare.cnt5y ?? 0} 筆</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-slate-500">尚無生活圈統計資料。</div>
              )}
            </div>

            <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto">
              {filteredCommunities.length === 0 && (
                <div className="text-sm text-slate-500">圈內無社區或資料尚未載入。</div>
              )}
              {filteredCommunities.map((c) => (
                <a key={c.id} href={`/community/${c.id}`} className="flex items-center justify-between rounded border p-2 hover:bg-slate-50">
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-sm text-slate-600">
                    {c.avgUnitPricePerPing ? `${(c.avgUnitPricePerPing / 10000).toFixed(1)} 萬/坪` : "—"}
                  </div>
                </a>
              ))}
            </div>
          </aside>
        )}

        {/* 地址成交歷史側欄 */}
        {detail && (
          <aside className="absolute right-0 top-0 z-[1000] flex h-full w-96 max-w-full flex-col border-l border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-200 p-4">
              <div>
                <h2 className="font-bold text-slate-800">{detail.address}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  共 {detail.count} 筆成交
                  {detail.avgUnitPricePerPing
                    ? `｜平均 ${(detail.avgUnitPricePerPing / 10000).toFixed(1)} 萬/坪`
                    : ""}
                </p>
              </div>
              <button
                className="rounded px-2 py-1 text-slate-400 hover:bg-slate-100"
                onClick={() => setDetail(null)}
              >
                ✕
              </button>
            </div>
            <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
              {detail.transactions.map((t) => (
                <li key={t.serialNo} className="p-4 text-sm">
                  <div className="flex justify-between font-medium text-slate-800">
                    <span>{t.transactionDate.slice(0, 10)}</span>
                    <span>{formatWan(t.totalPrice)}</span>
                  </div>
                  <div className="mt-1 text-slate-500">
                    {t.buildingType ?? "—"}
                    {t.floor ? `｜${floorLabel(t.floor)}/${t.totalFloors ?? "?"}F` : ""}
                    {t.areaPing ? `｜${t.areaPing} 坪` : ""}
                    {t.unitPricePerPing
                      ? `｜${(t.unitPricePerPing / 10000).toFixed(1)} 萬/坪`
                      : ""}
                  </div>
                  <div className="mt-1 text-slate-500">
                    {[t.rooms, t.halls, t.baths].every((v) => v === null)
                      ? ""
                      : `${t.rooms ?? 0}房${t.halls ?? 0}廳${t.baths ?? 0}衛`}
                    {t.parkingType ? `｜車位：${t.parkingType}` : ""}
                  </div>
                  {t.note && (
                    <div className="mt-1 text-xs text-amber-600">{t.note}</div>
                  )}
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
