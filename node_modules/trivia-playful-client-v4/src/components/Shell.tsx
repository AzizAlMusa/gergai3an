import React from "react";
export function Shell({ title, kicker, children }) {
  return <div className="page-wrap"><div className="shape orb-a"/><div className="shape orb-b"/><div className="shape spark one">?</div><div className="shape spark two">!</div><div className="shell-window"><div className="window-bar"><div className="window-dots"><span/><span/><span/></div><div className="window-title">{kicker || "Trivia Live"}</div><div/></div><div className="shell-body"><div className="hero">{kicker ? <div className="hero-kicker">{kicker}</div> : null}<h1>{title}</h1></div>{children}</div></div></div>;
}
