const timeValue = (iso) => {
  if (!iso) return -Infinity;
  const date = new Date(iso);
  const value = date.getTime();
  return Number.isNaN(value) ? -Infinity : value;
};

export const formatActivityTime = (iso) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const sortConversationsByActivity = (list) => {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const aTime = timeValue(a?.lastActivityIso || a?.lastActivity);
    const bTime = timeValue(b?.lastActivityIso || b?.lastActivity);
    if (aTime === bTime) {
      return (b?.title || "").localeCompare(a?.title || "");
    }
    return bTime - aTime;
  });
};
