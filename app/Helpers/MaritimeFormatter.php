<?php

namespace App\Helpers;

class MaritimeFormatter
{
    /**
     * Converts a duration in minutes into a human-readable string.
     */
    public static function formatDuration(float $minutes): string
    {
        $totalSeconds = (int) round($minutes * 60);

        if ($totalSeconds < 60) {
            return "{$totalSeconds} seconds";
        }

        if ($totalSeconds < 3600) {
            $m = (int) floor($totalSeconds / 60);

            return "{$m} minute".($m !== 1 ? 's' : '');
        }

        if ($totalSeconds < 86400) {
            $h = (int) floor($totalSeconds / 3600);
            $remainingM = (int) floor(($totalSeconds % 3600) / 60);

            if ($remainingM > 0) {
                return "{$h} hour".($h !== 1 ? 's' : '')." {$remainingM} minute".($remainingM !== 1 ? 's' : '');
            }

            return "{$h} hour".($h !== 1 ? 's' : '');
        }

        $d = (int) floor($totalSeconds / 86400);
        $remainingH = (int) floor(($totalSeconds % 86400) / 3600);

        if ($remainingH > 0) {
            return "{$d} day".($d !== 1 ? 's' : '')." {$remainingH} hour".($remainingH !== 1 ? 's' : '');
        }

        return "{$d} day".($d !== 1 ? 's' : '');
    }
}
