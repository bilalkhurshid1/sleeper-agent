export interface SleeperUser {
  user_id: string;
  username?: string;
  display_name?: string;
  metadata?: { team_name?: string } | null;
}

export interface SleeperRosterSettings {
  wins?: number;
  losses?: number;
  ties?: number;
  fpts?: number;
  fpts_decimal?: number;
  fpts_against?: number;
  fpts_against_decimal?: number;
  waiver_position?: number;
  waiver_budget_used?: number;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id?: string | null;
  players?: string[] | null;
  starters?: string[] | null;
  taxi?: string[] | null;
  reserve?: string[] | null;
  settings?: SleeperRosterSettings;
}

export interface SleeperLeagueSettings {
  playoff_week_start?: number;
  playoff_teams?: number;
  trade_deadline?: number;
  waiver_type?: number;
  waiver_budget?: number;
  taxi_slots?: number;
  reserve_slots?: number;
  max_keepers?: number;
}

export interface SleeperScoringSettings {
  [key: string]: number | undefined;
}

export interface SleeperLeague {
  league_id: string;
  name?: string;
  season?: string;
  status?: string;
  total_rosters?: number;
  roster_positions?: string[];
  settings?: SleeperLeagueSettings;
  scoring_settings?: SleeperScoringSettings;
}

export interface SleeperMatchup {
  matchup_id: number | null;
  roster_id: number;
  points?: number;
}

export interface SleeperTransactionSettings {
  waiver_bid?: number;
}

export interface SleeperTransaction {
  type: string;
  status?: string;
  adds?: Record<string, number> | null;
  drops?: Record<string, number> | null;
  consenter_ids?: number[] | null;
  settings?: SleeperTransactionSettings | null;
}

export interface SleeperTradedPick {
  season: string;
  round: number;
  roster_id: number;
  owner_id: number;
  previous_owner_id: number;
}

export interface SleeperDraft {
  draft_id: string;
  type?: string;
  status?: string;
  season?: string;
}

export interface SleeperDraftPick {
  round: number;
  pick_no: number;
  picked_by?: string;
  player_id?: string;
}

export interface SleeperPlayer {
  player_id?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  team?: string | null;
}

export type SleeperPlayers = Record<string, SleeperPlayer>;

export interface SleeperTrendingPlayer {
  player_id: string;
  count?: number;
}

export interface SleeperNflState {
  week?: number;
  display_week?: number;
  season_type?: string;
  season?: string;
  league_create_season?: string;
}
