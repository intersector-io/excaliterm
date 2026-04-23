import { useState, useCallback } from "react";
import { X, Plus, Tag } from "lucide-react";

const TAG_COLORS = [
  "bg-accent-cyan/15 text-accent-cyan border-accent-cyan/25",
  "bg-accent-green/15 text-accent-green border-accent-green/25",
  "bg-accent-amber/15 text-accent-amber border-accent-amber/25",
  "bg-accent-blue/15 text-accent-blue border-accent-blue/25",
  "bg-accent-red/15 text-accent-red border-accent-red/25",
  "bg-purple-500/15 text-purple-400 border-purple-500/25",
];

function hashTag(tag: string): number {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (tag.codePointAt(i) ?? 0) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function getTagColor(tag: string): string {
  return TAG_COLORS[hashTag(tag) % TAG_COLORS.length] as string;
}

const TAG_BORDER_COLORS = [
  "border-l-accent-cyan",
  "border-l-accent-green",
  "border-l-accent-amber",
  "border-l-accent-blue",
  "border-l-accent-red",
  "border-l-purple-500",
];

export function getTagBorderColor(tag: string): string {
  return TAG_BORDER_COLORS[hashTag(tag) % TAG_BORDER_COLORS.length] as string;
}

interface TagEditorProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  compact?: boolean;
}

export function TagEditor({ tags, onTagsChange, compact }: Readonly<TagEditorProps>) {
  const [isAdding, setIsAdding] = useState(false);
  const [input, setInput] = useState("");

  const addTag = useCallback(() => {
    const tag = input.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      onTagsChange([...tags, tag]);
    }
    setInput("");
    setIsAdding(false);
  }, [input, tags, onTagsChange]);

  const removeTag = useCallback(
    (tag: string) => {
      onTagsChange(tags.filter((t) => t !== tag));
    },
    [tags, onTagsChange],
  );

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-caption font-medium ${getTagColor(tag)}`}
        >
          {tag}
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeTag(tag);
            }}
            className="ml-0.5 rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100"
          >
            <X className="h-2 w-2" />
          </button>
        </span>
      ))}
      {isAdding ? (
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addTag();
            if (e.key === "Escape") {
              setIsAdding(false);
              setInput("");
            }
          }}
          onBlur={addTag}
          placeholder="tag"
          className="h-6 w-16 rounded border border-border/50 bg-transparent px-1.5 text-caption text-foreground outline-none placeholder:text-muted-foreground/40"
        />
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsAdding(true);
          }}
          className="flex h-5 items-center gap-1 rounded-full border border-dashed border-border/50 px-1.5 text-caption text-muted-foreground/40 transition-colors hover:border-accent-cyan/30 hover:text-accent-cyan/70"
          title="Add tag"
        >
          {compact && tags.length === 0 ? (
            <>
              <Tag className="h-2.5 w-2.5" />
              <span className="text-caption">Add tag</span>
            </>
          ) : (
            <Plus className="h-2.5 w-2.5" />
          )}
        </button>
      )}
    </div>
  );
}

interface TagChipsProps {
  tags: string[];
  selectedTag?: string | null;
  onSelectTag?: (tag: string | null) => void;
}

export function TagChips({ tags, selectedTag, onSelectTag }: Readonly<TagChipsProps>) {
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      <button
        onClick={() => onSelectTag?.(null)}
        className={`rounded-full border px-2 py-0.5 text-caption font-medium transition-colors ${
          selectedTag === null
            ? "border-accent-cyan/30 bg-accent-cyan/15 text-accent-cyan"
            : "border-border/40 bg-transparent text-muted-foreground hover:border-border"
        }`}
      >
        All
      </button>
      {tags.map((tag) => (
        <button
          key={tag}
          onClick={() => onSelectTag?.(selectedTag === tag ? null : tag)}
          className={`rounded-full border px-2 py-0.5 text-caption font-medium transition-colors ${
            selectedTag === tag
              ? `${getTagColor(tag)}`
              : "border-border/40 bg-transparent text-muted-foreground hover:border-border"
          }`}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
