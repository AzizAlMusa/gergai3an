import React, { useState } from "react";

export function Avatar({ nickname, avatarKey, size = 72, lobbyMode = false }) {
  const [broken, setBroken] = useState(false);
  const src = avatarKey ? `/avatars/${avatarKey}.png` : "";
  const label = (nickname || "?").slice(0, 1).toUpperCase();

  if (avatarKey && !broken) {
    return (
      <div className={`avatar-plain ${lobbyMode ? "lobby" : ""}`} style={{ width: size, height: size }}>
        <img src={src} alt={nickname} className="avatar-img-plain" onError={() => setBroken(true)} />
      </div>
    );
  }

  return (
    <div className={`avatar-shell ${lobbyMode ? "lobby" : ""}`} style={{ width: size, height: size }}>
      <div className="avatar-fallback">{label}</div>
    </div>
  );
}
