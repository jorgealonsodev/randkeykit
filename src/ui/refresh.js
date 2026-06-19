export function getRefreshAllToastMessage(total, failures) {
  if (failures === 0) {
    return "All generators refreshed.";
  }

  if (failures === total) {
    return "Refresh failed for every generator.";
  }

  return `Refreshed ${total - failures}/${total} generators.`;
}
