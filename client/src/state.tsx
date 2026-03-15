import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { socket } from "./socket";
const STORAGE_KEY = "trivia-live-player-v4";
const Ctx = createContext({ state:null, player:null, setPlayerLocal: (_p)=>{} });
export function AppProvider({ children }) {
  const [state, setState] = useState(null);
  const [player, setPlayer] = useState(null);
  useEffect(()=>{ socket.on('state', setState); return ()=>socket.off('state', setState); },[]);
  useEffect(()=>{ const raw=localStorage.getItem(STORAGE_KEY); if(!raw) return; try{ const parsed=JSON.parse(raw); if(parsed?.id){ socket.emit('player:resume',{playerId:parsed.id},res=>{ if(res?.ok) setPlayer(res.player); }); } }catch{} },[]);
  useEffect(()=>{ const onKicked = () => { setPlayer(null); localStorage.removeItem(STORAGE_KEY); }; socket.on('kicked', onKicked); return ()=>socket.off('kicked', onKicked); },[]);
  const setPlayerLocal = (p) => { setPlayer(p); if(!p) localStorage.removeItem(STORAGE_KEY); else localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); };
  const value = useMemo(()=>({state, player, setPlayerLocal}), [state, player]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useApp(){ return useContext(Ctx); }
