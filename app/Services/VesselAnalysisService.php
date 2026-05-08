<?php

namespace App\Services;

use App\Helpers\MaritimeFormatter;
use App\Models\Vessel;
use App\Models\VesselActivity;
use App\Models\VesselPosition;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class VesselAnalysisService
{
    /** @var array|null */
    private $monitoredZones = null;

    /**
     * Perform behavioral analysis on vessels with pending updates.
     *
     * Optimizes performance by only targeting vessels that have received
     * new position reports since their last analysis run.
     */
    public function analyzeActiveFleet(): void
    {
        $vessels = Vessel::where(function ($query) {
            $query->whereNull('last_analyzed_at')
                ->orWhereColumn('last_seen_at', '>', 'last_analyzed_at');
        })
            ->where('last_seen_at', '>=', now()->subDays(30))
            ->limit(100) // Process in chunks to maintain low latency
            ->get();

        Log::info("Processing behavioral analysis for {$vessels->count()} vessels.");

        /** @var Collection<Vessel> $vessels */
        foreach ($vessels as $vessel) {
            $this->processVesselMetrics($vessel);
        }
    }

    /**
     * Resets and re-runs analysis for the entire fleet.
     */
    public function rebuildAll(): void
    {
        Log::info('SIST | REBUILD: Starting full fleet analysis rebuild...');

        DB::transaction(function () {
            VesselActivity::truncate();

            Vessel::query()->update(['last_analyzed_at' => null]);
        });

        Vessel::query()->chunk(100, function ($vessels) {
            foreach ($vessels as $vessel) {
                /** @var Vessel $vessel */
                $this->processVesselMetrics($vessel);
            }
        });

        Log::info('SIST | REBUILD: Full fleet analysis rebuild completed.');
    }

    /**
     * Evaluates a single vessel against behavioral anomaly heuristics.
     */
    public function processVesselMetrics(Vessel $vessel): void
    {
        DB::beginTransaction();
        try {
            $this->detectTransmissionGaps($vessel);
            $this->detectLoiteringPatterns($vessel);
            $this->detectKinematicAnomalies($vessel);
            $this->detectPortInteractions($vessel);

            $vessel->update(['last_analyzed_at' => now()]);
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error("Behavioral analysis failed for MMSI {$vessel->mmsi}: ".$e->getMessage());
        }
    }

    /**
     * Identifies prolonged periods of AIS silence.
     */
    private function detectTransmissionGaps(Vessel $vessel): void
    {
        $positions = $vessel->positions()
            ->where('recorded_at', '>=', now()->subDays(30))
            ->orderBy('recorded_at', 'asc')
            ->get();

        if ($positions->count() < 2) {
            return;
        }

        for ($i = 0; $i < $positions->count() - 1; $i++) {
            $current = $positions[$i];
            $next = $positions[$i + 1];

            $delta = $current->recorded_at->diffInMinutes($next->recorded_at);

            // Ignore if vessel is explicitly anchored or moored (safe power down)
            if (in_array($vessel->navigational_status, [1, 5, 6])) {
                continue;
            }

            // High-confidence gap: > 12 hours (720 min)
            // Low-confidence/Noise gap: 4-12 hours (240-720 min)
            if ($delta >= 240) {
                $severity = $delta >= 720 ? 'medium' : 'low';

                // Distance check: If the vessel hasn't moved much, it's likely just poor receiver coverage while drifting/stationary
                $distanceKm = $this->calculateDistance($current->lat, $current->lng, $next->lat, $next->lng);
                $distanceNm = $distanceKm / 1.852;

                // If moving at less than 1.5 knots effective speed over the gap, it's less suspicious
                $effectiveSpeed = ($delta > 0) ? ($distanceNm / ($delta / 60)) : 0;

                if ($effectiveSpeed < 1.5 && $distanceNm < 5) {
                    continue;
                }

                if (($current->speed ?? 0) > 1.0 || ($next->speed ?? 0) > 1.0 || $distanceNm > 10) {
                    $hasGlobalActivity = VesselPosition::whereBetween('recorded_at', [
                        $current->recorded_at->addMinute(),
                        $next->recorded_at->subMinute(),
                    ])
                        ->where('mmsi', '!=', $vessel->mmsi)
                        ->exists();

                    if (! $hasGlobalActivity) {
                        continue;
                    }

                    $this->persistActivity($vessel, 'ais_gap', $severity, [
                        'duration_minutes' => $delta,
                        'distance_nm' => round($distanceNm, 2),
                        'effective_speed' => round($effectiveSpeed, 2),
                        'gap_start' => $current->recorded_at->toIso8601String(),
                        'gap_end' => $next->recorded_at->toIso8601String(),
                        'start_speed' => $current->speed,
                        'end_speed' => $next->speed,
                    ], $current->recorded_at, $next->recorded_at);
                }
            }
        }
    }

    /**
     * Detects low-speed residency within a confined spatial radius.
     */
    private function detectLoiteringPatterns(Vessel $vessel): void
    {
        $positions = $vessel->positions()
            ->where('recorded_at', '>=', now()->subDays(30))
            ->orderBy('recorded_at', 'desc')
            ->get();

        if ($positions->count() < 15) {
            return;
        }

        $recent = $positions->where('recorded_at', '>=', now()->subDays(7));
        if ($recent->count() > 10) {
            $avgSpeed = $recent->avg('speed');
            $durationHours = $recent->last()->recorded_at->diffInHours($recent->first()->recorded_at);

            // Loitering requires at least 24 hours of consistent low-speed presence
            if ($avgSpeed >= 0.1 && $avgSpeed < 3.0 && $durationHours >= 24) {
                $latRange = $recent->max('lat') - $recent->min('lat');
                $lngRange = $recent->max('lng') - $recent->min('lng');

                // Residency within a ~2nm box
                if ($latRange < 0.03 && $lngRange < 0.03 && ($latRange > 0 || $lngRange > 0)) {
                    if (in_array($vessel->navigational_status, [1, 5, 6, 7])) {
                        return;
                    }

                    $this->persistActivity($vessel, 'loitering', 'low', [
                        'avg_speed' => round($avgSpeed, 2),
                        'duration_hours' => $durationHours,
                        'lat_span' => round($latRange, 6),
                        'lng_span' => round($lngRange, 6),
                    ], $recent->last()->recorded_at, $recent->first()->recorded_at);
                }
            }
        }
    }

    /**
     * Validates speed reports against physical maritime constraints.
     */
    private function detectKinematicAnomalies(Vessel $vessel): void
    {
        $latest = $vessel->positions()->latest('recorded_at')->first();

        if ($latest && $latest->speed > 50) {
            $this->persistActivity($vessel, 'speed_anomaly', 'high', [
                'reported_speed' => $latest->speed,
                'coordinates' => ['lat' => $latest->lat, 'lng' => $latest->lng],
            ], $latest->recorded_at);
        }
    }

    /**
     * Detects interactions with monitored ports of interest.
     */
    private function detectPortInteractions(Vessel $vessel): void
    {
        if ($this->monitoredZones === null) {
            $path = resource_path('data/ports_of_interest.json');
            if (file_exists($path)) {
                $this->monitoredZones = json_decode(file_get_contents($path), true);
            } else {
                $this->monitoredZones = [];
            }
        }

        if (empty($this->monitoredZones)) {
            return;
        }

        $positions = $vessel->positions()
            ->where('recorded_at', '>=', now()->subDays(30))
            ->orderBy('recorded_at', 'desc')
            ->get();

        if ($positions->isEmpty()) {
            return;
        }

        foreach ($this->monitoredZones as $zone) {
            $matchingPositions = $positions->filter(function ($pos) use ($zone) {
                // Radius of 2km for high accuracy (visit detection)
                return $this->calculateDistance($pos->lat, $pos->lng, $zone['lat'], $zone['lng']) <= 2.0;
            });

            // If we have 3 or more points within the radius, it's a high-confidence visit/interaction
            if ($matchingPositions->count() >= 3) {
                $start = $matchingPositions->min('recorded_at');
                $end = $matchingPositions->max('recorded_at');
                $durationMinutes = $start->diffInMinutes($end);

                // Only flag if they stayed for at least 30 minutes to filter out slow bypasses
                if ($durationMinutes >= 30) {
                    $this->persistActivity($vessel, 'port_of_interest', $zone['severity'], [
                        'port_name' => $zone['name'],
                        'port_type' => $zone['type'],
                        'source' => $zone['source'] ?? 'Unknown',
                        'visit_duration_minutes' => $durationMinutes,
                        'point_count' => $matchingPositions->count(),
                        'coordinates' => ['lat' => $zone['lat'], 'lng' => $zone['lng']],
                    ], $start, $end);
                }
            }
        }
    }

    /**
     * Logs or updates a detected behavioral event.
     */
    private function persistActivity(
        Vessel $vessel,
        string $type,
        string $severity,
        array $details,
        Carbon $start,
        ?Carbon $end = null
    ): void {
        $existing = VesselActivity::where('mmsi', $vessel->mmsi)
            ->where('type', $type)
            ->where('started_at', $start)
            ->first();

        if ($existing) {
            if ($end && (! $existing->ended_at || $end->gt($existing->ended_at))) {
                $existing->update([
                    'ended_at' => $end,
                    'details' => array_merge($existing->details ?? [], $details),
                ]);
            }

            return;
        }

        VesselActivity::create([
            'mmsi' => $vessel->mmsi,
            'type' => $type,
            'severity' => $severity,
            'description' => $this->resolveDescription($type, $details),
            'details' => $details,
            'started_at' => $start,
            'ended_at' => $end,
            'is_active' => $end ? $end->diffInMinutes(now()) < 30 : true,
        ]);

        Log::info("SIST | BEHAVIOR: Detected {$type} ({$severity}) for MMSI {$vessel->mmsi} (".($vessel->name ?? 'Unknown').')');
    }

    /**
     * Generates a technical summary for the detected event.
     */
    private function resolveDescription(string $type, array $details): string
    {
        return match ($type) {
            'ais_gap' => 'AIS transmission interruption detected ('.MaritimeFormatter::formatDuration($details['duration_minutes'] ?? 0).').',
            'loitering' => 'Stationary residency pattern in open-sea transit area.',
            'speed_anomaly' => 'Kinematic violation: speed exceeds physical capability ('.round($details['reported_speed'] ?? 0, 1).' kn).',
            'port_of_interest' => 'Vessel interaction detected at high-risk maritime hub: '.($details['port_name'] ?? 'Unknown Port').'.',
            default => 'Anomalous behavioral event detected.',
        };
    }

    /**
     * Calculates the great-circle distance between two points in km.
     */
    private function calculateDistance(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) * sin($dLat / 2) +
            cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
            sin($dLon / 2) * sin($dLon / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadius * $c;
    }
}
