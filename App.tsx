
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { CHAMPIONS, ITEMS, GOLD_VALUES } from './constants';
import { Role, EnemyThreshold, Item, AxiomState, VideoTelemetry, FrictionEvent, ItemStat, Champion } from './types';
import { getDeepVideoAudit, extractVideoTelemetry } from './geminiService';

/**
 * Parses simple **bold** markdown into styled spans for the Thirteenth Legion aesthetic.
 */
const FormattedAudit: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <div className="leading-[1.8] tracking-tight whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <span key={i} className="text-[#00ff41] font-black glow-text bg-[#00ff41]/10 px-1 mx-0.5">{part.slice(2, -2)}</span>;
        }
        return <span key={i} className="opacity-80">{part}</span>;
      })}
    </div>
  );
};

/**
 * Visual representation of RGE over time.
 */
const RGEGraph: React.FC<{ timeline: { timestamp: number, value: number }[] }> = ({ timeline }) => {
  if (!timeline || timeline.length === 0) return (
    <div className="h-64 flex items-center justify-center border border-[#00ff41]/10 bg-black/40 italic opacity-20 rounded-sm">
      DATA_STREAM_EMPTY
    </div>
  );

  const width = 1200;
  const height = 400;
  const padding = 60;

  const minX = Math.min(...timeline.map(d => d.timestamp));
  const maxX = Math.max(...timeline.map(d => d.timestamp));
  const minY = 0;
  const maxY = 150;

  const getX = (t: number) => padding + ((t - minX) / (maxX - minX || 1)) * (width - 2 * padding);
  const getY = (v: number) => (height - padding) - (v / maxY) * (height - 2 * padding);

  const points = timeline.map(d => `${getX(d.timestamp)},${getY(d.value)}`).join(' ');
  const areaPoints = `${getX(minX)},${height - padding} ` + points + ` ${getX(maxX)},${height - padding}`;

  return (
    <div className="w-full h-auto p-6 terminal-border bg-black/60 relative group rounded-sm shadow-inner">
      <div className="absolute top-4 right-6 text-[10px] font-black opacity-30 uppercase tracking-[0.2em]">Efficiency_Flow_Delta</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible drop-shadow-[0_0_15px_rgba(0,255,65,0.15)]">
        <defs>
          <linearGradient id="efficiencyGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00ff41" stopOpacity="0.6" />
            <stop offset="80%" stopColor="#00ff41" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#ff4444" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        
        {/* Grid Lines */}
        {[0, 50, 100, 150].map(v => (
          <g key={v}>
            <line 
              x1={padding} 
              y1={getY(v)} 
              x2={width - padding} 
              y2={getY(v)} 
              stroke={v === 100 ? "rgba(0,255,65,0.3)" : "rgba(0,255,65,0.05)"} 
              strokeWidth="1" 
              strokeDasharray={v === 100 ? "0" : "4 4"}
            />
            <text x={padding - 15} y={getY(v) + 4} textAnchor="end" fill="rgba(0,255,65,0.4)" fontSize="12" fontWeight="bold">{v}%</text>
          </g>
        ))}

        {/* Fill Area */}
        <polygon points={areaPoints} fill="url(#efficiencyGradient)" className="opacity-20" />

        {/* Main Trace */}
        <polyline
          fill="none"
          stroke="#00ff41"
          strokeWidth="3"
          points={points}
          className="transition-all duration-1000 ease-out"
        />

        {/* Dynamic Nodes */}
        {timeline.map((d, i) => (
          <circle 
            key={i} 
            cx={getX(d.timestamp)} 
            cy={getY(d.value)} 
            r="4" 
            fill={d.value < 90 ? "#ff4444" : "#00ff41"} 
            className="hover:r-8 cursor-pointer transition-all"
          >
            <title>Video T+{d.timestamp}s | RGE: {d.value}%</title>
          </circle>
        ))}
      </svg>
    </div>
  );
};

/**
 * Item Card for display in various protocols.
 */
const ItemCard: React.FC<{ item: Item; variant?: 'BASE' | 'UPGRADE' | 'TACTICAL'; onClick?: () => void; isSelected?: boolean }> = ({ item, variant = 'BASE', onClick, isSelected }) => {
  const efficiency = useMemo(() => {
    let rawValue = 0;
    Object.entries(item.stats).forEach(([stat, value]) => {
      const gv = (GOLD_VALUES as any)[stat.toUpperCase()];
      if (gv) rawValue += ((value as number) || 0) * (gv as number);
    });
    rawValue += item.passiveValue || 0;
    return (rawValue / item.cost) * 100;
  }, [item]);

  return (
    <div 
      onClick={onClick}
      className={`p-5 border cursor-pointer transition-all relative overflow-hidden flex flex-col gap-3 group rounded-sm
      ${variant === 'UPGRADE' ? 'bg-[#00ff41]/5 border-[#00ff41]/40 shadow-[0_0_15px_rgba(0,255,65,0.05)]' : 'bg-black/60 border-[#00ff41]/10'}
      ${isSelected ? 'border-[#00ff41] bg-[#00ff41]/20 scale-[1.02] shadow-[0_0_20px_rgba(0,255,65,0.1)]' : 'hover:border-[#00ff41]/40 hover:bg-[#00ff41]/5'}
      `}
    >
      <div className="flex justify-between items-start">
        <span className={`text-[9px] font-black uppercase tracking-widest ${variant === 'UPGRADE' ? 'text-[#00ff41]' : 'opacity-30'}`}>
          {variant === 'UPGRADE' ? 'Δ_EVOLUTION' : variant === 'TACTICAL' ? `ID_${item.id.toUpperCase()}` : 'AXIOM_BASE'}
        </span>
        <span className="text-[11px] font-bold opacity-60 tabular-nums">{item.cost}G</span>
      </div>
      <div className="text-sm font-black uppercase truncate group-hover:text-white transition-colors tracking-tight">{item.name}</div>
      <div className="flex items-center gap-3">
        <div className="flex-grow h-1.5 bg-[#00ff41]/10 rounded-full overflow-hidden">
          <div className={`h-full transition-all duration-1000 ${efficiency > 100 ? 'bg-[#00ff41]' : 'bg-[#00ff41]/40'}`} style={{ width: `${Math.min(100, efficiency)}%` }}></div>
        </div>
        <span className={`text-[10px] font-black tabular-nums ${efficiency > 100 ? 'text-[#00ff41]' : 'opacity-40'}`}>
          {efficiency.toFixed(1)}%
        </span>
      </div>
      {variant === 'UPGRADE' && (
        <div className="absolute top-2 right-2">
           <div className="w-1.5 h-1.5 bg-[#00ff41] animate-pulse rounded-full"></div>
        </div>
      )}
    </div>
  );
};

/**
 * Total Tactical Overhaul.
 */
const TacticalProtocol: React.FC<{ champion: Champion | null }> = ({ champion }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<'NONE' | 'EFF_DESC' | 'COST_ASC'>('NONE');

  const calcEff = useCallback((item: Item) => {
    let raw = 0;
    Object.entries(item.stats).forEach(([s, v]) => {
      const gv = (GOLD_VALUES as any)[s.toUpperCase()];
      if (gv) raw += ((v as number) || 0) * (gv as number);
    });
    return (raw + (item.passiveValue || 0)) / item.cost * 100;
  }, []);

  const toggleItem = (item: Item) => {
    if (selectedIds.includes(item.id)) {
      setSelectedIds(prev => prev.filter(id => id !== item.id));
    } else if (selectedIds.length < 3) {
      setSelectedIds(prev => [...prev, item.id]);
    }
  };

  const selectedItems = useMemo(() => {
    return selectedIds.map(id => ITEMS.find(i => i.id === id)!).filter(Boolean);
  }, [selectedIds]);

  const sortedMatrixItems = useMemo(() => {
    let list = [...selectedItems];
    if (sortOrder === 'EFF_DESC') list.sort((a, b) => calcEff(b) - calcEff(a));
    if (sortOrder === 'COST_ASC') list.sort((a, b) => a.cost - b.cost);
    return list;
  }, [selectedItems, sortOrder, calcEff]);

  const statKeys: (keyof ItemStat)[] = ['ad', 'ap', 'hp', 'armor', 'mr', 'ah', 'as', 'crit', 'ms_percent'];

  return (
    <div className="space-y-20 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      <div className="space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-[#00ff41]/10 pb-10">
           <div className="space-y-4">
              <h3 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic glow-text">TACTICAL_ARSENAL</h3>
              <p className="text-xs opacity-40 uppercase tracking-[0.5em]">Map the Axiom of Value across the global item pool (Max 3 Comparisons)</p>
           </div>
           <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => setSortOrder('EFF_DESC')}
                className={`px-8 py-3 border text-[10px] font-black uppercase tracking-[0.3em] transition-all rounded-sm ${sortOrder === 'EFF_DESC' ? 'bg-[#00ff41] text-black border-[#00ff41]' : 'border-[#00ff41]/30 hover:bg-[#00ff41]/10'}`}
              >SORT_EFFICIENCY</button>
              <button 
                onClick={() => setSelectedIds([])}
                className="px-8 py-3 border border-red-900/40 text-red-500 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-red-900/20 transition-all rounded-sm"
              >FLUSH_MATRIX</button>
           </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
           {ITEMS.map(item => (
             <ItemCard 
               key={item.id} 
               item={item} 
               variant="TACTICAL" 
               isSelected={selectedIds.includes(item.id)}
               onClick={() => toggleItem(item)}
             />
           ))}
        </div>
      </div>

      {selectedItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 pt-10">
          {sortedMatrixItems.map((item) => (
            <div key={item.id} className="terminal-border p-10 bg-black/40 space-y-10 relative group rounded-sm shadow-2xl">
              <div className="flex justify-between items-baseline border-b border-[#00ff41]/10 pb-6">
                 <h4 className="text-3xl font-black uppercase tracking-tight text-[#00ff41] truncate mr-4">{item.name}</h4>
                 <span className="text-4xl font-black opacity-10 tabular-nums">#{calcEff(item).toFixed(0)}%</span>
              </div>
              
              <div className="space-y-8">
                {statKeys.map(key => {
                  const val = item.stats[key];
                  if (val === undefined || val === 0) return null;
                  return (
                    <div key={key} className="space-y-3">
                       <div className="flex justify-between text-[12px] font-black uppercase opacity-60 tracking-wider">
                          <span>{key}</span>
                          <span className="text-[#00ff41]">{val}{key === 'ms_percent' ? '%' : ''}</span>
                       </div>
                       <div className="h-2 bg-[#00ff41]/5 w-full rounded-full">
                          <div className="h-full bg-[#00ff41] rounded-full shadow-[0_0_10px_rgba(0,255,65,0.2)]" style={{ width: `${Math.min(100, (val / (key === 'hp' ? 600 : 80)) * 100)}%` }}></div>
                       </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-10 italic text-[11px] leading-relaxed opacity-40 border-t border-[#00ff41]/5">
                 "{item.description}"
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-96 flex flex-col items-center justify-center border-2 border-dashed border-[#00ff41]/5 rounded-sm opacity-20 space-y-6">
           <div className="text-7xl font-black italic tracking-tighter">EMPTY_MATRIX</div>
           <p className="text-[10px] font-black uppercase tracking-[1em]">Awaiting Axiom Input</p>
        </div>
      )}
    </div>
  );
};

/**
 * Main Protocol.
 */
const App: React.FC = () => {
  const [state, setState] = useState<AxiomState & { videoUrl?: string }>({
    currentGold: 0,
    cr: 0,
    laneVelocity: 0,
    enemyDefensiveState: EnemyThreshold.SQUISHY,
    selectedChampion: null,
    isAnalyzing: false,
    videoUrl: undefined,
    view: 'UPLOAD'
  });

  const [videoTelemetry, setVideoTelemetry] = useState<VideoTelemetry | null>(null);
  const [audit, setAudit] = useState<string>("");
  const [snapshots, setSnapshots] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'AUDIT' | 'MATH' | 'GALLERY' | 'TACTICAL'>('AUDIT');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const captureFrame = (time: number): Promise<string> => {
    return new Promise((resolve) => {
      if (!videoRef.current || !canvasRef.current) return resolve("");
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      const onSeeked = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        video.removeEventListener('seeked', onSeeked);
        resolve(dataUrl);
      };

      video.addEventListener('seeked', onSeeked);
      video.currentTime = Math.max(0, time);
    });
  };

  const processSnapshots = async (events: FrictionEvent[]) => {
    const images: string[] = [];
    for (const event of events) {
      const img = await captureFrame(event.timestampSeconds);
      images.push(img);
    }
    setSnapshots(images);
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const mimeType = file.type || (file.name.endsWith('.webm') ? 'video/webm' : 'video/mp4');
    const url = URL.createObjectURL(file);
    
    setState(prev => ({ ...prev, isAnalyzing: true, videoUrl: url, view: 'UPLOAD' }));
    setAudit("COMMENCING_NEURAL_RECONSTRUCTION...");

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const telemetry = await extractVideoTelemetry(base64, mimeType);

      if (telemetry) {
        const champ = CHAMPIONS.find(c => c.name.toLowerCase() === telemetry.championName.toLowerCase());
        setVideoTelemetry(telemetry);
        
        setTimeout(async () => {
          await processSnapshots(telemetry.frictionEvents);
          const auditResponse = await getDeepVideoAudit(telemetry);
          setAudit(auditResponse);
          setState(prev => ({ ...prev, selectedChampion: champ || null, isAnalyzing: false, view: 'AUDIT' }));
        }, 2000);
      } else {
        setAudit("NEURAL_LINK_ERROR: INGESTION_FAILED.");
        setState(prev => ({ ...prev, isAnalyzing: false }));
      }
    };
    reader.readAsDataURL(file);
  };

  const suggestedUpgrades = useMemo(() => {
    if (!videoTelemetry) return [];
    return videoTelemetry.suggestedItems
      .map(name => ITEMS.find(i => i.name.toLowerCase().includes(name.toLowerCase())))
      .filter((i): i is Item => !!i);
  }, [videoTelemetry]);

  const baseBuildItems = useMemo(() => {
    if (!state.selectedChampion) return [];
    return state.selectedChampion.baseBuild
      .map(name => ITEMS.find(i => i.name === name))
      .filter((i): i is Item => !!i);
  }, [state.selectedChampion]);

  return (
    <div className="min-h-screen flex flex-col relative selection:bg-[#00ff41] selection:text-black bg-[#010101]">
      <canvas ref={canvasRef} className="hidden" />
      <video ref={videoRef} src={state.videoUrl} className="hidden" muted crossOrigin="anonymous" />
      
      {state.view === 'UPLOAD' ? (
        <div className="h-screen flex flex-col items-center justify-center p-10 animate-in fade-in duration-1000 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
             <div className="grid grid-cols-12 grid-rows-12 h-full w-full border border-[#00ff41]/20">
                {Array.from({length: 144}).map((_, i) => <div key={i} className="border border-[#00ff41]/10"></div>)}
             </div>
          </div>

          <div className="w-full max-w-6xl space-y-24 relative z-10">
            <div className="text-center space-y-6">
              <h1 className="text-[12rem] md:text-[16rem] font-black tracking-[-0.2em] leading-none glitch-text glow-text uppercase" data-text="LUNACY">
                LUNACY
              </h1>
              <div className="flex items-center justify-center gap-8 opacity-40">
                <span className="w-32 h-px bg-[#00ff41]"></span>
                <p className="text-sm uppercase tracking-[1.5em] font-black">Forensic_Node_77</p>
                <span className="w-32 h-px bg-[#00ff41]"></span>
              </div>
            </div>

            <div 
              className="w-full max-w-4xl mx-auto border-2 border-[#00ff41]/20 bg-black/50 backdrop-blur-3xl group cursor-pointer h-96 flex flex-col items-center justify-center gap-12 transition-all hover:border-[#00ff41]/60 hover:bg-[#00ff41]/5 relative shadow-2xl rounded-sm"
              onClick={() => !state.isAnalyzing && fileInputRef.current?.click()}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-[#00ff41]/10">
                {state.isAnalyzing && <div className="h-full bg-[#00ff41] w-1/4 animate-[progress_1.2s_infinite_linear] shadow-[0_0_10px_#00ff41]"></div>}
              </div>
              
              <div className="p-12 border border-[#00ff41]/10 group-hover:border-[#00ff41]/40 transition-all rounded-sm">
                <svg className={`w-24 h-24 ${state.isAnalyzing ? 'animate-pulse text-[#00ff41]' : 'group-hover:scale-110 group-hover:text-[#00ff41] transition-all'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.25}>
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>

              <div className="text-center space-y-4">
                 <h2 className="text-3xl font-black uppercase tracking-[0.5em] tracking-tighter">{state.isAnalyzing ? 'RECONSTRUCTING' : 'INGEST_COMBAT_LOG'}</h2>
                 <p className="text-[10px] opacity-40 uppercase tracking-[0.8em]">Awaiting Forensic Neural Ingestion (MP4/WEBM)</p>
              </div>
              <input type="file" accept="video/mp4,video/webm" className="hidden" ref={fileInputRef} onChange={handleVideoUpload} />
            </div>

            {state.isAnalyzing && (
              <div className="max-w-xl mx-auto space-y-6 text-center animate-pulse">
                 <div className="text-[11px] font-black uppercase tracking-[1em] text-[#00ff41]">Neural_Interface_Online...</div>
                 <p className="text-sm italic opacity-80 leading-relaxed font-medium">"{audit}"</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col animate-in fade-in duration-1000 min-h-screen">
          {/* Global Operational Header - Fixed height for offset calculation */}
          <header className="sticky top-0 z-[100] px-12 py-10 bg-black/95 backdrop-blur-2xl border-b border-[#00ff41]/10 flex flex-col lg:flex-row items-center justify-between gap-12 shadow-2xl h-[220px] lg:h-[180px]">
             <div className="flex items-center gap-16">
                <div className="space-y-3">
                   <h1 className="text-5xl font-black tracking-tighter uppercase glitch-text leading-none glow-text" data-text={`${videoTelemetry?.championName} // 0xAF`}>
                      {videoTelemetry?.championName} // 0xAF
                   </h1>
                   <div className="flex gap-6 items-center">
                      <span className="text-[10px] bg-[#00ff41] text-black px-3 py-1 font-black uppercase tracking-widest rounded-sm">RECON_COMPLETE</span>
                      <span className="text-[10px] opacity-30 uppercase font-black tracking-[0.4em]">Forensic_Node: Alpha_Primary</span>
                   </div>
                </div>

                <div className="h-16 w-px bg-[#00ff41]/10 hidden xl:block"></div>

                <div className="hidden xl:flex gap-16">
                   {[
                     { l: 'CS_DELTA', v: `+${videoTelemetry ? videoTelemetry.endCS - videoTelemetry.startCS : 0}` },
                     { l: 'GOLD_HOARD', v: `${videoTelemetry?.mathMetrics.goldHoarded}g`, c: 'text-[#00ff41]' },
                     { l: 'T_VELOCITY', v: `${videoTelemetry?.mathMetrics.velocityHz.toFixed(2)}Hz` },
                     { l: 'F_INDEX', v: `${videoTelemetry?.mathMetrics.frictionCoefficient.toFixed(2)}`, c: 'text-red-500' }
                   ].map((k, i) => (
                     <div key={i} className="flex flex-col">
                        <span className="text-[10px] font-black opacity-30 uppercase tracking-[0.6em] mb-1">{k.l}</span>
                        <span className={`text-3xl font-black tabular-nums tracking-tighter ${k.c || 'text-white'}`}>{k.v}</span>
                     </div>
                   ))}
                </div>
             </div>

             <div className="flex gap-6">
                <button 
                  onClick={() => setState(p => ({ ...p, view: 'UPLOAD', videoUrl: undefined }))}
                  className="px-12 py-4 border-2 border-red-600/40 text-red-500 text-xs font-black uppercase tracking-[0.5em] hover:bg-red-600 hover:text-white transition-all rounded-sm shadow-lg"
                >TERMINATE_PROTOCOL</button>
             </div>
          </header>

          <main className="flex-grow flex flex-col relative z-10">
             {/* Sticky Tab Navigation - Offset matches header height */}
             <nav className="sticky top-[220px] lg:top-[180px] z-[90] bg-black border-b border-[#00ff41]/10 flex overflow-x-auto no-scrollbar shadow-xl">
                {['AUDIT', 'MATH', 'GALLERY', 'TACTICAL'].map((t) => (
                   <button 
                     key={t}
                     onClick={() => setActiveTab(t as any)}
                     className={`px-16 py-7 text-[11px] font-black uppercase tracking-[0.8em] transition-all whitespace-nowrap relative flex-1 min-w-[200px]
                     ${activeTab === t ? 'bg-[#00ff41] text-black glow-text' : 'hover:bg-[#00ff41]/5 opacity-30 hover:opacity-100'}
                     `}
                   >
                      {t}_PROTOCOL
                      {activeTab === t && <div className="absolute bottom-0 left-0 w-full h-1 bg-white/40"></div>}
                   </button>
                ))}
             </nav>

             {/* Main Protocol Content */}
             <div className="p-10 md:p-20 max-w-[1800px] mx-auto w-full space-y-32">
                {activeTab === 'AUDIT' && (
                  <div className="space-y-32 animate-in slide-in-from-bottom-12 duration-1000">
                    <div className="space-y-16">
                       <div className="flex items-center gap-10 opacity-20">
                          <span className="text-[11px] font-black uppercase tracking-[1.2em]">Neural_Log_Start</span>
                          <div className="flex-grow h-px bg-[#00ff41]"></div>
                       </div>
                       <div className="text-xl md:text-2xl font-medium text-white/90 max-w-7xl selection:bg-white selection:text-black">
                          <FormattedAudit text={audit} />
                       </div>
                       <div className="flex items-center gap-10 opacity-20">
                          <div className="flex-grow h-px bg-[#00ff41]"></div>
                          <span className="text-[11px] font-black uppercase tracking-[1.2em]">Neural_Log_End</span>
                       </div>
                    </div>

                    <div className="space-y-16">
                       <h3 className="text-5xl font-black uppercase tracking-tighter italic glow-text">EQUIPMENT_POST_MORTEM</h3>
                       <div className="grid grid-cols-1 lg:grid-cols-2 gap-24">
                          <div className="space-y-10">
                             <div className="flex items-center gap-6 text-[12px] font-black opacity-30 uppercase tracking-[0.6em]">
                                <span className="w-16 h-px bg-[#00ff41]/20"></span> ARCHIVAL_BUILD
                             </div>
                             <div className="grid grid-cols-1 gap-6">
                                {baseBuildItems.map((it, i) => <ItemCard key={i} item={it} variant="BASE" />)}
                             </div>
                          </div>
                          <div className="space-y-10">
                             <div className="flex items-center gap-6 text-[12px] font-black text-[#00ff41] uppercase tracking-[0.6em]">
                                <span className="w-16 h-px bg-[#00ff41]"></span> AXIOMATIC_UPGRADES
                             </div>
                             <div className="grid grid-cols-1 gap-6">
                                {suggestedUpgrades.map((it, i) => <ItemCard key={i} item={it} variant="UPGRADE" />)}
                                {suggestedUpgrades.length === 0 && (
                                   <div className="h-64 border-2 border-dashed border-[#00ff41]/5 flex items-center justify-center italic opacity-10 text-lg rounded-sm">ZERO_DEVIATION_DETECTED</div>
                                )}
                             </div>
                          </div>
                       </div>
                    </div>
                  </div>
                )}

                {activeTab === 'MATH' && (
                  <div className="space-y-32 animate-in slide-in-from-bottom-12 duration-1000">
                     <div className="space-y-12">
                        <h3 className="text-5xl font-black uppercase tracking-tighter italic glow-text">EFFICIENCY_TIME_MAPPING</h3>
                        <RGEGraph timeline={videoTelemetry?.rgeTimeline || []} />
                     </div>

                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-32">
                        <div className="space-y-12">
                           <h3 className="text-5xl font-black uppercase tracking-tighter italic glow-text">TEMPO_CALCULUS</h3>
                           <p className="text-2xl leading-relaxed opacity-60 font-medium">
                              Relative efficiency is the delta between potential gold energy and kinetic lane pressure. Unspent gold is a tax on destiny.
                           </p>
                           <div className="p-16 terminal-border bg-[#00ff41]/5 space-y-6 rounded-sm shadow-2xl relative overflow-hidden">
                              <div className="absolute top-0 right-0 p-6 text-[10px] opacity-10 font-black tracking-widest">THIRTEENTH_LEGION_DOC</div>
                              <div className="text-[12px] font-black opacity-40 uppercase tracking-[0.8em]">Master_Velocity_Logic</div>
                              <div className="text-5xl md:text-7xl font-black text-[#00ff41] tracking-tighter glitch-text leading-none" data-text="L = (ΔCS/Δt) * Φ⁻¹">
                                 L = (ΔCS / Δt) * (1 + (G_p / 1000))⁻¹
                              </div>
                           </div>
                        </div>

                        <div className="flex flex-col justify-center gap-16">
                           <div className="space-y-6">
                              <div className="flex justify-between text-xs font-black tracking-[1em] uppercase">
                                 <span className="opacity-30 tracking-[1em]">SYNC_RELIABILITY</span>
                                 <span className="text-[#00ff41]">{videoTelemetry?.mathMetrics.rgeEstimate.toFixed(1)}%</span>
                              </div>
                              <div className="h-6 bg-black border border-[#00ff41]/10 relative rounded-sm overflow-hidden">
                                 <div className="h-full bg-[#00ff41] shadow-[0_0_30px_rgba(0,255,65,0.5)] transition-all duration-1000" style={{ width: `${videoTelemetry?.mathMetrics.rgeEstimate}%` }}></div>
                              </div>
                           </div>
                           <div className="space-y-6">
                              <div className="flex justify-between text-xs font-black tracking-[1em] uppercase">
                                 <span className="opacity-30 tracking-[1em]">KINETIC_FRICTION</span>
                                 <span className="text-red-500">{(videoTelemetry?.mathMetrics.frictionCoefficient || 0).toFixed(2)}</span>
                              </div>
                              <div className="h-6 bg-black border border-red-500/10 relative rounded-sm overflow-hidden">
                                 <div className="h-full bg-red-600 shadow-[0_0_30px_rgba(239,68,68,0.5)] transition-all duration-1000" style={{ width: `${(videoTelemetry?.mathMetrics.frictionCoefficient || 0) * 100}%` }}></div>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
                )}

                {activeTab === 'GALLERY' && (
                  <div className="space-y-24 animate-in slide-in-from-bottom-12 duration-1000">
                    <div className="flex items-center justify-between border-b border-[#00ff41]/10 pb-12">
                       <div className="space-y-4">
                          <h3 className="text-5xl font-black uppercase tracking-tighter italic glow-text">EVIDENCE_GALLERY</h3>
                          <p className="text-xs opacity-40 uppercase tracking-[0.6em]">Visual confirmation of temporal violations</p>
                       </div>
                       <span className="text-xl font-black tabular-nums opacity-20">{videoTelemetry?.frictionEvents.length || 0}_FRAMES</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-16">
                       {videoTelemetry?.frictionEvents.map((ev, idx) => (
                         <div key={idx} className="terminal-border overflow-hidden bg-black/80 group hover:border-[#00ff41]/60 transition-all rounded-sm shadow-2xl">
                            <div className="aspect-video relative overflow-hidden bg-black">
                               <img src={snapshots[idx]} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all group-hover:scale-110 duration-700" alt="Forensic Log" />
                               <div className="absolute top-6 left-6 flex gap-4">
                                  <span className="bg-[#00ff41] text-black px-4 py-1 text-[11px] font-black uppercase tracking-widest shadow-lg rounded-sm">{ev.gameClock}</span>
                                  <span className="bg-black/60 backdrop-blur-md text-[#00ff41] px-4 py-1 text-[11px] font-black uppercase border border-[#00ff41]/40 rounded-sm">SEC_{ev.timestampSeconds}</span>
                               </div>
                            </div>
                            <div className="p-10 space-y-6">
                               <div className="text-red-500 font-black text-2xl uppercase tracking-tighter leading-none border-l-4 border-red-500 pl-6">{ev.axiomViolation}</div>
                               <p className="text-sm leading-relaxed opacity-60 italic font-medium">"{ev.description}"</p>
                            </div>
                         </div>
                       ))}
                       {(!videoTelemetry?.frictionEvents || videoTelemetry.frictionEvents.length === 0) && (
                         <div className="col-span-full h-[600px] flex flex-col items-center justify-center opacity-10 space-y-10">
                            <div className="text-[12rem] font-black italic tracking-tighter">NULL</div>
                            <div className="text-xs font-black uppercase tracking-[2em]">Forensic_Data_Empty</div>
                         </div>
                       )}
                    </div>
                  </div>
                )}

                {activeTab === 'TACTICAL' && <TacticalProtocol champion={state.selectedChampion} />}
             </div>
          </main>

          <footer className="mt-32 px-12 py-20 border-t border-[#00ff41]/5 bg-black/40 text-center relative z-10">
             <div className="text-[11px] font-black opacity-10 uppercase tracking-[3em] text-center">
                Aesthetic_Precision // Thirteenth_Legion // Logic_Terminal_77
             </div>
          </footer>
        </div>
      )}

      {/* Persistent Global Metrics Overlay */}
      <div className="fixed bottom-0 w-full flex justify-between items-center px-12 py-4 text-[11px] opacity-20 uppercase tracking-[1.2em] pointer-events-none z-[200] bg-black/80 backdrop-blur-md border-t border-[#00ff41]/5">
         <div>Forensic_Interface_Active</div>
         <div className="flex items-center gap-6">
            <span className="animate-pulse">Neural_Sync_Stable</span>
            <div className="w-2 h-2 bg-[#00ff41] rounded-full shadow-[0_0_10px_#00ff41]"></div>
         </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(500%); }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        /* Smooth scrolling for the global context */
        html {
            scroll-behavior: smooth;
        }
      `}} />
    </div>
  );
};

export default App;
