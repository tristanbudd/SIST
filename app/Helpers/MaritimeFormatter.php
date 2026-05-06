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
                return "{$h} hour".($h !== 1 ? 's' : '').", {$remainingM} minute".($remainingM !== 1 ? 's' : '');
            }

            return "{$h} hour".($h !== 1 ? 's' : '');
        }

        if ($totalSeconds < 2592000) { // 30 days
            $d = (int) floor($totalSeconds / 86400);
            $remainingH = (int) floor(($totalSeconds % 86400) / 3600);

            if ($remainingH > 0) {
                return "{$d} day".($d !== 1 ? 's' : '').", {$remainingH} hour".($remainingH !== 1 ? 's' : '');
            }

            return "{$d} day".($d !== 1 ? 's' : '');
        }

        if ($totalSeconds < 31536000) { // 365 days
            $mo = (int) floor($totalSeconds / 2592000);
            $remainingD = (int) floor(($totalSeconds % 2592000) / 86400);

            if ($remainingD > 0) {
                return "{$mo} month".($mo !== 1 ? 's' : '').", {$remainingD} day".($remainingD !== 1 ? 's' : '');
            }

            return "{$mo} month".($mo !== 1 ? 's' : '');
        }

        $y = (int) floor($totalSeconds / 31536000);
        $remainingMo = (int) floor(($totalSeconds % 31536000) / 2592000);

        if ($remainingMo > 0) {
            return "{$y} year".($y !== 1 ? 's' : '').", {$remainingMo} month".($remainingMo !== 1 ? 's' : '');
        }

        return "{$y} year".($y !== 1 ? 's' : '');
    }
}
