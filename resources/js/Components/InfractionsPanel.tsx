import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FaEye, FaXmark, FaMagnifyingGlass, FaChevronLeft, FaChevronRight } from 'react-icons/fa6';
import axios from 'axios';
import L from 'leaflet';
import { API_BASE_URL } from '../constants';
import { Vessel as MapVessel } from './MapDisplay';

interface InfractionVessel {
    mmsi: number;
    imo?: number;
    name: string;
    lat: number;
    lng: number;
    course: number;
    infractions_count: number;
    highest_severity: 'low' | 'medium' | 'high';
    risk_score: number;
}

interface InfractionsPanelProps {
    onNavigate?: (lat: number, lng: number, zoom: number) => void;
    onVesselSelect?: (vessel: MapVessel | null) => void;
    isGrouped?: boolean;
    isOpen?: boolean;
    onOpen?: () => void;
    onClose?: () => void;
    hideTrigger?: boolean;
    trackedVessels?: MapVessel[];
    isCompact?: boolean;
}

export default function InfractionsPanel({
    onNavigate,
    onVesselSelect,
    isGrouped = false,
    isOpen: isOpenProp,
    onOpen,
    onClose,
    hideTrigger = false,
    trackedVessels = [],
    isCompact = false,
}: InfractionsPanelProps) {
    const [isOpenInternal, setIsOpenInternal] = useState(false);
    const isOpen = isOpenProp ?? isOpenInternal;
    const openPanel = onOpen ?? (() => setIsOpenInternal(true));
    const closePanel = onClose ?? (() => setIsOpenInternal(false));

    const [searchQuery, setSearchQuery] = useState('');
    const [severityFilter, setSeverityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
    const [vessels, setVessels] = useState<InfractionVessel[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalVessels, setTotalVessels] = useState(0);
    const ITEMS_PER_PAGE = 20;

    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (panelRef.current) {
            L.DomEvent.disableScrollPropagation(panelRef.current);
            L.DomEvent.disableClickPropagation(panelRef.current);
        }
    }, [isOpen]);

    const fetchVessels = useCallback(
        async (
            search: string = '',
            severity: string = 'all',
            status: string = 'all',
            page: number = 1
        ) => {
            setLoading(true);
            try {
                const response = await axios.get(`${API_BASE_URL}/vessels/infractions`, {
                    params: {
                        search: search.trim(),
                        severity: severity === 'all' ? undefined : severity,
                        status: status === 'all' ? undefined : status,
                        per_page: ITEMS_PER_PAGE,
                        page: page,
                    },
                });
                setVessels(response.data.data || []);
                setTotalPages(response.data.meta?.last_page || 1);
                setTotalVessels(response.data.meta?.total || 0);
            } catch (error) {
                console.error('Failed to fetch infractions vessels:', error);
                setVessels([]);
                setTotalPages(1);
                setTotalVessels(0);
            } finally {
                setLoading(false);
            }
        },
        []
    );

    // Initial fetch handled by debounced effect below

    useEffect(() => {
        if (!isOpen) return;

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = setTimeout(
            () => {
                fetchVessels(searchQuery, severityFilter, statusFilter, currentPage);
            },
            searchQuery ? 300 : 0
        );

        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, [searchQuery, severityFilter, statusFilter, isOpen, fetchVessels, currentPage]);

    const onlineMmsis = useMemo(() => {
        const set = new Set<number>();
        trackedVessels.forEach((v) => {
            const val = Number(v.mmsi);
            if (!isNaN(val)) set.add(val);
        });
        return set;
    }, [trackedVessels]);

    const handleVesselClick = (vessel: InfractionVessel) => {
        if (onVesselSelect) {
            onVesselSelect({
                mmsi: vessel.mmsi,
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
    };

    return (
        <div
            ref={panelRef}
            className={`
                ${
                    isOpen
                        ? `fixed inset-0 sm:absolute sm:inset-auto ${
                              isCompact ? 'sm:top-[calc(50%+16px)]' : 'sm:top-1/2'
                          } sm:-translate-y-1/2 ${isGrouped ? 'sm:left-0' : 'sm:left-4'}`
                        : isGrouped
                          ? ''
                          : 'absolute top-1/2 -translate-y-1/2 left-4'
                }
                ${isOpen ? 'z-1500' : !isGrouped ? 'z-1500' : ''}
                flex flex-col items-start gap-2 pointer-events-auto
            `}
        >
            {isOpen && (
                <div
                    className={`bg-zinc-950 border-white/20 shadow-2xl flex flex-col w-full sm:w-96 h-[calc(100vh-32px)] sm:h-auto ${isCompact ? 'sm:max-h-[calc(100vh-160px)]' : 'sm:max-h-[70vh]'} animate-in slide-in-from-left-2 duration-200 overflow-hidden sm:border`}
                >
                    <div className="flex items-center justify-between border-b border-white/10 px-4 pt-4 pb-3">
                        <div className="flex items-center gap-3">
                            <FaEye className="text-white w-4 h-4" />
                            <span className="text-xs font-bold text-white tracking-wider">
                                BEHAVIOURAL INFRACTIONS
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
                                    placeholder="Search by name, IMO, MMSI..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="bg-transparent border-none outline-none text-white text-xs font-semibold w-full placeholder:text-zinc-500 focus:ring-0 pl-7"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <div className="flex bg-zinc-950 border border-white/20 divide-x divide-white/10 overflow-hidden w-full">
                                    {(['all', 'low', 'medium', 'high'] as const).map((sev) => (
                                        <button
                                            key={sev}
                                            onClick={() => {
                                                setSeverityFilter(sev);
                                                setCurrentPage(1);
                                            }}
                                            className={`flex-1 text-[9px] font-bold uppercase tracking-widest px-2 py-2 transition-all ${
                                                severityFilter === sev
                                                    ? 'bg-zinc-800 text-white'
                                                    : 'bg-transparent text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
                                            }`}
                                        >
                                            {sev}
                                        </button>
                                    ))}
                                </div>
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

                    <div ref={listRef} className="flex-1 overflow-y-auto px-2 py-2">
                        {loading && (
                            <div className="flex items-center justify-center py-8">
                                <div className="w-5 h-5 border-2 border-white/20 border-t-zinc-400 rounded-full animate-spin" />
                            </div>
                        )}

                        {!loading && vessels.length === 0 && (
                            <div className="py-8 text-center text-xs font-semibold text-zinc-500">
                                No vessels with infractions found.
                            </div>
                        )}

                        <div className="space-y-1">
                            {vessels.map((vessel) => {
                                const isOnline = onlineMmsis.has(vessel.mmsi);
                                return (
                                    <button
                                        key={vessel.mmsi}
                                        onClick={() => handleVesselClick(vessel)}
                                        className="w-full px-3 py-2.5 text-left transition-all bg-transparent hover:bg-zinc-900 border border-transparent hover:border-white/5 active:scale-[0.99] flex items-start justify-between gap-3"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold text-white truncate">
                                                    {vessel.name}
                                                </span>
                                                {isOnline ? (
                                                    <span className="text-[8px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 whitespace-nowrap font-semibold tracking-wider border border-emerald-500/20">
                                                        ONLINE
                                                    </span>
                                                ) : (
                                                    <span className="text-[8px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 whitespace-nowrap font-semibold tracking-wider">
                                                        OFFLINE
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-[9px] font-semibold text-zinc-500">
                                                <span>
                                                    MMSI:{' '}
                                                    <span className="text-zinc-400">
                                                        {vessel.mmsi}
                                                    </span>
                                                </span>
                                                {vessel.imo && (
                                                    <span>
                                                        IMO:{' '}
                                                        <span className="text-zinc-400">
                                                            {vessel.imo}
                                                        </span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right whitespace-nowrap flex flex-col items-end gap-1">
                                            <div
                                                className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${
                                                    vessel.highest_severity === 'high'
                                                        ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                                        : vessel.highest_severity === 'medium'
                                                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                                          : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                                }`}
                                            >
                                                {vessel.infractions_count} INFRACTIONS
                                            </div>
                                            <div className="text-[8px] text-zinc-500 font-bold tracking-widest uppercase">
                                                RISK SCORE:{' '}
                                                <span
                                                    className={
                                                        vessel.risk_score >= 75
                                                            ? 'text-red-500'
                                                            : vessel.risk_score >= 50
                                                              ? 'text-amber-500'
                                                              : 'text-emerald-500'
                                                    }
                                                >
                                                    {vessel.risk_score}
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {!loading && vessels.length > 0 && totalPages > 1 && (
                        <div className="border-t border-white/10 px-4 py-2.5 bg-zinc-950 flex flex-col gap-2">
                            <div className="flex justify-between items-center text-[9px] font-semibold text-zinc-500 tracking-wider">
                                <span>
                                    SHOWING {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
                                    {Math.min(currentPage * ITEMS_PER_PAGE, totalVessels)} OF{' '}
                                    {totalVessels}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                                <button
                                    onClick={() => {
                                        setCurrentPage((p) => Math.max(1, p - 1));
                                        listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    disabled={currentPage === 1}
                                    className="p-1 text-zinc-500 hover:text-white disabled:opacity-30 transition-colors"
                                >
                                    <FaChevronLeft className="w-3 h-3" />
                                </button>
                                <div className="text-[9px] font-bold text-zinc-400">
                                    PAGE {currentPage} OF {totalPages}
                                </div>
                                <button
                                    onClick={() => {
                                        setCurrentPage((p) => Math.min(totalPages, p + 1));
                                        listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    disabled={currentPage === totalPages}
                                    className="p-1 text-zinc-500 hover:text-white disabled:opacity-30 transition-colors"
                                >
                                    <FaChevronRight className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {!isOpen && !hideTrigger && (
                <button
                    onClick={openPanel}
                    title="Behavioural Infractions"
                    className="bg-zinc-950 border border-white/20 w-10 h-10 shadow-2xl hover:bg-zinc-900 active:scale-95 transition-all flex items-center justify-center pointer-events-auto z-1000"
                >
                    <FaEye className="w-4 h-4 text-white" />
                </button>
            )}
        </div>
    );
}
