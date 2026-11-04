import React, { useRef } from "react";
import { Calendar } from "lucide-react";
import "./DateInput.css";

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  id: string;
  label?: string;
  required?: boolean;
  error?: string;
  touched?: boolean;
  onBlur?: () => void;
}

const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  id,
  label,
  required,
  error,
  touched,
  onBlur,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePicker = () => {
    const el = inputRef.current;
    if (el) {
      el.focus();
      el.showPicker?.();
    }
  };

  return (
    <div className="form-group">
      {label && (
        <label>
          {label} {required && <span className="required">*</span>}
        </label>
      )}
      <div className="input-with-icon date-input-wrap">
        <input autoComplete="off"
          ref={inputRef}
          type="date"
          className={`form-control${touched && error ? " input-error" : ""}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          id={id}
        />
        <button
          type="button"
          className="date-picker-btn"
          onClick={handlePicker}
        >
          <Calendar size={18} />
        </button>
      </div>
      {touched && error && (
        <span className="field-error">{error}</span>
      )}
    </div>
  );
};

export default DateInput;
