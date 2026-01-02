
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { CHAMPIONS, ITEMS, GOLD_VALUES } from './constants';
import { Role, EnemyThreshold, Item, AxiomState, VideoTelemetry, FrictionEvent } from './types';
import { getDeepVideoAudit, extractVideoTelemetry } from './geminiService';

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
  const [activeTab, setActiveTab] = useState<'AUDIT' | 'GALLERY' | 'MATH'>('AUDIT');
  
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
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
        
        // Wait for video metadata to load for frame capture
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

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col font-mono text-[#00ff41] relative selection:bg-[#00ff41] selection:text-black">
      <canvas ref={canvasRef} className="hidden" />
      <video ref={videoRef} src={state.videoUrl} className="hidden" muted crossOrigin="anonymous" />
      
      {state.view === 'UPLOAD' ? (
        <div className="flex-grow flex flex-col items-center justify-center p-8 animate-in fade-in duration-1000 relative overflow-hidden">
          {/* Background Decorative Elements */}
          <div className="absolute inset-0 opacity-5 pointer-events-none">
             <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,_#00ff41_0%,_transparent_70%)] opacity-10"></div>
             <div className="grid grid-cols-12 h-full w-full">
                {Array.from({length: 12}).map((_, i) => <div key={i} className="border-r border-[#00ff41]/20"></div>)}
             </div>
          </div>

          <div className="relative z-10 w-full max-w-6xl space-y-16">
            <div className="text-center space-y-6">
              <h1 className="text-8xl md:text-9xl font-black tracking-tighter glow-text uppercase leading-none">
                THE_CURATOR
              </h1>
              <p className="text-sm md:text-base opacity-40 uppercase tracking-[1.5em] font-bold">
                FORENSIC // AXIOMATIC // AUDIT
              </p>
            </div>

            <div className="flex flex-col items-center gap-12">
               <div 
                 className="w-full max-w-2xl group relative cursor-pointer"
                 onClick={() => !state.isAnalyzing && fileInputRef.current?.click()}
               >
                 {/* Large Ingestion Zone */}
                 <div className="h-[400px] border border-[#00ff41]/30 bg-black/40 backdrop-blur-3xl flex flex-col items-center justify-center gap-8 transition-all hover:border-[#00ff41] hover:bg-[#00ff41]/5 overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-[#00ff41]/10 group-hover:bg-[#00ff41]/40 overflow-hidden">
                       {state.isAnalyzing && <div className="h-full bg-[#00ff41] w-1/3 animate-[progress_1s_infinite_linear]"></div>}
                    </div>
                    
                    <div className="relative">
                       <svg className={`w-24 h-24 ${state.isAnalyzing ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                       </svg>
                    </div>

                    <div className="text-center space-y-4 px-12">
                       <h2 className="text-xl font-black tracking-[0.3em] uppercase">{state.isAnalyzing ? 'INGESTING_REPLAY_STREAM' : 'INITIATE_FORENSIC_INGESTION'}</h2>
                       <p className="text-xs opacity-40 uppercase leading-relaxed max-w-md mx-auto">
                          Drop Combat Logs (MP4/WEBM) here for Thirteenth Legion Axiomatic Validation. 
                          The Curator will extract temporal telemetry and identify friction.
                       </p>
                    </div>

                    <div className="absolute bottom-4 right-4 flex items-center gap-2 opacity-20">
                       <span className="text-[10px] font-bold">NODE_ID: 77-BETA</span>
                       <div className="w-1.5 h-1.5 bg-[#00ff41] rounded-full animate-pulse"></div>
                    </div>
                 </div>
                 
                 <input type="file" accept="video/mp4,video/webm" className="hidden" ref={fileInputRef} onChange={handleVideoUpload} />
               </div>

               {state.isAnalyzing && (
                 <div className="w-full max-w-md space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-60">
                       <span>Extraction_Status</span>
                       <span className="text-[#00ff41]">ACTIVE</span>
                    </div>
                    <div className="h-px bg-[#00ff41]/20 w-full relative">
                       <div className="absolute top-0 left-0 h-full bg-[#00ff41] w-1/2 animate-[progress_2s_infinite_ease-in-out]"></div>
                    </div>
                    <p className="text-xs text-center italic opacity-80 animate-pulse">{audit}</p>
                 </div>
               )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-grow flex flex-col animate-in fade-in duration-700 h-screen overflow-hidden">
          {/* HEADER BAR - FULL WIDTH */}
          <header className="px-8 py-6 border-b border-[#00ff41]/20 bg-black flex items-center justify-between">
             <div className="flex items-center gap-10">
                <div className="flex flex-col">
                   <h1 className="text-4xl font-black uppercase tracking-tighter glow-text leading-none">
                      {videoTelemetry?.championName} // 0x77_LOG
                   </h1>
                   <div className="flex gap-4 mt-2">
                      <span className="text-[10px] bg-[#00ff41] text-black px-2 py-0.5 font-black uppercase">STATUS: AUDITED</span>
                      <span className="text-[10px] opacity-40 uppercase font-bold tracking-widest">Temporal_Drift: CRITICAL_LOW</span>
                   </div>
                </div>

                <div className="h-10 w-px bg-[#00ff41]/10 hidden md:block"></div>

                <div className="hidden lg:flex gap-12">
                   {[
                     { label: 'CS_DELTA', value: `+${videoTelemetry ? videoTelemetry.endCS - videoTelemetry.startCS : 0}`, color: 'text-white' },
                     { label: 'GOLD_HOARDED', value: `${videoTelemetry?.mathMetrics.goldHoarded}g`, color: 'text-yellow-500' },
                     { label: 'VELOCITY', value: `${videoTelemetry?.mathMetrics.velocityHz.toFixed(2)}Hz`, color: 'text-[#00ff41]' },
                     { label: 'FRICTION', value: `${videoTelemetry?.mathMetrics.frictionCoefficient.toFixed(2)}`, color: 'text-red-500' }
                   ].map((kpi, i) => (
                     <div key={i} className="flex flex-col">
                        <span className="text-[9px] font-black opacity-30 uppercase tracking-tighter mb-1">{kpi.label}</span>
                        <span className={`text-2xl font-black ${kpi.color} tabular-nums leading-none tracking-tight`}>{kpi.value}</span>
                     </div>
                   ))}
                </div>
             </div>

             <button 
               onClick={() => setState(p => ({ ...p, view: 'UPLOAD', videoUrl: undefined }))}
               className="px-8 py-3 border border-red-500/50 text-red-500 text-xs font-black uppercase hover:bg-red-500 hover:text-white transition-all tracking-widest"
             >
                PURGE_LOG
             </button>
          </header>

          {/* MAIN CONTENT AREA - GRID */}
          <main className="flex-grow grid grid-cols-12 overflow-hidden">
             
             {/* LEFT COLUMN: JUDGMENT OUTPUT & MATH */}
             <section className="col-span-12 lg:col-span-7 border-r border-[#00ff41]/10 flex flex-col h-full bg-[#050505]">
                <div className="flex border-b border-[#00ff41]/10">
                   {['AUDIT', 'MATH'].map((t) => (
                      <button 
                        key={t}
                        onClick={() => setActiveTab(t as any)}
                        className={`px-12 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-r border-[#00ff41]/10 ${activeTab === t ? 'bg-[#00ff41] text-black' : 'hover:bg-[#00ff41]/5 opacity-40 hover:opacity-100'}`}
                      >
                         {t}_PROTOCOL
                      </button>
                   ))}
                </div>

                <div className="flex-grow overflow-y-auto p-12 custom-scrollbar">
                   {activeTab === 'AUDIT' ? (
                      <div className="max-w-4xl animate-in slide-in-from-left-4 duration-500">
                         <div className="text-[10px] font-black opacity-30 uppercase mb-8 flex items-center gap-4">
                            <span className="w-12 h-px bg-[#00ff41]/30"></span>
                            NEURAL_JUDGMENT_STREAM
                            <span className="w-12 h-px bg-[#00ff41]/30"></span>
                         </div>
                         <div className="text-xl md:text-2xl font-medium leading-[1.6] italic text-white/90 whitespace-pre-wrap selection:bg-white selection:text-black">
                            {audit}
                         </div>
                      </div>
                   ) : (
                      <div className="space-y-16 animate-in slide-in-from-left-4 duration-500">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div className="space-y-6">
                               <h3 className="text-2xl font-black uppercase tracking-tighter">THE_CALCULUS_OF_TEMPO</h3>
                               <p className="text-sm leading-relaxed opacity-60">
                                  Your performance is bound by the <strong>Axiom of Value</strong>. 
                                  Unspent resources represent a total systemic failure of kinetic force.
                               </p>
                               <div className="p-6 bg-[#00ff41]/5 border border-[#00ff41]/20 space-y-4">
                                  <div className="text-[10px] font-black opacity-30 uppercase">Primary_Equation</div>
                                  <div className="text-2xl font-black text-[#00ff41] tracking-tighter">
                                     L = (ΔCS / Δt) * (1 + (G_p / 1000))⁻¹
                                  </div>
                               </div>
                            </div>
                            <div className="space-y-10">
                               <div className="space-y-2">
                                  <div className="flex justify-between text-[10px] font-black">
                                     <span className="opacity-40 uppercase">AXIOMATIC_CONVERSION_RATE</span>
                                     <span className="text-[#00ff41]">{videoTelemetry?.mathMetrics.rgeEstimate.toFixed(1)}%</span>
                                  </div>
                                  <div className="h-4 bg-[#00ff41]/10 w-full relative">
                                     <div className="absolute top-0 left-0 h-full bg-[#00ff41]" style={{width: `${videoTelemetry?.mathMetrics.rgeEstimate}%`}}></div>
                                  </div>
                               </div>
                               <div className="space-y-2">
                                  <div className="flex justify-between text-[10px] font-black">
                                     <span className="opacity-40 uppercase">KINETIC_FRICTION_COEFFICIENT</span>
                                     <span className="text-red-500">{(videoTelemetry?.mathMetrics.frictionCoefficient || 0).toFixed(2)}</span>
                                  </div>
                                  <div className="h-4 bg-red-500/10 w-full relative">
                                     <div className="absolute top-0 left-0 h-full bg-red-500" style={{width: `${(videoTelemetry?.mathMetrics.frictionCoefficient || 0) * 100}%`}}></div>
                                  </div>
                               </div>
                            </div>
                         </div>

                         <div className="pt-12 border-t border-[#00ff41]/10 grid grid-cols-3 gap-8">
                            {[
                               { label: 'POTENTIAL_FORCE_LOST', value: `${(videoTelemetry?.mathMetrics.goldHoarded || 0) * 2} HP/E` },
                               { label: 'CONVERSION_LATENCY', value: '4.2ms/g' },
                               { label: 'EFFICIENCY_QUARTILE', value: 'T3_SUBSTDR' }
                            ].map((m, i) => (
                               <div key={i} className="space-y-1">
                                  <div className="text-[9px] font-black opacity-30 uppercase tracking-widest">{m.label}</div>
                                  <div className="text-xl font-black">{m.value}</div>
                               </div>
                            ))}
                         </div>
                      </div>
                   )}
                </div>
             </section>

             {/* RIGHT COLUMN: EVIDENCE GALLERY */}
             <section className="col-span-12 lg:col-span-5 flex flex-col h-full bg-black/20">
                <div className="px-8 py-4 border-b border-[#00ff41]/10 flex items-center justify-between bg-black/40">
                   <h3 className="text-xs font-black uppercase tracking-[0.4em]">FORENSIC_EVIDENCE_GALLERY</h3>
                   <span className="text-[10px] opacity-20 font-bold">SEGMENTS_DETECTED: {videoTelemetry?.frictionEvents.length || 0}</span>
                </div>

                <div className="flex-grow overflow-y-auto p-8 space-y-8 custom-scrollbar">
                   {videoTelemetry?.frictionEvents.map((ev, idx) => (
                      <div 
                        key={idx} 
                        className="group flex flex-col bg-black border border-[#00ff41]/10 hover:border-[#00ff41] transition-all cursor-pointer overflow-hidden shadow-2xl"
                      >
                         <div className="relative aspect-video overflow-hidden">
                            <img 
                              src={snapshots[idx]} 
                              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                              alt="Forensic Frame" 
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>
                            <div className="absolute top-4 left-4 bg-[#00ff41] text-black text-[10px] font-black px-2 py-0.5 uppercase">
                               IN_GAME: {ev.gameClock}
                            </div>
                            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                               <div className="flex flex-col">
                                  <span className="text-[9px] opacity-40 uppercase font-black">VIOLATION</span>
                                  <span className="text-red-500 font-black uppercase text-sm tracking-widest">{ev.axiomViolation}</span>
                               </div>
                               <button className="text-[9px] font-black uppercase px-2 py-1 border border-[#00ff41]/30 hover:bg-[#00ff41] hover:text-black transition-all">REVIEW_FRAME</button>
                            </div>
                         </div>
                         <div className="p-6 bg-black">
                            <p className="text-base leading-relaxed italic opacity-80 group-hover:opacity-100 transition-opacity">
                               "{ev.description}"
                            </p>
                         </div>
                      </div>
                   ))}

                   {(!videoTelemetry?.frictionEvents || videoTelemetry.frictionEvents.length === 0) && (
                      <div className="h-full flex items-center justify-center opacity-10 text-xl font-black uppercase tracking-[0.5em] italic">
                         NO_FRICTION_DETECTED
                      </div>
                   )}
                </div>

                <footer className="p-6 bg-black/60 border-t border-[#00ff41]/10 text-center">
                   <div className="text-[8px] opacity-20 uppercase tracking-[1em] mb-2 font-bold">
                      AESTHETIC_PRECISION // FORENSIC_AXIOMS
                   </div>
                </footer>
             </section>
          </main>
        </div>
      )}

      {/* GLOBAL FOOTER */}
      <footer className="fixed bottom-0 w-full flex justify-between items-center px-8 py-2 text-[8px] opacity-20 uppercase tracking-[0.5em] pointer-events-none z-50">
        <div>THIRTEENTH_LEGION // ARCHIVE_77</div>
        <div>STABLE_NODE_PROTOCOL_V2.5</div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #050505;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #00ff4133;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #00ff41;
        }
        .glow-text {
          text-shadow: 0 0 20px rgba(0, 255, 65, 0.4);
        }
      `}} />
    </div>
  );
};

export default App;
