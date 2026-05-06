import { useEffect, useState, useCallback, useMemo, useRef, ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import {
    MapContainer,
    TileLayer,
    useMap,
    Marker,
    Popup,
    useMapEvents,
    Polyline,
    CircleMarker,
    Polygon,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
    FaPlus,
    FaMinus,
    FaXmark,
    FaLayerGroup,
    FaCity,
    FaAnchor,
    FaLocationArrow,
} from 'react-icons/fa6';
import L from 'leaflet';
import axios from 'axios';
import portsData from '../../data/ports.json';
import countriesData from '../../data/countries.json';
import citiesData from '../../data/cities.json';
import { HistoryPosition } from '../Pages/Index';
import { API_BASE_URL, OFFLINE_THRESHOLD_MINUTES } from '../constants';
import { formatShortDate } from '../utils';
import LayerControl from './LayerControl';

const defaultIconPrototype = L.Icon.Default.prototype as L.Icon.Default & {
    _getIconUrl?: () => string;
};

delete defaultIconPrototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const MAX_BOUNDS: L.LatLngBoundsExpression = [
    [-90, -180],
    [90, 180],
];

interface Country {
    name: string;
    lat: number;
    lng: number;
    cca2: string;
}

const COUNTRY_NAMES: Record<string, string> = (countriesData as Country[]).reduce(
    (acc, c) => {
        acc[c.cca2] = c.name;
        return acc;
    },
    {} as Record<string, string>
);

export interface Vessel {
    mmsi: number;
    imo?: number;
    name: string;
    lat: number;
    lng: number;
    course: number;
}

interface ClusteredVessel extends Vessel {
    isCluster: boolean;
    clusterCount: number;
    sumLat: number;
    sumLng: number;
}

const IGNORED_VESSEL_NAMES = ['--'];

function normalizeVessels(raw: Vessel[]): Vessel[] {
    // Deduplicate by MMSI, preferring records with a usable name over placeholder names like "--"
    const byMmsi = new Map<number, Vessel>();

    for (const vessel of raw) {
        const mmsi = Number(vessel.mmsi);
        const trimmedName = (vessel.name || '').trim().toUpperCase();

        if (!trimmedName || IGNORED_VESSEL_NAMES.includes(trimmedName)) {
            continue;
        }

        const existing = byMmsi.get(mmsi);
        if (!existing) {
            byMmsi.set(mmsi, { ...vessel, mmsi });
            continue;
        }

        const existingName = (existing.name || '').trim().toUpperCase();
        const currentName = (vessel.name || '').trim().toUpperCase();
        const existingHasUsefulName =
            existingName.length > 2 && !IGNORED_VESSEL_NAMES.includes(existingName);
        const currentHasUsefulName =
            currentName.length > 2 && !IGNORED_VESSEL_NAMES.includes(currentName);

        if (currentHasUsefulName && !existingHasUsefulName) {
            byMmsi.set(mmsi, { ...vessel, mmsi });
        }
    }

    return Array.from(byMmsi.values());
}

function FleetLayer({
    onUpdate,
    selectedMmsi,
    selectedVessel,
    onVesselSelect,
    onClusterZoomNotice,
    showAll,
    sidebarOpen,
    onIdleChange,
    isToolsOpen = false,
}: {
    onUpdate?: (stats: {
        renderedIcons: number;
        totalRenderedShips: number;
        trackedShips: number;
        trackedVessels: Vessel[];
        currentArea: string;
    }) => void;
    selectedMmsi: number | null;
    selectedVessel?: Vessel | null;
    onVesselSelect?: (vessel: Vessel | null) => void;
    onClusterZoomNotice?: () => void;
    showAll?: boolean;
    sidebarOpen?: boolean;
    onIdleChange?: (isIdle: boolean) => void;
    isToolsOpen?: boolean;
}) {
    const map = useMap();
    const [windowVessels, setWindowVessels] = useState<Vessel[]>([]);
    const [trackedCount, setTrackedCount] = useState(0);
    const [trackedSearchVessels, setTrackedSearchVessels] = useState<Vessel[]>([]);
    const [zoom, setZoom] = useState(map.getZoom());
    const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const trackedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const suppressNextMapClickRef = useRef(false);
    const lastClusterInteractionRef = useRef<{ mmsi: number; at: number } | null>(null);
    const [lastActivity, setLastActivity] = useState(() => Date.now());
    const [isIdle, setIsIdle] = useState(false);
    const IDLE_THRESHOLD = 120000;

    const recordActivity = useCallback(() => {
        setLastActivity(() => Date.now());
        if (isIdle) {
            setIsIdle(false);
            onIdleChange?.(false);
        }
    }, [isIdle, onIdleChange]);

    const fetchWindowVessels = useCallback(
        async (force = false) => {
            if (isIdle && !force) return;

            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            const controller = new AbortController();
            abortControllerRef.current = controller;

            const bounds = map.getBounds();
            const currentZoom = map.getZoom();

            try {
                const response = await axios.get(`${API_BASE_URL}/vessels`, {
                    signal: controller.signal,
                    params: {
                        sw_lat: bounds.getSouthWest().lat,
                        sw_lng: bounds.getSouthWest().lng,
                        ne_lat: bounds.getNorthEast().lat,
                        ne_lng: bounds.getNorthEast().lng,
                        age_minutes: OFFLINE_THRESHOLD_MINUTES,
                    },
                });
                setZoom(currentZoom);
                const data = normalizeVessels(response.data.data || []);
                setWindowVessels(data);
            } catch (error) {
                if (axios.isCancel(error)) return;
                if (axios.isAxiosError(error) && error.response?.status === 404) {
                    setWindowVessels([]);
                    return;
                }
                console.error('Failed to fetch fleet data:', error);
                setWindowVessels([]);
            } finally {
                if (abortControllerRef.current === controller) {
                    abortControllerRef.current = null;
                }
            }
        },
        [map, isIdle]
    );

    const fetchTrackedSearchVessels = useCallback(async () => {
        if (isIdle) return;

        let allVessels: Vessel[] = [];
        let offset = 0;
        let hasMore = true;
        const BATCH_LIMIT = 2500;

        try {
            while (hasMore) {
                const response = await axios.get(`${API_BASE_URL}/vessels`, {
                    params: {
                        age_minutes: OFFLINE_THRESHOLD_MINUTES,
                        offset: offset,
                    },
                });

                const batch = response.data.data || [];
                allVessels = [...allVessels, ...batch];

                if (batch.length < BATCH_LIMIT) {
                    hasMore = false;
                } else {
                    offset += BATCH_LIMIT;
                }

                if (offset >= 100000) break;
            }

            const normalized = normalizeVessels(allVessels);
            setTrackedCount(normalized.length);
            setTrackedSearchVessels(normalized);
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
                if (offset === 0) {
                    setTrackedCount(0);
                    setTrackedSearchVessels([]);
                }
                return;
            }
            console.error('Failed to fetch global fleet:', error);
        }
    }, [isIdle]);

    const debouncedFetch = useCallback(() => {
        // 400ms debounce to batch rapid pan/zoom events
        if (fetchTimer.current) {
            clearTimeout(fetchTimer.current);
        }
        fetchTimer.current = setTimeout(() => {
            fetchWindowVessels();
        }, 400);
    }, [fetchWindowVessels]);

    useMapEvents({
        moveend: () => {
            recordActivity();
            debouncedFetch();
        },
        zoomend: () => {
            recordActivity();
            setZoom(map.getZoom());
            debouncedFetch();
        },
        popupclose: () => {
            suppressNextMapClickRef.current = true;
            setTimeout(() => {
                suppressNextMapClickRef.current = false;
            }, 100);
        },
        click: (e) => {
            recordActivity();
            const target = e.originalEvent?.target as HTMLElement | null;
            if (
                target?.closest(
                    '.leaflet-marker-icon, .leaflet-popup, .leaflet-popup-content, .leaflet-interactive'
                )
            ) {
                return;
            }
            if (suppressNextMapClickRef.current) {
                suppressNextMapClickRef.current = false;
                return;
            }
            if (onVesselSelect) onVesselSelect(null);
        },
        dragstart: recordActivity,
        mousedown: recordActivity,
    });

    useEffect(() => {
        const handleGlobalClick = () => recordActivity();
        window.addEventListener('click', handleGlobalClick, { capture: true });

        const interval = setInterval(() => {
            if (Date.now() - lastActivity > IDLE_THRESHOLD) {
                if (!isIdle) {
                    setIsIdle(true);
                    onIdleChange?.(true);
                }
            }
        }, 5000);

        return () => {
            window.removeEventListener('click', handleGlobalClick, { capture: true });
            clearInterval(interval);
        };
    }, [lastActivity, recordActivity, isIdle, onIdleChange]);

    useEffect(() => {
        const initializeMapData = async () => {
            await fetchWindowVessels(true);
            await fetchTrackedSearchVessels();
        };

        initializeMapData();

        pollTimer.current = setInterval(() => fetchWindowVessels(), 15000);
        trackedTimer.current = setInterval(() => fetchTrackedSearchVessels(), 300000);

        return () => {
            if (fetchTimer.current) clearTimeout(fetchTimer.current);
            if (pollTimer.current) clearInterval(pollTimer.current);
            if (trackedTimer.current) clearInterval(trackedTimer.current);
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, [fetchWindowVessels, fetchTrackedSearchVessels]);

    const visibleVessels = useMemo(() => {
        const filtered: ClusteredVessel[] = [];

        const minDistancePx = zoom < 4 ? 25 : zoom < 9 ? 30 : zoom < 12 ? 25 : zoom < 15 ? 15 : 0;

        if (minDistancePx === 0) {
            return windowVessels.map((v) => ({
                ...v,
                isCluster: false,
                clusterCount: 1,
                sumLat: v.lat,
                sumLng: v.lng,
            }));
        }

        windowVessels.forEach((vessel) => {
            // Skip clustering for the selected vessel so it stays clickable
            if (vessel.mmsi === selectedMmsi) {
                filtered.push({
                    ...vessel,
                    isCluster: false,
                    clusterCount: 1,
                    sumLat: vessel.lat,
                    sumLng: vessel.lng,
                });
                return;
            }

            // Project to screen pixels for proximity check
            const pos = map.latLngToLayerPoint([vessel.lat, vessel.lng]);
            const clusterIndex = filtered.findIndex((f) => {
                const fPos = map.latLngToLayerPoint([f.lat, f.lng]);
                const dist = Math.sqrt(Math.pow(pos.x - fPos.x, 2) + Math.pow(pos.y - fPos.y, 2));
                return dist < minDistancePx;
            });

            if (clusterIndex !== -1) {
                filtered[clusterIndex].isCluster = true;
                filtered[clusterIndex].clusterCount++;
                filtered[clusterIndex].sumLat += vessel.lat;
                filtered[clusterIndex].sumLng += vessel.lng;
            } else {
                filtered.push({
                    ...vessel,
                    isCluster: false,
                    clusterCount: 1,
                    sumLat: vessel.lat,
                    sumLng: vessel.lng,
                });
            }
        });

        return filtered.map((v) => {
            const isActualCluster = v.isCluster && v.clusterCount > 1;
            return {
                ...v,
                isCluster: isActualCluster,
                lat: isActualCluster ? v.sumLat / v.clusterCount : v.lat,
                lng: isActualCluster ? v.sumLng / v.clusterCount : v.lng,
            };
        });
    }, [windowVessels, map, zoom, selectedMmsi]);

    const getAreaName = useCallback((lat: number, lng: number, currentZoom: number) => {
        if (currentZoom <= 3) return 'WORLD OVERVIEW';

        // High Latitude / Polar
        if (lat > 75) return 'ARCTIC REGION';
        if (lat < -60) return 'SOUTHERN OCEAN';

        // North America
        if (lat > 15 && lat < 75 && lng > -170 && lng < -50) {
            if (lat > 25 && lat < 50) {
                if (lng > -130 && lng < -115) return 'US WEST COAST';
                if (lng > -85 && lng < -65) return 'US EAST COAST';
                if (lng > -98 && lng < -80 && lat < 31) return 'GULF OF MEXICO';
            }
            if (lat > 50) return 'CANADA / ALASKA';
            if (lat < 25) return 'CENTRAL AMERICA';
            return 'NORTH AMERICA';
        }

        // Caribbean
        if (lat > 10 && lat < 28 && lng > -98 && lng < -55) {
            return 'CARIBBEAN SEA';
        }

        // South America
        if (lat > -60 && lat < 15 && lng > -95 && lng < -30) {
            return 'SOUTH AMERICA';
        }

        // Europe
        if (lat > 35 && lat < 75 && lng > -25 && lng < 45) {
            if (lat > 30 && lat < 47 && lng > -6 && lng < 42) return 'MEDITERRANEAN SEA';
            if (lat > 50 && lat < 62 && lng > -10 && lng < 10) return 'NORTHERN EUROPE';
            if (lat > 55 && lat < 70 && lng > 10 && lng < 35) return 'BALTIC SEA';
            return 'EUROPE';
        }

        // Africa
        if (lat > -38 && lat < 38 && lng > -25 && lng < 55) {
            if (lat > 12 && lat < 30 && lng > 32 && lng < 45) return 'RED SEA';
            if (lat > -5 && lat < 15 && lng > -20 && lng < 15) return 'GULF OF GUINEA';
            return 'AFRICA';
        }

        // Asia
        if (lat > -10 && lat < 80 && lng > 50 && lng < 180) {
            if (lat > 10 && lat < 30 && lng > 50 && lng < 78) return 'ARABIAN SEA';
            if (lat > 5 && lat < 28 && lng > 78 && lng < 100) return 'BAY OF BENGAL';
            if (lat > -5 && lat < 25 && lng > 100 && lng < 125) return 'SOUTH CHINA SEA';
            if (lat > 20 && lat < 55 && lng > 120 && lng < 155) return 'EAST ASIA';
            if (lat > 50) return 'RUSSIA / NORTH ASIA';
            return 'ASIA';
        }

        // Oceania / Australia
        if (lat > -50 && lat < 10 && lng > 110 && lng < 180) {
            if (lat < -10) return 'AUSTRALIA / NZ';
            return 'OCEANIA';
        }

        // Oceans (General)
        if (lat > 0) {
            if (lng > -80 && lng < 0) return 'NORTH ATLANTIC';
            if (lng > 120 || lng < -120) return 'NORTH PACIFIC';
            if (lng > 40 && lng < 110) return 'INDIAN OCEAN';
        } else {
            if (lng > -70 && lng < 20) return 'SOUTH ATLANTIC';
            if (lng > 120 || lng < -100) return 'SOUTH PACIFIC';
            if (lng > 20 && lng < 115) return 'INDIAN OCEAN';
        }

        return 'WORLD OVERVIEW';
    }, []);

    const mergedVessels = useMemo(() => {
        const knownMmsis = new Set(trackedSearchVessels.map((v) => v.mmsi));
        const merged = [...trackedSearchVessels];
        windowVessels.forEach((v) => {
            if (!knownMmsis.has(v.mmsi)) {
                merged.push(v);
            }
        });
        return merged;
    }, [trackedSearchVessels, windowVessels]);

    useEffect(() => {
        if (onUpdate) {
            const totalRenderedShips = visibleVessels.reduce((acc, v) => acc + v.clusterCount, 0);
            const center = map.getCenter();

            onUpdate({
                renderedIcons: visibleVessels.length,
                totalRenderedShips,
                trackedShips: Math.max(trackedCount, mergedVessels.length),
                trackedVessels: mergedVessels,
                currentArea: getAreaName(center.lat, center.lng, zoom),
            });
        }
    }, [visibleVessels, trackedCount, mergedVessels, onUpdate, map, zoom, getAreaName]);

    const createVesselIcon = (course: number, isCluster: boolean, isSelected: boolean) => {
        const color = isSelected ? '#ef4444' : 'white';
        const shadowColor = isSelected ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.4)';

        const singleIconHtml = renderToString(
            <FaLocationArrow
                style={{
                    color,
                    width: '16px',
                    height: '16px',
                    transform: 'rotate(-45deg)',
                    filter: 'drop-shadow(0 0 1px black)',
                }}
            />
        );

        const clusterIconHtml = renderToString(
            <div
                style={{ position: 'relative', width: '22px', height: '22px', overflow: 'visible' }}
            >
                <FaLocationArrow
                    style={{
                        color,
                        width: '18px',
                        height: '18px',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        transform: 'rotate(-45deg)',
                        filter: 'drop-shadow(0 0 1px black)',
                    }}
                />
                <FaLocationArrow
                    style={{
                        color: shadowColor,
                        width: '14px',
                        height: '14px',
                        position: 'absolute',
                        top: '6px',
                        left: '6px',
                        transform: 'rotate(-45deg)',
                        filter: 'drop-shadow(0 0 1px black)',
                    }}
                />
            </div>
        );

        return L.divIcon({
            className: 'vessel-icon-container',
            html: `
                <div style="transform: rotate(${course}deg); display: flex; align-items: center; justify-content: center; width: 48px; height: 48px;">
                    ${isCluster ? clusterIconHtml : singleIconHtml}
                </div>
            `,
            iconSize: [48, 48],
            iconAnchor: [24, 24],
        });
    };

    const handleClusterInteraction = useCallback(
        (vessel: ClusteredVessel) => {
            const now = Date.now();
            const last = lastClusterInteractionRef.current;
            if (last && last.mmsi === vessel.mmsi && now - last.at < 250) return;
            lastClusterInteractionRef.current = { mmsi: vessel.mmsi, at: now };

            suppressNextMapClickRef.current = true;
            if (onVesselSelect) onVesselSelect(null);
            if (onClusterZoomNotice) onClusterZoomNotice();
            const nextZoom = Math.min(Math.max(map.getZoom() + 2, 11), 16);
            map.flyTo([vessel.lat, vessel.lng], nextZoom, {
                duration: 0.7,
                easeLinearity: 0.25,
            });
        },
        [map, onVesselSelect, onClusterZoomNotice]
    );

    const handleMarkerClick = (vessel: ClusteredVessel, e: L.LeafletMouseEvent) => {
        if (vessel.isCluster) {
            if (e.originalEvent) L.DomEvent.stop(e.originalEvent);
            handleClusterInteraction(vessel);
            return;
        }
        suppressNextMapClickRef.current = true;
        if (e.originalEvent) L.DomEvent.stop(e.originalEvent);
        if (onVesselSelect) {
            onVesselSelect(vessel);
        }
    };

    return (
        <>
            {isIdle && (
                <div
                    className={`fixed inset-0 z-1400 sm:z-4000 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm animate-in fade-in cursor-pointer p-4 transition-all duration-500 ${sidebarOpen ? 'sm:right-100' : ''} ${isToolsOpen ? 'pb-64 sm:pb-0' : ''}`}
                    onClick={recordActivity}
                >
                    <div className="bg-zinc-950/90 border border-amber-500/50 p-6 shadow-2xl flex flex-col items-center gap-4 text-center max-w-xs w-full animate-in zoom-in-95 duration-300">
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[12px] font-bold text-amber-500 uppercase tracking-[0.2em]">
                                Live Updates Paused
                            </span>
                            <p className="text-[11px] leading-relaxed text-zinc-400">
                                Global vessel tracking is currently paused due to inactivity to
                                conserve system resources.
                            </p>
                        </div>

                        <button
                            onClick={recordActivity}
                            className="w-full bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-bold px-6 py-2.5 transition-all active:scale-95 uppercase tracking-wider shadow-lg shadow-amber-500/20"
                        >
                            Resume Tracking
                        </button>

                        <span className="text-[9px] text-zinc-600">(Inactive for 2 minutes)</span>
                    </div>
                </div>
            )}

            {visibleVessels
                .filter((v) => showAll || v.mmsi === selectedMmsi)
                .map((vessel) => (
                    <Marker
                        key={vessel.mmsi}
                        position={[vessel.lat, vessel.lng]}
                        interactive={true}
                        bubblingMouseEvents={false}
                        riseOnHover={true}
                        icon={createVesselIcon(
                            vessel.course || 0,
                            vessel.isCluster,
                            vessel.mmsi === selectedMmsi
                        )}
                        eventHandlers={{
                            mousedown: (e) => handleMarkerClick(vessel, e),
                            click: (e) => handleMarkerClick(vessel, e),
                        }}
                    />
                ))}
            {selectedVessel && !visibleVessels.some((v) => v.mmsi === selectedMmsi) && (
                <Marker
                    key={`offline-${selectedVessel.mmsi}`}
                    position={[selectedVessel.lat, selectedVessel.lng]}
                    interactive={true}
                    bubblingMouseEvents={false}
                    riseOnHover={true}
                    icon={createVesselIcon(selectedVessel.course || 0, false, true)}
                    eventHandlers={{
                        mousedown: (e) =>
                            handleMarkerClick(
                                {
                                    ...selectedVessel,
                                    isCluster: false,
                                    clusterCount: 1,
                                    sumLat: selectedVessel.lat,
                                    sumLng: selectedVessel.lng,
                                } as ClusteredVessel,
                                e
                            ),
                        click: (e) =>
                            handleMarkerClick(
                                {
                                    ...selectedVessel,
                                    isCluster: false,
                                    clusterCount: 1,
                                    sumLat: selectedVessel.lat,
                                    sumLng: selectedVessel.lng,
                                } as ClusteredVessel,
                                e
                            ),
                    }}
                />
            )}
        </>
    );
}

interface Port {
    name: string;
    country: string;
    code: string;
    lat: number;
    lng: number;
}

function PortLayer() {
    const map = useMap();
    const [zoom, setZoom] = useState(map.getZoom());
    const [bounds, setBounds] = useState(map.getBounds());

    useMapEvents({
        zoomend: () => {
            setZoom(map.getZoom());
            setBounds(map.getBounds());
        },
        moveend: () => setBounds(map.getBounds()),
    });

    const visiblePorts = useMemo(() => {
        if (zoom < 6) return [];

        const ports = portsData as unknown as Port[];
        const filtered: Port[] = [];
        const minDistancePx = zoom < 7 ? 25 : zoom < 10 ? 15 : 0;

        ports.forEach((port) => {
            if (!bounds.contains([port.lat, port.lng])) return;

            const pos = map.latLngToLayerPoint([port.lat, port.lng]);
            const tooClose =
                minDistancePx > 0 &&
                filtered.some((f) => {
                    const fPos = map.latLngToLayerPoint([f.lat, f.lng]);
                    const dist = Math.sqrt(
                        Math.pow(pos.x - fPos.x, 2) + Math.pow(pos.y - fPos.y, 2)
                    );
                    return dist < minDistancePx;
                });

            if (!tooClose) {
                filtered.push(port);
            }
        });

        return filtered;
    }, [map, zoom, bounds]);

    const portIcon = L.divIcon({
        className: 'port-icon-container',
        html: renderToString(
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '48px',
                    height: '48px',
                    color: '#22d3ee',
                    filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.5))',
                }}
            >
                <FaAnchor style={{ width: '14px', height: '14px' }} />
            </div>
        ),
        iconSize: [48, 48],
        iconAnchor: [24, 24],
    });

    return (
        <>
            {visiblePorts.map((port: Port, idx: number) => (
                <Marker
                    key={`port-${port.code}-${idx}`}
                    position={[port.lat, port.lng]}
                    title={`Port: ${port.name} (${port.code})`}
                    icon={portIcon}
                >
                    <Popup closeButton={false} minWidth={200}>
                        <div className="bg-zinc-950 border border-white/20 shadow-2xl p-4 min-w-50">
                            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-2 mb-2">
                                <span className="font-bold text-xs uppercase tracking-wider text-cyan-400 truncate">
                                    {port.name}
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        map.closePopup();
                                    }}
                                    className="text-zinc-500 hover:text-white transition-colors"
                                    title="Close"
                                >
                                    <FaXmark className="w-3 h-3" />
                                </button>
                            </div>
                            <div className="text-[10px] text-zinc-400 uppercase font-bold tracking-tight">
                                {port.country}
                            </div>
                            <div className="text-[9px] text-zinc-500 font-mono mt-1 opacity-60">
                                {port.code}
                            </div>
                        </div>
                    </Popup>
                </Marker>
            ))}
        </>
    );
}

interface City {
    name: string;
    country: string;
    lat: number;
    lng: number;
}

function CityLayer() {
    const map = useMap();
    const [zoom, setZoom] = useState(map.getZoom());
    const [bounds, setBounds] = useState(map.getBounds());

    useMapEvents({
        zoomend: () => {
            setZoom(map.getZoom());
            setBounds(map.getBounds());
        },
        moveend: () => setBounds(map.getBounds()),
    });

    const visibleCities = useMemo(() => {
        if (zoom < 8) return [];

        const cities = citiesData as unknown as City[];
        const filtered: City[] = [];
        const minDistancePx = zoom < 10 ? 50 : zoom < 12 ? 30 : zoom < 14 ? 15 : 0;
        const MAX_CITIES = 250;

        for (let i = 0; i < cities.length; i++) {
            const city = cities[i];

            if (
                city.lat < bounds.getSouth() ||
                city.lat > bounds.getNorth() ||
                city.lng < bounds.getWest() ||
                city.lng > bounds.getEast()
            ) {
                continue;
            }

            if (minDistancePx > 0) {
                const pos = map.latLngToLayerPoint([city.lat, city.lng]);
                const tooClose = filtered.some((f) => {
                    const fPos = map.latLngToLayerPoint([f.lat, f.lng]);
                    const distSq = Math.pow(pos.x - fPos.x, 2) + Math.pow(pos.y - fPos.y, 2);
                    return distSq < minDistancePx * minDistancePx;
                });

                if (tooClose) continue;
            }

            filtered.push(city);
            if (filtered.length >= MAX_CITIES) break;
        }

        return filtered;
    }, [map, zoom, bounds]);

    const cityIcon = L.divIcon({
        className: 'city-icon-container',
        html: renderToString(
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '48px',
                    height: '48px',
                    color: '#22c55e',
                    filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.5))',
                }}
            >
                <FaCity style={{ width: '12px', height: '12px' }} />
            </div>
        ),
        iconSize: [48, 48],
        iconAnchor: [24, 24],
    });

    return (
        <>
            {visibleCities.map((city: City, idx: number) => (
                <Marker
                    key={`city-${city.name}-${idx}`}
                    position={[city.lat, city.lng]}
                    title={`City: ${city.name}, ${COUNTRY_NAMES[city.country] || city.country}`}
                    icon={cityIcon}
                >
                    <Popup closeButton={false} minWidth={150}>
                        <div className="bg-zinc-950 border border-white/20 shadow-2xl p-4 min-w-37.5">
                            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-2 mb-2">
                                <span className="font-bold text-xs uppercase tracking-wider text-green-400 truncate">
                                    {city.name}
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        map.closePopup();
                                    }}
                                    className="text-zinc-500 hover:text-white transition-colors"
                                    title="Close"
                                >
                                    <FaXmark className="w-3 h-3" />
                                </button>
                            </div>
                            <div className="text-[10px] text-zinc-400 uppercase font-bold tracking-tight">
                                {COUNTRY_NAMES[city.country] || city.country}
                            </div>
                            <div className="text-[9px] text-zinc-500 font-mono mt-1 opacity-60">
                                {city.country}
                            </div>
                        </div>
                    </Popup>
                </Marker>
            ))}
        </>
    );
}

function ZoomControls() {
    const map = useMap();

    return (
        <div className="absolute right-4 bottom-12 z-3000 flex flex-col gap-1 pointer-events-auto">
            <button
                onClick={() => map.zoomIn()}
                className="w-10 h-10 bg-zinc-950 border border-white/20 flex items-center justify-center text-white hover:bg-zinc-900 transition-colors shadow-2xl active:scale-95"
                title="Zoom In"
            >
                <FaPlus className="w-4 h-4" />
            </button>
            <button
                onClick={() => map.zoomOut()}
                className="w-10 h-10 bg-zinc-950 border border-white/20 flex items-center justify-center text-white hover:bg-zinc-900 transition-colors shadow-2xl active:scale-95"
                title="Zoom Out"
            >
                <FaMinus className="w-4 h-4" />
            </button>
        </div>
    );
}

function MapViewHandler({ center, zoom }: { center: [number, number]; zoom: number }) {
    const map = useMap();

    useEffect(() => {
        map.flyTo(center, zoom, {
            duration: 1.5,
            easeLinearity: 0.25,
        });
    }, [center, zoom, map]);

    return null;
}

interface MapDisplayProps {
    center?: [number, number];
    zoom?: number;
    onFleetUpdate?: (stats: {
        renderedIcons: number;
        totalRenderedShips: number;
        trackedShips: number;
        trackedVessels: Vessel[];
        currentArea: string;
    }) => void;
    selectedMmsi: number | null;
    selectedVessel?: Vessel | null;
    onVesselSelect?: (vessel: Vessel | null) => void;
    onClusterZoomNotice?: () => void;
    historyPositions?: HistoryPosition[];
    showHistory?: boolean;
    showWaypoints?: boolean;
    selectedWaypointKey?: string | null;
    sidebarOpen?: boolean;
    measurementMode?: 'distance' | 'area' | null;
    measurementPoints?: { lat: number; lng: number }[];
    onMeasurementPointAdd?: (point: { lat: number; lng: number }) => void;
    onMeasurementPointUpdate?: (index: number, point: { lat: number; lng: number }) => void;
    isIdle?: boolean;
    onIdleChange?: (isIdle: boolean) => void;
    isToolsOpen?: boolean;
    activePanel?: 'sanctioned' | 'tools' | 'infractions' | null;
    onOpenPanelChange?: (panel: 'sanctioned' | 'tools' | 'infractions' | null) => void;
    isLayersOpen: boolean;
    onLayersOpenChange: (open: boolean) => void;
    showVessels: boolean;
    setShowVessels: (v: boolean) => void;
    showPorts: boolean;
    setShowPorts: (v: boolean) => void;
    showCities: boolean;
    setShowCities: (v: boolean) => void;
}

export default function MapDisplay({
    center = [20, 0],
    zoom = 3,
    onFleetUpdate,
    selectedMmsi,
    selectedVessel = null,
    onVesselSelect,
    onClusterZoomNotice,
    historyPositions = [],
    showHistory = false,
    showWaypoints = true,
    selectedWaypointKey = null,
    sidebarOpen = false,
    measurementMode = null,
    measurementPoints = [],
    onMeasurementPointAdd,
    onMeasurementPointUpdate,
    isIdle = false,
    onIdleChange,
    isToolsOpen = false,
    activePanel,
    isLayersOpen,
    onLayersOpenChange,
    showVessels,
    setShowVessels,
    showPorts,
    setShowPorts,
    showCities,
    setShowCities,
}: MapDisplayProps) {
    const [isCompact, setIsCompact] = useState(
        typeof window !== 'undefined' ? window.innerWidth < 640 || window.innerHeight < 840 : false
    );

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleResize = () =>
            setIsCompact(window.innerWidth < 640 || window.innerHeight < 840);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const activeMeasurementMode = measurementMode;

    return (
        <div className="fixed inset-0 bg-zinc-950">
            <MapContainer
                center={center}
                zoom={zoom}
                minZoom={3}
                maxBounds={MAX_BOUNDS}
                maxBoundsViscosity={1.0}
                zoomControl={false}
                style={{ height: '100%', width: '100%', background: '#09090b' }}
                className="sist-map"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a> | Port Data: <a href="https://datacatalog.worldbank.org/search/dataset/0038118/global-international-ports">World Bank</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />

                {showPorts && <PortLayer />}
                {showCities && <CityLayer />}
                <FleetLayer
                    onUpdate={onFleetUpdate}
                    selectedMmsi={selectedMmsi}
                    selectedVessel={selectedVessel}
                    onVesselSelect={onVesselSelect}
                    onClusterZoomNotice={onClusterZoomNotice}
                    showAll={showVessels}
                    sidebarOpen={sidebarOpen}
                    onIdleChange={onIdleChange}
                    isToolsOpen={isToolsOpen}
                />
                <TrajectoryLayer
                    positions={historyPositions}
                    show={showHistory}
                    showWaypoints={showWaypoints}
                    selectedWaypointKey={selectedWaypointKey}
                />
                <MeasurementLayer
                    mode={activeMeasurementMode}
                    points={measurementPoints}
                    onPointAdd={onMeasurementPointAdd}
                    onPointUpdate={onMeasurementPointUpdate}
                />
                <MapViewHandler center={center} zoom={zoom} />
                {!isIdle && (
                    <>
                        <ZoomControls />
                        <div className="absolute left-4 bottom-12 z-3000 flex flex-col items-start gap-2 pointer-events-auto">
                            <LayerControl
                                showVessels={showVessels}
                                setShowVessels={setShowVessels}
                                showPorts={showPorts}
                                setShowPorts={setShowPorts}
                                showCities={showCities}
                                setShowCities={setShowCities}
                                isOpen={isLayersOpen}
                                onClose={() => onLayersOpenChange(false)}
                            />
                            {!isLayersOpen && !(isCompact && activePanel !== null) && (
                                <button
                                    onClick={() => onLayersOpenChange(true)}
                                    className="w-10 h-10 border flex items-center justify-center transition-all shadow-2xl active:scale-95 bg-zinc-950 text-white border-white/20 hover:bg-zinc-900"
                                    title="Map Layers & Legend"
                                >
                                    <FaLayerGroup className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </>
                )}
            </MapContainer>
            <div className="pointer-events-none absolute inset-0 z-1 shadow-[inset_0_0_150px_rgba(0,0,0,0.8)]" />
        </div>
    );
}

function MeasurementLayer({
    mode,
    points,
    onPointAdd,
    onPointUpdate,
}: {
    mode: 'distance' | 'area' | null;
    points: L.LatLngLiteral[];
    onPointAdd?: (point: L.LatLngLiteral) => void;
    onPointUpdate?: (index: number, point: L.LatLngLiteral) => void;
}) {
    const map = useMap();
    const draggingIndexRef = useRef<number | null>(null);
    const didDragRef = useRef(false);

    const updatePoint = (index: number, nextPoint: L.LatLngLiteral) => {
        if (!onPointUpdate) return;
        if (mode === 'area' && !canMovePolygonPoint(points, index, nextPoint)) {
            return;
        }
        onPointUpdate(index, nextPoint);
    };

    useMapEvents({
        click: (event) => {
            if (!mode) return;
            if (draggingIndexRef.current !== null || didDragRef.current) {
                didDragRef.current = false;
                return;
            }
            const nextPoint = { lat: event.latlng.lat, lng: event.latlng.lng };
            if (mode === 'area' && !canAddPolygonPoint(points, nextPoint)) {
                return;
            }
            onPointAdd?.(nextPoint);
        },
        mousemove: (event) => {
            if (draggingIndexRef.current === null) return;
            didDragRef.current = true;
            updatePoint(draggingIndexRef.current, {
                lat: event.latlng.lat,
                lng: event.latlng.lng,
            });
        },
        mouseup: () => {
            if (draggingIndexRef.current !== null) {
                draggingIndexRef.current = null;
                didDragRef.current = false;
                map.dragging.enable();
            }
        },
    });

    if (!mode || points.length === 0) return null;

    const positions = points.map((point) => [point.lat, point.lng] as [number, number]);

    return (
        <>
            {mode === 'distance' && positions.length > 1 && (
                <Polyline
                    positions={positions}
                    pathOptions={{
                        color: '#f4f4f5',
                        weight: 2,
                        dashArray: '6, 8',
                        opacity: 0.8,
                    }}
                />
            )}
            {mode === 'area' && positions.length > 2 && (
                <Polygon
                    positions={positions}
                    pathOptions={{
                        color: '#f4f4f5',
                        weight: 2,
                        fillColor: '#f4f4f5',
                        fillOpacity: 0.12,
                    }}
                />
            )}
            {points.map((point, index) => (
                <CircleMarker
                    key={`${point.lat}-${point.lng}-${index}`}
                    center={[point.lat, point.lng]}
                    radius={4}
                    pathOptions={{
                        fillColor: '#f4f4f5',
                        fillOpacity: 0.9,
                        color: '#09090b',
                        weight: 1,
                    }}
                    eventHandlers={{
                        mousedown: (event) => {
                            if (!mode) return;
                            draggingIndexRef.current = index;
                            didDragRef.current = false;
                            if (event.originalEvent) {
                                L.DomEvent.stop(event.originalEvent);
                            }
                            map.dragging.disable();
                        },
                        click: (event) => {
                            if (mode !== 'distance') return;
                            if (event.originalEvent) {
                                L.DomEvent.stop(event.originalEvent);
                            }
                            onPointAdd?.({ lat: point.lat, lng: point.lng });
                        },
                    }}
                />
            ))}
        </>
    );
}

function canMovePolygonPoint(
    points: L.LatLngLiteral[],
    index: number,
    next: L.LatLngLiteral
): boolean {
    if (points.length < 4) return true;
    const nextPoints = points.map((point, i) => (i === index ? next : point));
    return isSimplePolygon(nextPoints);
}

function isSimplePolygon(points: L.LatLngLiteral[]): boolean {
    if (points.length < 4) return true;
    const n = points.length;
    for (let i = 0; i < n; i++) {
        const a1 = points[i];
        const a2 = points[(i + 1) % n];
        for (let j = i + 1; j < n; j++) {
            const b1 = points[j];
            const b2 = points[(j + 1) % n];
            if (i === j) continue;
            if ((i + 1) % n === j) continue;
            if (i === (j + 1) % n) continue;
            if (segmentsIntersect(a1, a2, b1, b2)) {
                return false;
            }
        }
    }
    return true;
}

function canAddPolygonPoint(points: L.LatLngLiteral[], next: L.LatLngLiteral): boolean {
    if (points.length < 2) return true;

    const last = points[points.length - 1];
    const newSegmentStart = last;
    const newSegmentEnd = next;

    for (let i = 0; i < points.length - 2; i++) {
        const segmentStart = points[i];
        const segmentEnd = points[i + 1];
        if (segmentsIntersect(newSegmentStart, newSegmentEnd, segmentStart, segmentEnd)) {
            return false;
        }
    }

    if (points.length >= 3) {
        const closingStart = next;
        const closingEnd = points[0];
        for (let i = 1; i < points.length - 1; i++) {
            const segmentStart = points[i];
            const segmentEnd = points[i + 1];
            if (segmentsIntersect(closingStart, closingEnd, segmentStart, segmentEnd)) {
                return false;
            }
        }
    }

    return true;
}

function segmentsIntersect(
    a: L.LatLngLiteral,
    b: L.LatLngLiteral,
    c: L.LatLngLiteral,
    d: L.LatLngLiteral
): boolean {
    if (pointsEqual(a, c) || pointsEqual(a, d) || pointsEqual(b, c) || pointsEqual(b, d)) {
        return false;
    }

    const orientation = (p: L.LatLngLiteral, q: L.LatLngLiteral, r: L.LatLngLiteral) => {
        const value = (q.lng - p.lng) * (r.lat - q.lat) - (q.lat - p.lat) * (r.lng - q.lng);
        if (Math.abs(value) < 1e-12) return 0;
        return value > 0 ? 1 : 2;
    };

    const onSegment = (p: L.LatLngLiteral, q: L.LatLngLiteral, r: L.LatLngLiteral) => {
        return (
            q.lng <= Math.max(p.lng, r.lng) + 1e-12 &&
            q.lng >= Math.min(p.lng, r.lng) - 1e-12 &&
            q.lat <= Math.max(p.lat, r.lat) + 1e-12 &&
            q.lat >= Math.min(p.lat, r.lat) - 1e-12
        );
    };

    const o1 = orientation(a, b, c);
    const o2 = orientation(a, b, d);
    const o3 = orientation(c, d, a);
    const o4 = orientation(c, d, b);

    if (o1 !== o2 && o3 !== o4) return true;

    if (o1 === 0 && onSegment(a, c, b)) return true;
    if (o2 === 0 && onSegment(a, d, b)) return true;
    if (o3 === 0 && onSegment(c, a, d)) return true;
    if (o4 === 0 && onSegment(c, b, d)) return true;

    return false;
}

function pointsEqual(a: L.LatLngLiteral, b: L.LatLngLiteral): boolean {
    return Math.abs(a.lat - b.lat) < 1e-12 && Math.abs(a.lng - b.lng) < 1e-12;
}
function WaypointMarker({
    p,
    isSelected,
    createWaypointIcon,
    children,
}: {
    p: HistoryPosition & { mergedCount: number };
    isSelected: boolean;
    createWaypointIcon: (course: number) => L.DivIcon;
    children: ReactNode;
}) {
    const markerRef = useRef<L.Marker | L.CircleMarker>(null);

    useEffect(() => {
        if (isSelected && markerRef.current) {
            const timer = setTimeout(() => {
                markerRef.current?.openPopup();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [isSelected]);

    if (p.mergedCount > 1) {
        return (
            <CircleMarker
                ref={markerRef as React.Ref<L.CircleMarker>}
                center={[Number(p.lat), Number(p.lng)]}
                radius={4}
                pathOptions={{
                    fillColor: '#f4f4f5',
                    fillOpacity: 0.8,
                    color: '#09090b',
                    weight: 1,
                }}
            >
                {children}
            </CircleMarker>
        );
    }

    return (
        <Marker
            ref={markerRef as React.Ref<L.Marker>}
            position={[Number(p.lat), Number(p.lng)]}
            icon={createWaypointIcon(Number(p.course) || 0)}
        >
            {children}
        </Marker>
    );
}

function TrajectoryLayer({
    positions,
    show,
    showWaypoints,
    selectedWaypointKey,
}: {
    positions: HistoryPosition[];
    show: boolean;
    showWaypoints: boolean;
    selectedWaypointKey?: string | null;
}) {
    const merged = useMemo(() => {
        if (!show || !positions || positions.length === 0) return [];
        const result: (HistoryPosition & { mergedCount: number })[] = [];
        positions.forEach((p) => {
            if (result.length === 0) {
                result.push({ ...p, mergedCount: 1 });
                return;
            }
            const last = result[result.length - 1];
            const dist = Math.sqrt(
                Math.pow(Number(p.lat) - Number(last.lat), 2) +
                    Math.pow(Number(p.lng) - Number(last.lng), 2)
            );
            if (dist < 0.0005) {
                last.mergedCount++;
            } else {
                result.push({ ...p, mergedCount: 1 });
            }
        });
        return result;
    }, [positions, show]);

    if (!show || !positions || positions.length === 0) return null;

    const path = positions.map((p) => [Number(p.lat), Number(p.lng)] as [number, number]);

    const createWaypointIcon = (course: number) => {
        return L.divIcon({
            className: 'waypoint-icon-container',
            html: `
                <div style="transform: rotate(${course}deg); display: flex; align-items: center; justify-content: center; opacity: 0.8;">
                    <svg viewBox="0 0 448 512" style="width: 12px; height: 12px; transform: rotate(-45deg); filter: drop-shadow(0 0 1px black);" fill="#f4f4f5">
                        <path d="M429.6 92.1c4.9-11.9 2.1-25.6-7-34.7s-22.8-11.9-34.7-7l-352 144c-14.2 5.8-22.2 20.8-19.3 35.8s16.1 25.8 31.4 25.8H224V432c0 15.3 10.8 28.4 25.8 31.4s30-5.1 35.8-19.3l144-352z"/>
                    </svg>
                </div>
            `,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
        });
    };

    return (
        <>
            <Polyline
                positions={path}
                pathOptions={{
                    color: '#f4f4f5',
                    weight: 2,
                    dashArray: '5, 10',
                    opacity: 0.6,
                }}
            />
            {showWaypoints &&
                merged
                    .filter((p) => !p.isLatest)
                    .map((p, i) => (
                        <WaypointMarker
                            key={`${p.recorded_at}-${i}`}
                            p={p}
                            isSelected={selectedWaypointKey === p.recorded_at}
                            createWaypointIcon={createWaypointIcon}
                        >
                            <Popup closeButton={false} minWidth={220} className="sist-popup">
                                <div className="bg-zinc-950 border border-white/20 shadow-2xl p-4 min-w-55">
                                    <div className="flex flex-col gap-1 border-b border-white/10 pb-2 mb-2">
                                        <span className="font-bold text-[10px] uppercase tracking-[0.2em] text-zinc-200">
                                            {p.mergedCount > 1
                                                ? 'Stationary Block'
                                                : 'Waypoint Detail'}
                                        </span>
                                        <span className="text-[10px] font-mono text-zinc-500">
                                            {formatShortDate(p.recorded_at)}
                                        </span>
                                    </div>
                                    {p.mergedCount > 1 && (
                                        <div className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                            <FaLayerGroup className="w-2.5 h-2.5 text-zinc-600" />
                                            {p.mergedCount} Records in this area
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[8px] text-zinc-600 uppercase font-black tracking-tighter">
                                                Speed
                                            </span>
                                            <span className="text-[11px] font-black text-zinc-300">
                                                {Number(p.speed).toFixed(1)} kn
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-0.5 text-right">
                                            <span className="text-[8px] text-zinc-600 uppercase font-black tracking-tighter">
                                                Course
                                            </span>
                                            <span className="text-[11px] font-black text-zinc-300">
                                                {Number(p.course).toFixed(0)}°
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
                                        <span className="text-[9px] text-zinc-600 font-mono">
                                            {Number(p.lat).toFixed(4)}, {Number(p.lng).toFixed(4)}
                                        </span>
                                    </div>
                                </div>
                            </Popup>
                        </WaypointMarker>
                    ))}
        </>
    );
}
