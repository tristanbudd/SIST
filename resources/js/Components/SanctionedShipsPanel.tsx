import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    FaShip,
    FaXmark,
    FaMagnifyingGlass,
    FaChevronLeft,
    FaChevronRight,
    FaArrowUpRightFromSquare,
    FaCircleExclamation,
} from 'react-icons/fa6';
import axios from 'axios';
import L from 'leaflet';
import { OFFLINE_THRESHOLD_MINUTES, API_BASE_URL } from '../constants';
import { Vessel as MapVessel } from './MapDisplay';
import MapToolsPanel from './MapToolsPanel';

interface SanctionedVessel {
    id?: string;
    mmsi: number;
    imo?: number;
    name: string;
    lat: number;
    lng: number;
    course: number;
    last_seen_at: string;
    is_sanctioned: boolean;
    risk_level: 'clear' | 'low' | 'medium' | 'high';
    sanctions_count: number;
    sanctioners?: string[];
}

interface SISTSearchVessel {
    mmsi: number | string;
    imo?: number | string;
    name: string;
    lat: number;
    lng: number;
    last_seen_at?: string;
}

interface SanctionedShipsPanelProps {
    onNavigate?: (lat: number, lng: number, zoom: number) => void;
    onVesselSelect?: (vessel: MapVessel | null) => void;
    isGrouped?: boolean;
    isOpen?: boolean;
    onOpen?: () => void;
    onClose?: () => void;
    hideTrigger?: boolean;
}

interface SanctionedShipsPanelWithToolsProps {
    onNavigate?: (lat: number, lng: number, zoom: number) => void;
    onVesselSelect?: (vessel: MapVessel | null) => void;
    onMeasureDistance?: () => void;
    onMeasureArea?: () => void;
    onExitTool?: () => void;
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
    measurementMode?: 'distance' | 'area' | null;
    measurementPoints?: { lat: number; lng: number }[];
}

export default function SanctionedShipsPanel({
    onNavigate,
    onVesselSelect,
    isGrouped = false,
    isOpen: isOpenProp,
    onOpen,
    onClose,
    hideTrigger = false,
}: SanctionedShipsPanelProps) {
    const [isOpenInternal, setIsOpenInternal] = useState(false);
    const isOpen = isOpenProp ?? isOpenInternal;
    const openPanel = onOpen ?? (() => setIsOpenInternal(true));
    const closePanel = onClose ?? (() => setIsOpenInternal(false));
    const [searchQuery, setSearchQuery] = useState('');
    const [sanctionedVessels, setSanctionedVessels] = useState<SanctionedVessel[]>([]);
    const [loading, setLoading] = useState(false);

    const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');

    const ITEMS_PER_PAGE = 20;
    const [currentPage, setCurrentPage] = useState(1);
    const [databaseError, setDatabaseError] = useState<{
        name: string;
        mmsi?: number;
        imo?: number;
    } | null>(null);
    const [checkingVesselMmsi, setCheckingVesselMmsi] = useState<number | null>(null);

    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (panelRef.current) {
            L.DomEvent.disableScrollPropagation(panelRef.current);
            L.DomEvent.disableClickPropagation(panelRef.current);
        }
    }, [isOpen]);

    const fetchSanctionedVessels = useCallback(async (search: string = '') => {
        // Defer to avoid synchronous setState warning in useEffect
        await Promise.resolve();
        setLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/vessels/sanctioned/list`, {
                params: {
                    search: search.trim(),
                    limit: 100,
                },
            });
            const sorted = (response.data.data || []).sort(
                (a: SanctionedVessel, b: SanctionedVessel) => {
                    const dateA = new Date(a.last_seen_at || 0).getTime();
                    const dateB = new Date(b.last_seen_at || 0).getTime();
                    return dateB - dateA;
                }
            );
            setSanctionedVessels(sorted);
        } catch (error) {
            console.error('Failed to fetch sanctioned vessels:', error);
            setSanctionedVessels([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen && sanctionedVessels.length === 0) {
            const timer = setTimeout(() => {
                fetchSanctionedVessels();
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [isOpen, sanctionedVessels.length, fetchSanctionedVessels]);

    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = setTimeout(() => {
            if (isOpen) {
                fetchSanctionedVessels(searchQuery);
            }
        }, 300);

        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, [searchQuery, isOpen, fetchSanctionedVessels]);

    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);

    const filteredVessels = useMemo(() => {
        let filtered = sanctionedVessels;

        if (statusFilter !== 'all') {
            filtered = filtered.filter((v) => {
                const diffMins = (now - new Date(v.last_seen_at).getTime()) / 60000;
                const isOffline = diffMins > OFFLINE_THRESHOLD_MINUTES;
                return statusFilter === 'offline' ? isOffline : !isOffline;
            });
        }

        return filtered;
    }, [sanctionedVessels, statusFilter, now]);

    const isVesselOffline = (lastSeen: string, time: number): boolean => {
        const lastSeenTime = new Date(lastSeen).getTime();
        const ageMinutes = (time - lastSeenTime) / 60000;
        return ageMinutes > OFFLINE_THRESHOLD_MINUTES;
    };

    const handleVesselClick = async (vessel: SanctionedVessel) => {
        const checkId = vessel.mmsi || vessel.imo || 0;
        setCheckingVesselMmsi(checkId);
        setDatabaseError(null);

        try {
            let mmsiToUse = vessel.mmsi;
            let success = false;

            // Try resolving by provided MMSI
            if (mmsiToUse && mmsiToUse !== 0) {
                try {
                    await axios.get(`${API_BASE_URL}/vessels/${mmsiToUse}`);
                    success = true;
                } catch {
                    // Fall through
                }
            }

            // Fallback: Search by IMO
            if (!success && vessel.imo) {
                try {
                    const searchRes = await axios.get(`${API_BASE_URL}/vessels/search`, {
                        params: { q: vessel.imo },
                    });
                    const found = (searchRes.data.data || []).find(
                        (v: SISTSearchVessel) => String(v.imo) === String(vessel.imo)
                    );
                    if (found && found.mmsi) {
                        mmsiToUse = parseInt(String(found.mmsi));
                        await axios.get(`${API_BASE_URL}/vessels/${mmsiToUse}`);
                        success = true;
                    }
                } catch {
                    // Fall through
                }
            }

            // Fallback: Search by Name
            if (!success && vessel.name) {
                try {
                    const searchRes = await axios.get(`${API_BASE_URL}/vessels/search`, {
                        params: { q: vessel.name },
                    });
                    const found = (searchRes.data.data || []).find(
                        (v: SISTSearchVessel) => v.name.toUpperCase() === vessel.name.toUpperCase()
                    );
                    if (found && found.mmsi) {
                        mmsiToUse = parseInt(String(found.mmsi));
                        await axios.get(`${API_BASE_URL}/vessels/${mmsiToUse}`);
                        success = true;
                    }
                } catch {
                    // Fall through
                }
            }

            if (!success || !mmsiToUse) {
                setDatabaseError({ name: vessel.name, mmsi: vessel.mmsi, imo: vessel.imo });
                setTimeout(() => setDatabaseError(null), 6000);
                return;
            }

            if (onVesselSelect) {
                onVesselSelect({
                    mmsi: mmsiToUse,
                    imo: vessel.imo || undefined,
                    name: vessel.name,
                    lat: vessel.lat,
                    lng: vessel.lng,
                    course: vessel.course,
                });
            }
            if (onNavigate) {
                onNavigate(vessel.lat, vessel.lng, 14);
            }
        } catch (error) {
            if (
                axios.isAxiosError(error) &&
                (error.response?.status === 404 || error.response?.status === 400)
            ) {
                setDatabaseError({ name: vessel.name, mmsi: vessel.mmsi, imo: vessel.imo });
                setTimeout(() => setDatabaseError(null), 6000);
            } else {
                console.error('Failed to verify vessel in database:', error);
            }
        } finally {
            setCheckingVesselMmsi(null);
        }
    };

    const totalPages = Math.ceil(filteredVessels.length / ITEMS_PER_PAGE);
    const paginatedVessels = filteredVessels.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    return (
        <div
            ref={panelRef}
            className={`
                ${
                    isOpen
                        ? `fixed inset-0 sm:absolute sm:inset-auto sm:top-1/2 sm:-translate-y-1/2 ${
                              isGrouped ? 'sm:left-0' : 'sm:left-4'
                          }`
                        : isGrouped
                          ? ''
                          : 'absolute top-1/2 -translate-y-1/2 left-4'
                }
                ${isOpen ? 'z-1500' : !isGrouped ? 'z-1500' : ''}
                flex flex-col items-start gap-2 pointer-events-auto
            `}
            onWheel={(e) => e.stopPropagation()}
            onMouseEnter={(e) => {
                e.currentTarget.style.cursor = 'default';
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
        >
            {isOpen && (
                <div className="bg-zinc-950 border-white/20 shadow-2xl flex flex-col w-full sm:w-96 h-[calc(100vh-32px)] sm:h-auto sm:max-h-[70vh] animate-in slide-in-from-left-2 duration-200 overflow-hidden sm:border">
                    <div className="flex items-center justify-between border-b border-white/10 px-4 pt-4 pb-3">
                        <div className="flex items-center gap-3">
                            <FaShip className="text-white w-4 h-4" />
                            <span className="text-xs font-bold text-white tracking-wider">
                                SANCTIONED VESSELS
                            </span>
                        </div>
                        <button
                            onClick={closePanel}
                            className="text-zinc-500 hover:text-white transition-colors p-2 hover:bg-white/5"
                            title="Close"
                        >
                            <FaXmark className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="px-4 py-3 flex flex-col gap-3 bg-zinc-900/30 border-b border-white/5">
                        <div className="flex flex-col gap-2">
                            <div className="relative flex items-center bg-zinc-950 border border-white/20 px-3 py-2.5 transition-all focus-within:border-white/40 focus-within:ring-1 focus-within:ring-white/10">
                                <FaMagnifyingGlass className="w-4 h-4 text-zinc-500 absolute left-3 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Search API by name, IMO, MMSI..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="bg-transparent border-none outline-none text-white text-xs font-semibold w-full placeholder:text-zinc-500 focus:ring-0 pl-7"
                                />
                            </div>

                            <div className="flex justify-between items-center w-full">
                                {/* Status Filter */}
                                <div className="flex bg-zinc-950 border border-white/20 divide-x divide-white/10 overflow-hidden w-full">
                                    {(['all', 'online', 'offline'] as const).map((status) => (
                                        <button
                                            key={status}
                                            onClick={() => {
                                                setStatusFilter(status);
                                                setCurrentPage(1);
                                            }}
                                            className={`flex-1 text-[9px] font-bold uppercase tracking-widest px-2 py-2 transition-all ${
                                                statusFilter === status
                                                    ? 'bg-zinc-800 text-white'
                                                    : 'bg-transparent text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
                                            }`}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {databaseError && (
                        <div className="mx-4 mb-3 bg-red-500/10 border border-red-500/30 px-3 py-2.5 flex items-center gap-3 animate-in slide-in-from-top-2 duration-200">
                            <FaCircleExclamation className="w-4 h-4 text-red-500 shrink-0" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider leading-tight">
                                    Vessel Not Found in SIST Database
                                </span>
                                <span className="text-[9px] font-semibold text-red-400/80 mt-0.5">
                                    {databaseError.name} (IMO: {databaseError.imo || 'N/A'})
                                </span>
                            </div>
                        </div>
                    )}

                    <div ref={listRef} className="flex-1 overflow-y-auto px-2 py-2">
                        {loading && (
                            <div className="flex items-center justify-center py-8">
                                <div className="w-5 h-5 border-2 border-white/20 border-t-zinc-400 rounded-full animate-spin" />
                            </div>
                        )}

                        {!loading && filteredVessels.length === 0 && (
                            <div className="py-8 text-center text-xs font-semibold text-zinc-500">
                                {sanctionedVessels.length === 0
                                    ? 'No sanctioned vessels found.'
                                    : 'No results match your search or filters.'}
                            </div>
                        )}

                        <div className="space-y-1">
                            {paginatedVessels.map((vessel: SanctionedVessel) => {
                                const offline = isVesselOffline(vessel.last_seen_at, now);
                                return (
                                    <button
                                        key={vessel.id || vessel.mmsi}
                                        onClick={() => handleVesselClick(vessel)}
                                        className="w-full px-3 py-2.5 text-left transition-all bg-transparent hover:bg-zinc-900 border border-transparent hover:border-white/5 active:scale-[0.99] flex items-start justify-between gap-3"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold text-white truncate">
                                                    {vessel.name}
                                                </span>
                                                {offline && (
                                                    <span className="text-[8px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 whitespace-nowrap font-semibold tracking-wider">
                                                        OFFLINE
                                                    </span>
                                                )}
                                                {checkingVesselMmsi ===
                                                    (vessel.mmsi || vessel.imo || 0) && (
                                                    <div className="w-3 h-3 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-[9px] font-semibold text-zinc-500">
                                                {vessel.mmsi ? (
                                                    <span>
                                                        MMSI:{' '}
                                                        <span className="text-zinc-400">
                                                            {vessel.mmsi}
                                                        </span>
                                                    </span>
                                                ) : null}
                                                {vessel.imo ? (
                                                    <span>
                                                        IMO:{' '}
                                                        <span className="text-zinc-400">
                                                            {vessel.imo}
                                                        </span>
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="text-right whitespace-nowrap flex flex-col items-end gap-0.5">
                                            <div className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-red-500/10 text-red-500 border border-red-500/20">
                                                SANCTIONED
                                            </div>
                                            <div
                                                className="text-[8px] text-zinc-500 font-semibold tracking-widest mt-1 uppercase max-w-40 truncate"
                                                title={vessel.sanctioners?.join(', ')}
                                            >
                                                {vessel.sanctioners?.slice(0, 5).join(', ') ||
                                                    'Unknown'}
                                                {vessel.sanctioners &&
                                                    vessel.sanctioners.length > 5 &&
                                                    ` AND ${vessel.sanctioners.length - 5} OTHERS`}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {!loading && filteredVessels.length > 0 && (
                        <div className="border-t border-white/10 px-4 py-2.5 bg-zinc-950 flex flex-col gap-2">
                            <div className="flex justify-between items-center text-[9px] font-semibold text-zinc-500 tracking-wider">
                                <span>
                                    SHOWING {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
                                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredVessels.length)}{' '}
                                    OF {filteredVessels.length}
                                </span>
                                <a
                                    href="https://fleetleaks.com"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 hover:text-white transition-colors"
                                >
                                    FLEETLEAKS RECORDS{' '}
                                    <FaArrowUpRightFromSquare className="w-2.5 h-2.5" />
                                </a>
                            </div>

                            {totalPages > 1 && (
                                <div className="flex justify-between items-center mt-1">
                                    <button
                                        onClick={() => {
                                            setCurrentPage((p) => Math.max(1, p - 1));
                                            listRef.current?.scrollTo({
                                                top: 0,
                                                behavior: 'smooth',
                                            });
                                        }}
                                        disabled={currentPage === 1}
                                        className="p-1 text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors"
                                    >
                                        <FaChevronLeft className="w-3 h-3" />
                                    </button>
                                    <div className="text-[9px] font-bold text-zinc-400">
                                        PAGE {currentPage} OF {totalPages}
                                    </div>
                                    <button
                                        onClick={() => {
                                            setCurrentPage((p) => Math.min(totalPages, p + 1));
                                            listRef.current?.scrollTo({
                                                top: 0,
                                                behavior: 'smooth',
                                            });
                                        }}
                                        disabled={currentPage === totalPages}
                                        className="p-1 text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors"
                                    >
                                        <FaChevronRight className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {!isOpen && !hideTrigger && (
                <button
                    onClick={openPanel}
                    title="Sanctioned Vessels"
                    className="bg-zinc-950 border border-white/20 w-10 h-10 shadow-2xl hover:bg-zinc-900 active:scale-95 transition-all flex items-center justify-center pointer-events-auto z-1000"
                >
                    <FaShip className="w-4 h-4 text-white" />
                </button>
            )}
        </div>
    );
}

// Wrapper component that includes both sanctioned ships panel and map tools
export function SanctionedShipsPanelWithTools({
    onNavigate,
    onVesselSelect,
    onMeasureDistance,
    onMeasureArea,
    onExitTool,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    measurementMode,
    measurementPoints,
}: SanctionedShipsPanelWithToolsProps) {
    const [openPanel, setOpenPanel] = useState<'sanctioned' | 'tools' | null>(null);
    const hideTriggers = openPanel !== null;

    return (
        <div
            className={`
                ${
                    openPanel
                        ? 'pointer-events-auto'
                        : 'absolute top-1/2 -translate-y-1/2 left-4 pointer-events-auto'
                }
                sm:absolute sm:top-1/2 sm:-translate-y-1/2 sm:left-4 z-1500 flex flex-col items-start gap-2
            `}
        >
            <SanctionedShipsPanel
                onNavigate={onNavigate}
                onVesselSelect={onVesselSelect}
                isGrouped={true}
                isOpen={openPanel === 'sanctioned'}
                onOpen={() => setOpenPanel('sanctioned')}
                onClose={() => setOpenPanel(null)}
                hideTrigger={hideTriggers}
            />
            <MapToolsPanel
                onMeasureDistance={onMeasureDistance}
                onMeasureArea={onMeasureArea}
                onExitTool={onExitTool}
                onUndo={onUndo}
                onRedo={onRedo}
                canUndo={canUndo}
                canRedo={canRedo}
                measurementMode={measurementMode}
                measurementPoints={measurementPoints}
                isOpen={openPanel === 'tools'}
                onOpen={() => setOpenPanel('tools')}
                onClose={() => {
                    onExitTool?.();
                    setOpenPanel(null);
                }}
                hideTrigger={hideTriggers}
            />
        </div>
    );
}
