import { useMemo, useState } from 'react';
import {
    FaRuler,
    FaXmark,
    FaToolbox,
    FaDrawPolygon,
    FaCircleXmark,
    FaArrowRotateLeft,
    FaArrowRotateRight,
} from 'react-icons/fa6';
import { getDistance } from '../utils';

interface MapToolsPanelProps {
    onMeasureDistance?: () => void;
    onMeasureArea?: () => void;
    onExitTool?: () => void;
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
    isOpen?: boolean;
    onOpen?: () => void;
    onClose?: () => void;
    hideTrigger?: boolean;
    measurementMode?: 'distance' | 'area' | null;
    measurementPoints?: { lat: number; lng: number }[];
}

export default function MapToolsPanel({
    onMeasureDistance,
    onMeasureArea,
    onExitTool,
    onUndo,
    onRedo,
    canUndo = false,
    canRedo = false,
    isOpen: isOpenProp,
    onOpen,
    onClose,
    hideTrigger = false,
    measurementMode = null,
    measurementPoints = [],
}: MapToolsPanelProps) {
    const [isOpenInternal, setIsOpenInternal] = useState(false);
    const isOpen = isOpenProp ?? isOpenInternal;
    const openPanel = onOpen ?? (() => setIsOpenInternal(true));
    const closePanel = () => {
        onExitTool?.();
        if (onClose) {
            onClose();
        } else {
            setIsOpenInternal(false);
        }
    };
    const togglePanel = () => {
        if (isOpen) {
            closePanel();
        } else {
            openPanel();
        }
    };

    const measurementSummary = useMemo(() => {
        if (!measurementMode) return null;
        if (measurementMode === 'distance') {
            const distanceKm = measurementPoints.reduce((total, point, index) => {
                if (index === 0) return total;
                const previous = measurementPoints[index - 1];
                return total + getDistance(previous.lat, previous.lng, point.lat, point.lng);
            }, 0);
            return {
                label: 'Distance Tool',
                value: formatMeasurement(distanceKm, 'km'),
            };
        }

        const areaKm = calculatePolygonArea(measurementPoints);
        return {
            label: 'Area Tool',
            value: formatMeasurement(areaKm, 'km2'),
        };
    }, [measurementMode, measurementPoints]);

    return (
        <div className="flex flex-col items-start gap-2 pointer-events-auto">
            {isOpen && (
                <div className="fixed inset-x-0 bottom-[calc(2rem+env(safe-area-inset-bottom))] bg-zinc-950 border-t border-white/20 p-3 pb-3 shadow-2xl flex flex-col gap-3 max-h-[45vh] overflow-y-auto animate-in slide-in-from-bottom-2 duration-200 sm:static sm:max-h-none sm:overflow-visible sm:w-56 sm:border sm:border-white/20 sm:pb-3">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                            Map Tools
                        </span>
                        <button
                            onClick={closePanel}
                            className="text-zinc-500 hover:text-white transition-colors w-7 h-7 flex items-center justify-center rounded hover:bg-white/10"
                            title="Close"
                        >
                            <FaXmark className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex flex-col gap-3 sm:grid sm:grid-cols-[1fr,1fr] sm:items-start sm:gap-4">
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => {
                                    onMeasureDistance?.();
                                }}
                                className={`flex items-center gap-3 px-3 py-2 text-left border transition-all active:scale-95 w-full ${
                                    measurementMode === 'distance'
                                        ? 'bg-white/5 border-white/20 text-white'
                                        : 'border-transparent hover:bg-zinc-900 hover:border-white/5 text-white'
                                }`}
                            >
                                <FaRuler className="w-4 h-4 text-white shrink-0" />
                                <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                                    Measure Distance
                                </span>
                            </button>

                            <button
                                onClick={() => {
                                    onMeasureArea?.();
                                }}
                                className={`flex items-center gap-3 px-3 py-2 text-left border transition-all active:scale-95 w-full ${
                                    measurementMode === 'area'
                                        ? 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                                        : 'border-transparent hover:bg-zinc-900 hover:border-white/5 text-white'
                                }`}
                            >
                                <FaDrawPolygon className="w-4 h-4 text-white shrink-0" />
                                <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                                    Measure Area
                                </span>
                            </button>
                        </div>

                        {measurementSummary && (
                            <div className="border-t border-white/10 pt-3 flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                        Active: {measurementSummary.label}
                                    </span>
                                </div>
                                <div className="text-sm font-bold text-white">
                                    {measurementSummary.value}
                                </div>
                                <div className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider">
                                    Tap map to add points
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={onUndo}
                                        disabled={!canUndo}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/5 text-white border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-colors disabled:opacity-40 disabled:hover:bg-white/5"
                                        title="Undo"
                                    >
                                        <FaArrowRotateLeft className="w-3.5 h-3.5" />
                                        Undo
                                    </button>
                                    <button
                                        onClick={onRedo}
                                        disabled={!canRedo}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/5 text-white border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-colors disabled:opacity-40 disabled:hover:bg-white/5"
                                        title="Redo"
                                    >
                                        <FaArrowRotateRight className="w-3.5 h-3.5" />
                                        Redo
                                    </button>
                                </div>
                                <button
                                    onClick={onExitTool}
                                    className="mt-1 w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-white/5 text-white border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-colors"
                                    title="Exit Tool"
                                >
                                    <FaCircleXmark className="w-3.5 h-3.5" />
                                    Exit Tool
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {!hideTrigger && (
                <button
                    onClick={togglePanel}
                    className="w-10 h-10 border flex items-center justify-center transition-all shadow-2xl active:scale-95 bg-zinc-950 text-white border-white/20 hover:bg-zinc-900"
                    title="Map Tools"
                >
                    <FaToolbox className="w-4 h-4" />
                </button>
            )}
        </div>
    );
}

function formatMeasurement(valueKm: number, unit: 'km' | 'km2'): string {
    if (unit === 'km') {
        if (valueKm >= 1) return `${formatNumber(valueKm, 2)} km`;
        return `${formatNumber(valueKm * 1000, 0)} m`;
    }

    if (valueKm >= 1) return `${formatNumber(valueKm, 2)} km²`;
    return `${formatNumber(valueKm * 1000000, 0)} m²`;
}

function formatNumber(value: number, maxFractionDigits: number): string {
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: maxFractionDigits,
        minimumFractionDigits: value >= 1 ? Math.min(2, maxFractionDigits) : 0,
    }).format(value);
}

function calculatePolygonArea(points: { lat: number; lng: number }[]): number {
    if (points.length < 3) return 0;
    const radiusKm = 6371;
    let total = 0;

    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        const lat1 = (p1.lat * Math.PI) / 180;
        const lat2 = (p2.lat * Math.PI) / 180;
        const dLon = ((p2.lng - p1.lng) * Math.PI) / 180;
        total += dLon * (2 + Math.sin(lat1) + Math.sin(lat2));
    }

    return (Math.abs(total) * (radiusKm * radiusKm)) / 2;
}
