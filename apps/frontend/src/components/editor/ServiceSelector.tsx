import { ChevronDown, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import { useServices } from "@/hooks/use-services";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

function getSelectorLabel(isLoading: boolean, selectedName?: string): string {
  if (isLoading) return "Loading...";
  if (selectedName) return selectedName;
  return "Select a service";
}

interface ServiceSelectorProps {
  selectedServiceId: string | null;
  onSelect: (serviceId: string) => void;
}

export function ServiceSelector({ selectedServiceId, onSelect }: ServiceSelectorProps) {
  const { services, isLoading } = useServices();

  const selected = services.find((s) => s.id === selectedServiceId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-2 rounded-md border border-border bg-surface-sunken px-3 py-2 text-sm transition-colors hover:bg-accent/50",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          )}
        >
          <Server className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-left">
            {getSelectorLabel(isLoading, selected?.name)}
          </span>
          {selected && (
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                selected.status === "online" ? "bg-accent-green" : "bg-accent-red",
              )}
            />
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {services.length === 0 && (
          <div className="px-2 py-3 text-center text-sm text-muted-foreground">
            No services registered
          </div>
        )}
        {services.map((service) => (
          <DropdownMenuItem
            key={service.id}
            onClick={() => onSelect(service.id)}
            className={cn(
              "cursor-pointer",
              service.id === selectedServiceId && "bg-accent",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                service.status === "online" ? "bg-accent-green" : "bg-accent-red",
              )}
            />
            <span className="flex-1 truncate">{service.name}</span>
            <span className="text-xs text-muted-foreground">
              {service.status}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
