import React from "react";
import "../../styles/app.css";

export function CredentialsBox({ username, password }) {
  return (
    <div className="creds-box">
      <div className="creds-box__mono">
        <div>
          <span className="creds-box__label">Username  </span>
          <strong className="creds-box__value">{username}</strong>
        </div>
        <div>
          <span className="creds-box__label">Password  </span>
          <strong className="creds-box__value">{password}</strong>
        </div>
      </div>
    </div>
  );
}
