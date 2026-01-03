
const API_KEY = 'RGAPI-002c650a-b84e-4d6c-87c1-754942d8909d';

export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export interface MatchSummary {
  matchId: string;
  championName: string;
  role: string;
  win: boolean;
  cs: number;
  gold: number;
  duration: number; // in seconds
  items: number[];
}

const REGION_MAP: Record<string, string> = {
  'NA': 'americas',
  'EUW': 'europe',
  'EUNE': 'europe',
  'KR': 'asia',
  'JP': 'asia',
  'BR': 'americas',
  'LAN': 'americas',
  'LAS': 'americas',
  'OCE': 'sea',
};

const PLATFORM_MAP: Record<string, string> = {
  'NA': 'na1',
  'EUW': 'euw1',
  'EUNE': 'eun1',
  'KR': 'kr',
  'JP': 'jp1',
  'BR': 'br1',
  'LAN': 'la1',
  'LAS': 'la2',
  'OCE': 'oc1',
};

export const getRiotIdentity = async (gameName: string, tagLine: string, region: string): Promise<RiotAccount> => {
  const cluster = REGION_MAP[region] || 'americas';
  const url = `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}?api_key=${API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("IDENTITY_NOT_FOUND");
  return await response.json();
};

export const getTrendData = async (puuid: string, region: string): Promise<MatchSummary[]> => {
  const cluster = REGION_MAP[region] || 'americas';
  const platform = PLATFORM_MAP[region] || 'na1';
  
  // Get last 10 matches
  const matchIdsUrl = `https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=10&api_key=${API_KEY}`;
  const idsResponse = await fetch(matchIdsUrl);
  const matchIds: string[] = await idsResponse.json();

  const summaries: MatchSummary[] = [];

  for (const id of matchIds) {
    const detailUrl = `https://${cluster}.api.riotgames.com/lol/match/v5/matches/${id}?api_key=${API_KEY}`;
    const detailResponse = await fetch(detailUrl);
    const data = await detailResponse.json();
    
    const participant = data.info.participants.find((p: any) => p.puuid === puuid);
    if (participant) {
      summaries.push({
        matchId: id,
        championName: participant.championName,
        role: participant.teamPosition || participant.individualPosition,
        win: participant.win,
        cs: participant.totalMinionsKilled + participant.neutralMinionsKilled,
        gold: participant.goldEarned,
        duration: data.info.gameDuration,
        items: [participant.item0, participant.item1, participant.item2, participant.item3, participant.item4, participant.item5]
      });
    }
  }

  return summaries;
};
