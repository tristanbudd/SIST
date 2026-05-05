<?php

namespace App\Services;

use App\Helpers\MaritimeFormatter;
use App\Models\Vessel;
use App\Models\VesselActivity;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class VesselAnalysisService
{
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

        foreach ($vessels as $vessel) {
            $this->processVesselMetrics($vessel);
        }
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

            if ($delta > 120) {
                $this->persistActivity($vessel, 'ais_gap', 'medium', [
                    'duration_minutes' => $delta,
                    'gap_start' => $current->recorded_at->toIso8601String(),
                    'gap_end' => $next->recorded_at->toIso8601String(),
                ], $current->recorded_at, $next->recorded_at);
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

        if ($positions->count() < 10) {
            return;
        }

        $recent = $positions->where('recorded_at', '>=', now()->subDays(7));
        if ($recent->count() > 5) {
            $avgSpeed = $recent->avg('speed');

            if ($avgSpeed < 1.0) {
                $latRange = $recent->max('lat') - $recent->min('lat');
                $lngRange = $recent->max('lng') - $recent->min('lng');

                // Flag if remaining within ~500m area
                if ($latRange < 0.005 && $lngRange < 0.005) {
                    $this->persistActivity($vessel, 'loitering', 'low', [
                        'avg_speed' => round($avgSpeed, 2),
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
            default => 'Anomalous behavioral event detected.',
        };
    }
}
