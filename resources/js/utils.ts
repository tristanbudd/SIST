/**
 * Shared utility functions used across the SIST frontend.
 */

/**
 * Formats a duration in seconds into a human-readable relative time string.
 * Handles ranges from seconds through months with correct pluralisation.
 */
export function formatPositionAge(seconds: number | undefined): string {
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

/**
 * Calculates the great-circle distance between two coordinates using the Haversine formula.
 * @returns Distance in kilometres
 */
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
            Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

interface ExternalLink {
    source: string;
    url: string;
    icon?: string;
}

/**
 * Generates external lookup URLs for a vessel based on its identifiers.
 * Prefers IMO for lookups as it is a permanent hull identifier,
 * whereas MMSI can change when a vessel re-flags.
 */
export function generateExternalLinks(mmsi: number, imo?: number): ExternalLink[] {
    return [
        {
            source: 'MarineTraffic (COM)',
            url: imo
                ? `https://www.marinetraffic.com/en/ais/details/ships/imo:${imo}`
                : `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${mmsi}`,
            icon: 'marinetraffic',
        },
        {
            source: 'VesselFinder',
            url: imo
                ? `https://www.vesselfinder.com/vessels/details/${imo}`
                : `https://www.vesselfinder.com/vessels?name=${mmsi}`,
            icon: 'vesselfinder',
        },
        {
            source: 'VesselTracker',
            url: imo
                ? `https://www.vesseltracker.com/en/Ships/${imo}.html`
                : `https://www.vesseltracker.com/en/vessels.html?search=${mmsi}`,
            icon: 'vesseltracker',
        },
        {
            source: 'MarineTraffic (ORG)',
            url: `https://www.marinetraffic.org/vessels?vessel=${imo || mmsi}`,
            icon: 'marinetraffic_org',
        },
        {
            source: 'ShipSpotting',
            url: imo
                ? `https://www.shipspotting.com/photos/gallery?imo=${imo}`
                : `https://www.shipspotting.com/photos/gallery?mmsi=${mmsi}`,
            icon: 'shipspotting',
        },
        {
            source: 'MyShipTracking',
            url: `https://www.myshiptracking.com/vessels/mmsi-${mmsi}`,
            icon: 'myshiptracking',
        },
    ];
}

/** Formats the current time in Europe/London timezone. */
export function formatLondonTime(options?: Intl.DateTimeFormatOptions): string {
    return new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/London',
        ...options,
    });
}

/** Formats a date string using the en-GB locale with the standard SIST display format. */
export function formatShortDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/London',
    });
}

/**
 * Truncates a string to a specified length, appending an ellipsis if necessary.
 */
export function truncate(str: string, length: number = 40): string {
    if (str.length <= length) return str;
    return str.slice(0, length) + '...';
}

import type { VesselActivity } from './Components/ShipDetailsSidebar';

/**
 * Determines the risk level string based on a numeric risk score.
 */
export function getRiskLevel(score: number): 'low' | 'medium' | 'high' {
    if (score >= 75) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
}

/**
 * Calculates risk statistics based on a vessel's recent activity.
 */
export function calculateActivityStats(activities: VesselActivity[]) {
    const days = 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const displayActivities = activities.filter((a) => {
        const started = new Date(a.started_at).getTime();
        return started >= cutoff;
    });

    const total = displayActivities.length;
    const highRiskCount = displayActivities.filter((a) => a.severity === 'high').length;

    // Scoring System: High 10 pts, Medium 3 pts, Low 1 pt. Max score is capped at 100
    const score = Math.min(
        100,
        displayActivities.reduce((acc, a) => {
            if (a.severity === 'high') return acc + 10;
            if (a.severity === 'medium') return acc + 3;
            return acc + 1;
        }, 0)
    );

    const riskLevel = getRiskLevel(score);

    return { total, highRiskCount, score, riskLevel };
}

/**
 * Returns visual metadata (labels, colors) for a risk level to ensure UI consistency.
 */
export function getRiskMetadata(level: 'low' | 'medium' | 'high') {
    switch (level) {
        case 'high':
            return {
                label: 'High Risk',
                colorClass: 'text-red-500',
                borderClass: 'border-red-500',
                bgClass: 'bg-red-500/5',
                softBorderClass: 'border-red-500/10',
            };
        case 'medium':
            return {
                label: 'Medium Risk',
                colorClass: 'text-amber-500',
                borderClass: 'border-amber-500',
                bgClass: 'bg-amber-500/5',
                softBorderClass: 'border-amber-500/10',
            };
        case 'low':
            return {
                label: 'Low Risk',
                colorClass: 'text-emerald-500',
                borderClass: 'border-emerald-500',
                bgClass: 'bg-emerald-500/5',
                softBorderClass: 'border-emerald-500/10',
            };
        default:
            return {
                label: 'Unknown',
                colorClass: 'text-zinc-500',
                borderClass: 'border-zinc-500',
                bgClass: 'bg-zinc-500/5',
                softBorderClass: 'border-zinc-500/10',
            };
    }
}
