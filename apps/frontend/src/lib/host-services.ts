type HostCandidateService = {
  id: string;
};

export function getHostServiceIds(
  services: HostCandidateService[],
): Set<string> {
  return new Set(services.map((service) => service.id));
}

export function findNewHostServiceId(
  services: HostCandidateService[],
  existingHostServiceIds: Set<string>,
): string | null {
  return (
    services.find((service) => !existingHostServiceIds.has(service.id))?.id ??
    null
  );
}
