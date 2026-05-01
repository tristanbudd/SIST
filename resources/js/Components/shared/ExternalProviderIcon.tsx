import { FaShieldHalved, FaImage } from 'react-icons/fa6';
import { EXTERNAL_ICON_MAP } from '../../constants';

interface ExternalProviderIconProps {
    name: string;
    className?: string;
}

/**
 * Renders the appropriate icon for an external maritime data provider.
 * Falls back to Google favicon service if the local icon fails to load,
 * or to a generic icon for unknown providers.
 */
export default function ExternalProviderIcon({ name, className = '' }: ExternalProviderIconProps) {
    const iconPath = EXTERNAL_ICON_MAP[name.toLowerCase()];

    if (iconPath) {
        return (
            <img
                src={iconPath}
                alt={`${name} logo`}
                className={className}
                onError={(e) => {
                    const domain = name.toLowerCase().includes('marinetraffic')
                        ? name.toLowerCase().includes('org')
                            ? 'marinetraffic.org'
                            : 'marinetraffic.com'
                        : name.toLowerCase();
                    (e.target as HTMLImageElement).src =
                        `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
                }}
            />
        );
    }

    switch (name.toLowerCase()) {
        case 'sanctions_network':
        case 'fleetleaks':
            return <FaShieldHalved className={className} />;
        default:
            return <FaImage className={className} />;
    }
}
