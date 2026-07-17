"use client";

// 地圖找房主畫面：Leaflet 地圖 + 篩選列 + 地址成交歷史側欄

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
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
  TAICHUNG_DISTRICTS,
  BUILDING_TYPES,
} from "@/lib/types";
import CommunitySearch from "./CommunitySearch";
import { floorLabel } from "@/lib/floors";

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

function MapEvents({ onMoveEnd }: { onMoveEnd: (map: LeafletMap) => void }) {
  const map = useMapEvents({
    moveend: () => onMoveEnd(map),
  });
  return null;
}

export default function TransactionMap() {
  const [points, setPoints] = useState<TransactionPoint[]>([]);
  const [communities, setCommunities] = useState<CommunityMapHit[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [detail, setDetail] = useState<AddressDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);

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
          <MapEvents onMoveEnd={loadPoints} />
          {points.map((p) => (
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
        </MapContainer>

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
