<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Vessel;
use App\Models\VesselPosition;
use App\Services\SanctionsService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/**
 * @group Vessel Intelligence
 *
 * Endpoints for querying and tracking maritime vessels within the SIST database.
 * These endpoints provide the latest AIS states, positions, and metadata for ships.
 */
class VesselController extends Controller
{
    /**
     * List Active Fleet
     *
     * Retrieve a list of recently active vessels. Supports spatial bounding box filtering
     * to only return vessels currently visible on the user's map interface.
     *
     * @queryParam sw_lat float South-West Latitude (Bounding Box). Example: 49.0
     * @queryParam sw_lng float South-West Longitude (Bounding Box). Example: -5.0
     * @queryParam ne_lat float North-East Latitude (Bounding Box). Example: 51.5
     * @queryParam ne_lng float North-East Longitude (Bounding Box). Example: 2.0
     * @queryParam age_minutes integer Filter out vessels not seen in this many minutes. Defaults to 60 (1 hour). Example: 30
     * @queryParam offset integer The number of records to skip. Use with a limit of 2500 for pagination. Example: 2500
     *
     * @response 200 scenario="Success" {
     * "data": [
     * {
     * "mmsi": 219225000,
     * "imo": 9326093,
     * "name": "MAERSK NORFOLK",
     * "lat": 51.9542,
     * "lng": 1.2589,
     * "course": 210.0
     * }
     * ]
     * }
     * @response 404 scenario="No vessels found" {
     * "message": "No active vessels found in the specified area or timeframe."
     * }
     */
    public function index(Request $request): JsonResponse
    {
        $query = Vessel::query();

        // Time window filtering is critical for DB performance
        // Without this, the query would scan millions of historical vessel records
        $age = $request->input('age_minutes', 60);
        $query->where('last_seen_at', '>=', now()->subMinutes($age));

        $ignoredNames = ['--'];
        $query->whereNotNull('name')
            ->whereNotIn('name', $ignoredNames);

        // Spatial bounding box query
        // Only queries for vessels physically visible within the user's current map viewport coordinates
        if ($request->has(['sw_lat', 'sw_lng', 'ne_lat', 'ne_lng'])) {
            $query->whereBetween('lat', [(float) $request->sw_lat, (float) $request->ne_lat])
                ->whereBetween('lng', [(float) $request->sw_lng, (float) $request->ne_lng]);
        }

        $vessels = $query->orderBy('last_seen_at', 'desc')
            ->offset($request->input('offset', 0))
            ->limit(2500)
            ->get([
                'mmsi',
                'imo',
                'name',
                'lat',
                'lng',
                'course',
                'navigational_status',
            ])
            ->map(fn ($vessel) => [
                'mmsi' => (int) $vessel->mmsi,
                'imo' => (int) $vessel->imo,
                'name' => $vessel->name,
                'lat' => (float) $vessel->lat,
                'lng' => (float) $vessel->lng,
                'course' => (float) $vessel->course,
                'navigational_status' => $vessel->navigational_status,
            ]);

        if ($vessels->isEmpty()) {
            return response()->json([
                'message' => 'No active vessels found in the specified area or timeframe.',
            ], 404);
        }

        return response()->json([
            'data' => $vessels,
        ]);
    }

    /**
     * Search Vessels
     *
     * Fuzzy search for vessels by name, MMSI, or IMO.
     * Returns up to 20 results, including offline vessels.
     *
     * @queryParam q string required The search query. Minimum 2 characters. Example: MAE
     *
     * @response 200 scenario="Search results" {
     * "data": [
     * {
     * "category": "vessel",
     * "mmsi": "219225000",
     * "imo": "9326093",
     * "name": "MAERSK NORFOLK",
     * "lat": 51.9542,
     * "lng": 1.2589,
     * "last_seen_at": "2026-04-13T12:20:07.000000Z"
     * }
     * ]
     * }
     * @response 404 scenario="No vessels found" {
     * "message": "No vessels found matching your search query."
     * }
     */
    public function search(Request $request): JsonResponse
    {
        $q = $request->input('q');

        if (empty($q) || strlen($q) < 2) {
            return response()->json(['data' => []]);
        }

        $vessels = Vessel::where('name', 'like', "%{$q}%")
            ->orWhere('mmsi', 'like', "{$q}%")
            ->orWhere('imo', 'like', "{$q}%")
            ->orderBy('last_seen_at', 'desc')
            ->limit(20)
            ->get(['mmsi', 'imo', 'name', 'last_seen_at', 'lat', 'lng']);

        $formatted = $vessels->map(function ($v) {
            return [
                'category' => 'vessel',
                'mmsi' => (string) $v->mmsi,
                'imo' => (string) $v->imo,
                'name' => $v->name,
                'lat' => (float) $v->lat,
                'lng' => (float) $v->lng,
                'last_seen_at' => $v->last_seen_at,
            ];
        });

        if ($formatted->isEmpty()) {
            return response()->json([
                'message' => 'No vessels found matching your search query.',
            ], 404);
        }

        return response()->json([
            'data' => $formatted,
        ]);
    }

    /**
     * Lookup Vessel by MMSI
     *
     * Retrieve the latest known state, identity, and location for a specific vessel from the SIST database.
     *
     * @urlParam mmsi integer required The Maritime Mobile Service Identity (MMSI) number. Example: 219225000
     *
     * @response 200 scenario="Vessel found" {
     * "mmsi": 219225000,
     * "imo": 9326093,
     * "name": "MAERSK NORFOLK",
     * "call_sign": "OWDQ2",
     * "type": 70,
     * "navigational_status": 0,
     * "lat": 51.9542,
     * "lng": 1.2589,
     * "speed": 18.5,
     * "course": 210.0,
     * "heading": 212,
     * "length": 299,
     * "width": 40,
     * "draught": 12.5,
     * "destination": "FELIXSTOWE",
     * "eta": "2026-04-03T14:30:00.000000Z",
     * "last_seen_at": "2026-04-02T14:15:00.000000Z",
     * "nav_status_text": "Under way using engine",
     * "vessel_type_text": "Cargo",
     * "flying_flag": "DK",
     * "flying_flag_country": "Denmark",
     * "flying_flag_continent": "Europe",
     * "flying_flag_local_time": "2026-04-02 16:15:00",
     * "flying_flag_timezone": "Europe/Copenhagen",
     * "registry_country": "Denmark",
     * "registry_country_code": "DK",
     * "registry_continent": "Europe",
     * "registry_local_time": "2026-04-02 16:15:00",
     * "registry_timezone": "Europe/Copenhagen"
     * }
     * @response 404 scenario="Vessel not found" {
     * "error": "Vessel not found in SIST records",
     * "mmsi": 999999999
     * }
     *
     * @responseField mmsi integer The unique 9-digit Maritime Mobile Service Identity.
     * @responseField imo integer The unique 7-digit International Maritime Organization identifier.
     * @responseField name string The registered name of the vessel.
     * @responseField call_sign string The vessel's unique radio call sign.
     * @responseField type integer The raw AIS vessel type code (e.g., 70 for Cargo).
     * @responseField navigational_status integer The raw AIS navigational status code.
     * @responseField lat number The last recorded latitude.
     * @responseField lng number The last recorded longitude.
     * @responseField speed number Speed over ground (SOG) in knots.
     * @responseField course number Course over ground (COG) in degrees.
     * @responseField heading integer The true heading of the vessel in degrees (if available).
     * @responseField length integer The length of the vessel in meters (calculated from dimensions).
     * @responseField width integer The width of the vessel in meters (calculated from dimensions).
     * @responseField draught number The maximum static draught of the vessel in meters.
     * @responseField destination string The crew-reported destination.
     * @responseField eta string ISO 8601 estimated time of arrival (crew-reported).
     * @responseField last_seen_at string ISO 8601 timestamp of the last received AIS report.
     * @responseField nav_status_text string Human-readable translation of the navigational status.
     * @responseField vessel_type_text string Human-readable translation of the vessel's classification.
     * @responseField flying_flag string The 2-letter flag code from the vessel's current AIS transmission.
     * @responseField flying_flag_country string The country corresponding to the current flying flag.
     * @responseField flying_flag_continent string The continent of the current flying flag.
     * @responseField flying_flag_local_time string The calculated current local time based on the flying flag's timezone.
     * @responseField flying_flag_timezone string The IANA timezone string for the current flying flag.
     * @responseField registry_country string The country of registry extracted from the MMSI's MID (home port).
     * @responseField registry_country_code string The ISO 3166-1 alpha-2 country code of the registry.
     * @responseField registry_continent string The continent of the vessel's registry (home port).
     * @responseField registry_local_time string The calculated current local time in the vessel's registry.
     * @responseField registry_timezone string The IANA timezone string for the vessel's registry.
     *
     * @param  int  $mmsi
     */
    public function show($mmsi): JsonResponse
    {
        $vessel = Vessel::where('mmsi', $mmsi)->first();

        if (! $vessel) {
            return response()->json([
                'error' => 'Vessel not found in SIST records',
                'mmsi' => (int) $mmsi,
            ], 404);
        }

        return response()->json($vessel);
    }

    /**
     * Get Vessel History
     *
     * Retrieve the historical breadcrumb trail (trajectory) for a specific vessel,
     * ordered from newest to oldest.
     *
     * @urlParam mmsi integer required The MMSI of the vessel. Example: 235000123
     *
     * @queryParam hours integer Number of past hours to retrieve. Defaults to 24. Example: 48
     * @queryParam start string ISO 8601 start timestamp. If provided with end, takes precedence over hours. Example: 2026-04-01T00:00:00Z
     * @queryParam end string ISO 8601 end timestamp. If provided with start, takes precedence over hours. Example: 2026-04-02T00:00:00Z
     *
     * @response 200 scenario="History found" {
     * "mmsi": 235000123,
     * "history": [
     * {
     * "lat": 50.1234,
     * "lng": -1.2345,
     * "speed": 14.5,
     * "course": 180.2,
     * "recorded_at": "2026-04-02T12:00:00+00:00"
     * }
     * ]
     * }
     * @response 404 scenario="Vessel not found or no history found" {
     * "error": "No history found for this time period",
     * "reason": "no_history_found",
     * "mmsi": 235000123
     * }
     */
    public function history(Request $request, string $mmsi): JsonResponse
    {
        if (! Vessel::where('mmsi', $mmsi)->exists()) {
            return response()->json([
                'error' => 'Vessel not found in SIST records',
                'reason' => 'vessel_not_found',
                'mmsi' => (int) $mmsi,
            ], 404);
        }

        $start = $request->input('start');
        $end = $request->input('end');

        $query = VesselPosition::where('mmsi', $mmsi);

        if ($start && $end) {
            $query->whereBetween('recorded_at', [$start, $end]);
        } elseif ($start) {
            $query->where('recorded_at', '>=', $start);
        } elseif ($end) {
            $query->where('recorded_at', '<=', $end);
        } else {
            $hours = $request->input('hours', 24);
            $query->where('recorded_at', '>=', now()->subHours($hours));
        }

        $positions = $query->orderBy('recorded_at', 'desc')
            ->get([
                'mmsi',
                'lat',
                'lng',
                'speed',
                'course',
                'heading',
                'navigational_status',
                'rate_of_turn',
                'position_accuracy',
                'raim',
                'recorded_at',
            ]);

        // Transform to pair numeric values with their text equivalents
        // Note: 'nav_status_text' is not a database column; it is generated dynamically via an Eloquent accessor on the VesselPosition model
        $history = $positions->map(function ($position) {
            return [
                'lat' => $position->lat,
                'lng' => $position->lng,
                'speed' => $position->speed,
                'course' => $position->course,
                'heading' => $position->heading,
                'nav_status' => $position->navigational_status,
                'nav_status_text' => $position->nav_status_text,
                'rate_of_turn' => $position->rate_of_turn,
                'position_accuracy' => $position->position_accuracy,
                'raim' => $position->raim,
                'recorded_at' => $position->recorded_at,
            ];
        });

        if ($positions->isEmpty()) {
            return response()->json([
                'error' => 'No history found for this time period',
                'reason' => 'no_history_found',
                'mmsi' => (int) $mmsi,
            ], 404);
        }

        return response()->json([
            'mmsi' => (int) $mmsi,
            'history' => $history,
        ]);
    }

    /**
     * Check Sanctions Status
     *
     * Check if a vessel is listed on international sanctions lists or associated with restricted entities using multiple data sources:
     * - Sanctions.network: Checks against official OFAC SDN, UN, and EU sanctions lists to identify globally sanctioned entities.
     * - FleetLeaks: Queries network analysis and dark fleet maps to identify vessels involved in irregular or unrecorded activities.
     *
     * @urlParam mmsi integer required The MMSI of the vessel. Example: 219225000
     *
     * @queryParam force_refresh boolean Force refresh cached data (default: false). Example: false
     *
     * @response 200 scenario="Vessel checked" {
     * "vessel_name": "LIGOVSKY PROSPECT",
     * "imo": 9256066,
     * "mmsi": 273251810,
     * "call_sign": "UBRZ6",
     * "is_sanctioned": true,
     * "risk_level": "medium",
     * "sanctions_count": 1,
     * "sources_confirming": ["sanctions_network"],
     * "checked_at": "2026-04-13T12:20:07+00:00",
     * "sources": {
     * "sanctions_network": {
     * "status": "ok",
     * "found": true,
     * "count": 1,
     * "results": [
     * {
     * "name": "LIGOVSKY PROSPECT",
     * "source": "ofac",
     * "source_id": "46288",
     * "matched_name": "LIGOVSKY PROSPECT"
     * }
     * ]
     * },
     * "fleetleaks": {
     * "status": "ok",
     * "found": false,
     * "results": []
     * }
     * }
     * }
     * @response 404 scenario="Vessel not found in SIST records" {
     * "error": "Vessel not found in SIST records",
     * "mmsi": 999999999
     * }
     * @response 422 scenario="Insufficient vessel data" {
     * "error": "Insufficient vessel data for sanctions check",
     * "mmsi": 999999999
     * }
     *
     * @param  int  $mmsi
     */
    public function checkSanctions(Request $request, $mmsi, SanctionsService $sanctionsService): JsonResponse
    {
        $vessel = Vessel::where('mmsi', $mmsi)->first();

        if (! $vessel) {
            return response()->json([
                'error' => 'Vessel not found in SIST records',
                'mmsi' => (int) $mmsi,
            ], 404);
        }

        // Validate vessel has identifying information
        if (! $vessel->name && ! $vessel->imo && ! $vessel->mmsi && ! $vessel->call_sign) {
            return response()->json([
                'error' => 'Insufficient vessel data for sanctions check',
                'mmsi' => (int) $mmsi,
            ], 422);
        }

        $forceRefresh = $request->boolean('force_refresh');

        $result = $sanctionsService->checkVessel(
            $vessel->name ?? "MMSI-{$vessel->mmsi}",
            $vessel->imo ? (string) $vessel->imo : null,
            $vessel->mmsi ? (string) $vessel->mmsi : null,
            $vessel->call_sign,
            $forceRefresh
        );

        return response()->json([
            'mmsi' => (int) $mmsi,
            'imo' => $vessel->imo,
            'name' => $result['vessel_name'],
            'call_sign' => $vessel->call_sign,
            'is_sanctioned' => $result['is_sanctioned'],
            'sanctions_count' => $result['sanctions_count'],
            'risk_level' => $result['risk_level'],
            'sources_confirming' => $result['sources_confirming'],
            'sanctions' => $result['sanctions'],
            'checked_at' => $result['checked_at'],
            'sources' => $result['sources'],
        ]);
    }

    /**
     * List Sanctioned Vessels
     *
     * Fetch known sanctioned vessels from FleetLeaks API.
     *
     * @response 200 scenario="Sanctioned vessels" {
     * "data": [
     * {
     * "mmsi": 273251810,
     * "imo": 9256066,
     * "name": "LIGOVSKY PROSPECT",
     * "lat": 42.1234,
     * "lng": 51.5678,
     * "last_seen_at": "2026-05-02T12:20:07.000000Z",
     * "is_sanctioned": true,
     * "risk_level": "high"
     * }
     * ]
     * }
     * @response 404 scenario="No sanctioned vessels found" {
     * "message": "No sanctioned vessels found in the current records."
     * }
     */
    public function sanctionedList(Request $request): JsonResponse
    {
        $cacheKey = 'fleetleaks_sanctioned_map_data';

        $vessels = Cache::remember($cacheKey, 3600, function () {
            $response = Http::withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
            ])->get('https://fleetleaks.com/wp-json/fleetleaks/v1/vessels/map-data');

            if (! $response->successful()) {
                return [];
            }

            return $response->json() ?? [];
        });

        $search = strtolower($request->input('search', ''));
        $limit = min((int) $request->input('limit', 100), 500);

        $sanctionedData = [];
        $count = 0;

        foreach ($vessels as $vessel) {
            $name = $vessel['name'] ?? '';

            if ($search && strpos(strtolower($name), $search) === false) {
                continue;
            }

            $sanctionedData[] = $vessel;

            $count++;
            if ($count >= $limit) {
                break;
            }
        }

        if (empty($sanctionedData)) {
            return response()->json([
                'message' => 'No sanctioned vessels found in the current records.',
            ], 404);
        }

        // Pre-fetch local vessel data to cross-reference ONLY for the limited result set
        $mmsis = collect($sanctionedData)->pluck('mmsi')->filter()->toArray();
        $imos = collect($sanctionedData)->pluck('imo')->filter()->toArray();

        $localVessels = Vessel::whereIn('mmsi', $mmsis)
            ->orWhereIn('imo', $imos)
            ->get(['mmsi', 'imo', 'last_seen_at']);

        $localByMmsi = $localVessels->whereNotNull('mmsi')->keyBy('mmsi');
        $localByImo = $localVessels->whereNotNull('imo')->keyBy('imo');

        $sanctioned = [];
        foreach ($sanctionedData as $vessel) {
            $name = $vessel['name'] ?? '';
            $sanctioners = $vessel['sanctioners'] ?? [];
            $sanctions_count = is_array($sanctioners) ? count($sanctioners) : 0;

            $risk_level = 'medium';
            if ($sanctions_count > 2) {
                $risk_level = 'high';
            } elseif ($sanctions_count == 0) {
                $risk_level = 'low';
            }

            $mmsi = isset($vessel['mmsi']) ? (int) $vessel['mmsi'] : null;
            $imo = isset($vessel['imo']) ? (int) $vessel['imo'] : null;

            $localMatch = null;
            if ($mmsi && isset($localByMmsi[$mmsi])) {
                $localMatch = $localByMmsi[$mmsi];
            } elseif ($imo && isset($localByImo[$imo])) {
                $localMatch = $localByImo[$imo];
            }

            // Using fleetleaks data to construct standardized response
            $sanctioned[] = [
                'id' => $vessel['id'] ?? null,
                'mmsi' => $mmsi ?: (int) ($vessel['imo'] ?? 0), // fallback for matching
                'imo' => $imo,
                'name' => $name,
                'lat' => (float) ($vessel['latitude'] ?? 0),
                'lng' => (float) ($vessel['longitude'] ?? 0),
                'course' => (float) ($vessel['course_degrees'] ?? 0),
                'last_seen_at' => $vessel['location_last_updated'] ?? null,
                'sist_last_seen_at' => $localMatch ? $localMatch->last_seen_at?->toIso8601String() : null,
                'in_sist' => ! is_null($localMatch),
                'is_sanctioned' => true,
                'risk_level' => $risk_level,
                'sanctions_count' => $sanctions_count,
                'sanctioners' => $sanctioners,
            ];
        }

        return response()->json(['data' => $sanctioned]);
    }

    /**
     * Get Vessel Activities
     *
     * Retrieve a list of detected suspicious activities or anomalous behavior for a specific vessel.
     *
     * @urlParam mmsi integer required The MMSI of the vessel. Example: 219225000
     *
     * @response 200 scenario="Activities found" {
     * "mmsi": 219225000,
     * "data": [
     * {
     * "id": 1,
     * "type": "ais_gap",
     * "severity": "medium",
     * "description": "Significant AIS transmission gap detected (145 minutes).",
     * "details": {
     * "duration_minutes": 145,
     * "gap_start": "2026-04-02T10:00:00Z",
     * "gap_end": "2026-04-02T12:25:00Z"
     * },
     * "started_at": "2026-04-02T10:00:00Z",
     * "ended_at": "2026-04-02T12:25:00Z",
     * "is_active": false
     * }
     * ]
     * }
     * @response 404 scenario="Vessel not found" {
     * "error": "Vessel not found in SIST records",
     * "mmsi": 219225000
     * }
     */
    public function activities(string $mmsi): JsonResponse
    {
        $vessel = Vessel::where('mmsi', $mmsi)->first();

        if (! $vessel) {
            return response()->json([
                'error' => 'Vessel not found in SIST records',
                'mmsi' => (int) $mmsi,
            ], 404);
        }

        $activities = $vessel->activities()
            ->where('started_at', '>=', now()->subDays(30))
            ->orderBy('started_at', 'desc')
            ->get();

        $data = $activities->map(function ($activity) {
            $details = $activity->details;
            $source = null;

            if ($activity->type === 'port_of_interest') {
                static $poiData = null;
                if ($poiData === null) {
                    $path = resource_path('data/ports_of_interest.json');
                    $poiData = file_exists($path) ? json_decode(file_get_contents($path), true) : [];
                }

                $portName = $details['port_name'] ?? null;
                $matchingPoi = collect($poiData)->firstWhere('name', $portName);
                $source = $matchingPoi['source'] ?? ($details['source'] ?? 'FleetLeaks');
            }

            return [
                'id' => $activity->id,
                'type' => $activity->type,
                'severity' => $activity->severity,
                'description' => $activity->description,
                'details' => $details,
                'source' => $source,
                'started_at' => $activity->started_at,
                'ended_at' => $activity->ended_at,
            ];
        });

        return response()->json([
            'mmsi' => (int) $mmsi,
            'data' => $data,
        ]);
    }

    /**
     * List Vessels with Infractions
     *
     * Retrieve a list of vessels with the most behavioural infractions in the last 30 days.
     *
     * @queryParam severity string Filter by infraction severity (all, low, medium, high). Example: high
     * @queryParam search string Search by vessel name, IMO, or MMSI. Example: MAERSK
     * @queryParam limit integer Maximum number of results. Example: 100
     *
     * @response 200 scenario="Success" {
     * "data": [
     * {
     * "mmsi": 219225000,
     * "imo": 9326093,
     * "name": "MAERSK NORFOLK",
     * "infractions_count": 12,
     * "highest_severity": "high",
     * "risk_score": 85
     * }
     * ]
     * }
     * @response 404 scenario="No infractions found" {
     * "message": "No vessels with behavioural infractions found in the last 30 days."
     * }
     */
    public function infractionsList(Request $request): JsonResponse
    {
        $severity = $request->input('severity');
        $search = $request->input('search');
        $status = $request->input('status');
        $perPage = min((int) $request->input('per_page', 20), 100);
        $cutoff = now()->subDays(30);

        $query = Vessel::query()
            ->join('vessel_activities', 'vessels.mmsi', '=', 'vessel_activities.mmsi')
            ->select([
                'vessels.mmsi',
                'vessels.imo',
                'vessels.name',
                'vessels.lat',
                'vessels.lng',
                'vessels.course',
                'vessels.last_seen_at',
                DB::raw('COUNT(vessel_activities.id) as activities_count'),
                DB::raw("SUM(CASE WHEN vessel_activities.severity = 'high' THEN 8 WHEN vessel_activities.severity = 'medium' THEN 2 ELSE 0.5 END) as raw_score"),
                DB::raw("MAX(CASE WHEN vessel_activities.severity = 'high' THEN 3 WHEN vessel_activities.severity = 'medium' THEN 2 ELSE 1 END) as max_severity_level"),
            ])
            ->where('vessel_activities.started_at', '>=', $cutoff);

        if ($severity && $severity !== 'all') {
            if ($severity === 'high') {
                $query->havingRaw("SUM(CASE WHEN vessel_activities.severity = 'high' THEN 8 WHEN vessel_activities.severity = 'medium' THEN 2 ELSE 0.5 END) >= 80");
            } elseif ($severity === 'medium') {
                $query->havingRaw("SUM(CASE WHEN vessel_activities.severity = 'high' THEN 8 WHEN vessel_activities.severity = 'medium' THEN 2 ELSE 0.5 END) >= 40");
                $query->havingRaw("SUM(CASE WHEN vessel_activities.severity = 'high' THEN 8 WHEN vessel_activities.severity = 'medium' THEN 2 ELSE 0.5 END) < 80");
            } elseif ($severity === 'low') {
                $query->havingRaw("SUM(CASE WHEN vessel_activities.severity = 'high' THEN 8 WHEN vessel_activities.severity = 'medium' THEN 2 ELSE 0.5 END) < 40");
            }
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('vessels.name', 'like', "%{$search}%")
                    ->orWhere('vessels.mmsi', 'like', "{$search}%")
                    ->orWhere('vessels.imo', 'like', "{$search}%");
            });
        }

        if ($status && $status !== 'all') {
            $onlineThreshold = now()->subMinutes(15);
            if ($status === 'online') {
                $query->where('vessels.last_seen_at', '>=', $onlineThreshold);
            } elseif ($status === 'offline') {
                $query->where(function ($q) use ($onlineThreshold) {
                    $q->where('vessels.last_seen_at', '<', $onlineThreshold)
                        ->orWhereNull('vessels.last_seen_at');
                });
            }
        }

        $query->groupBy([
            'vessels.mmsi', 'vessels.imo', 'vessels.name',
            'vessels.lat', 'vessels.lng', 'vessels.course', 'vessels.last_seen_at',
        ])->orderBy('activities_count', 'desc');

        $paginator = $query->paginate($perPage);

        if ($paginator->isEmpty()) {
            return response()->json([
                'message' => 'No vessels with behavioural infractions found in the last 30 days.',
            ], 404);
        }

        $items = collect($paginator->items())->map(function ($vessel) {
            $highestSeverity = 'low';
            if ($vessel->max_severity_level == 3) {
                $highestSeverity = 'high';
            } elseif ($vessel->max_severity_level == 2) {
                $highestSeverity = 'medium';
            }

            return [
                'mmsi' => (int) $vessel->mmsi,
                'imo' => $vessel->imo ? (int) $vessel->imo : null,
                'name' => $vessel->name,
                'lat' => (float) $vessel->lat,
                'lng' => (float) $vessel->lng,
                'course' => (float) $vessel->course,
                'last_seen_at' => Carbon::parse($vessel->last_seen_at)->toIso8601String(),
                'infractions_count' => (int) $vessel->activities_count,
                'highest_severity' => $highestSeverity,
                'risk_score' => min(100, (int) $vessel->raw_score),
            ];
        });

        return response()->json([
            'data' => $items,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
            ],
        ]);
    }
}
