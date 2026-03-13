export type TeamId = "A" | "B" | "C";
export type Team = { id: TeamId; name: string; color: string; score: number; };
export type Player = { id: string; nickname: string; teamId: TeamId; avatarKey?: string | null; };
