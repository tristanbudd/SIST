import { FaXmark, FaLocationArrow, FaAnchor, FaCity, FaLayerGroup } from 'react-icons/fa6';

interface LayerControlProps {
    showVessels: boolean;
    setShowVessels: (v: boolean) => void;
    showPorts: boolean;
    setShowPorts: (v: boolean) => void;
    showCities: boolean;
    setShowCities: (v: boolean) => void;
    isOpen: boolean;
    onClose: () => void;
}

export default function LayerControl({
    showVessels,
    setShowVessels,
    showPorts,
    setShowPorts,
    showCities,
    setShowCities,
    isOpen,
    onClose,
}: LayerControlProps) {
    if (!isOpen) return null;

    return (
        <div className="absolute bottom-0 left-0 z-5000 bg-zinc-950 border border-white/20 shadow-2xl flex flex-col w-64 max-h-[70vh] animate-in slide-in-from-left-2 duration-200 overflow-hidden">
            <div className="p-3.5 flex flex-col gap-3.5 h-full overflow-y-auto">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <div className="flex items-center gap-3">
                            <FaLayerGroup className="text-white w-4 h-4" />
                            <span className="text-xs font-bold text-white tracking-wider uppercase">
                                Map Layers
                            </span>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-zinc-500 hover:text-white transition-colors w-5 h-5 flex items-center justify-center rounded hover:bg-white/10"
                            title="Close"
                        >
                            <FaXmark className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => setShowVessels(!showVessels)}
                            className="flex items-center justify-between group cursor-pointer"
                        >
                            <span
                                className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${showVessels ? 'text-white' : 'text-zinc-600'}`}
                            >
                                Vessels
                            </span>
                            <div
                                className={`w-8 h-4 border transition-colors relative ${showVessels ? 'bg-white border-white' : 'border-zinc-800 bg-transparent'}`}
                            >
                                <div
                                    className={`absolute top-0.5 bottom-0.5 w-3 transition-all ${showVessels ? 'right-0.5 bg-black' : 'left-0.5 bg-zinc-800'}`}
                                />
                            </div>
                        </button>

                        <button
                            onClick={() => setShowPorts(!showPorts)}
                            className="flex items-center justify-between group cursor-pointer"
                        >
                            <span
                                className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${showPorts ? 'text-white' : 'text-zinc-600'}`}
                            >
                                Ports
                            </span>
                            <div
                                className={`w-8 h-4 border transition-colors relative ${showPorts ? 'bg-white border-white' : 'border-zinc-800 bg-transparent'}`}
                            >
                                <div
                                    className={`absolute top-0.5 bottom-0.5 w-3 transition-all ${showPorts ? 'right-0.5 bg-black' : 'left-0.5 bg-zinc-800'}`}
                                />
                            </div>
                        </button>

                        <button
                            onClick={() => setShowCities(!showCities)}
                            className="flex items-center justify-between group cursor-pointer"
                        >
                            <span
                                className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${showCities ? 'text-white' : 'text-zinc-600'}`}
                            >
                                Cities / Towns
                            </span>
                            <div
                                className={`w-8 h-4 border transition-colors relative ${showCities ? 'bg-white border-white' : 'border-zinc-800 bg-transparent'}`}
                            >
                                <div
                                    className={`absolute top-0.5 bottom-0.5 w-3 transition-all ${showCities ? 'right-0.5 bg-black' : 'left-0.5 bg-zinc-800'}`}
                                />
                            </div>
                        </button>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] border-b border-white/10 pb-2">
                        Legend
                    </span>
                    <div className="flex flex-col gap-2.5">
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 bg-zinc-900 border border-white/10 flex items-center justify-center">
                                <FaLocationArrow className="w-2.5 h-2.5 text-white -rotate-45" />
                            </div>
                            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-tight">
                                Tracked Vessel
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 bg-zinc-900 border border-white/10 flex items-center justify-center relative">
                                <FaLocationArrow className="w-2.5 h-2.5 text-white -rotate-45" />
                                <FaLocationArrow className="w-2.5 h-2.5 text-white/40 -rotate-45 absolute translate-x-1 translate-y-1" />
                            </div>
                            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-tight">
                                Vessel Cluster
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 bg-zinc-900 border border-white/10 flex items-center justify-center">
                                <FaAnchor className="w-2.5 h-2.5 text-cyan-400" />
                            </div>
                            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-tight">
                                International Port
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 bg-zinc-900 border border-white/10 flex items-center justify-center">
                                <FaCity className="w-2.5 h-2.5 text-green-500" />
                            </div>
                            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-tight">
                                City / Town
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
