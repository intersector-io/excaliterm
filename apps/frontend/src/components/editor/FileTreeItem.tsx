import { ChevronRight, Folder, FolderOpen, File, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";

const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rb", ".go", ".rs", ".java", ".kt",
  ".cs", ".cpp", ".c", ".h", ".hpp",
  ".css", ".scss", ".less", ".html", ".xml",
  ".json", ".yaml", ".yml", ".toml",
  ".sh", ".bash", ".ps1", ".bat",
  ".sql", ".graphql", ".gql",
  ".md", ".mdx",
]);

function isCodeFile(name: string): boolean {
  const lastDot = name.lastIndexOf(".");
  if (lastDot < 0) return false;
  return CODE_EXTENSIONS.has(name.slice(lastDot).toLowerCase());
}

interface FileTreeItemProps {
  name: string;
  path: string;
  isDirectory: boolean;
  isExpanded: boolean;
  isActive: boolean;
  depth: number;
  onToggle: () => void;
  onClick: () => void;
}

export function FileTreeItem({
  name,
  isDirectory,
  isExpanded,
  isActive,
  depth,
  onToggle,
  onClick,
}: FileTreeItemProps) {
  const handleClick = () => {
    if (isDirectory) {
      onToggle();
    } else {
      onClick();
    }
  };

  const Icon = isDirectory
    ? isExpanded
      ? FolderOpen
      : Folder
    : isCodeFile(name)
      ? FileCode
      : File;

  const iconColor = isDirectory
    ? "text-accent-amber"
    : isCodeFile(name)
      ? "text-accent-blue"
      : "text-muted-foreground";

  return (
    <button
      onClick={handleClick}
      className={cn(
        "group flex w-full items-center gap-1 rounded-sm px-1 py-[3px] text-left text-sm transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-foreground/80 hover:bg-accent/50 hover:text-foreground",
      )}
      style={{ paddingLeft: `${depth * 12 + 4}px` }}
    >
      {/* Chevron for directories */}
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {isDirectory && (
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform duration-150",
              isExpanded && "rotate-90",
            )}
          />
        )}
      </span>

      <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />

      <span className="flex-1 truncate">{name}</span>
    </button>
  );
}
