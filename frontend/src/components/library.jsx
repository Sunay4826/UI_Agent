import React, { useMemo, useState } from "react";

export function Button({ label, variant = "primary" }) {
  const [clicked, setClicked] = useState(false);

  return (
    <button className={`ui-button ui-button--${variant}`} onClick={() => setClicked((prev) => !prev)}>
      {clicked ? `${label || "Button"} ✓` : label || "Button"}
    </button>
  );
}

export function Card({ title, body, footer }) {
  return (
    <section className="ui-card">
      <h3>{title || "Card"}</h3>
      <p>{body || "Card content"}</p>
      {footer ? <div className="ui-card__footer">{footer}</div> : null}
    </section>
  );
}

export function Input({ label, placeholder, value }) {
  const [localValue, setLocalValue] = useState(value || "");

  return (
    <label className="ui-input">
      <span>{label || "Label"}</span>
      <input
        value={localValue}
        placeholder={placeholder || "Type..."}
        onChange={(e) => setLocalValue(e.target.value)}
      />
    </label>
  );
}

export function Table({ columns = [], rows = [] }) {
  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`${idx}-${row.join("-")}`}>
              {row.map((cell, cellIdx) => (
                <td key={`${idx}-${cellIdx}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Modal({ title, body, open, confirmLabel }) {
  const [isOpen, setIsOpen] = useState(Boolean(open));
  const [confirmed, setConfirmed] = useState(false);

  if (!isOpen) {
    return (
      <div className="ui-modal-collapsed">
        <Button label={`Open ${title || "Modal"}`} variant="secondary" />
        <button className="ui-link-button" onClick={() => setIsOpen(true)}>
          Re-open
        </button>
      </div>
    );
  }

  return (
    <div className="ui-modal">
      <div className="ui-modal__panel">
        <h3>{title || "Modal"}</h3>
        <p>{body || "Modal content"}</p>
        <div className="ui-modal__actions">
          <button
            className="ui-link-button"
            onClick={() => {
              setConfirmed(true);
            }}
          >
            {confirmLabel || "Confirm"}
          </button>
          <button className="ui-link-button" onClick={() => setIsOpen(false)}>
            Close
          </button>
        </div>
        {confirmed ? <small>Saved successfully.</small> : null}
      </div>
    </div>
  );
}

export function Sidebar({ title, items = [] }) {
  const [activeItem, setActiveItem] = useState(items[0] || "");

  return (
    <aside className="ui-sidebar">
      <h4>{title || "Sidebar"}</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>
            <button
              className={item === activeItem ? "ui-item-button active" : "ui-item-button"}
              onClick={() => setActiveItem(item)}
            >
              {item}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function Navbar({ title, links = [] }) {
  const [activeLink, setActiveLink] = useState(links[0] || "");

  return (
    <nav className="ui-navbar">
      <strong>{title || "Navbar"}</strong>
      <div className="ui-navbar__links">
        {links.map((link) => (
          <button
            key={link}
            className={link === activeLink ? "ui-nav-link active" : "ui-nav-link"}
            onClick={() => setActiveLink(link)}
          >
            {link}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function Chart({ title, points = [], labels = [] }) {
  const max = points.length ? Math.max(...points) : 1;
  const [hovered, setHovered] = useState("");

  const bars = useMemo(
    () =>
      points.map((point, idx) => {
        const ratio = point / max;
        let level = "level-1";
        if (ratio >= 0.9) level = "level-10";
        else if (ratio >= 0.8) level = "level-9";
        else if (ratio >= 0.7) level = "level-8";
        else if (ratio >= 0.6) level = "level-7";
        else if (ratio >= 0.5) level = "level-6";
        else if (ratio >= 0.4) level = "level-5";
        else if (ratio >= 0.3) level = "level-4";
        else if (ratio >= 0.2) level = "level-3";
        else if (ratio >= 0.1) level = "level-2";

        return { idx, point, label: labels[idx] || `P${idx + 1}`, level };
      }),
    [labels, max, points]
  );

  return (
    <section className="ui-card ui-chart">
      <h3>{title || "Chart"}</h3>
      <div className="ui-chart__bars">
        {bars.map((bar) => (
          <div
            key={`${bar.label}-${bar.idx}`}
            className="ui-chart__bar-col"
            onMouseEnter={() => setHovered(`${bar.label}: ${bar.point}`)}
            onMouseLeave={() => setHovered("")}
          >
            <div className={`ui-chart__bar ${bar.level}`} />
            <small>{bar.label}</small>
          </div>
        ))}
      </div>
      <small className="ui-chart__meta">{hovered || "Hover bars to inspect values"}</small>
    </section>
  );
}
