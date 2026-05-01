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
