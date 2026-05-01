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
} from 'react-icons/fa6';
import {
    Vessel,
    VesselDetails,
    SanctionsData,
    SanctionRecord,
    WeatherData,
    TideData,
} from './ShipDetailsSidebar';

interface AnalysisReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    vessel: Vessel;
    details: VesselDetails | null;
    sanctions: SanctionsData | null;
    weather: WeatherData | null;
    tides: TideData | null;
    isOffline: boolean;
}

const SANCTIONER_MAPPING: Record<string, { name: string; body: string }> = {
    us: { name: 'United States (US)', body: 'OFAC SDN / BIS List' },
    eu: { name: 'European Union (EU)', body: 'EEAS Consolidated List' },
    un: { name: 'United Nations (UN)', body: 'UNSC Sanctions Regimes' },
    uk: { name: 'United Kingdom (UK)', body: 'HM Treasury (OFSI)' },
    ca: { name: 'Canada (CA)', body: 'Special Economic Measures (SARA)' },
    au: { name: 'Australia (AU)', body: 'DFAT Consolidated List' },
    jp: { name: 'Japan (JP)', body: 'METI Asset Freeze List' },
    ch: { name: 'Switzerland (CH)', body: 'SECO Sanctions' },
    fr: { name: 'France (FR)', body: 'National Asset Freeze List' },
    no: { name: 'Norway (NO)', body: 'MFA Sanctions List' },
    ru: { name: 'Russia (RU)', body: 'Rosfinmonitoring Watchlist' },
    ua: { name: 'Ukraine (UA)', body: 'NSDC Sanctions' },
    ina: { name: 'Indonesia (INA)', body: 'National Authority (BAPETEN)' },
    kr: { name: 'South Korea (KR)', body: 'Financial Services Commission' },
    sg: { name: 'Singapore (SG)', body: 'MAS Sanctions List' },
};

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

type TabType = 'overview' | 'particulars' | 'sanctions' | 'environment' | 'activity';

function formatPositionAge(seconds: number | undefined): string {
    if (seconds === undefined) return 'N/A';
    const absSec = Math.round(Math.abs(seconds));

    if (absSec < 60) return `${absSec} second${absSec !== 1 ? 's' : ''} ago`;
    if (absSec < 3600) {
        const mins = Math.floor(absSec / 60);
        return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
    }
    if (absSec < 86400) {
        const hours = Math.floor(absSec / 3600);
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }
    if (absSec < 604800) {
        const days = Math.floor(absSec / 86400);
        return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
    if (absSec < 2592000) {
        const weeks = Math.floor(absSec / 604800);
        return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
    }
    const months = Math.floor(absSec / 2592000);
    return `${months} month${months !== 1 ? 's' : ''} ago`;
}

function ExternalProviderIcon({ name, className = '' }: { name: string; className?: string }) {
    const iconMap: Record<string, string> = {
        'marinetraffic (com)': '/images/external/vesseltrackercom.png',
        'marinetraffic (org)': '/images/external/marinetrafficorg.png',
        vesselfinder: '/images/external/vesselfinder.png',
        vesseltracker: '/images/external/vesseltracker.png',
        shipspotting: '/images/external/shipspotting.png',
        myshiptracking: '/images/external/myshiptracking.png',
    };

    const iconPath = iconMap[name.toLowerCase()];

    if (iconPath) {
        return (
            <img
                src={iconPath}
                alt={`${name} logo`}
                className={className}
                onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                }}
            />
        );
    }
    return null;
}

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
    isOffline = false,
}: AnalysisReportModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [animateIn, setAnimateIn] = useState(false);

    const weatherContainerRef = useRef<HTMLDivElement>(null);
    const tideContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                setAnimateIn(true);
                setActiveTab('overview');
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

    const generatedLinks = useMemo(() => {
        if (!vessel) return [];
        const mmsi = vessel.mmsi;
        const imo = details?.imo || vessel.imo;

        return [
            {
                source: 'MarineTraffic (COM)',
                url: imo
                    ? `https://www.marinetraffic.com/en/ais/details/ships/imo:${imo}`
                    : `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${mmsi}`,
            },
            {
                source: 'VesselFinder',
                url: imo
                    ? `https://www.vesselfinder.com/vessels/details/${imo}`
                    : `https://www.vesselfinder.com/vessels?name=${mmsi}`,
            },
            {
                source: 'VesselTracker',
                url: imo
                    ? `https://www.vesseltracker.com/en/Ships/${imo}.html`
                    : `https://www.vesseltracker.com/en/vessels.html?search=${mmsi}`,
            },
            {
                source: 'MarineTraffic (ORG)',
                url: `https://www.marinetraffic.org/vessels?vessel=${imo || mmsi}`,
            },
            {
                source: 'ShipSpotting',
                url: imo
                    ? `https://www.shipspotting.com/photos/gallery?imo=${imo}`
                    : `https://www.shipspotting.com/photos/gallery?mmsi=${mmsi}`,
            },
            {
                source: 'MyShipTracking',
                url: `https://www.myshiptracking.com/vessels/mmsi-${mmsi}`,
            },
        ];
    }, [vessel, details]);

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

    const getWeatherDescription = (code: number) => {
        const codes: Record<number, string> = {
            0: 'Clear Sky',
            1: 'Mainly Clear',
            2: 'Partly Cloudy',
            3: 'Overcast',
            45: 'Fog',
            48: 'Depositing Rime Fog',
            51: 'Light Drizzle',
            53: 'Moderate Drizzle',
            55: 'Dense Drizzle',
            61: 'Slight Rain',
            63: 'Moderate Rain',
            65: 'Heavy Rain',
            71: 'Slight Snowfall',
            73: 'Moderate Snowfall',
            75: 'Heavy Snowfall',
            95: 'Thunderstorm',
        };
        return codes[code] || 'Unrecorded';
    };

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
        { id: 'activity', label: 'Activity', icon: <FaEye /> },
    ];

    if (!isOpen) return null;

    return (
        <div
            className={`fixed inset-0 z-3000 flex items-center justify-center p-4 sm:p-6 transition-all duration-500 ${animateIn ? 'opacity-100 backdrop-blur-md bg-black/60' : 'opacity-0 pointer-events-none'}`}
        >
            <div
                className={`relative w-full max-w-5xl h-full max-h-[85vh] bg-zinc-950 border border-white/10 shadow-2xl flex flex-col transform transition-all duration-500 ease-out ${animateIn ? 'translate-y-0 scale-100' : 'translate-y-12 scale-95 opacity-0'}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="analysis-modal-title"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/10 bg-zinc-900/80">
                    <div className="flex items-center gap-4">
                        <img
                            src="/images/logo.png"
                            alt="SIST Logo"
                            className="h-10 object-contain opacity-90"
                        />
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
                                {details?.imo && (
                                    <div className="flex items-center gap-3">
                                        <span className="hidden sm:block w-1 h-1 bg-zinc-600 rounded-full" />
                                        <span>IMO: {details.imo}</span>
                                    </div>
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
                                        className={`ml-auto px-1.5 py-0.5 text-[8px] rounded-sm ${activeTab === tab.id ? 'bg-red-500 text-white' : 'bg-red-500/20 text-red-400'}`}
                                    >
                                        {tab.badge}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-zinc-950">
                        {isOffline && (
                            <div className="bg-red-500/10 border border-red-500/50 p-4 mb-6 animate-in fade-in slide-in-from-top-2 duration-500">
                                <h4 className="text-red-400 font-bold uppercase tracking-widest text-xs mb-1">
                                    Offline / Historical Data Only
                                </h4>
                                <p className="text-red-400/80 text-[11px] leading-relaxed uppercase font-bold tracking-tight">
                                    This vessel has not transmitted AIS data in the last hour. All
                                    situational intelligence and environmental analysis is based on
                                    the last known coordinates and should be treated as historical.
                                </p>
                            </div>
                        )}

                        {activeTab === 'overview' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div
                                        className={`p-6 border flex flex-col justify-center items-center text-center gap-3 ${sanctions?.is_sanctioned ? 'bg-red-500/5 border-red-500/20' : 'bg-emerald-500/5 border-emerald-500/10'}`}
                                    >
                                        <div className="text-[11px] text-zinc-500 uppercase font-bold tracking-widest">
                                            Sanction Status
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {sanctions?.is_sanctioned ? (
                                                <FaCircleExclamation className="text-red-500 w-6 h-6" />
                                            ) : (
                                                <FaCircleCheck className="text-emerald-500 w-6 h-6" />
                                            )}
                                            <span
                                                className={`text-2xl font-black uppercase tracking-tight ${sanctions?.is_sanctioned ? 'text-red-500' : 'text-emerald-500'}`}
                                            >
                                                {sanctions?.is_sanctioned ? 'Sanctioned' : 'Clear'}
                                            </span>
                                        </div>
                                    </div>
                                    <div
                                        className={`p-6 border bg-white/5 border-white/10 flex flex-col justify-center text-center gap-1 transition-all ${isOffline ? 'opacity-40 grayscale' : ''}`}
                                    >
                                        <div className="text-[11px] text-zinc-500 uppercase font-bold tracking-widest mb-1">
                                            Navigational Status
                                        </div>
                                        <span className="text-xl font-black text-white uppercase truncate">
                                            {details?.nav_status_text || 'Unknown'}
                                        </span>
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
                                                value={details?.nav_status_text || 'Unknown'}
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
                                                details?.eta
                                                    ? new Date(details.eta).toLocaleString('en-GB')
                                                    : 'N/A'
                                            }
                                            isStale={isOffline}
                                        />
                                        <DataRow
                                            label="Last AIS Transmission"
                                            value={
                                                details?.last_seen_at
                                                    ? new Date(details.last_seen_at).toLocaleString(
                                                          'en-GB'
                                                      )
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
                                                ? new Date(details.last_seen_at).toLocaleString(
                                                      'en-GB'
                                                  )
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
                                            className="space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 scroll-smooth"
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
                                            className="space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 scroll-smooth"
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

                        {activeTab === 'activity' && (
                            <div className="h-full flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-300">
                                <h3 className="text-lg font-black text-white uppercase tracking-widest mb-2">
                                    Activity Tracking
                                </h3>
                                <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest">
                                    Module currently under development (Work in Progress)
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
