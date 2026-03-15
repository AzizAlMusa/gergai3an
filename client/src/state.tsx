import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { socket } from "./socket";
const STORAGE_KEY = "trivia-live-player-v4";
const SESSION_KEY = "trivia-live-session-v1";
const Ctx = createContext({ state:null, player:null, sessionId:"", setPlayerLocal: (_p)=>{}, clearPlayerLocal: ()=>{} });

function createSessionId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function getSessionId() {
  let value = localStorage.getItem(SESSION_KEY);
  if (!value) {
    value = createSessionId();
    localStorage.setItem(SESSION_KEY, value);
  }
  return value;
}

export function AppProvider({ children }) {
  const [state, setState] = useState(null);
  const [player, setPlayer] = useState(null);
  const [sessionId] = useState(() => getSessionId());

  useEffect(()=>{ socket.on('state', setState); return ()=>socket.off('state', setState); },[]);
  useEffect(()=>{
    const handleKicked = () => {
      setPlayer(null);
      localStorage.removeItem(STORAGE_KEY);
      window.location.href = '/join';
    };
    socket.on('player:kicked', handleKicked);
    return ()=>socket.off('player:kicked', handleKicked);
  },[]);
  useEffect(()=>{ const raw=localStorage.getItem(STORAGE_KEY); if(!raw) return; try{ const parsed=JSON.parse(raw); if(parsed?.id){ socket.emit('player:resume',{playerId:parsed.id, sessionId},res=>{ if(res?.ok) setPlayer(res.player); else localStorage.removeItem(STORAGE_KEY); }); } }catch{} },[sessionId]);
  const setPlayerLocal = (p) => { setPlayer(p); if(!p) localStorage.removeItem(STORAGE_KEY); else localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); };
  const clearPlayerLocal = () => { setPlayer(null); localStorage.removeItem(STORAGE_KEY); };
  const value = useMemo(()=>({state, player, sessionId, setPlayerLocal, clearPlayerLocal}), [state, player, sessionId]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useApp(){ return useContext(Ctx); }
