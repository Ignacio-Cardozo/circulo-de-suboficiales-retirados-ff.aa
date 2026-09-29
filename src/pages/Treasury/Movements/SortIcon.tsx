import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import React from "react";
import type { SortDir, SortField } from "./sorting";

const SortIcon: React.FC<{ field: SortField; currentSort: SortField | null; currentDir: SortDir }> = ({ field, currentSort, currentDir }) => {
  if (currentSort !== field || !currentDir) return <ArrowUpDown size={14} style={{ marginLeft: 4, opacity: 0.3 }} />;
  return currentDir === "asc"
    ? <ArrowUp size={14} style={{ marginLeft: 4 }} />
    : <ArrowDown size={14} style={{ marginLeft: 4 }} />;
};

export default SortIcon;
