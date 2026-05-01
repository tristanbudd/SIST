/** Shared constants used across the SIST frontend. */

/** Base URL for all SIST API requests */
export const API_BASE_URL = 'https://sist.tristanbudd.com/api/v1';

/** Threshold in minutes before a vessel is considered "offline" */
export const OFFLINE_THRESHOLD_MINUTES = 15;

/** Maps ISO country codes to sanctioning authority details */
export const SANCTIONER_MAPPING: Record<string, { name: string; body: string }> = {
    us: { name: 'United States (US)', body: 'OFAC SDN / BIS List' },
    eu: { name: 'European Union (EU)', body: 'EEAS Consolidated List' },
    un: { name: 'United Nations (UN)', body: 'UNSC Sanctions Regimes' },
    uk: { name: 'United Kingdom (UK)', body: 'HM Treasury (OFSI)' },
    ca: { name: 'Canada (CA)', body: 'Special Economic Measures (SARA)' },
    au: { name: 'Australia (AU)', body: 'DFAT Consolidated List' },
    jp: { name: 'Japan (JP)', body: 'METI Asset Freeze List' },
    ch: { name: 'Switzerland (CH)', body: 'SECO Sanctions' },
    fr: { name: 'France (FR)', body: 'National Asset Freeze List' },
    no: { name: 'Norway (NO)', body: 'MFA Sanctions List' },
    ru: { name: 'Russia (RU)', body: 'Rosfinmonitoring Watchlist' },
    ua: { name: 'Ukraine (UA)', body: 'NSDC Sanctions' },
    ina: { name: 'Indonesia (INA)', body: 'National Authority (BAPETEN)' },
    kr: { name: 'South Korea (KR)', body: 'Financial Services Commission' },
    sg: { name: 'Singapore (SG)', body: 'MAS Sanctions List' },
};

/** Maps AIS navigational status codes to human-readable labels */
export const NAV_STATUS_MAP: Record<number, string> = {
    0: 'Underway',
    1: 'Anchored',
    2: 'NUC',
    3: 'Restricted',
    4: 'Constrained',
    5: 'Moored',
    6: 'Aground',
    7: 'Fishing',
    8: 'Sailing',
    9: 'HSC',
    10: 'WIG',
    11: 'Towing',
    12: 'Pushing',
    13: 'Reserved',
    14: 'SART Active',
};

/** Maps WMO weather codes to descriptive text */
export const WEATHER_CODES: Record<number, string> = {
    0: 'Clear Sky',
    1: 'Mainly Clear',
    2: 'Partly Cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing Rime Fog',
    51: 'Light Drizzle',
    53: 'Moderate Drizzle',
    55: 'Dense Drizzle',
    61: 'Slight Rain',
    63: 'Moderate Rain',
    65: 'Heavy Rain',
    71: 'Slight Snowfall',
    73: 'Moderate Snowfall',
    75: 'Heavy Snowfall',
    95: 'Thunderstorm',
};

/** Maps external provider names to their local icon paths */
export const EXTERNAL_ICON_MAP: Record<string, string> = {
    'marinetraffic (com)': '/images/external/vesseltrackercom.png',
    'marinetraffic (org)': '/images/external/marinetrafficorg.png',
    vesselfinder: '/images/external/vesselfinder.png',
    vesseltracker: '/images/external/vesseltracker.png',
    shipspotting: '/images/external/shipspotting.png',
    myshiptracking: '/images/external/myshiptracking.png',
};
