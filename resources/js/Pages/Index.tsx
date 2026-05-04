import { useState, useCallback, useRef } from 'react';
import { Head } from '@inertiajs/react';
import MainLayout from '../Layouts/MainLayout';
import HeaderBar from '../Components/HeaderBar';
import MapDisplay, { Vessel } from '../Components/MapDisplay';
import ShipDetailsSidebar from '../Components/ShipDetailsSidebar';
import { SanctionedShipsPanelWithTools } from '../Components/SanctionedShipsPanel';

interface FleetStats {
    renderedIcons: number;
    totalRenderedShips: number;
    trackedShips: number;
    trackedVessels: Vessel[];
    currentArea: string;
}

export interface HistoryPosition {
    lat: number;
    lng: number;
    speed: number;
    course: number;
    recorded_at: string;
    isLatest?: boolean;
}

export default function Index() {
    const [mapViewState, setMapViewState] = useState<{ center: [number, number]; zoom: number }>({
        center: [20, 0],
        zoom: 3,
    });
    const [measurementMode, setMeasurementMode] = useState<'distance' | 'area' | null>(null);
    const [measurementPoints, setMeasurementPoints] = useState<{ lat: number; lng: number }[]>([]);
    const [measurementUndoStack, setMeasurementUndoStack] = useState<
        { lat: number; lng: number }[][]
    >([]);
    const [measurementRedoStack, setMeasurementRedoStack] = useState<
        { lat: number; lng: number }[][]
    >([]);

    const [fleetStats, setFleetStats] = useState({
        renderedIcons: 0,
        totalRenderedShips: 0,
        trackedShips: 0,
        currentArea: 'WORLD OVERVIEW',
    });

    const [trackedVessels, setTrackedVessels] = useState<Vessel[]>([]);
    const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null);
    const [historyData, setHistoryData] = useState<HistoryPosition[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showWaypoints, setShowWaypoints] = useState(true);
    const [selectedWaypointKey, setSelectedWaypointKey] = useState<string | null>(null);
    const [showClusterZoomNotice, setShowClusterZoomNotice] = useState(false);
    const clusterZoomNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleNavigate = useCallback((lat: number, lng: number, zoom: number = 12) => {
        setMapViewState({ center: [lat, lng], zoom });
    }, []);

    const handleFleetUpdate = useCallback((stats: FleetStats) => {
        setFleetStats({
            renderedIcons: stats.renderedIcons,
            totalRenderedShips: stats.totalRenderedShips,
            trackedShips: stats.trackedShips,
            currentArea: stats.currentArea,
        });
        setTrackedVessels(stats.trackedVessels || []);
    }, []);

    const handleSelectVessel = useCallback((vessel: Vessel | null) => {
        setSelectedVessel(vessel);
        setHistoryData([]);
        setSelectedWaypointKey(null);

        if (vessel) {
            // @ts-expect-error - GTM dataLayer
            window.dataLayer = window.dataLayer || [];
            // @ts-expect-error - GTM dataLayer
            window.dataLayer.push({
                event: 'vessel_select',
                vessel_mmsi: vessel.mmsi,
                vessel_name: vessel.name,
            });
        }
    }, []);

    const handleClusterZoomNotice = useCallback(() => {
        if (clusterZoomNoticeTimerRef.current) {
            clearTimeout(clusterZoomNoticeTimerRef.current);
        }
        setShowClusterZoomNotice(true);
        clusterZoomNoticeTimerRef.current = setTimeout(() => {
            setShowClusterZoomNotice(false);
        }, 5000);
    }, []);

    const handleMeasureDistance = useCallback(() => {
        setMeasurementMode('distance');
        setMeasurementPoints([]);
        setMeasurementUndoStack([]);
        setMeasurementRedoStack([]);
    }, []);

    const handleMeasureArea = useCallback(() => {
        setMeasurementMode('area');
        setMeasurementPoints([]);
        setMeasurementUndoStack([]);
        setMeasurementRedoStack([]);
    }, []);

    const handleClearMeasurements = useCallback(() => {
        setMeasurementMode(null);
        setMeasurementPoints([]);
        setMeasurementUndoStack([]);
        setMeasurementRedoStack([]);
    }, []);

    const handleMeasurementUndo = useCallback(() => {
        setMeasurementUndoStack((stack) => {
            if (stack.length === 0) return stack;
            const previous = stack[stack.length - 1];
            setMeasurementPoints((current) => {
                setMeasurementRedoStack((redo) => [...redo, current]);
                return previous;
            });
            return stack.slice(0, -1);
        });
    }, []);

    const handleMeasurementRedo = useCallback(() => {
        setMeasurementRedoStack((stack) => {
            if (stack.length === 0) return stack;
            const next = stack[stack.length - 1];
            setMeasurementPoints((current) => {
                setMeasurementUndoStack((undo) => [...undo, current]);
                return next;
            });
            return stack.slice(0, -1);
        });
    }, []);

    return (
        <MainLayout
            header={
                <HeaderBar
                    trackedVessels={trackedVessels}
                    onNavigate={handleNavigate}
                    onVesselSelect={handleSelectVessel}
                    selectedVesselName={
                        selectedVessel
                            ? selectedVessel.name?.trim() || `MMSI ${selectedVessel.mmsi}`
                            : undefined
                    }
                    showClusterZoomNotice={showClusterZoomNotice}
                />
            }
            fleetStats={fleetStats}
        >
            <Head title="Home" />
            <MapDisplay
                center={mapViewState.center}
                zoom={mapViewState.zoom}
                onFleetUpdate={handleFleetUpdate}
                selectedMmsi={selectedVessel?.mmsi ?? null}
                selectedVessel={selectedVessel}
                onVesselSelect={handleSelectVessel}
                onClusterZoomNotice={handleClusterZoomNotice}
                historyPositions={historyData}
                showHistory={showHistory}
                showWaypoints={showWaypoints}
                selectedWaypointKey={selectedWaypointKey}
                sidebarOpen={!!selectedVessel}
                measurementMode={measurementMode}
                measurementPoints={measurementPoints}
                onMeasurementPointAdd={(point) =>
                    setMeasurementPoints((prev) => {
                        setMeasurementUndoStack((stack) => [...stack, prev]);
                        setMeasurementRedoStack([]);
                        return [...prev, point];
                    })
                }
                onMeasurementPointUpdate={(index, point) =>
                    setMeasurementPoints((prev) => {
                        setMeasurementUndoStack((stack) => [...stack, prev]);
                        setMeasurementRedoStack([]);
                        return prev.map((existing, i) => (i === index ? point : existing));
                    })
                }
            />
            <ShipDetailsSidebar
                vessel={selectedVessel}
                onClose={() => handleSelectVessel(null)}
                onHistoryUpdate={setHistoryData}
                showHistory={showHistory}
                onShowHistoryChange={setShowHistory}
                onNavigate={handleNavigate}
                showWaypoints={showWaypoints}
                onShowWaypointsChange={setShowWaypoints}
                selectedWaypointKey={selectedWaypointKey}
                onWaypointSelect={(pos) => {
                    setSelectedWaypointKey(null);
                    setTimeout(() => setSelectedWaypointKey(pos.recorded_at), 0);
                }}
            />
            <SanctionedShipsPanelWithTools
                onNavigate={handleNavigate}
                onVesselSelect={handleSelectVessel}
                onMeasureDistance={handleMeasureDistance}
                onMeasureArea={handleMeasureArea}
                onExitTool={handleClearMeasurements}
                onUndo={handleMeasurementUndo}
                onRedo={handleMeasurementRedo}
                canUndo={measurementUndoStack.length > 0}
                canRedo={measurementRedoStack.length > 0}
                measurementMode={measurementMode}
                measurementPoints={measurementPoints}
            />
        </MainLayout>
    );
}
