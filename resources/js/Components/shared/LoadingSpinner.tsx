/** Loading spinner component with size variants. */

const SIZE_CLASSES = {
    sm: 'w-4 h-4 border',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-2',
} as const;

interface LoadingSpinnerProps {
    size?: keyof typeof SIZE_CLASSES;
    className?: string;
}

export default function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
    return (
        <div
            className={`${SIZE_CLASSES[size]} bg-zinc-800 animate-spin rounded-full border-t-zinc-400 border-zinc-800 ${className}`}
        />
    );
}
