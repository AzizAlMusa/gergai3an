import React, { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useApp } from "../state";
import { socket } from "../socket";
import { Shell } from "../components/Shell";
import { Avatar } from "../components/Avatar";
export function JoinPage() {
  const { state, player, setPlayerLocal } = useApp();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState(player?.nickname || "");
  const [teamId, setTeamId] = useState(player?.teamId || "");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const rosters = useMemo(() => state?.rosters || { A:[], B:[], C:[] }, [state]);
  if (player) return <Navigate to="/team" replace />;
  return <Shell title="TRIVIA NIGHT" kicker="Welcome to"><div className="lobby-grid"><div className="hero-panel"><div className="card playful-card"><div className="eyebrow">Join the lobby</div><label className="label">Nickname</label><input className="fun-input" value={nickname} onChange={e=>setNickname(e.target.value)} placeholder="Captain Chaos" maxLength={24} /><label className="label top-gap">Choose your team once</label><div className="team-choices">{['A','B','C'].map(id=><button key={id} className={`team-choice ${teamId===id?'selected':''}`} style={{background: state?.teams?.[id]?.color || '#fff'}} onClick={()=>setTeamId(id)}><strong>{state?.teams?.[id]?.name || id}</strong><span>{rosters[id].length} joined</span></button>)}</div>{error ? <div className="error-text">{error}</div> : null}<div className="button-row"><button className="fun-btn" disabled={joining} onClick={()=>{ setError(''); if(!nickname.trim()) return setError('Enter a nickname.'); if(!teamId) return setError('Choose a team.'); setJoining(true); socket.emit('player:join',{nickname,teamId},res=>{ setJoining(false); if(!res?.ok) return setError(res?.error || 'Could not join.'); setPlayerLocal(res.player); navigate('/team'); }); }}>{joining ? 'Joining...' : 'Enter Lobby'}</button></div></div></div><div className="wide-lobby">{['A','B','C'].map(id=>{ const count=Math.min(rosters[id].length || 1, 8); const cols=Math.max(2, Math.ceil(count / 2)); const avatarSize=Math.max(56, 86 - Math.max(0, cols - 2) * 6); return <div className="lobby-team-column" key={id}><div className="lobby-avatar-grid" style={{gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`}}>{rosters[id].length===0 ? <div className="empty-lobby">Waiting for players...</div> : null}{rosters[id].slice(0,8).map(p=><div className="lobby-avatar-chip" key={p.id}><Avatar nickname={p.nickname} avatarKey={p.avatarKey} size={avatarSize} /><div className="avatar-name">{p.nickname}</div></div>)}</div></div>;})}</div></div></Shell>;
}
