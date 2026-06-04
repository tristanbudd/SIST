<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $activities = DB::table('vessel_activities')
            ->where('type', 'speed_anomaly')
            ->get();

        $idsToDelete = [];

        foreach ($activities as $activity) {
            $details = is_string($activity->details) ? json_decode($activity->details, true) : $activity->details;
            $speed = $details['reported_speed'] ?? 0;

            if ($speed >= 102 && $speed <= 103) {
                $idsToDelete[] = $activity->id;
            }
        }

        if (! empty($idsToDelete)) {
            DB::table('vessel_activities')
                ->whereIn('id', $idsToDelete)
                ->delete();
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};
