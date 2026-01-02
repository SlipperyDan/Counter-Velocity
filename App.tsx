
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { CHAMPIONS, ITEMS, GOLD_VALUES } from './constants';
import { Role, EnemyThreshold, Item, AxiomState, VideoTelemetry, FrictionEvent, ItemStat, Champion } from './types';
import { getDeepVideoAudit, extractVideoTelemetry, connectLiveAudit } from './geminiService';

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

const RGELineChart: React.FC<{ data: { timestamp: number; value: number }[] }> = ({ data }) => {
  if (!data || data.length < 2) return null;

  const width = 1200;
  const height = 200;
  const padding = 20;
  
  const maxTime = Math.max(...data.map(d => d.timestamp));
  const minTime = Math.min(...data.map(d => d.timestamp));
  const timeRange = maxTime - minTime || 1;

  const points = data.map(d => {
    const x = padding + ((d.timestamp - minTime) / timeRange) * (width - 2 * padding);
    const y = (height - padding) - (d.value * (height - 2 * padding));
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full space-y-4">
      <div className="flex justify-between items-end">
        <div className="text-[10px] font-black uppercase tracking-[0.5em] text-[#00ff41]">Efficiency_Velocity_Mapping</div>
        <div className="text-[10px] opacity-30 uppercase tracking-[0.2em]">Y_AXIS: RELATIVE_GOLD_EFFICIENCY (RGE)</div>
      </div>
      <div className="relative border border-[#00ff41]/10 bg-black/40 p-4 overflow-hidden rounded-sm group">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48 filter drop-shadow-[0_0_8px_rgba(0,255,65,0.4)]">
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(0,255,65,0.1)" strokeWidth="1" />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="rgba(0,255,65,0.1)" strokeWidth="1" />
          <line x1={padding} y1={padding + (height - 2 * padding) * 0.5} x2={width - padding} y2={padding + (height - 2 * padding) * 0.5} stroke="rgba(0,255,65,0.05)" strokeDasharray="5,5" />
          <polyline fill="none" stroke="#00ff41" strokeWidth="3" strokeLinejoin="round" points={points} className="animate-[draw_2s_ease-out]" />
          <path d={`M ${padding},${height - padding} ${points} L ${width - padding},${height - padding} Z`} fill="url(#gradient)" className="opacity-10" />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#00ff41" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute top-4 right-4 flex gap-6">
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#00ff41] rounded-full"></div>
              <span className="text-[9px] font-bold text-[#00ff41] uppercase tracking-widest">Axiom_Sync</span>
           </div>
        </div>
      </div>
    </div>
  );
};

const LiveHUD: React.FC<{ stream: MediaStream | null; transcripts: {text: string, isUser: boolean}[] }> = ({ stream, transcripts }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (videoRef.current && stream) videoRef.current.srcObject = stream; }, [stream]);

  return (
    <div className="relative w-full aspect-video border-2 border-[#00ff41]/20 bg-black rounded-sm overflow-hidden group shadow-[0_0_50px_rgba(0,255,65,0.05)]">
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-60 grayscale-[0.2]" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-8 left-8 space-y-2">
           <div className="text-[10px] font-black uppercase tracking-[0.5em] text-[#00ff41] animate-pulse">NEURAL_INPUT_ACTIVE</div>
           <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-red-500 animate-ping rounded-full"></div>
              <div className="text-xl font-black uppercase tracking-tighter glow-text">LIVE_TELEMETRY</div>
           </div>
        </div>
        <div className="absolute left-8 bottom-8 w-1/3 max-h-[40%] overflow-hidden flex flex-col-reverse gap-2">
          {transcripts.slice(-5).reverse().map((t, i) => (
            <div key={i} className={`p-3 text-[11px] font-medium leading-relaxed rounded-sm border-l-2 transition-all ${t.isUser ? 'bg-white/5 border-white/20 text-white/40' : 'bg-[#00ff41]/5 border-[#00ff41] text-[#00ff41]'}`}>
              <span className="font-black mr-2">[{t.isUser ? 'SUBJ' : 'ARCH'}]</span> {t.text}
            </div>
          ))}
        </div>
      </div>
      <div className="absolute inset-0 bg-[#00ff41]/5 opacity-10 pointer-events-none mix-blend-overlay"></div>
    </div>
  );
};

const App: React.FC = () => {
  const [state, setState] = useState<AxiomState & { videoUrl?: string; liveStream: MediaStream | null }>({
    currentGold: 0, cr: 0, laneVelocity: 0, enemyDefensiveState: EnemyThreshold.SQUISHY,
    selectedChampion: null, isAnalyzing: false, videoUrl: undefined, liveStream: null, view: 'UPLOAD'
  });

  const [audit, setAudit] = useState<string>("");
  const [telemetry, setTelemetry] = useState<VideoTelemetry | null>(null);
  const [transcripts, setTranscripts] = useState<{text: string, isUser: boolean}[]>([]);
  const [activeTab, setActiveTab] = useState<'AUDIT' | 'LIVE' | 'TACTICAL'>('AUDIT');
  const [loadingMsg, setLoadingMsg] = useState<string>("");
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const frameIntervalRef = useRef<number | null>(null);

  const extractFramesFromVideo = async (file: File, frameCount: number = 12): Promise<{data: string, mimeType: string}[]> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.playsInline = true;
      const frames: {data: string, mimeType: string}[] = [];
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      video.onloadedmetadata = async () => {
        const duration = video.duration;
        const interval = duration / (frameCount + 1);
        for (let i = 1; i <= frameCount; i++) {
          video.currentTime = i * interval;
          await new Promise(r => {
            const onSeeked = () => { video.removeEventListener('seeked', onSeeked); r(null); };
            video.addEventListener('seeked', onSeeked);
          });
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx?.drawImage(video, 0, 0);
          frames.push({ data: canvas.toDataURL('image/jpeg', 0.5).split(',')[1], mimeType: 'image/jpeg' });
        }
        URL.revokeObjectURL(video.src);
        resolve(frames);
      };
      video.onerror = (e) => reject(new Error("VIDEO_LOAD_ERROR"));
    });
  };

  const startLiveAudit = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: true });
      setState(prev => ({ ...prev, liveStream: stream, view: 'AUDIT' }));
      setActiveTab('LIVE');
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const sessionPromise = connectLiveAudit({
        onTranscript: (text, isUser) => setTranscripts(prev => [...prev, { text, isUser }]),
        onAudioData: async (base64) => {
          if (!audioContextRef.current) return;
          const ctx = audioContextRef.current;
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const buffer = ctx.createBuffer(1, bytes.length / 2, 24000);
          const dataInt16 = new Int16Array(bytes.buffer);
          const channelData = buffer.getChannelData(0);
          for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
          source.start(nextStartTimeRef.current);
          nextStartTimeRef.current += buffer.duration;
        },
        onInterrupted: () => { nextStartTimeRef.current = 0; },
        onError: (e) => console.error("LIVE_LINK_ERROR", e)
      });
      sessionPromiseRef.current = sessionPromise;
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      const canvas = document.createElement('canvas');
      frameIntervalRef.current = window.setInterval(async () => {
        if (!video.videoWidth) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
        const session = await sessionPromiseRef.current;
        if (session) session.sendRealtimeInput({ media: { data: base64, mimeType: 'image/jpeg' } });
      }, 3000);
    } catch (e) { console.error("LIVE_INIT_FAILED", e); }
  };

  const stopLiveAudit = () => {
    state.liveStream?.getTracks().forEach(t => t.stop());
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    setState(prev => ({ ...prev, liveStream: null, view: 'UPLOAD' }));
    setAudit(""); setTelemetry(null); setTranscripts([]); setLoadingMsg("");
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingMsg("INGESTING_FORENSIC_FRAMES...");
    setState(prev => ({ ...prev, view: 'AUDIT' }));
    setActiveTab('AUDIT');
    try {
      const frames = await extractFramesFromVideo(file);
      setLoadingMsg("EXTRACTING_TELEMETRY...");
      const rawTelemetry = await extractVideoTelemetry(frames);
      setTelemetry(rawTelemetry);
      setLoadingMsg("CONSULTING_AXIOMS...");
      const finalAudit = await getDeepVideoAudit(rawTelemetry);
      setAudit(finalAudit);
      setLoadingMsg("");
    } catch (err) {
      setAudit("PROTOCOL_FAILED: PAYLOAD_LIMIT_EXCEEDED_OR_CORRUPT_FILE");
      setLoadingMsg("");
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative bg-[#010101] selection:bg-[#00ff41] selection:text-black">
      {state.view === 'UPLOAD' ? (
        <div className="min-h-screen flex flex-col items-center justify-center p-10 animate-in fade-in zoom-in-95 duration-700">
          <div className="w-full max-w-6xl space-y-24 text-center py-20">
            <h1 className="text-[12rem] font-black tracking-[-0.2em] glitch-text glow-text uppercase leading-none" data-text="LUNACY">LUNACY</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
               <button onClick={startLiveAudit} className="p-16 border-2 border-[#00ff41]/20 bg-black/50 hover:border-[#00ff41] hover:bg-[#00ff41]/10 transition-all group rounded-sm shadow-xl">
                  <div className="text-4xl font-black mb-4 uppercase tracking-tighter group-hover:text-[#00ff41]">LIVE_AUDIT</div>
                  <div className="text-[10px] opacity-40 uppercase tracking-[0.5em]">Neural Screen Forensic Ingestion</div>
               </button>
               <label className="p-16 border-2 border-[#00ff41]/20 bg-black/50 hover:border-[#00ff41] hover:bg-[#00ff41]/10 transition-all group rounded-sm shadow-xl cursor-pointer">
                  <div className="text-4xl font-black mb-4 uppercase tracking-tighter group-hover:text-[#00ff41]">POST_MORTEM</div>
                  <div className="text-[10px] opacity-40 uppercase tracking-[0.5em]">Analyze Historical Combat Clips</div>
                  <input type="file" className="hidden" accept="video/*" onChange={handleVideoUpload} />
               </label>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col min-h-screen animate-in slide-in-from-bottom-4 duration-500">
          <header className="px-12 py-10 bg-black/95 border-b border-[#00ff41]/10 flex items-center justify-between shadow-2xl shrink-0">
             <h1 className="text-4xl font-black tracking-tighter uppercase glow-text">FORENSIC_PROTOCOL_V2.8</h1>
             <button onClick={stopLiveAudit} className="px-10 py-3 border border-red-500/50 text-red-500 text-xs font-black uppercase tracking-[0.4em] hover:bg-red-500 hover:text-white transition-all rounded-sm">ABORT_PROTOCOL</button>
          </header>
          <nav className="bg-black border-b border-[#00ff41]/10 flex shrink-0">
             {['LIVE', 'AUDIT', 'TACTICAL'].map((t) => (
                <button key={t} onClick={() => setActiveTab(t as any)} className={`px-12 py-6 text-[11px] font-black uppercase tracking-[0.6em] transition-all flex-1 ${activeTab === t ? 'bg-[#00ff41] text-black' : 'opacity-30 hover:opacity-100'}`}>
                  {t}_TERMINAL
                </button>
             ))}
          </nav>
          <main className="p-12 max-w-[1600px] mx-auto w-full flex-grow space-y-12">
             {activeTab === 'LIVE' && <LiveHUD stream={state.liveStream} transcripts={transcripts} />}
             {activeTab === 'AUDIT' && (
                <>
                  {telemetry?.rgeTimeline && <RGELineChart data={telemetry.rgeTimeline} />}
                  <div className="space-y-12 animate-in fade-in duration-500">
                     <div className="flex justify-between items-end border-b border-[#00ff41]/10 pb-4">
                        <h3 className="text-4xl font-black uppercase tracking-tighter italic glow-text">NEURAL_DEBRIEFING</h3>
                        {telemetry && <div className="text-[10px] font-bold uppercase tracking-[0.3em] bg-[#00ff41]/10 px-4 py-2 text-[#00ff41]">Subject: {telemetry.championName} // RGE: {(telemetry.mathMetrics.rgeEstimate * 100).toFixed(1)}%</div>}
                     </div>
                     <div className="p-10 border border-[#00ff41]/10 bg-black/40 min-h-[500px] shadow-inner relative overflow-hidden">
                        {loadingMsg && <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center space-y-8 z-50"><div className="w-16 h-16 border-4 border-t-[#00ff41] border-[#00ff41]/10 animate-spin rounded-full"></div><div className="text-xl font-black tracking-[0.4em] text-[#00ff41] animate-pulse uppercase">{loadingMsg}</div></div>}
                        <FormattedAudit text={audit || "INITIALIZING_AUDIT_STREAM... SYSTEM_STANDBY..."} />
                     </div>
                  </div>
                </>
             )}
             {activeTab === 'TACTICAL' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-right-4 duration-500">
                   {ITEMS.map(item => (
                      <div key={item.id} className="p-8 border border-[#00ff41]/10 bg-black/60 rounded-sm hover:border-[#00ff41]/40 transition-colors group">
                         <div className="text-[10px] opacity-30 uppercase tracking-widest font-black">AXIOM_VALUE_{item.cost}G</div>
                         <div className="text-2xl font-black uppercase text-[#00ff41] mb-4 tracking-tighter glow-text">{item.name}</div>
                         <p className="text-[11px] opacity-60 leading-relaxed italic border-l-2 border-[#00ff41]/10 pl-4">"{item.description}"</p>
                      </div>
                   ))}
                </div>
             )}
          </main>
          <footer className="py-12 border-t border-[#00ff41]/5 text-center opacity-10 text-[10px] font-black uppercase tracking-[2em] shrink-0">THIRTEENTH_LEGION // AESTHETIC_PRECISION // RGE_COMPRESSION_ACTIVE</footer>
        </div>
      )}
    </div>
  );
};

export default App;
