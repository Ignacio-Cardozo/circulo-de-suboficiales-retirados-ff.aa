import React, { useRef } from "react";
import { Search, User, X } from "lucide-react";
import { useClickOutside } from "../../hooks/useClickOutside";
import type { Member, Person } from "../../models/members";
import "./PersonSearch.css";

interface PersonSearchProps {
  type: "socio" | "persona";
  searchValue: string;
  onSearchChange: (value: string) => void;
  results: (Member | Person)[];
  selected: Member | Person | null;
  onSelect: (person: Member | Person) => void;
  onClear: () => void;
  showDropdown: boolean;
  onShowDropdown: (show: boolean) => void;
  loading?: boolean;
  error?: string;
  touched?: boolean;
  onBlur?: () => void;
}

const PersonSearch: React.FC<PersonSearchProps> = ({
  type,
  searchValue,
  onSearchChange,
  results,
  selected,
  onSelect,
  onClear,
  showDropdown,
  onShowDropdown,
  loading = false,
  error,
  touched,
  onBlur,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  useClickOutside(wrapperRef, () => onShowDropdown(false), showDropdown);

  const placeholder = type === "socio"
    ? (loading ? "Cargando socios..." : "Buscar socio por nombre o DNI...")
    : (loading ? "Cargando terceros..." : "Buscar tercero por nombre o DNI...");

  const isError = touched && !!error;

  return (
    <div className="member-search-wrapper person-search" ref={wrapperRef}>
      <div className="input-with-icon">
        <input autoComplete="off"
          type="text"
          className={`form-control${isError ? " input-error" : ""}`}
          placeholder={placeholder}
          value={searchValue}
          onChange={(e) => {
            onSearchChange(e.target.value);
            onShowDropdown(true);
          }}
          onFocus={() => onShowDropdown(true)}
          onBlur={() => onBlur?.()}
          disabled={loading}
        />
        <Search size={18} className="input-icon" />
      </div>

      {showDropdown && results.length > 0 && !selected && (
        <div className="member-dropdown custom-scroll">
          {results.map((p) => (
            <button
              type="button"
              key={p.id}
              className="member-dropdown-item"
              onClick={() => {
                onSelect(p);
                onShowDropdown(false);
              }}
            >
              <User size={16} />
              <div className="member-dropdown-info">
                <span className="member-dropdown-name">{p.nombre}</span>
                <span className="member-dropdown-detail">
                  {type === "socio"
                    ? `DNI ${(p as Member).documento} \u00B7 N\u00BA ${(p as Member).numeroDeSocio}`
                    : `${(p as Person).tipoDoc} ${(p as Person).documento}`}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="selected-user-card">
          <div className="user-info">
            <div className="user-avatar-small">
              <User size={20} />
            </div>
            <div className="user-details">
              <span className="user-name">{selected.nombre}</span>
              <span className="user-dni">
                {type === "socio"
                  ? `DNI ${(selected as Member).documento}`
                  : `${(selected as Person).tipoDoc} ${(selected as Person).documento}`}
              </span>
            </div>
          </div>
          <div className="user-status">
            {type === "socio" && (
              <span className="user-number">Nº Socio {(selected as Member).numeroDeSocio}</span>
            )}
            <button type="button" className="clear-member-btn" onClick={onClear}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {isError && (
        <span className="field-error">{error}</span>
      )}
    </div>
  );
};

export default PersonSearch;
