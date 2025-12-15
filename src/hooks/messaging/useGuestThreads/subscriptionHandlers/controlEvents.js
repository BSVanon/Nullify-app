import { handleLeave } from "./control/leave.js";
import { handleBurn } from "./control/burn.js";
import { handleMintCt } from "./control/mintCt.js";
import { handleMintDt } from "./control/mintDt.js";
import { handleLink } from "./control/link.js";
import { handleBlock } from "./control/block.js";
import { handleUnblock } from "./control/unblock.js";
import { handleProfileUpdate } from "./control/profileUpdate.js";

export async function handleControlEvent({
  event,
  threadId,
  receiptsRef,
  setReceiptsByThread,
  setConversations,
  setMessagesByThread,
  clearTyping,
  updateJoinReceipt,
  deleteJoinReceipt,
  deleteGuestIdentity,
  updateThreadMetadata,
  conversationFromReceipt,
  bumpConversationActivity,
}) {
  const action = event?.payload?.action;
  switch (action) {
    case "leave":
      return handleLeave({
        event,
        threadId,
        receiptsRef,
        setReceiptsByThread,
        setConversations,
        clearTyping,
        updateJoinReceipt,
        conversationFromReceipt,
      });
    case "burn":
      return handleBurn({
        event,
        threadId,
        receiptsRef,
        setReceiptsByThread,
        setConversations,
        setMessagesByThread,
        clearTyping,
        updateJoinReceipt,
        deleteGuestIdentity,
        conversationFromReceipt,
      });
    case "mint-ct":
      return handleMintCt({
        event,
        threadId,
        receiptsRef,
        setReceiptsByThread,
        setConversations,
        updateThreadMetadata,
        conversationFromReceipt,
      });
    case "mint-dt":
      return handleMintDt({
        event,
        threadId,
        receiptsRef,
        setReceiptsByThread,
        setConversations,
        updateThreadMetadata,
        conversationFromReceipt,
      });
    case "link":
      return handleLink({
        event,
        threadId,
        receiptsRef,
        setReceiptsByThread,
        setConversations,
        conversationFromReceipt,
        updateJoinReceipt,
      });
    case "block":
      return handleBlock({
        event,
        threadId,
        receiptsRef,
        setReceiptsByThread,
        setConversations,
        updateJoinReceipt,
        conversationFromReceipt,
      });
    case "unblock":
      return handleUnblock({
        event,
        threadId,
        receiptsRef,
        setReceiptsByThread,
        setConversations,
        updateJoinReceipt,
        conversationFromReceipt,
      });
    case "profile-update":
      return handleProfileUpdate({
        event,
        threadId,
        receiptsRef,
      });
    default:
      return undefined;
  }
}
