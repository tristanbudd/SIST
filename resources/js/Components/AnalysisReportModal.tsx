import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    FaXmark,
    FaShieldHalved,
    FaFileContract,
    FaCircleExclamation,
    FaCircleCheck,
    FaClock,
    FaEye,
    FaShip,
    FaCloudSun,
    FaCircleInfo,
    FaBuildingColumns,
    FaPassport,
    FaArrowUpRightFromSquare,
    FaRoute,
    FaMagnifyingGlass,
    FaGaugeHigh,
    FaCompass,
    FaArrowTrendUp,
    FaChevronLeft,
    FaChevronRight,
} from 'react-icons/fa6';
import {
    Vessel,
    VesselDetails,
    SanctionsData,
    SanctionRecord,
    WeatherData,
    TideData,
    HistoryPosition,
    VesselActivity,
} from './ShipDetailsSidebar';
import { SANCTIONER_MAPPING, WEATHER_CODES, NAV_STATUS_MAP } from '../constants';
import { formatPositionAge, getDistance, generateExternalLinks, formatShortDate } from '../utils';
import ExternalProviderIcon from './shared/ExternalProviderIcon';
import LoadingSpinner from './shared/LoadingSpinner';

interface AnalysisReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    vessel: Vessel;
    details: VesselDetails | null;
    sanctions: SanctionsData | null;
    weather: WeatherData | null;
    tides: TideData | null;
    history: HistoryPosition[];
    activities: VesselActivity[];
    isOffline: boolean;
    initialTab?: TabType;
    loading?: {
        details: boolean;
        weather: boolean;
        tides: boolean;
        sanctions: boolean;
        history: boolean;
        activities: boolean;
    };
}

import { calculateActivityStats } from './ShipDetailsSidebar';
const SanctionRecordCard = ({
    record,
    variant,
}: {
    record: SanctionRecord;
    variant: 'official' | 'network';
}) => {
    return (
        <div
            className={`p-4 border transition-all ${variant === 'official' ? 'bg-red-500/5 border-red-500/20' : 'bg-white/2 border-white/5'}`}
        >
            <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span
                            className={`text-xs font-black uppercase tracking-tight ${variant === 'official' ? 'text-red-400' : 'text-zinc-200'}`}
                        >
                            {record.name}
                        </span>
                        {record.match_type === 'fuzzy' && (
                            <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-500 text-[7px] font-black uppercase tracking-tighter rounded-sm">
                                Fuzzy Match
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-[8px] text-zinc-500 font-bold uppercase tracking-widest">
                        <FaBuildingColumns className="w-2.5 h-2.5" />
                        Source:{' '}
                        {record.source === 'fleetleaks'
                            ? 'FleetLeaks (Official)'
                            : 'Sanctions Network (Analysis)'}
                        {record.source_id && (
                            <span className="opacity-50"> • ID: {record.source_id}</span>
                        )}
                    </div>
                </div>
                {record.link && (
                    <a
                        href={record.link}
                        target="_blank"
                        rel="noreferrer"
                        className={`p-2 rounded-sm transition-all ${variant === 'official' ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20' : 'bg-white/5 hover:bg-white/10 text-zinc-400 border border-white/10'}`}
                        title="View Full Record"
                    >
                        <FaArrowUpRightFromSquare className="w-3 h-3" />
                    </a>
                )}
            </div>

            <div className="flex flex-col gap-4">
                {record.sanctioned_by && record.sanctioned_by.length > 0 && (
                    <div className="space-y-2">
                        <div className="text-[7px] text-zinc-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                            <FaPassport className="w-2.5 h-2.5" />
                            Official Watchlists
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {record.sanctioned_by.map((code: string) => {
                                const info = SANCTIONER_MAPPING[code.toLowerCase()];
                                return (
                                    <div
                                        key={code}
                                        className={`flex flex-col py-2 px-3 border-l-2 ${variant === 'official' ? 'border-red-500/40 bg-red-500/5' : 'border-zinc-700 bg-white/5'}`}
                                    >
                                        <span
                                            className={`text-[11px] font-black uppercase tracking-tight ${variant === 'official' ? 'text-red-400' : 'text-zinc-300'}`}
                                        >
                                            {info ? info.name : code.toUpperCase()}
                                        </span>
                                        <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                                            {info ? info.body : 'National Authority'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {record.matched_name && (
                    <div className="pt-3 border-t border-white/5 flex flex-col gap-1">
                        <span className="text-[7px] text-zinc-500 font-black uppercase tracking-widest">
                            Matched Identifier
                        </span>
                        <span className="text-[11px] text-zinc-400 font-mono">
                            {record.matched_name}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

type TabType = 'overview' | 'particulars' | 'sanctions' | 'environment' | 'waypoints' | 'activity';

const DataRow = ({
    label,
    value,
    subValue,
    isStale,
}: {
    label: string;
    value: React.ReactNode;
    subValue?: string;
    isStale?: boolean;
}) => (
    <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-white/5 last:border-0 group hover:bg-white/2 transition-colors px-2 ${isStale ? 'opacity-40 grayscale' : ''}`}
    >
        <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest group-hover:text-zinc-400 transition-colors">
            {label}
        </span>
        <div className="flex flex-col items-end">
            <span className="text-[11px] text-zinc-200 font-mono mt-1 sm:mt-0 text-right font-bold uppercase tracking-tight">
                {value}
            </span>
            {subValue && (
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">
                    {subValue}
                </span>
            )}
        </div>
    </div>
);

export default function AnalysisReportModal({
    isOpen,
    onClose,
    vessel,
    details,
    sanctions,
    weather,
    tides,
    history = [],
    activities = [],
    isOffline = false,
    initialTab,
    loading = {
        details: false,
        weather: false,
        tides: false,
        sanctions: false,
        history: false,
        activities: false,
    },
}: AnalysisReportModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>(initialTab || 'overview');
    const [prevInitialTab, setPrevInitialTab] = useState(initialTab);

    if (initialTab !== prevInitialTab) {
        setPrevInitialTab(initialTab);
        if (initialTab) {
            setActiveTab(initialTab);
        }
    }

    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
    if (isOpen !== prevIsOpen) {
        setPrevIsOpen(isOpen);
        if (isOpen) {
            setActiveTab(initialTab || 'overview');
        }
    }

    const [now] = useState(() => Date.now());
    const [animateIn, setAnimateIn] = useState(false);
    const [waypointFilters, setWaypointFilters] = useState({
        search: '',
        timeRange: 'all' as 'all' | '1h' | '6h' | '24h' | 'custom',
        movementType: 'all' as 'all' | 'moving' | 'stationary',
        relativeValue: '',
        relativeUnit: 'h' as 'm' | 'h' | 'd',
        customStart: '',
        customEnd: '',
    });
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;
    const [activityPage, setActivityPage] = useState(1);
    const activityPageSize = 5;

    const handleFilterUpdate = (update: Partial<typeof waypointFilters>) => {
        setWaypointFilters((prev) => ({ ...prev, ...update }));
        setCurrentPage(1);
    };

    const weatherContainerRef = useRef<HTMLDivElement>(null);
    const tideContainerRef = useRef<HTMLDivElement>(null);

    const filteredHistory = useMemo(() => {
        const now = new Date().getTime();
        return history.filter((pos) => {
            const speed = Number(pos.speed);
            const recordedAt = new Date(pos.recorded_at).getTime();

            // Movement Type Filter
            if (waypointFilters.movementType === 'moving' && speed < 0.5) return false;
            if (waypointFilters.movementType === 'stationary' && speed >= 0.5) return false;

            // Time Range Filter
            if (waypointFilters.timeRange === '1h' && now - recordedAt > 3600000) return false;
            if (waypointFilters.timeRange === '6h' && now - recordedAt > 21600000) return false;
            if (waypointFilters.timeRange === '24h' && now - recordedAt > 86400000) return false;

            if (waypointFilters.timeRange === 'custom') {
                if (waypointFilters.relativeValue) {
                    const val = parseFloat(waypointFilters.relativeValue);
                    if (!isNaN(val)) {
                        const ms =
                            waypointFilters.relativeUnit === 'm'
                                ? val * 60000
                                : waypointFilters.relativeUnit === 'h'
                                  ? val * 3600000
                                  : val * 86400000;
                        if (now - recordedAt > ms) return false;
                    }
                } else {
                    if (
                        waypointFilters.customStart &&
                        recordedAt < new Date(waypointFilters.customStart).getTime()
                    )
                        return false;
                    if (
                        waypointFilters.customEnd &&
                        recordedAt > new Date(waypointFilters.customEnd).getTime()
                    )
                        return false;
                }
            }

            // Search filter
            const matchesSearch =
                waypointFilters.search === '' ||
                formatShortDate(pos.recorded_at)
                    .toLowerCase()
                    .includes(waypointFilters.search.toLowerCase()) ||
                pos.lat.toString().includes(waypointFilters.search) ||
                pos.lng.toString().includes(waypointFilters.search);

            return matchesSearch;
        });
    }, [history, waypointFilters]);

    const activityStats = useMemo(() => {
        return calculateActivityStats(activities);
    }, [activities]);

    const paginatedHistory = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredHistory.slice(start, start + pageSize);
    }, [filteredHistory, currentPage]);

    const totalPages = Math.ceil(filteredHistory.length / pageSize);

    const filteredActivities = useMemo(() => {
        const days = 30;
        const cutoff = now - days * 24 * 60 * 60 * 1000;
        return activities.filter((a) => {
            return new Date(a.started_at).getTime() >= cutoff;
        });
    }, [activities, now]);

    const paginatedActivities = useMemo(() => {
        const start = (activityPage - 1) * activityPageSize;
        return filteredActivities.slice(start, start + activityPageSize);
    }, [filteredActivities, activityPage]);

    const totalActivityPages = Math.ceil(filteredActivities.length / activityPageSize);

    const stats = useMemo(() => {
        if (history.length === 0) return { avgSpeed: 0, maxSpeed: 0, totalDist: 0 };
        const speeds = history.map((p) => Number(p.speed));
        const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
        const maxSpeed = Math.max(...speeds);

        let totalDist = 0;
        for (let i = 0; i < history.length - 1; i++) {
            totalDist += getDistance(
                Number(history[i].lat),
                Number(history[i].lng),
                Number(history[i + 1].lat),
                Number(history[i + 1].lng)
            );
        }

        return { avgSpeed, maxSpeed, totalDist };
    }, [history]);

    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                setAnimateIn(true);
            }, 10);
            document.body.style.overflow = 'hidden';
            return () => {
                clearTimeout(timer);
                document.body.style.overflow = '';
            };
        } else {
            const timer = setTimeout(() => {
                setAnimateIn(false);
            }, 0);
            document.body.style.overflow = '';
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    useEffect(() => {
        if (activeTab === 'environment') {
            const scrollCurrent = (container: HTMLDivElement | null) => {
                if (!container) return;
                const currentItem = container.querySelector('[data-current="true"]');
                if (currentItem) {
                    currentItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            };
            const timer = setTimeout(() => {
                scrollCurrent(weatherContainerRef.current);
                scrollCurrent(tideContainerRef.current);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [activeTab, weather, tides]);

    const generatedLinks = useMemo(
        () => (vessel ? generateExternalLinks(vessel.mmsi, details?.imo || vessel.imo) : []),
        [vessel, details]
    );

    const isCurrentTime = (timeStr: string) => {
        const itemDate = new Date(timeStr);
        const now = new Date();
        return (
            itemDate.getUTCFullYear() === now.getUTCFullYear() &&
            itemDate.getUTCMonth() === now.getUTCMonth() &&
            itemDate.getUTCDate() === now.getUTCDate() &&
            itemDate.getUTCHours() === now.getUTCHours()
        );
    };

    const getWeatherDescription = (code: number) => WEATHER_CODES[code] || 'Unrecorded';

    const tabs: { id: TabType; label: string; icon: React.ReactNode; badge?: number }[] = [
        { id: 'overview', label: 'Overview', icon: <FaFileContract /> },
        { id: 'particulars', label: 'Particulars', icon: <FaShip /> },
        {
            id: 'sanctions',
            label: 'Sanctions',
            icon: <FaShieldHalved />,
            badge:
                sanctions?.sanctions?.filter(
                    (s) => s.source === 'fleetleaks' && s.match_type === 'exact'
                ).length || 0,
        },
        { id: 'environment', label: 'Environment', icon: <FaCloudSun /> },
        { id: 'waypoints', label: 'Waypoints', icon: <FaRoute /> },
        { id: 'activity', label: 'Activity', icon: <FaEye />, badge: activityStats.total },
    ];

    if (!isOpen) return null;

    return (
        <div
            className={`fixed inset-0 z-5000 flex items-center justify-center p-0 md:p-6 transition-all duration-500 ${animateIn ? 'opacity-100 backdrop-blur-md bg-black/60' : 'opacity-0 pointer-events-none'}`}
        >
            <div
                className={`relative w-full md:max-w-5xl h-full md:max-h-[85vh] bg-zinc-950 border-0 md:border border-white/10 shadow-2xl flex flex-col transform transition-all duration-500 ease-out ${animateIn ? 'translate-y-0 scale-100' : 'translate-y-12 md:translate-y-12 scale-100 md:scale-95 opacity-0'}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="analysis-modal-title"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/10 bg-zinc-900/80">
                    <div className="flex items-center gap-4">
                        <picture>
                            <source
                                type="image/webp"
                                srcSet="/images/logo-1x.webp 1x, /images/logo-2x.webp 2x, /images/logo-3x.webp 3x"
                            />
                            <img
                                src="/images/logo.png"
                                alt="SIST Logo"
                                className="h-10 object-contain opacity-90"
                            />
                        </picture>
                        <div className="w-px h-8 bg-white/20 mx-2" />
                        <div>
                            <h2
                                id="analysis-modal-title"
                                className="text-xl font-black text-white uppercase tracking-tight"
                            >
                                {details?.name || vessel.name || 'UNKNOWN VESSEL'}
                            </h2>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1 text-[11px] text-zinc-400 font-mono">
                                <span>MMSI: {vessel.mmsi}</span>
                                {!!(
                                    (details?.imo && String(details.imo) !== '0') ||
                                    (vessel.imo && String(vessel.imo) !== '0')
                                ) && (
                                    <>
                                        <span className="hidden sm:block w-1 h-1 bg-zinc-600 rounded-full" />
                                        <span>IMO: {details?.imo || vessel.imo}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2.5 hover:bg-white/10 transition-colors text-zinc-500 hover:text-white group"
                        aria-label="Close Report"
                    >
                        <FaXmark className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Navigation Sidebar */}
                    <div className="w-full md:w-56 border-r border-white/10 bg-zinc-950/80 flex flex-row md:flex-col p-3 gap-1 overflow-x-auto">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-3 px-4 py-3 text-left uppercase text-[11px] font-black tracking-widest transition-colors whitespace-nowrap ${activeTab === tab.id ? 'bg-white/10 text-white border-l-2 border-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border-l-2 border-transparent'}`}
                            >
                                <span
                                    className={
                                        activeTab === tab.id ? 'text-white' : 'text-zinc-500'
                                    }
                                >
                                    {tab.icon}
                                </span>
                                {tab.label}
                                {tab.badge !== undefined && tab.badge > 0 && (
                                    <span
                                        className={`ml-auto px-1.5 py-0.5 text-[8px] font-black rounded-sm transition-colors ${
                                            tab.id === 'sanctions'
                                                ? 'bg-red-500 text-white'
                                                : tab.id === 'activity'
                                                  ? activityStats.score > 70
                                                      ? 'bg-red-500 text-white'
                                                      : activityStats.score > 30
                                                        ? 'bg-amber-500 text-white'
                                                        : 'bg-emerald-500 text-white'
                                                  : 'bg-white text-zinc-950'
                                        }`}
                                    >
                                        {tab.badge}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 overflow-y-auto p-6 bg-zinc-950 relative">
                        {/* Global Loading Overlay */}
                        {loading.details && activeTab === 'overview' && (
                            <div className="absolute inset-0 bg-zinc-950/50 backdrop-blur-[2px] z-50 flex items-center justify-center">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-8 h-8 border-2 border-white/10 border-t-white/80 rounded-full animate-spin" />
                                    <span className="text-[10px] font-black text-white uppercase tracking-widest animate-pulse">
                                        Loading Intelligence...
                                    </span>
                                </div>
                            </div>
                        )}
                        {isOffline && (
                            <div className="bg-red-500/10 border border-red-500/50 p-4 mb-6 animate-in fade-in slide-in-from-top-2 duration-500">
                                <h4 className="text-red-400 font-bold uppercase tracking-widest text-xs mb-1">
                                    Offline / Historical Data Only
                                </h4>
                                <p className="text-red-400/80 text-[11px] leading-relaxed">
                                    This vessel has not transmitted AIS data in the last 15 minutes.
                                    All situational intelligence and environmental analysis is based
                                    on the last known coordinates and should be treated as
                                    historical.
                                </p>
                            </div>
                        )}

                        {activeTab === 'overview' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div
                                        className={`p-6 border flex flex-col justify-center items-center text-center gap-3 ${loading.sanctions ? 'bg-zinc-900 border-zinc-800' : sanctions?.is_sanctioned ? 'bg-red-500/5 border-red-500/20' : 'bg-emerald-500/5 border-emerald-500/10'}`}
                                    >
                                        <div className="text-[11px] text-zinc-500 uppercase font-bold tracking-widest">
                                            Sanction Status
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {loading.sanctions ? (
                                                <LoadingSpinner size="md" />
                                            ) : sanctions?.is_sanctioned ? (
                                                <FaCircleExclamation className="text-red-500 w-6 h-6" />
                                            ) : (
                                                <FaCircleCheck className="text-emerald-500 w-6 h-6" />
                                            )}
                                            <span
                                                className={`text-2xl font-black uppercase tracking-tight ${loading.sanctions ? 'text-zinc-700' : sanctions?.is_sanctioned ? 'text-red-500' : 'text-emerald-500'}`}
                                            >
                                                {loading.sanctions
                                                    ? 'Checking...'
                                                    : sanctions?.is_sanctioned
                                                      ? 'Sanctioned'
                                                      : 'Clear'}
                                            </span>
                                        </div>
                                    </div>
                                    <div
                                        className={`p-6 border flex flex-col justify-center items-center text-center gap-3 ${
                                            loading.activities
                                                ? 'bg-zinc-900 border-zinc-800'
                                                : activityStats.score > 70
                                                  ? 'bg-red-500/5 border-red-500/20'
                                                  : activityStats.score > 30
                                                    ? 'bg-amber-500/5 border-amber-500/10'
                                                    : 'bg-emerald-500/5 border-emerald-500/10'
                                        }`}
                                    >
                                        <div className="text-[11px] text-zinc-500 uppercase font-bold tracking-widest">
                                            Activity Status
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {loading.activities ? (
                                                <LoadingSpinner size="md" />
                                            ) : activityStats.score > 70 ? (
                                                <FaCircleExclamation className="text-red-500 w-6 h-6" />
                                            ) : activityStats.score > 30 ? (
                                                <FaCircleExclamation className="text-amber-500 w-6 h-6" />
                                            ) : (
                                                <FaCircleCheck className="text-emerald-500 w-6 h-6" />
                                            )}
                                            <span
                                                className={`text-2xl font-black uppercase tracking-tight ${
                                                    loading.activities
                                                        ? 'text-zinc-700'
                                                        : activityStats.score > 70
                                                          ? 'text-red-500'
                                                          : activityStats.score > 30
                                                            ? 'text-amber-500'
                                                            : 'text-emerald-500'
                                                }`}
                                            >
                                                {loading.activities
                                                    ? 'Analyzing...'
                                                    : activityStats.score > 70
                                                      ? 'High Risk'
                                                      : activityStats.score > 30
                                                        ? 'Medium Risk'
                                                        : 'Low Risk'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <section className={isOffline ? 'opacity-75 grayscale-[0.5]' : ''}>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">
                                            Quick Insights
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                                        <DataRow
                                            label="Current Speed"
                                            value={`${details?.speed ?? 0} kn`}
                                            isStale={isOffline}
                                        />
                                        <DataRow
                                            label="True Heading"
                                            value={details?.heading ? `${details.heading}°` : 'N/A'}
                                            isStale={isOffline}
                                        />
                                        <DataRow
                                            label="Navigation Status"
                                            value={details?.nav_status_text || 'Unknown'}
                                            isStale={isOffline}
                                        />
                                        <DataRow
                                            label="Last Update"
                                            value={formatPositionAge(details?.position_age_seconds)}
                                            isStale={isOffline}
                                        />
                                        <DataRow
                                            label="Vessel Type"
                                            value={
                                                details?.vessel_type_text?.split(',')[0] ||
                                                'Unknown'
                                            }
                                            isStale={isOffline}
                                        />
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-4">
                                        External Discovery
                                    </h3>
                                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                        {generatedLinks.map((link, idx) => (
                                            <a
                                                key={idx}
                                                href={link.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex flex-col items-center justify-center p-3 bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group gap-2"
                                            >
                                                <ExternalProviderIcon
                                                    name={link.source}
                                                    className="w-8 h-8 object-contain filter grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300"
                                                />
                                                <span className="text-[9px] font-black uppercase tracking-tight text-zinc-400 group-hover:text-zinc-200 text-center">
                                                    {link.source}
                                                </span>
                                            </a>
                                        ))}
                                    </div>
                                </section>

                                {isOffline && (
                                    <div className="mt-4 p-3 bg-white/5 border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                                        <div className="flex items-center gap-2 text-[11px] text-zinc-500 uppercase font-bold tracking-tight">
                                            <FaCircleInfo className="w-3 h-3 text-zinc-500 shrink-0" />
                                            <span>
                                                Greyed out fields indicate stale data and are not
                                                up-to-date.
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-zinc-500 font-mono font-bold uppercase tracking-widest sm:text-right w-full sm:w-auto border-t border-white/5 sm:border-0 pt-2 sm:pt-0">
                                            Last Seen:{' '}
                                            {details?.last_seen_at
                                                ? new Date(details.last_seen_at).toLocaleString(
                                                      'en-GB'
                                                  )
                                                : 'Unknown'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'particulars' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                    <FaShip className="text-zinc-500" />
                                    Full Vessel Specifications
                                </h3>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <section>
                                        <h4 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">
                                            Identity & Registry
                                        </h4>
                                        <div className="space-y-1">
                                            <DataRow
                                                label="Vessel Name"
                                                value={details?.name || vessel.name}
                                            />
                                            <DataRow label="MMSI Number" value={vessel.mmsi} />
                                            <DataRow
                                                label="IMO Number"
                                                value={details?.imo || 'N/A'}
                                            />
                                            <DataRow
                                                label="Call Sign"
                                                value={details?.call_sign || 'N/A'}
                                            />
                                            <DataRow
                                                label="Flag"
                                                value={details?.flying_flag_country || 'N/A'}
                                                subValue={details?.flying_flag}
                                            />
                                            <DataRow
                                                label="Registry"
                                                value={details?.registry_country || 'N/A'}
                                                subValue={details?.registry_continent}
                                            />
                                            <DataRow
                                                label="Home Timezone"
                                                value={details?.registry_timezone || 'UTC'}
                                            />
                                        </div>
                                    </section>
                                    <section>
                                        <h4 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">
                                            Technical & Dimensions
                                        </h4>
                                        <div className="space-y-1">
                                            <DataRow
                                                label="Classification"
                                                value={details?.vessel_type_text || 'Unknown'}
                                                subValue={`Code: ${details?.type || '--'}`}
                                            />
                                            <DataRow
                                                label="Navigational Status"
                                                value={
                                                    details?.nav_status_text ||
                                                    (details?.navigational_status !== undefined
                                                        ? NAV_STATUS_MAP[
                                                              details.navigational_status
                                                          ]
                                                        : 'Unknown')
                                                }
                                                subValue={`Code: ${details?.navigational_status ?? '--'}`}
                                                isStale={isOffline}
                                            />
                                            <DataRow
                                                label="Length Overall"
                                                value={
                                                    details?.length ? `${details.length} m` : 'N/A'
                                                }
                                            />
                                            <DataRow
                                                label="Beam (Width)"
                                                value={
                                                    details?.width ? `${details.width} m` : 'N/A'
                                                }
                                            />
                                            <DataRow
                                                label="Current Draught"
                                                value={
                                                    details?.draught
                                                        ? `${details.draught} m`
                                                        : 'N/A'
                                                }
                                                isStale={isOffline}
                                            />
                                        </div>
                                    </section>
                                </div>
                                <section>
                                    <h4 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">
                                        Voyage Information
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                                        <DataRow
                                            label="Reported Destination"
                                            value={details?.destination || 'Global Waters'}
                                            isStale={isOffline}
                                        />
                                        <DataRow
                                            label="Estimated Arrival"
                                            value={
                                                details?.eta ? formatShortDate(details.eta) : 'N/A'
                                            }
                                            isStale={isOffline}
                                        />
                                        <DataRow
                                            label="Last AIS Transmission"
                                            value={
                                                details?.last_seen_at
                                                    ? formatShortDate(details.last_seen_at)
                                                    : 'N/A'
                                            }
                                            isStale={isOffline}
                                        />
                                        <DataRow
                                            label="Position Age"
                                            value={formatPositionAge(details?.position_age_seconds)}
                                            isStale={isOffline}
                                        />
                                    </div>
                                </section>
                                {isOffline && (
                                    <div className="mt-8 p-3 bg-white/5 border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                                        <div className="flex items-center gap-2 text-[11px] text-zinc-500 uppercase font-bold tracking-tight">
                                            <FaCircleInfo className="w-3 h-3 text-zinc-500 shrink-0" />
                                            <span>
                                                Greyed out fields indicate stale data and are not
                                                up-to-date.
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-zinc-500 font-mono font-bold uppercase tracking-widest sm:text-right w-full sm:w-auto border-t border-white/5 sm:border-0 pt-2 sm:pt-0">
                                            Last Seen:{' '}
                                            {details?.last_seen_at
                                                ? formatShortDate(details.last_seen_at)
                                                : 'Unknown'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'sanctions' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                    <FaShieldHalved className="text-zinc-500" />
                                    Sanctions Intelligence
                                </h3>
                                {!sanctions?.sanctions || sanctions.sanctions.length === 0 ? (
                                    <div className="p-8 border border-emerald-500/20 bg-emerald-500/5 flex flex-col items-center justify-center text-center">
                                        <FaCircleCheck className="w-10 h-10 text-emerald-500/50 mb-3" />
                                        <h4 className="text-emerald-500 font-black">
                                            Clear from Watchlists
                                        </h4>
                                        <p className="text-emerald-500/70 text-[11px] mt-1 uppercase tracking-widest">
                                            No matches found on OFAC, UN, EU, or proprietary
                                            databases.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {(() => {
                                            const officialMatches = sanctions.sanctions.filter(
                                                (s) =>
                                                    s.source === 'fleetleaks' &&
                                                    s.match_type === 'exact'
                                            );
                                            const networkMatches = sanctions.sanctions.filter(
                                                (s) =>
                                                    !(
                                                        s.source === 'fleetleaks' &&
                                                        s.match_type === 'exact'
                                                    )
                                            );

                                            return (
                                                <div className="space-y-8">
                                                    {officialMatches.length > 0 && (
                                                        <div className="space-y-4">
                                                            <div className="flex items-center gap-3 border-b border-red-500/30 pb-2">
                                                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                                                <h4 className="text-red-400 font-black uppercase tracking-widest text-[11px]">
                                                                    Official Designations
                                                                </h4>
                                                            </div>
                                                            <div className="space-y-3">
                                                                {officialMatches.map((s, idx) => (
                                                                    <SanctionRecordCard
                                                                        key={`official-${idx}`}
                                                                        record={s}
                                                                        variant="official"
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {networkMatches.length > 0 && (
                                                        <div className="space-y-4">
                                                            <div className="flex items-center gap-3 border-b border-white/10 pb-2">
                                                                <div className="w-2 h-2 bg-zinc-600 rounded-full" />
                                                                <h4 className="text-zinc-500 font-black uppercase tracking-widest text-[11px]">
                                                                    Network Analysis Matches
                                                                </h4>
                                                            </div>
                                                            <div className="space-y-3">
                                                                {networkMatches.map((s, idx) => (
                                                                    <SanctionRecordCard
                                                                        key={`network-${idx}`}
                                                                        record={s}
                                                                        variant="network"
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'environment' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                    <FaCloudSun className="text-zinc-500" />
                                    Full Environmental Forecast
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/10 border border-white/10 overflow-hidden">
                                    <div className="bg-zinc-950 p-6 space-y-2 border-r border-white/5">
                                        <span className="text-[11px] text-zinc-500 uppercase font-black tracking-widest block">
                                            Atmosphere
                                        </span>
                                        <div className="text-5xl font-black text-white">
                                            {weather?.current?.temperature_c
                                                ? `${Number(weather.current.temperature_c).toFixed(1)}°C`
                                                : '--'}
                                        </div>
                                        <div className="text-[11px] text-zinc-500 uppercase font-bold tracking-tight">
                                            Current Air Temp
                                        </div>
                                    </div>
                                    <div className="bg-zinc-950 p-6 space-y-2">
                                        <span className="text-[11px] text-zinc-500 uppercase font-black tracking-widest block">
                                            Marine
                                        </span>
                                        <div className="text-5xl font-black text-cyan-400">
                                            {tides?.current?.wave_height
                                                ? `${Number(tides.current.wave_height).toFixed(1)}m`
                                                : '--'}
                                        </div>
                                        <div className="text-[11px] text-zinc-500 uppercase font-bold tracking-tight">
                                            Significant Wave
                                        </div>
                                    </div>
                                </div>

                                <section>
                                    <h4 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">
                                        Comprehensive Current Breakdown
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                        <DataRow
                                            label="Apparent Temp"
                                            value={
                                                weather?.current?.apparent_temperature_c
                                                    ? `${Number(weather.current.apparent_temperature_c).toFixed(1)}°C`
                                                    : 'N/A'
                                            }
                                        />
                                        <DataRow
                                            label="Wind Speed"
                                            value={
                                                weather?.current?.wind_speed_kph
                                                    ? `${Number(weather.current.wind_speed_kph).toFixed(1)} kph`
                                                    : 'N/A'
                                            }
                                        />
                                        <DataRow
                                            label="Wind Gusts"
                                            value={
                                                weather?.current?.wind_gusts_kph
                                                    ? `${Number(weather.current.wind_gusts_kph).toFixed(1)} kph`
                                                    : 'N/A'
                                            }
                                        />
                                        <DataRow
                                            label="Wind Direction"
                                            value={
                                                weather?.current?.wind_direction_degrees
                                                    ? `${weather.current.wind_direction_degrees}°`
                                                    : 'N/A'
                                            }
                                        />
                                        <DataRow
                                            label="Weather Status"
                                            value={
                                                weather?.current?.weather_code !== undefined
                                                    ? getWeatherDescription(
                                                          weather.current.weather_code
                                                      )
                                                    : 'N/A'
                                            }
                                        />
                                        <DataRow
                                            label="Daylight State"
                                            value={
                                                weather?.current?.is_day !== undefined
                                                    ? weather.current.is_day
                                                        ? 'Daylight'
                                                        : 'Night'
                                                    : 'N/A'
                                            }
                                        />

                                        <DataRow
                                            label="Sea Level (MSL)"
                                            value={
                                                tides?.current?.sea_level_height_msl
                                                    ? `${Number(tides.current.sea_level_height_msl).toFixed(2)}m`
                                                    : 'N/A'
                                            }
                                        />
                                        <DataRow
                                            label="Current Velocity"
                                            value={
                                                tides?.current?.ocean_current_velocity
                                                    ? `${Number(tides.current.ocean_current_velocity).toFixed(2)} kn`
                                                    : 'N/A'
                                            }
                                        />
                                        <DataRow
                                            label="Current Heading"
                                            value={
                                                tides?.current?.ocean_current_direction
                                                    ? `${tides.current.ocean_current_direction}°`
                                                    : 'N/A'
                                            }
                                        />
                                        <DataRow
                                            label="Significant Wave"
                                            value={
                                                tides?.current?.wave_height
                                                    ? `${Number(tides.current.wave_height).toFixed(1)}m`
                                                    : 'N/A'
                                            }
                                        />
                                        <DataRow
                                            label="Wave Period"
                                            value={
                                                tides?.current?.wave_period
                                                    ? `${Number(tides.current.wave_period).toFixed(1)}s`
                                                    : 'N/A'
                                            }
                                        />
                                        <DataRow
                                            label="Wave Direction"
                                            value={
                                                tides?.current?.wave_direction
                                                    ? `${tides.current.wave_direction}°`
                                                    : 'N/A'
                                            }
                                        />
                                    </div>
                                </section>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <section>
                                        <h4 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">
                                            Hourly Weather Outlook
                                        </h4>
                                        <div
                                            ref={weatherContainerRef}
                                            className="space-y-1.5 max-h-75 overflow-y-auto pr-2 scroll-smooth"
                                        >
                                            {!weather?.hourly || weather.hourly.length === 0 ? (
                                                <div className="h-20 flex items-center justify-center text-zinc-500 font-black uppercase tracking-widest text-[11px]">
                                                    N/A
                                                </div>
                                            ) : (
                                                weather.hourly.map((h, i) => {
                                                    const current = isCurrentTime(h.time);
                                                    return (
                                                        <div
                                                            key={i}
                                                            data-current={current}
                                                            className={`border p-3 flex items-center justify-between group transition-all ${current ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                                                        >
                                                            <div className="flex flex-col">
                                                                <span
                                                                    className={`text-[11px] font-mono ${current ? 'text-zinc-200' : 'text-zinc-400'}`}
                                                                >
                                                                    {new Date(
                                                                        h.time
                                                                    ).toLocaleTimeString('en-GB', {
                                                                        hour: '2-digit',
                                                                        minute: '2-digit',
                                                                        day: '2-digit',
                                                                        month: 'short',
                                                                    })}
                                                                    {current && (
                                                                        <span className="ml-2 px-1 py-0.5 bg-zinc-100 text-black text-[7px] font-black uppercase rounded-sm">
                                                                            Current
                                                                        </span>
                                                                    )}
                                                                </span>
                                                                <span className="text-[8px] text-zinc-500 uppercase font-bold mt-0.5">
                                                                    Wind:{' '}
                                                                    {Number(
                                                                        h.wind_speed_kph
                                                                    ).toFixed(1)}{' '}
                                                                    kph • Precip:{' '}
                                                                    {h.precipitation_mm}mm
                                                                </span>
                                                            </div>
                                                            <span
                                                                className={`text-sm font-black ${current ? 'text-zinc-100' : 'text-white'}`}
                                                            >
                                                                {Number(h.temperature_c).toFixed(1)}
                                                                °C
                                                            </span>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </section>
                                    <section>
                                        <h4 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">
                                            Marine Predictions
                                        </h4>
                                        <div
                                            ref={tideContainerRef}
                                            className="space-y-1.5 max-h-75 overflow-y-auto pr-2 scroll-smooth"
                                        >
                                            {!tides?.predictions ||
                                            tides.predictions.length === 0 ? (
                                                <div className="h-20 flex items-center justify-center text-zinc-500 font-black uppercase tracking-widest text-[11px]">
                                                    N/A
                                                </div>
                                            ) : (
                                                tides.predictions.map((p, i) => {
                                                    const current = isCurrentTime(p.time);
                                                    return (
                                                        <div
                                                            key={i}
                                                            data-current={current}
                                                            className={`border p-3 flex items-center justify-between group transition-all ${current ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                                                        >
                                                            <div className="flex flex-col">
                                                                <span
                                                                    className={`text-[11px] font-mono ${current ? 'text-zinc-200' : 'text-zinc-400'}`}
                                                                >
                                                                    {new Date(
                                                                        p.time
                                                                    ).toLocaleTimeString('en-GB', {
                                                                        hour: '2-digit',
                                                                        minute: '2-digit',
                                                                        day: '2-digit',
                                                                        month: 'short',
                                                                    })}
                                                                    {current && (
                                                                        <span className="ml-2 px-1 py-0.5 bg-cyan-500 text-black text-[7px] font-black uppercase rounded-sm">
                                                                            Current
                                                                        </span>
                                                                    )}
                                                                </span>
                                                                <span className="text-[8px] text-zinc-500 uppercase font-bold mt-0.5">
                                                                    MSL:{' '}
                                                                    {Number(
                                                                        p.sea_level_height_msl
                                                                    ).toFixed(2)}
                                                                    m
                                                                </span>
                                                            </div>
                                                            <span
                                                                className={`text-sm font-black ${current ? 'text-cyan-400' : 'text-cyan-500'}`}
                                                            >
                                                                {Number(p.wave_height).toFixed(1)}m
                                                            </span>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </section>
                                </div>

                                <div className="mt-4 p-3 bg-white/5 border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 uppercase font-bold tracking-tight">
                                        <FaClock className="w-3 h-3 shrink-0" />
                                        <span>Server Time (London)</span>
                                        <span className="text-zinc-400 font-mono">
                                            (
                                            {new Date().toLocaleTimeString('en-GB', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                timeZone: 'Europe/London',
                                            })}
                                            )
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-zinc-500 font-mono font-bold uppercase tracking-widest sm:text-right w-full sm:w-auto border-t border-white/5 sm:border-0 pt-2 sm:pt-0">
                                        Data: open-meteo.com
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'waypoints' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="flex flex-col gap-1">
                                    <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                        <FaRoute className="text-zinc-500" />
                                        Waypoint Analysis Report
                                    </h3>
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                                        Trajectory data and navigational diagnostics
                                    </p>
                                </div>

                                {/* Unified Filter & Search Panel */}
                                <div className="bg-white/2 border border-white/5 divide-y divide-white/5 overflow-hidden">
                                    {/* Full Width Search */}
                                    <div className="relative group">
                                        <FaMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-zinc-400 transition-colors w-3.5 h-3.5" />
                                        <input
                                            type="text"
                                            placeholder="SEARCH BY TIMESTAMP, LATITUDE, OR LONGITUDE..."
                                            value={waypointFilters.search}
                                            onChange={(e) =>
                                                handleFilterUpdate({ search: e.target.value })
                                            }
                                            className="w-full bg-transparent border-none text-white text-[10px] pl-10 pr-4 py-3.5 focus:outline-none focus:ring-0 font-bold uppercase tracking-wider placeholder:text-zinc-700"
                                        />
                                    </div>

                                    {/* Selectors Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2">
                                        <div className="p-4 space-y-3 bg-zinc-950/50">
                                            <div className="flex items-center gap-2 text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                                                <FaClock className="w-3 h-3" />
                                                Time Window
                                            </div>
                                            <div className="flex bg-white/5 border border-white/10 p-1">
                                                {(
                                                    ['all', '1h', '6h', '24h', 'custom'] as const
                                                ).map((t) => (
                                                    <button
                                                        key={t}
                                                        onClick={() =>
                                                            handleFilterUpdate({ timeRange: t })
                                                        }
                                                        className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest transition-colors ${waypointFilters.timeRange === t ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
                                                    >
                                                        {t === 'all' ? 'FULL' : t.toUpperCase()}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="p-4 space-y-3 bg-zinc-950/50 border-t md:border-t-0 md:border-l border-white/5">
                                            <div className="flex items-center gap-2 text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                                                <FaGaugeHigh className="w-3 h-3" />
                                                Movement Analysis
                                            </div>
                                            <div className="flex bg-white/5 border border-white/10 p-1">
                                                {(['all', 'moving', 'stationary'] as const).map(
                                                    (m) => (
                                                        <button
                                                            key={m}
                                                            onClick={() =>
                                                                handleFilterUpdate({
                                                                    movementType: m,
                                                                })
                                                            }
                                                            className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest transition-colors ${waypointFilters.movementType === m ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
                                                        >
                                                            {m.toUpperCase()}
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Custom Controls (Embedded) */}
                                    {waypointFilters.timeRange === 'custom' && (
                                        <div className="p-4 bg-zinc-900/30 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-1 duration-300">
                                            <div className="space-y-3">
                                                <span className="text-[9px] text-zinc-600 font-black uppercase tracking-widest block">
                                                    Relative Search (Last X)
                                                </span>
                                                <div className="flex flex-row gap-2">
                                                    <div className="flex-1 relative group">
                                                        <input
                                                            type="number"
                                                            placeholder="Amount"
                                                            value={waypointFilters.relativeValue}
                                                            onChange={(e) =>
                                                                handleFilterUpdate({
                                                                    relativeValue: e.target.value,
                                                                })
                                                            }
                                                            className="w-full bg-white/5 border border-white/10 text-white text-[10px] px-3 py-2 focus:outline-none focus:border-white/20 font-mono"
                                                        />
                                                    </div>
                                                    <select
                                                        value={waypointFilters.relativeUnit}
                                                        onChange={(e) =>
                                                            handleFilterUpdate({
                                                                relativeUnit: e.target.value as
                                                                    | 'm'
                                                                    | 'h'
                                                                    | 'd',
                                                            })
                                                        }
                                                        className="bg-zinc-900 border border-white/10 text-zinc-500 text-[9px] px-2 py-2 focus:outline-none font-black uppercase cursor-pointer hover:text-zinc-300 transition-colors w-24"
                                                    >
                                                        <option value="m">MINS</option>
                                                        <option value="h">HOURS</option>
                                                        <option value="d">DAYS</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <span className="text-[9px] text-zinc-600 font-black uppercase tracking-widest block">
                                                    Absolute Search Window
                                                </span>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input
                                                        type="datetime-local"
                                                        value={waypointFilters.customStart}
                                                        onChange={(e) =>
                                                            handleFilterUpdate({
                                                                customStart: e.target.value,
                                                            })
                                                        }
                                                        className="bg-zinc-900 border border-white/10 text-zinc-400 text-[10px] px-3 py-2 focus:outline-none focus:border-zinc-500 font-mono w-full appearance-none custom-datetime-picker"
                                                    />
                                                    <input
                                                        type="datetime-local"
                                                        value={waypointFilters.customEnd}
                                                        onChange={(e) =>
                                                            handleFilterUpdate({
                                                                customEnd: e.target.value,
                                                            })
                                                        }
                                                        className="bg-zinc-900 border border-white/10 text-zinc-400 text-[10px] px-3 py-2 focus:outline-none focus:border-zinc-500 font-mono w-full appearance-none custom-datetime-picker"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* History Context & Information */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-1 mb-2 gap-1.5 sm:gap-0">
                                    <div className="flex items-center gap-2">
                                        <FaClock className="w-2.5 h-2.5 text-zinc-600" />
                                        <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                                            Telemetry Window: {history.length} Points Captured
                                        </span>
                                    </div>
                                    <span className="text-[9px] font-bold text-zinc-700 uppercase tracking-tighter">
                                        {filteredHistory.length} Results after filtering
                                    </span>
                                </div>

                                {/* Simplified Stats */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-white/5 border border-white/5 overflow-hidden">
                                    <div className="bg-zinc-950/80 p-4 border-r border-white/5 space-y-1 relative overflow-hidden">
                                        <span className="text-[9px] text-zinc-600 font-black uppercase tracking-widest block">
                                            Average Speed
                                        </span>
                                        <div className="text-xl font-black text-zinc-300">
                                            {loading.history ? (
                                                <div className="h-7 w-12 bg-white/5 animate-pulse rounded-sm" />
                                            ) : (
                                                <>
                                                    {stats.avgSpeed.toFixed(1)}
                                                    <span className="text-[10px] text-zinc-600 ml-1">
                                                        KN
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="bg-zinc-950/80 p-4 border-r border-white/5 space-y-1 relative overflow-hidden">
                                        <span className="text-[9px] text-zinc-600 font-black uppercase tracking-widest block">
                                            Peak Speed
                                        </span>
                                        <div className="text-xl font-black text-zinc-300">
                                            {loading.history ? (
                                                <div className="h-7 w-12 bg-white/5 animate-pulse rounded-sm" />
                                            ) : (
                                                <>
                                                    {stats.maxSpeed.toFixed(1)}
                                                    <span className="text-[10px] text-zinc-600 ml-1">
                                                        KN
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="bg-zinc-950/80 p-4 space-y-1 col-span-2 sm:col-span-1 relative overflow-hidden">
                                        <span className="text-[9px] text-zinc-600 font-black uppercase tracking-widest block">
                                            Track Distance
                                        </span>
                                        <div className="text-xl font-black text-zinc-300">
                                            {loading.history ? (
                                                <div className="h-7 w-16 bg-white/5 animate-pulse rounded-sm" />
                                            ) : (
                                                <>
                                                    {stats.totalDist.toFixed(1)}
                                                    <span className="text-[10px] text-zinc-600 ml-1">
                                                        KM
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Waypoint List */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between px-1 text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-800 animate-pulse" />
                                            Active Dataset Analysis
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span>{filteredHistory.length} Total Records</span>
                                            {totalPages > 1 && (
                                                <span className="text-zinc-400">
                                                    Page {currentPage} of {totalPages}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="border border-white/5 bg-zinc-950 overflow-hidden shadow-sm">
                                        {/* Desktop Table */}
                                        <table className="hidden sm:table w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-white/2 border-b border-white/5">
                                                    <th className="px-4 py-3 text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                                                        Timestamp
                                                    </th>
                                                    <th className="px-4 py-3 text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                                                        Position
                                                    </th>
                                                    <th className="px-4 py-3 text-[9px] font-black text-zinc-500 uppercase tracking-widest text-right">
                                                        Speed
                                                    </th>
                                                    <th className="px-4 py-3 text-[9px] font-black text-zinc-500 uppercase tracking-widest text-right">
                                                        Course
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {loading.history ? (
                                                    Array.from({ length: 10 }).map((_, i) => (
                                                        <tr key={i} className="animate-pulse">
                                                            <td className="px-4 py-3">
                                                                <div className="h-3 w-20 bg-white/5 rounded-sm" />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="h-3 w-32 bg-white/5 rounded-sm" />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="h-3 w-12 bg-white/5 rounded-sm ml-auto" />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="h-3 w-16 bg-white/5 rounded-sm ml-auto" />
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : paginatedHistory.length === 0 ? (
                                                    <tr>
                                                        <td
                                                            colSpan={4}
                                                            className="px-4 py-12 text-center text-zinc-600 font-black uppercase tracking-widest text-[10px]"
                                                        >
                                                            No matching results
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    paginatedHistory.map((pos, idx) => {
                                                        const currentIdx = history.indexOf(pos);
                                                        const prevPos = history[currentIdx + 1];
                                                        const currentSpeed = Number(pos.speed);
                                                        const prevSpeed = prevPos
                                                            ? Number(prevPos.speed)
                                                            : currentSpeed;
                                                        const trend = currentSpeed - prevSpeed;

                                                        return (
                                                            <tr
                                                                key={idx}
                                                                className="hover:bg-white/2 transition-colors group"
                                                            >
                                                                <td className="px-4 py-3">
                                                                    <span className="text-[10px] text-zinc-400 font-mono">
                                                                        {formatShortDate(
                                                                            pos.recorded_at
                                                                        )}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <span className="text-[10px] text-zinc-500 font-mono">
                                                                        {Number(pos.lat).toFixed(4)}
                                                                        ,{' '}
                                                                        {Number(pos.lng).toFixed(4)}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        {trend !== 0 && (
                                                                            <FaArrowTrendUp
                                                                                className={`w-2 h-2 ${trend > 0 ? 'text-zinc-500' : 'text-zinc-700 rotate-180'}`}
                                                                            />
                                                                        )}
                                                                        <span className="text-[10px] font-black text-zinc-300">
                                                                            {currentSpeed.toFixed(
                                                                                1
                                                                            )}
                                                                            <span className="text-[8px] text-zinc-600 ml-1 font-normal">
                                                                                KN
                                                                            </span>
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <span className="text-[10px] text-zinc-400 font-mono">
                                                                            {Number(
                                                                                pos.course
                                                                            ).toFixed(0)}
                                                                            °
                                                                        </span>
                                                                        <FaCompass className="w-2.5 h-2.5 text-zinc-700" />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>

                                        {/* Mobile Card List */}
                                        <div className="sm:hidden divide-y divide-white/5">
                                            {loading.history ? (
                                                Array.from({ length: 5 }).map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className="p-4 space-y-3 animate-pulse"
                                                    >
                                                        <div className="flex justify-between">
                                                            <div className="h-3 w-24 bg-white/5 rounded-sm" />
                                                            <div className="h-3 w-12 bg-white/5 rounded-sm" />
                                                        </div>
                                                        <div className="h-3 w-32 bg-white/5 rounded-sm" />
                                                    </div>
                                                ))
                                            ) : paginatedHistory.length === 0 ? (
                                                <div className="px-4 py-12 text-center text-zinc-600 font-black uppercase tracking-widest text-[10px]">
                                                    No matching results
                                                </div>
                                            ) : (
                                                paginatedHistory.map((pos, idx) => {
                                                    const currentIdx = history.indexOf(pos);
                                                    const prevPos = history[currentIdx + 1];
                                                    const currentSpeed = Number(pos.speed);
                                                    const prevSpeed = prevPos
                                                        ? Number(prevPos.speed)
                                                        : currentSpeed;
                                                    const trend = currentSpeed - prevSpeed;

                                                    return (
                                                        <div
                                                            key={idx}
                                                            className="p-4 space-y-3 hover:bg-white/2 transition-colors"
                                                        >
                                                            <div className="flex justify-between items-start">
                                                                <span className="text-[10px] text-zinc-400 font-mono">
                                                                    {formatShortDate(
                                                                        pos.recorded_at
                                                                    )}
                                                                </span>
                                                                <div className="flex items-center gap-2">
                                                                    {trend !== 0 && (
                                                                        <FaArrowTrendUp
                                                                            className={`w-2 h-2 ${trend > 0 ? 'text-zinc-500' : 'text-zinc-700 rotate-180'}`}
                                                                        />
                                                                    )}
                                                                    <span className="text-[10px] font-black text-zinc-300">
                                                                        {currentSpeed.toFixed(1)}
                                                                        <span className="text-[8px] text-zinc-600 ml-0.5 font-normal">
                                                                            KN
                                                                        </span>
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex justify-between items-center text-[9px]">
                                                                <span className="text-zinc-500 font-mono">
                                                                    {Number(pos.lat).toFixed(4)},{' '}
                                                                    {Number(pos.lng).toFixed(4)}
                                                                </span>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-zinc-400 font-mono">
                                                                        {Number(pos.course).toFixed(
                                                                            0
                                                                        )}
                                                                        °
                                                                    </span>
                                                                    <FaCompass className="w-2.5 h-2.5 text-zinc-700" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* Pagination Controls - Always show to indicate system exists */}
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-white/5 mt-4">
                                        <div className="flex items-center justify-between w-full sm:w-auto gap-2">
                                            <button
                                                onClick={() =>
                                                    setCurrentPage((p) => Math.max(1, p - 1))
                                                }
                                                disabled={currentPage === 1 || totalPages <= 1}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 text-[9px] font-black text-zinc-500 uppercase tracking-widest hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <FaChevronLeft className="w-2 h-2" />
                                                Prev
                                            </button>
                                            <button
                                                onClick={() =>
                                                    setCurrentPage((p) =>
                                                        Math.min(totalPages, p + 1)
                                                    )
                                                }
                                                disabled={
                                                    currentPage === totalPages || totalPages <= 1
                                                }
                                                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 text-[9px] font-black text-zinc-500 uppercase tracking-widest hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                            >
                                                Next
                                                <FaChevronRight className="w-2 h-2" />
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-3 order-first sm:order-0">
                                            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                                                Page {currentPage} of {Math.max(1, totalPages)}
                                            </span>
                                            <span className="hidden sm:block w-1 h-1 bg-zinc-800 rounded-full" />
                                            <span className="hidden sm:block text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                                                {filteredHistory.length} Total Records
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'activity' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="space-y-1">
                                    <div className="flex flex-row flex-wrap items-center justify-between gap-3">
                                        <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                            <FaEye className="text-zinc-500" />
                                            Behavioral Analysis
                                        </h3>
                                        <div className="w-fit flex items-center gap-2 bg-white/5 px-3 py-1.5 border border-white/5 rounded-sm">
                                            <FaCircleInfo className="text-zinc-600 w-2.5 h-2.5" />
                                            <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest whitespace-nowrap">
                                                Last 30 Days Monitoring
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                                        Automated detection of suspicious maritime movement patterns
                                    </p>
                                </div>

                                <div className="flex-1 overflow-y-auto">
                                    {(() => {
                                        if (loading?.activities) {
                                            return (
                                                <div className="h-40 flex flex-col items-center justify-center gap-4">
                                                    <LoadingSpinner size="lg" />
                                                    <span className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] animate-pulse">
                                                        Running Analysis...
                                                    </span>
                                                </div>
                                            );
                                        }

                                        const displayActivities = activities;

                                        if (displayActivities.length === 0) {
                                            return (
                                                <div className="p-8 border border-emerald-500/20 bg-emerald-500/5 flex flex-col items-center justify-center text-center">
                                                    <FaCircleCheck className="w-10 h-10 text-emerald-500/50 mb-3" />
                                                    <h4 className="text-emerald-500 font-black">
                                                        Clear Profile
                                                    </h4>
                                                    <p className="text-emerald-500/70 text-[11px] mt-1 uppercase tracking-widest">
                                                        No suspicious behavioral patterns or
                                                        movement anomalies detected.
                                                    </p>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="space-y-6">
                                                {/* Boxed Activity Stats */}
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/10 border border-white/10 overflow-hidden">
                                                    <div className="bg-zinc-950 p-5 space-y-1 border-r border-white/5">
                                                        <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">
                                                            Risk Level
                                                        </span>
                                                        <div
                                                            className={`text-xl font-black uppercase tracking-tight ${
                                                                activityStats.score > 70
                                                                    ? 'text-red-500'
                                                                    : activityStats.score > 30
                                                                      ? 'text-amber-500'
                                                                      : 'text-emerald-500'
                                                            }`}
                                                        >
                                                            {activityStats.score > 70
                                                                ? 'High Risk'
                                                                : activityStats.score > 30
                                                                  ? 'Medium Risk'
                                                                  : 'Low Risk'}
                                                        </div>
                                                        <div className="text-[9px] text-zinc-600 uppercase font-bold tracking-tight">
                                                            Current Status
                                                        </div>
                                                    </div>
                                                    <div className="bg-zinc-950 p-5 space-y-1 border-r border-white/5">
                                                        <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">
                                                            Risk Score
                                                        </span>
                                                        <div className="text-4xl font-black text-white">
                                                            {activityStats.score}%
                                                        </div>
                                                        <div className="text-[9px] text-zinc-600 uppercase font-bold tracking-tight">
                                                            Profile Analysis
                                                        </div>
                                                    </div>
                                                    <div className="bg-zinc-950 p-5 space-y-1 border-r border-white/5">
                                                        <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">
                                                            High Risk
                                                        </span>
                                                        <div className="text-4xl font-black text-zinc-300">
                                                            {activityStats.highRisk}
                                                        </div>
                                                        <div className="text-[9px] text-zinc-600 uppercase font-bold tracking-tight">
                                                            Critical Alerts
                                                        </div>
                                                    </div>
                                                    <div className="bg-zinc-950 p-5 space-y-1">
                                                        <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">
                                                            Records
                                                        </span>
                                                        <div className="text-4xl font-black text-zinc-300">
                                                            {activityStats.total}
                                                        </div>
                                                        <div className="text-[9px] text-zinc-600 uppercase font-bold tracking-tight">
                                                            Historical Log
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Simplified Activity List */}
                                                <div className="space-y-3">
                                                    {paginatedActivities.map((activity) => (
                                                        <div
                                                            key={activity.id}
                                                            className="p-4 border border-white/5 bg-white/2 hover:bg-white/4 transition-colors"
                                                        >
                                                            <div className="flex justify-between items-start mb-3">
                                                                <div className="flex items-center gap-3">
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[11px] font-black uppercase tracking-tight text-white">
                                                                                {activity.type
                                                                                    .replace(
                                                                                        /_/g,
                                                                                        ' '
                                                                                    )
                                                                                    .toUpperCase()}
                                                                            </span>
                                                                            <span
                                                                                className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-sm bg-zinc-900 ${
                                                                                    activity.severity ===
                                                                                    'high'
                                                                                        ? 'text-red-500'
                                                                                        : activity.severity ===
                                                                                            'medium'
                                                                                          ? 'text-amber-500'
                                                                                          : 'text-emerald-500'
                                                                                }`}
                                                                            >
                                                                                {activity.severity}{' '}
                                                                                risk
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                                                                            {formatShortDate(
                                                                                activity.started_at
                                                                            )}
                                                                            {activity.ended_at &&
                                                                                ` - ${formatShortDate(activity.ended_at)}`}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <p className="text-[11px] text-zinc-400 font-medium leading-relaxed mb-4">
                                                                {activity.description.replace(
                                                                    /\(([\d.]+)\s*(?:min|minutes)\)/g,
                                                                    (match, minutes) => {
                                                                        const totalSeconds =
                                                                            Math.round(
                                                                                parseFloat(
                                                                                    minutes
                                                                                ) * 60
                                                                            );

                                                                        if (totalSeconds < 60)
                                                                            return `(${totalSeconds} seconds)`;
                                                                        if (totalSeconds < 3600) {
                                                                            const m = Math.floor(
                                                                                totalSeconds / 60
                                                                            );
                                                                            return `(${m} minute${m !== 1 ? 's' : ''})`;
                                                                        }
                                                                        if (totalSeconds < 86400) {
                                                                            const h = Math.floor(
                                                                                totalSeconds / 3600
                                                                            );
                                                                            const m = Math.floor(
                                                                                (totalSeconds %
                                                                                    3600) /
                                                                                    60
                                                                            );
                                                                            return `(${h} hour${h !== 1 ? 's' : ''}${m > 0 ? `, ${m} minute${m !== 1 ? 's' : ''}` : ''})`;
                                                                        }
                                                                        if (
                                                                            totalSeconds < 2592000
                                                                        ) {
                                                                            const d = Math.floor(
                                                                                totalSeconds / 86400
                                                                            );
                                                                            const h = Math.floor(
                                                                                (totalSeconds %
                                                                                    86400) /
                                                                                    3600
                                                                            );
                                                                            return `(${d} day${d !== 1 ? 's' : ''}${h > 0 ? `, ${h} hour${h !== 1 ? 's' : ''}` : ''})`;
                                                                        }
                                                                        if (
                                                                            totalSeconds < 31536000
                                                                        ) {
                                                                            const mo = Math.floor(
                                                                                totalSeconds /
                                                                                    2592000
                                                                            );
                                                                            const d = Math.floor(
                                                                                (totalSeconds %
                                                                                    2592000) /
                                                                                    86400
                                                                            );
                                                                            return `(${mo} month${mo !== 1 ? 's' : ''}${d > 0 ? `, ${d} day${d !== 1 ? 's' : ''}` : ''})`;
                                                                        }
                                                                        const y = Math.floor(
                                                                            totalSeconds / 31536000
                                                                        );
                                                                        const mo = Math.floor(
                                                                            (totalSeconds %
                                                                                31536000) /
                                                                                2592000
                                                                        );
                                                                        return `(${y} year${y !== 1 ? 's' : ''}${mo > 0 ? `, ${mo} month${mo !== 1 ? 's' : ''}` : ''})`;
                                                                    }
                                                                )}
                                                            </p>

                                                            {activity.details && (
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 pt-4 border-t border-white/5">
                                                                    {Object.entries(
                                                                        activity.details
                                                                    ).map(([key, value]) => {
                                                                        const isDuration =
                                                                            key ===
                                                                            'duration_minutes';
                                                                        const displayKey =
                                                                            isDuration
                                                                                ? 'duration'
                                                                                : key;
                                                                        const displayValue =
                                                                            isDuration &&
                                                                            typeof value ===
                                                                                'number'
                                                                                ? (() => {
                                                                                      const totalSeconds =
                                                                                          Math.round(
                                                                                              value *
                                                                                                  60
                                                                                          );
                                                                                      if (
                                                                                          totalSeconds <
                                                                                          60
                                                                                      )
                                                                                          return `${totalSeconds} seconds`;
                                                                                      if (
                                                                                          totalSeconds <
                                                                                          3600
                                                                                      ) {
                                                                                          const m =
                                                                                              Math.floor(
                                                                                                  totalSeconds /
                                                                                                      60
                                                                                              );
                                                                                          return `${m} minute${m !== 1 ? 's' : ''}`;
                                                                                      }
                                                                                      if (
                                                                                          totalSeconds <
                                                                                          86400
                                                                                      ) {
                                                                                          const h =
                                                                                              Math.floor(
                                                                                                  totalSeconds /
                                                                                                      3600
                                                                                              );
                                                                                          const m =
                                                                                              Math.floor(
                                                                                                  (totalSeconds %
                                                                                                      3600) /
                                                                                                      60
                                                                                              );
                                                                                          return `${h} hour${h !== 1 ? 's' : ''}${m > 0 ? `, ${m} minute${m !== 1 ? 's' : ''}` : ''}`;
                                                                                      }
                                                                                      if (
                                                                                          totalSeconds <
                                                                                          2592000
                                                                                      ) {
                                                                                          const d =
                                                                                              Math.floor(
                                                                                                  totalSeconds /
                                                                                                      86400
                                                                                              );
                                                                                          const h =
                                                                                              Math.floor(
                                                                                                  (totalSeconds %
                                                                                                      86400) /
                                                                                                      3600
                                                                                              );
                                                                                          return `${d} day${d !== 1 ? 's' : ''}${h > 0 ? `, ${h} hour${h !== 1 ? 's' : ''}` : ''}`;
                                                                                      }
                                                                                      if (
                                                                                          totalSeconds <
                                                                                          31536000
                                                                                      ) {
                                                                                          const mo =
                                                                                              Math.floor(
                                                                                                  totalSeconds /
                                                                                                      2592000
                                                                                              );
                                                                                          const d =
                                                                                              Math.floor(
                                                                                                  (totalSeconds %
                                                                                                      2592000) /
                                                                                                      86400
                                                                                              );
                                                                                          return `${mo} month${mo !== 1 ? 's' : ''}${d > 0 ? `, ${d} day${d !== 1 ? 's' : ''}` : ''}`;
                                                                                      }
                                                                                      const y =
                                                                                          Math.floor(
                                                                                              totalSeconds /
                                                                                                  31536000
                                                                                          );
                                                                                      const mo =
                                                                                          Math.floor(
                                                                                              (totalSeconds %
                                                                                                  31536000) /
                                                                                                  2592000
                                                                                          );
                                                                                      return `${y} year${y !== 1 ? 's' : ''}${mo > 0 ? `, ${mo} month${mo !== 1 ? 's' : ''}` : ''}`;
                                                                                  })()
                                                                                : typeof value ===
                                                                                    'number'
                                                                                  ? value.toFixed(1)
                                                                                  : typeof value ===
                                                                                      'object'
                                                                                    ? JSON.stringify(
                                                                                          value
                                                                                      )
                                                                                    : String(value);

                                                                        return (
                                                                            <div
                                                                                key={key}
                                                                                className="flex flex-col gap-0.5"
                                                                            >
                                                                                <span className="text-[7px] text-zinc-600 font-black uppercase tracking-widest">
                                                                                    {displayKey.replace(
                                                                                        /_/g,
                                                                                        ' '
                                                                                    )}
                                                                                </span>
                                                                                <span className="text-[10px] text-zinc-400 font-mono">
                                                                                    {displayValue}
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Pagination Controls */}
                                                {totalActivityPages > 1 && (
                                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/5">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() =>
                                                                    setActivityPage((p) =>
                                                                        Math.max(1, p - 1)
                                                                    )
                                                                }
                                                                disabled={activityPage === 1}
                                                                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 text-[9px] font-black text-zinc-500 uppercase tracking-widest hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                                            >
                                                                <FaChevronLeft className="w-2 h-2" />
                                                                Prev
                                                            </button>
                                                            <button
                                                                onClick={() =>
                                                                    setActivityPage((p) =>
                                                                        Math.min(
                                                                            totalActivityPages,
                                                                            p + 1
                                                                        )
                                                                    )
                                                                }
                                                                disabled={
                                                                    activityPage ===
                                                                    totalActivityPages
                                                                }
                                                                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 text-[9px] font-black text-zinc-500 uppercase tracking-widest hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                                            >
                                                                Next
                                                                <FaChevronRight className="w-2 h-2" />
                                                            </button>
                                                        </div>
                                                        <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                                                            Page {activityPage} of{' '}
                                                            {totalActivityPages}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
