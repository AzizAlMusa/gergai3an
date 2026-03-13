import React from "react";
export function StepBar({ phase, mode, gameMode }) {
  const biddingSteps = [['round-ready','Start round'],['bidding','Open bidding'],['bids-revealed','Reveal bids'],['question','Reveal question'],['answer','Reveal answer']];
  const turnSteps = [['round-ready','Start round'],['bids-revealed','Pick question'],['question','Reveal question'],['answer','Reveal answer']];
  const activitySteps = [['activity-title','Title'],['activity-instructions','Instructions'],['activity-live','Live'],['activity-round-result','Results'],['activity-final','Final']];
  const steps = mode === 'activity' ? activitySteps : gameMode === 'turn' ? turnSteps : biddingSteps;
  const current = Math.max(steps.findIndex(s=>s[0]===phase),0);
  return <div className="stepbar">{steps.map((s,i)=><div key={s[0]} className={`step ${phase===s[0]?'active':''} ${i<current?'done':''}`}><span>{i+1}</span><strong>{s[1]}</strong></div>)}</div>;
}
