import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { SortDir } from "../../utils/sort";

const SortIcon = ({ dir }: { dir: SortDir }) => {
  if (dir === "asc") {
    return <ArrowUp size={14} style={{ marginLeft: 4 }} />;
  }
  if (dir === "desc") {
    return <ArrowDown size={14} style={{ marginLeft: 4 }} />;
  }
  return <ArrowUpDown size={14} style={{ marginLeft: 4, opacity: 0.3 }} />;
};

export default SortIcon;
