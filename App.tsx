
import React, { useState, useRef, useEffect } from 'react';
import { extractAxiomaticTelemetry, generateMonarchAudit, synthesizeMonarchVocals, generateTrendAudit } from './geminiService';
import { getRiotIdentity, getTrendData, MatchSummary, RiotAccount } from './riotService';
import { VideoTelemetry, MetricPoint, AxiomState, AxiomViolation, AxiomView } from './types';

const TypewriterLog: React.FC<{ lines: string[] }> = ({ lines }) => (
  <div className="font-mono text-[10px] space-y-1 opacity-60 overflow-hidden">
    {lines.map((line, i) => (
      <div key={i} className="flex gap-4 animate-in slide-in-from-left-2 duration-300">
        <span className="text-[#00ff41]/30">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
        <span className="uppercase tracking-wider">{line}</span>
      </div>
    ))}
  </div>
);

const MetricBlock: React.FC<MetricPoint> = ({ label, value, sub, color, description }) => (
  <div className="p-8 border border-[#00ff41]/10 bg-black/60 rounded-sm hover:border-[#00ff41]/40 transition-all shadow-2xl relative group overflow-hidden">
    <div className="absolute top-0 right-0 w-16 h-16 bg-[#00ff41]/5 rotate-45 translate-x-10 -translate-y-10 group-hover:bg-[#00ff41]/10 transition-all"></div>
    <div className="text-[9px] font-black uppercase tracking-[0.3em] text-[#00ff41]/30 mb-2">{label}</div>
    <div className={`text-4xl font-black tracking-tighter ${color || 'text-[#00ff41]'} glow-text`}>{value}</div>
    <div className="text-[10px] opacity-40 uppercase tracking-[0.1em] mt-3 font-bold">{sub}</div>
    {description && <div className="mt-4 text-[9px] text-white/20 italic font-medium leading-relaxed group-hover:text-white/40 transition-all">"{description}"</div>}
  </div>
);

const App: React.FC = () => {
  const [state, setState] = useState<AxiomState>({
    view: 'INITIALIZE',
    isAnalyzing: false,
    loadingMessage: "",
    terminalLog: ["NODE_413_STANDBY", "PROTOCOL_LUNACY_READY", "AWAITING_FORENSIC_STREAM"]
  });

  const [riotId, setRiotId] = useState({ name: '', tag: '', region: 'NA' });
  const [identity, setIdentity] = useState<RiotAccount | null>(null);
  const [trends, setTrends] = useState<MatchSummary[]>([]);
  const [trendAudit, setTrendAudit] = useState("");
  const [selectedMatch, setSelectedMatch] = useState<MatchSummary | null>(null);

  const [telemetry, setTelemetry] = useState<VideoTelemetry | null>(null);
  const [auditText, setAuditText] = useState<string>("");
  const [frames, setFrames] = useState<{data: string}[]>([]);
  const [isVocalizing, setIsVocalizing] = useState(false);
  const [activeTab, setActiveTab] = useState<'AUDIT' | 'SNAPSHOTS' | 'CALIBRATION'>('AUDIT');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => {
    setState(prev => ({ ...prev, terminalLog: [...prev.terminalLog.slice(-12), msg] }));
  };

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [state.terminalLog]);

  const playVocals = async (base64: string) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    const ctx = audioContextRef.current;
    const decode = (b64: string) => {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    };
    const bytes = decode(base64);
    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  };

  const handleRiotSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setState(prev => ({ ...prev, isAnalyzing: true, loadingMessage: "SYNCING_RIOT_MAINFRAME..." }));
    addLog(`SEARCHING_PUUID: ${riotId.name}#${riotId.tag}`);

    try {
      const id = await getRiotIdentity(riotId.name, riotId.tag, riotId.region);
      setIdentity(id);
      addLog("IDENTITY_SECURED_RETRIEVING_MATCH_HISTORY...");
      
      const matchData = await getTrendData(id.puuid, riotId.region);
      setTrends(matchData);
      addLog("MATCH_HISTORY_SYNCED_GENERATING_TREND_AUDIT...");
      
      const audit = await generateTrendAudit(matchData, id);
      setTrendAudit(audit);
      
      setState(prev => ({ ...prev, view: 'TREND_REPORT', isAnalyzing: false }));
      addLog("TREND_AUDIT_SEQUENCE_COMPLETE");
    } catch (err) {
      addLog("SYSTEM_ERROR: IDENTITY_SYNC_FAILURE");
      setState(prev => ({ ...prev, isAnalyzing: false }));
    }
  };

  const refreshRiotSync = async () => {
    if (!identity) return;
    const currentView = state.view;
    setState(prev => ({ ...prev, isAnalyzing: true, loadingMessage: "REFRESHING_MATCH_STREAMS...", view: 'INGESTION' }));
    addLog(`REFRESHING_HISTORY: ${identity.gameName}#${identity.tagLine}`);

    try {
      const matchData = await getTrendData(identity.puuid, riotId.region);
      setTrends(matchData);
      addLog("HISTORY_RECALIBRATED_REGENERATING_TREND_AUDIT...");
      
      const audit = await generateTrendAudit(matchData, identity);
      setTrendAudit(audit);
      
      setState(prev => ({ ...prev, view: currentView, isAnalyzing: false }));
      addLog("REFRESH_SEQUENCE_COMPLETE_TRENDS_UPDATED");
    } catch (err) {
      addLog("SYSTEM_ERROR: REFRESH_FAILURE");
      setState(prev => ({ ...prev, view: currentView, isAnalyzing: false }));
    }
  };

  const selectMatchForForensics = (match: MatchSummary) => {
    setSelectedMatch(match);
    setState(prev => ({ ...prev, view: 'UPLOAD_PENDING' }));
    addLog(`MATCH_SELECTED: ${match.matchId} (${match.championName})`);
    addLog(`AWAITING_VISUAL_TELEMETRY_UPLOAD...`);
  };

  const handleIngestion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setState(prev => ({ ...prev, view: 'INGESTION', isAnalyzing: true, loadingMessage: "DECONSTRUCTING_REPLAY_STREAM..." }));
    addLog(`VISUAL_SYNC_SOURCE: ${file.name.toUpperCase()}`);

    try {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      await new Promise((resolve) => video.onloadedmetadata = resolve);

      const captured: {data: string, mimeType: string}[] = [];
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const frameCount = 15;
      const interval = video.duration / (frameCount + 1);

      for (let i = 1; i <= frameCount; i++) {
        video.currentTime = i * interval;
        await new Promise(r => video.onseeked = r);
        canvas.width = video.videoWidth; 
        canvas.height = video.videoHeight;
        ctx?.drawImage(video, 0, 0);
        const base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        captured.push({ data: base64Data, mimeType: 'image/jpeg' });
        if (i % 3 === 0) addLog(`DECONSTRUCTING_SLICE_${i}_STABLE`);
      }
      setFrames(captured.map(c => ({ data: c.data })));

      setState(prev => ({ ...prev, loadingMessage: "EXTRACTING_AXIOMATIC_TELEMETRY..." }));
      const tel = await extractAxiomaticTelemetry(captured);
      setTelemetry(tel);

      setState(prev => ({ ...prev, loadingMessage: "GENERATING_MONARCH_FORENSIC_AUDIT..." }));
      const audit = await generateMonarchAudit(tel, selectedMatch);
      setAuditText(audit);

      setState(prev => ({ ...prev, view: 'DEBRIEF', isAnalyzing: false }));
      addLog("AUDIT_SEQUENCE_COMPLETE_SUBJECT_DECONSTRUCTED");
    } catch (err) {
      console.error(err);
      addLog("SYSTEM_ERROR: ANALYTIC_COLLAPSE");
      setState(prev => ({ ...prev, view: 'INITIALIZE', isAnalyzing: false }));
    }
  };

  return (
    <div className="min-h-screen bg-[#010101] text-[#00ff41] p-8 font-['Fira_Code'] selection:bg-[#00ff41] selection:text-black relative overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(to_right,#00ff41_1px,transparent_1px),linear-gradient(to_bottom,#00ff41_1px,transparent_1px)] bg-[size:100px_100px]"></div>

      {(state.view === 'INITIALIZE' || state.view === 'RIOT_SYNC') && (
        <div className="flex flex-col items-center justify-center min-h-[90vh] animate-in fade-in duration-1000">
          <div className="text-center space-y-4 mb-16 relative">
            <h1 className="text-[6rem] md:text-[10rem] font-black italic glow-text leading-none tracking-[-0.05em] uppercase translate-x-[-1rem]">LUNACY</h1>
            <div className="text-xl md:text-3xl font-black uppercase tracking-[1rem] md:tracking-[1.5rem] opacity-30 mt-[-1rem] md:mt-[-1.5rem] ml-12">PROTOCOL</div>
          </div>

          <div className="max-w-2xl w-full space-y-8">
            <div className="p-6 border-2 border-[#00ff41]/10 bg-black/40 backdrop-blur-sm rounded-sm" ref={logContainerRef}>
               <TypewriterLog lines={state.terminalLog} />
            </div>

            {state.view === 'INITIALIZE' ? (
              <button onClick={() => setState(prev => ({...prev, view: 'RIOT_SYNC'}))} className="w-full p-12 border-2 border-[#00ff41]/20 hover:border-[#00ff41] hover:bg-[#00ff41]/5 transition-all group rounded-sm shadow-[0_0_50px_rgba(0,255,65,0.05)] text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-3 h-full bg-[#00ff41] translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
                <div className="text-4xl md:text-5xl font-black mb-4 uppercase tracking-tighter group-hover:scale-105 transition-transform duration-700">INITIATE_SYNC</div>
                <div className="text-[11px] opacity-40 uppercase tracking-[0.8em] font-bold">Synchronize with Riot Identity</div>
              </button>
            ) : (
              <form onSubmit={handleRiotSync} className="p-10 border-2 border-[#00ff41]/20 bg-black/40 space-y-8 animate-in slide-in-from-bottom-5">
                <div className="flex justify-between items-center border-b border-[#00ff41]/20 pb-4">
                  <div className="text-xs font-black uppercase tracking-widest">IDENTITY_HANDSHAKE</div>
                  <button type="button" onClick={() => setState(prev => ({...prev, view: 'INITIALIZE'}))} className="text-[10px] opacity-40 hover:opacity-100 uppercase">ABORT</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[9px] uppercase tracking-widest opacity-40">Game Name</label>
                    <input required value={riotId.name} onChange={e => setRiotId({...riotId, name: e.target.value})} className="w-full bg-black border border-[#00ff41]/20 p-3 text-[#00ff41] focus:border-[#00ff41] outline-none uppercase font-black" placeholder="SUMMONER" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] uppercase tracking-widest opacity-40">Tagline</label>
                    <input required value={riotId.tag} onChange={e => setRiotId({...riotId, tag: e.target.value})} className="w-full bg-black border border-[#00ff41]/20 p-3 text-[#00ff41] focus:border-[#00ff41] outline-none uppercase font-black" placeholder="TAG" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase tracking-widest opacity-40">Cluster</label>
                  <select value={riotId.region} onChange={e => setRiotId({...riotId, region: e.target.value})} className="w-full bg-black border border-[#00ff41]/20 p-3 text-[#00ff41] focus:border-[#00ff41] outline-none uppercase font-black">
                    {['NA', 'EUW', 'EUNE', 'KR', 'JP', 'BR', 'LAN', 'LAS', 'OCE'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <button type="submit" disabled={state.isAnalyzing} className="w-full p-4 border-2 border-[#00ff41] bg-[#00ff41]/10 text-[#00ff41] font-black uppercase hover:bg-[#00ff41] hover:text-black transition-all shadow-2xl">
                  {state.isAnalyzing ? 'SYNCING_WITH_MAINFRAME...' : 'ESTABLISH_SYNC'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {state.view === 'TREND_REPORT' && identity && (
        <div className="max-w-[1400px] mx-auto animate-in slide-in-from-bottom-10 duration-1000 space-y-12 pb-24">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-[#00ff41]/20 pb-8 gap-8">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[1rem] opacity-30 mb-4">Historical_Forensic_Archive</div>
              <h1 className="text-6xl md:text-8xl font-black italic glow-text tracking-tighter uppercase leading-none">{identity.gameName}#{identity.tagLine}</h1>
            </div>
            <div className="flex gap-4">
               <button onClick={refreshRiotSync} className="px-8 py-3 border-2 border-[#00ff41]/40 text-[#00ff41] text-[10px] font-black uppercase hover:bg-[#00ff41] hover:text-black transition-all shadow-lg glow-text">REFRESH_SYNC</button>
               <button onClick={() => setState(prev => ({...prev, view: 'INITIALIZE'}))} className="px-8 py-3 border-2 border-red-900/40 text-red-600 text-[10px] font-black uppercase hover:bg-red-700 hover:text-white transition-all">TERMINATE_SYNC</button>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-8 space-y-12">
              <div className="p-12 border border-[#00ff41]/10 bg-black/60 rounded-sm leading-[2.2] text-white/90 font-medium text-lg whitespace-pre-wrap relative overflow-hidden shadow-inner">
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none text-6xl font-black uppercase">SYSTEMIC_DECAY_AUDIT</div>
                {trendAudit.split(/(\*\*.*?\*\*)/g).map((part, i) => part.startsWith('**') ? <span key={i} className="text-[#00ff41] font-black glow-text bg-[#00ff41]/5 px-1">{part.slice(2, -2)}</span> : <span key={i}>{part}</span>)}
              </div>
            </div>
            
            <div className="lg:col-span-4 space-y-8">
              <div className="p-8 border border-[#00ff41]/10 bg-black/80 shadow-2xl">
                <div className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-8 flex items-center gap-4">
                  <span className="w-8 h-px bg-[#00ff41]/20"></span>
                  MATCH_HISTORY_SELECTION
                </div>
                <div className="space-y-4">
                  {trends.map((m, i) => (
                    <div key={i} className="group relative border border-[#00ff41]/5 bg-black/40 hover:border-[#00ff41]/40 transition-all p-4 cursor-pointer" onClick={() => selectMatchForForensics(m)}>
                      <div className="absolute inset-0 bg-[#00ff41]/0 group-hover:bg-[#00ff41]/5 transition-all"></div>
                      <div className="flex justify-between items-center relative">
                        <div>
                          <div className="text-[9px] font-black opacity-30 uppercase">{m.role} // {Math.floor(m.duration / 60)}M</div>
                          <div className="text-base font-black uppercase tracking-tighter">{m.championName}</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-[10px] font-black ${m.win ? 'text-blue-500' : 'text-red-700'}`}>{m.win ? 'VICTORY' : 'DEFEAT'}</div>
                          <div className="text-[11px] font-black opacity-60">AUDIT_STABLE</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {state.view === 'UPLOAD_PENDING' && selectedMatch && (
        <div className="flex flex-col items-center justify-center min-h-[85vh] animate-in slide-in-from-top-10 duration-1000">
          <div className="max-w-2xl w-full space-y-12">
            <header className="text-center space-y-4">
              <div className="text-[10px] font-black uppercase tracking-[1rem] opacity-30">Awaiting_Forensic_Visuals</div>
              <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter glow-text">{selectedMatch.championName} // {selectedMatch.matchId.split('_')[1]}</h1>
            </header>

            <label className="block p-16 border-2 border-dashed border-[#00ff41]/20 hover:border-[#00ff41] hover:bg-[#00ff41]/5 cursor-pointer transition-all group rounded-sm shadow-2xl text-center relative overflow-hidden">
               <div className="text-4xl md:text-5xl font-black mb-4 uppercase tracking-tighter">UPLOAD_REPLAY_VIDEO</div>
               <div className="text-[11px] opacity-40 uppercase tracking-[0.6em] font-bold">Initiate Visual Telemetry Extraction</div>
               <input type="file" className="hidden" accept="video/*" onChange={handleIngestion} />
            </label>

            <button onClick={() => setState(prev => ({...prev, view: 'TREND_REPORT'}))} className="w-full py-4 border border-[#00ff41]/10 text-[#00ff41]/40 text-[9px] uppercase font-black hover:opacity-100">CANCEL_SELECTION</button>
          </div>
        </div>
      )}

      {state.view === 'INGESTION' && (
        <div className="flex flex-col items-center justify-center min-h-[85vh] space-y-16">
          <div className="w-48 h-48 border-8 border-[#00ff41]/10 border-t-[#00ff41] rounded-full animate-spin"></div>
          <div className="space-y-6 text-center">
            <div className="text-3xl font-black uppercase tracking-[0.5rem] animate-pulse glow-text">{state.loadingMessage}</div>
            <div className="max-w-xl mx-auto p-4 border border-[#00ff41]/10 opacity-30 mt-8">
               <TypewriterLog lines={state.terminalLog} />
            </div>
          </div>
        </div>
      )}

      {state.view === 'DEBRIEF' && telemetry && (
        <div className="max-w-[1600px] mx-auto animate-in slide-in-from-bottom-10 duration-1000 space-y-12 pb-24">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-[#00ff41]/20 pb-8 gap-6">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[1rem] opacity-30 mb-4">Forensic_Reconstruction // {telemetry.role}</div>
              <h1 className="text-6xl md:text-9xl font-black italic glow-text tracking-tighter uppercase leading-none">{telemetry.championName}</h1>
            </div>
            <button onClick={() => setState(prev => ({...prev, view: 'TREND_REPORT'}))} className="px-10 py-3 border-2 border-[#00ff41]/20 text-[#00ff41] text-[10px] font-black uppercase hover:bg-[#00ff41] hover:text-black transition-all">EXIT_AUDIT</button>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <MetricBlock label="CR_OBSERVED" value={`${((telemetry.cr_observed ?? 0) * 100).toFixed(1)}%`} sub="Coefficient of Mediocrity" color={(telemetry.cr_observed ?? 0) < 0.62 ? 'text-red-600' : ''} />
            <MetricBlock label="T_BUILD_EST" value={`${(telemetry.t_build_estimate ?? 0).toFixed(1)}M`} sub="Golden Spike Window" />
            <MetricBlock label="MU_COUNTER" value={`x${(telemetry.mu_counter ?? 1).toFixed(2)}`} sub="Spite Multiplier" />
            <MetricBlock label="LANE_LEAKAGE" value={`${telemetry.lane_leakage ?? 0}G`} sub="Velocity Bleed" color="text-red-800" />
            <MetricBlock label="SPITE_SCORE" value={(telemetry.spite_score ?? 0).toFixed(0)} sub="Aggression Utility" />
          </div>

          <nav className="flex flex-wrap gap-4 border-b border-[#00ff41]/10">
            {['AUDIT', 'SNAPSHOTS', 'CALIBRATION'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-8 py-4 text-xs font-black uppercase tracking-[0.3em] transition-all ${activeTab === tab ? 'bg-[#00ff41] text-black shadow-lg' : 'opacity-40 hover:opacity-100'}`}>{tab}</button>
            ))}
          </nav>

          <main className="min-h-[500px]">
            {activeTab === 'AUDIT' && (
              <div className="p-8 md:p-16 border border-[#00ff41]/10 bg-black/60 rounded-sm leading-[2.2] text-white/90 font-medium text-lg md:text-xl whitespace-pre-wrap relative overflow-hidden">
                <button onClick={async () => { if (!isVocalizing) { setIsVocalizing(true); const v = await synthesizeMonarchVocals(auditText); if (v) await playVocals(v); setIsVocalizing(false); } }} disabled={isVocalizing} className="absolute top-8 right-8 p-4 border border-[#00ff41]/20 text-[9px] hover:bg-[#00ff41]/5">{isVocalizing ? 'VOCALIZING...' : 'PLAY_VOCALS'}</button>
                {auditText.split(/(\*\*.*?\*\*)/g).map((part, i) => part.startsWith('**') ? <span key={i} className="text-[#00ff41] font-black glow-text bg-[#00ff41]/5 px-1">{part.slice(2, -2)}</span> : <span key={i}>{part}</span>)}
              </div>
            )}
            {activeTab === 'SNAPSHOTS' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {(telemetry.frictionEvents ?? []).map((event, i) => (
                  <div key={i} className="p-6 border border-[#00ff41]/10 bg-black/90 group hover:border-[#00ff41]/40 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div className="px-3 py-1 bg-red-900/40 text-red-500 text-[8px] font-black uppercase">{event.axiomViolation}</div>
                      <div className="text-[10px] opacity-20 font-bold">{event.timestampSeconds}s</div>
                    </div>
                    {frames[event.frameIndex] && <img src={`data:image/jpeg;base64,${frames[event.frameIndex].data}`} className="w-full aspect-video object-cover grayscale mb-4 opacity-60 group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-700" />}
                    <p className="text-sm italic text-white/70">"{event.description}"</p>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'CALIBRATION' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {(telemetry.alternativeItems ?? []).map((alt, i) => (
                  <div key={i} className="p-10 border border-[#00ff41]/10 bg-black/80">
                    <div className="flex items-center gap-6 mb-6">
                      <div className="text-red-700/50 line-through text-xl uppercase">{alt.mistakenItem}</div>
                      <div className="text-2xl text-[#00ff41]">→</div>
                      <div className="text-white text-3xl font-black uppercase">{alt.superiorItem}</div>
                    </div>
                    <div className="text-[10px] font-black text-[#00ff41] mb-4">RGE_DELTA: +{alt.rgeIncrease}%</div>
                    <p className="text-sm italic opacity-60">"{alt.reasoning}"</p>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
};

export default App;
