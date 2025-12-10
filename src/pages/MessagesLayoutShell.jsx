import React from "react";

import ConversationSidebar from "@/components/messages/ConversationSidebar.jsx";

export default function MessagesLayoutShell({ sidebarProps, children }) {
  return (
    <div className="flex h-full min-h-[640px] flex-1 overflow-hidden bg-background">
      <ConversationSidebar {...sidebarProps} />
      <div className="flex flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
