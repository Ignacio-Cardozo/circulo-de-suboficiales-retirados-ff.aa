import React from "react";
import { formatMoneyInput } from "../../utils/format";

interface MoneyInputProps {
    value: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    id?: string;
    disabled?: boolean;
}

const MoneyInput: React.FC<MoneyInputProps> = ({
    value,
    onValueChange,
    placeholder = "0,00",
    className = "ss-input",
    id,
    disabled,
}) => {
    return (
        <div className="money-input">
            <span className="money-input-symbol">$</span>
            <input
                autoComplete="off"
                type="text"
                inputMode="decimal"
                className={className}
                id={id}
                value={value}
                placeholder={placeholder}
                disabled={disabled}
                onChange={(e) => onValueChange(formatMoneyInput(e.target.value))}
            />
        </div>
    );
};

export default MoneyInput;
