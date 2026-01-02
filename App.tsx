
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { CHAMPIONS, ITEMS, GOLD_VALUES } from './constants';
import { Role, EnemyThreshold, Item, AxiomState, VideoTelemetry, FrictionEvent, ItemStat, Champion } from './types';
import { getDeepVideoAudit, extractVideoTelemetry, generateSpeech } from './geminiService';

const TypewriterHeader: React.FC<{ text: string; delay?: number; className?: string }> = ({ text, delay = 150, className = "" }) => {
  const [currentText, setCurrentText] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (text && index < text.length) {
      const timeout = setTimeout(() => {
        setCurrentText(prev => prev + text[index]);
        setIndex(prev => prev + 1);
      }, delay);
      return () => clearTimeout(timeout);
    }
  }, [index, delay, text]);

  return (
    <h1 className={className} data-text={currentText}>
      {currentText}
      {text && index < text.length && <span className="animate-pulse">_</span>}
    </h1>
  );
};

const FormattedAudit: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <div className="leading-[2.2] tracking-normal whitespace-pre-wrap text-lg text-white/90 font-medium">
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <span key={i} className="text-[#00ff41] font-black glow-text bg-[#00ff41]/5 px-2 py-1 rounded-sm border border-[#00ff41]/20 mx-1">{part.slice(2, -2)}</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
};

const MetricsDashboard: React.FC<{ telemetry: VideoTelemetry | null }> = ({ telemetry }) => {
  if (!telemetry) return null;
  const { mathMetrics, cr_observed, t_build_estimate, mu_counter } = telemetry;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-16">
      {[
        { label: 'CR_OBSERVED', value: (cr_observed * 100).toFixed(1) + '%', sub: 'Capture Efficiency', color: cr_observed < 0.62 ? 'text-red-600' : 'text-[#00ff41]' },
        { label: 'T_BUILD_EST', value: t_build_estimate.toFixed(1) + 'M', sub: 'Completion Mark' },
        { label: 'MU_COUNTER', value: 'x' + mu_counter.toFixed(2), sub: 'Spite Multiplier' },
        { label: 'LANE_LEAKAGE', value: mathMetrics.laneLeakage + 'G', sub: 'Velocity Loss', color: 'text-red-700' },
        { label: 'SPITE_SCORE', value: mathMetrics.spiteScore.toFixed(0), sub: 'Defiance Level' },
        { label: 'RGE_SYNC', value: (mathMetrics.rgeEstimate * 100).toFixed(1) + '%', sub: 'Effective Value' },
      ].map((m, i) => (
        <div key={i} className="p-8 border border-[#00ff41]/10 bg-black/80 rounded-sm relative overflow-hidden group hover:border-[#00ff41]/40 transition-all shadow-[0_0_30px_rgba(0,0,0,1)]">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#00ff41]/40 mb-3">{m.label}</div>
          <div className={`text-4xl font-black tracking-tighter ${m.color || 'text-[#00ff41]'} glow-text`}>{m.value}</div>
          <div className="text-[9px] opacity-20 uppercase tracking-[0.3em] mt-3 font-bold">{m.sub}</div>
        </div>
      ))}
    </div>
  );
};

const VisualTimeline: React.FC<{ events: FrictionEvent[] | undefined; frames: {data: string}[] }> = ({ events, frames }) => {
  if (!events || events.length === 0) return null;
  return (
    <div className="space-y-12 mb-24">
      <h3 className="text-2xl font-black uppercase tracking-[0.5em] text-[#00ff41] flex items-center gap-6">
        <span className="w-16 h-[1px] bg-[#00ff41]/30"></span>
        FORENSIC_EVIDENCE_LOG
      </h3>
      <div className="flex flex-col gap-10">
        {events.map((event, idx) => {
          const frame = (event.frameIndex !== undefined && frames) ? frames[event.frameIndex] : null;
          return (
            <div key={idx} className="flex flex-col lg:flex-row gap-10 p-10 border border-[#00ff41]/10 bg-black/60 rounded-sm hover:bg-black/80 transition-all group relative">
              <div className="absolute top-0 right-0 p-4 opacity-10 font-black text-[10px] tracking-widest">NODE_ID_{(idx * 1234).toString(16).toUpperCase()}</div>
              <div className="w-full lg:w-96 aspect-video bg-black border border-[#00ff41]/20 overflow-hidden relative shadow-2xl">
                {frame ? (
                  <img src={`data:image/jpeg;base64,${frame.data}`} className="w-full h-full object-cover grayscale brightness-75 group-hover:grayscale-0 group-hover:brightness-110 transition-all duration-1000" alt="Archive Evidence" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center opacity-10 text-[10px] font-bold">MISSING_TELEMETRY_DATA</div>
                )}
                <div className="absolute bottom-3 right-3 bg-[#00ff41] text-black px-3 py-1 text-xs font-black uppercase shadow-lg">{event.timestampSeconds}s</div>
              </div>
              <div className="flex-grow space-y-6">
                <div className="inline-block px-5 py-2 bg-red-600/10 border border-red-600/30 text-red-600 text-xs font-black uppercase tracking-[0.4em] mb-4 shadow-inner">{event.axiomViolation}</div>
                <p className="text-xl font-bold tracking-tight text-white/90 leading-relaxed italic border-l-8 border-[#10b981]/30 pl-8">{event.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AlternativesSection: React.FC<{ items: VideoTelemetry['alternativeItems'] | undefined }> = ({ items }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-24">
      <h3 className="text-2xl font-black uppercase tracking-[0.5em] text-[#00ff41] mb-10 flex items-center gap-6">
        <span className="w-16 h-[1px] bg-[#00ff41]/30"></span>
        AXIOMATIC_CALIBRATION
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {items.map((item, i) => (
          <div key={i} className="p-10 border border-[#10b981]/20 bg-[#10b981]/5 rounded-sm relative group shadow-xl">
            <div className="flex items-center gap-8 mb-8">
              <span className="text-red-600/40 line-through text-lg font-black uppercase tracking-tighter">{item.mistakenItem}</span>
              <span className="text-4xl text-white font-black">→</span>
              <span className="text-[#00ff41] font-black text-3xl tracking-tighter glow-text group-hover:scale-105 transition-transform duration-700">{item.superiorItem}</span>
            </div>
            <div className="text-xs font-black text-[#10b981] mb-4 uppercase tracking-[0.4em] flex items-center gap-3">
              <div className="w-2 h-2 bg-[#10b981] rounded-full animate-ping"></div>
              RGE_RECOVERY: +{item.rgeIncrease}%
            </div>
            <p className="text-base opacity-80 italic leading-relaxed font-medium text-white/70">"{item.reasoning}"</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [state, setState] = useState<AxiomState>({
    currentGold: 0, cr: 0, laneVelocity: 0, enemyDefensiveState: EnemyThreshold.SQUISHY,
    selectedChampion: null, isAnalyzing: false, view: 'UPLOAD'
  });

  const [audit, setAudit] = useState<string>("");
  const [telemetry, setTelemetry] = useState<VideoTelemetry | null>(null);
  const [capturedFrames, setCapturedFrames] = useState<{data: string, mimeType: string}[]>([]);
  const [activeTab, setActiveTab] = useState<'AUDIT' | 'TACTICAL'>('AUDIT');
  const [loadingMsg, setLoadingMsg] = useState<string>("");
  const [isVocalizing, setIsVocalizing] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);

  const decodeBase64 = (base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

  const playRawPCM = async (base64: string) => {
    if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const ctx = audioContextRef.current;
    const bytes = decodeBase64(base64);
    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;
  };

  const handleVocalize = async () => {
    if (!audit || isVocalizing) return;
    setIsVocalizing(true);
    const speechData = await generateSpeech(audit);
    if (speechData) await playRawPCM(speechData);
    setIsVocalizing(false);
  };

  const extractFramesFromVideo = async (file: File, frameCount: number = 20): Promise<{data: string, mimeType: string}[]> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = video.playsInline = true;
      const frames: {data: string, mimeType: string}[] = [];
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      video.onloadedmetadata = async () => {
        const interval = video.duration / (frameCount + 1);
        for (let i = 1; i <= frameCount; i++) {
          video.currentTime = i * interval;
          await new Promise(r => { const os = () => { video.removeEventListener('seeked', os); r(null); }; video.addEventListener('seeked', os); });
          canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          ctx?.drawImage(video, 0, 0);
          frames.push({ data: canvas.toDataURL('image/jpeg', 0.8).split(',')[1], mimeType: 'image/jpeg' });
        }
        URL.revokeObjectURL(video.src); resolve(frames);
      };
      video.onerror = () => reject(new Error("VIDEO_INGESTION_FAILURE"));
    });
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingMsg("INGESTING_FORENSIC_STREAM...");
    setState(prev => ({ ...prev, view: 'AUDIT' })); setActiveTab('AUDIT');
    try {
      const frames = await extractFramesFromVideo(file);
      setCapturedFrames(frames);
      setLoadingMsg("EXTRACTING_AXIOMATIC_TELEMETRY...");
      const raw = await extractVideoTelemetry(frames);
      setTelemetry(raw);
      setLoadingMsg("PROCESSING_POST_MORTEM_FORENSICS...");
      const finalAudit = await getDeepVideoAudit(raw);
      setAudit(finalAudit);
      setLoadingMsg("");
    } catch (err) { setAudit("SYSTEM_ERROR: AUDIT_FAILED_TO_SYNC"); setLoadingMsg(""); }
  };

  const resetSession = () => {
    setState(prev => ({ ...prev, view: 'UPLOAD' }));
    setAudit(""); setTelemetry(null); setLoadingMsg(""); setCapturedFrames([]);
  };

  return (
    <div className="min-h-screen flex flex-col relative bg-[#010101] text-[#00ff41] selection:bg-[#00ff41] selection:text-black">
      {state.view === 'UPLOAD' ? (
        <div className="min-h-screen flex flex-col items-center justify-center p-12 animate-in fade-in duration-1000 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center scale-150">
             <div className="w-[150vw] h-[1px] bg-[#00ff41] -rotate-[30deg] absolute"></div>
             <div className="w-[150vw] h-[1px] bg-[#00ff41] rotate-[30deg] absolute"></div>
          </div>

          <div className="relative mb-32 w-full max-w-7xl flex flex-col items-center">
            <TypewriterHeader 
              text="LUNACY" 
              delay={200}
              className="text-[14rem] font-black uppercase leading-none glow-text text-center italic tracking-[6rem] translate-x-[3rem]"
            />
            <div className="text-[12px] font-black opacity-40 uppercase tracking-[2.5rem] mt-24 text-center w-full translate-x-[1.25rem]">Node_413 // Thirteenth_Legion</div>
          </div>
          
          <div className="max-w-xl w-full">
            <label className="p-24 border-2 border-[#00ff41]/10 hover:border-[#00ff41] hover:bg-[#00ff41]/5 transition-all group cursor-pointer rounded-sm shadow-2xl relative block overflow-hidden text-center">
              <div className="absolute top-0 right-0 w-3 h-full bg-[#00ff41] translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
              <div className="text-6xl font-black mb-8 uppercase tracking-tighter group-hover:scale-105 transition-transform">POST_MORTEM</div>
              <div className="text-[11px] opacity-40 uppercase tracking-[1em] font-bold">Initiate Forensic Analysis</div>
              <input type="file" className="hidden" accept="video/*" onChange={handleVideoUpload} />
            </label>
          </div>
        </div>
      ) : (
        <div className="flex flex-col min-h-screen animate-in slide-in-from-bottom-5 duration-1000">
          <header className="px-16 py-12 bg-black/98 border-b border-[#00ff41]/20 flex items-center justify-between shadow-[0_0_100px_rgba(0,0,0,1)]">
            <div className="flex flex-col gap-2">
               <h1 className="text-6xl font-black tracking-[1.5rem] uppercase glow-text italic">LUNACY</h1>
               <div className="text-[10px] opacity-40 font-black uppercase tracking-[0.7em]">Forensic_Debrief // Node_Status: Ingestion_Complete</div>
            </div>
            <button onClick={resetSession} className="px-16 py-4 border-2 border-red-700/60 text-red-600 text-sm font-black uppercase rounded-sm hover:bg-red-700 hover:text-white transition-all shadow-[0_0_40px_rgba(185,28,28,0.2)]">DISCARD_ARCHIVE</button>
          </header>
          <nav className="bg-black border-b border-[#00ff41]/10 flex">
            {['AUDIT', 'TACTICAL'].map((t) => (
              <button key={t} onClick={() => setActiveTab(t as any)} className={`px-16 py-10 text-[12px] font-black uppercase tracking-[1em] transition-all flex-1 ${activeTab === t ? 'bg-[#00ff41] text-black shadow-inner translate-y-0' : 'opacity-30 hover:opacity-100 hover:bg-white/5'}`}>{t}</button>
            ))}
          </nav>
          <main className="p-20 max-w-[1700px] mx-auto w-full flex-grow space-y-24">
            {activeTab === 'AUDIT' && (
              <div className="animate-in fade-in duration-1000">
                <MetricsDashboard telemetry={telemetry} />
                {telemetry && (
                  <>
                    <VisualTimeline events={telemetry.frictionEvents} frames={capturedFrames} />
                    <AlternativesSection items={telemetry.alternativeItems} />
                  </>
                )}
                
                <div className="space-y-16">
                  <div className="flex justify-between items-center border-b border-[#00ff41]/20 pb-8">
                    <h3 className="text-5xl font-black uppercase tracking-tighter italic glow-text">NEURAL_FORENSIC_STREAM</h3>
                    {audit && (
                      <button onClick={handleVocalize} disabled={isVocalizing} className={`px-16 py-5 border-2 border-[#00ff41] text-xs font-black uppercase transition-all shadow-[0_0_40px_rgba(0,255,65,0.3)] ${isVocalizing ? 'opacity-50' : 'hover:bg-[#00ff41] hover:text-black hover:shadow-[0_0_60px_rgba(0,255,65,0.5)]'}`}>
                        {isVocalizing ? 'SYNTHESIZING_VOCALS...' : 'INITIATE_VOCAL_AUDIT'}
                      </button>
                    )}
                  </div>
                  <div className="p-20 border border-[#00ff41]/10 bg-black/70 min-h-[800px] relative shadow-2xl rounded-sm">
                    {loadingMsg && <div className="absolute inset-0 bg-black/98 flex flex-col items-center justify-center space-y-16 z-50"><div className="w-24 h-24 border-4 border-t-[#00ff41] border-[#00ff41]/10 animate-spin rounded-full"></div><div className="text-3xl font-black text-[#00ff41] animate-pulse uppercase tracking-[0.6em]">{loadingMsg}</div></div>}
                    <div className="max-w-5xl mx-auto">
                      <FormattedAudit text={audit || "AWAITING_INGESTION_FOR_ASTRONOMICAL_AUDIT."} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'TACTICAL' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 animate-in slide-in-from-right-10 duration-1000">
                   {ITEMS.map(item => (
                      <div key={item.id} className="p-12 border border-[#00ff41]/10 bg-black/90 hover:border-[#00ff41]/60 transition-all group rounded-sm shadow-2xl relative overflow-hidden">
                         <div className="absolute top-0 right-0 w-24 h-24 bg-[#00ff41]/5 rotate-45 translate-x-12 -translate-y-12"></div>
                         <div className="text-[11px] opacity-30 uppercase font-black mb-5 tracking-[0.3em] text-[#00ff41]">AXIOM_VAL_INGESTED: {item.cost}G</div>
                         <div className="text-3xl font-black uppercase text-[#00ff41] mb-8 glow-text tracking-tighter group-hover:translate-x-2 transition-transform">{item.name}</div>
                         <p className="text-sm opacity-80 leading-relaxed italic border-l-4 border-[#00ff41]/20 pl-8 font-medium text-white/80">"{item.description}"</p>
                      </div>
                   ))}
                </div>
             )}
          </main>
          <footer className="py-20 border-t border-[#00ff41]/5 text-center opacity-10 text-[11px] font-black uppercase tracking-[3rem] translate-x-[1.5rem]">THIRTEENTH_LEGION // ARCHIVAL_SYNC_STABLE // NO_GAPS_IN_MEMORY</footer>
        </div>
      )}
    </div>
  );
};

export default App;
