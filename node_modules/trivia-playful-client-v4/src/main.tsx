import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider } from "./state";
import "./styles.css";
import { JoinPage } from "./pages/JoinPage";
import { TeamPage } from "./pages/TeamPage";
import { HostPage } from "./pages/HostPage";
import { DisplayPage } from "./pages/DisplayPage";
function App(){ return <AppProvider><BrowserRouter><Routes><Route path="/" element={<Navigate to="/join" replace />} /><Route path="/join" element={<JoinPage/>} /><Route path="/team" element={<TeamPage/>} /><Route path="/host" element={<HostPage/>} /><Route path="/display" element={<DisplayPage/>} /></Routes></BrowserRouter></AppProvider>; }
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);
