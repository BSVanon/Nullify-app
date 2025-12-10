import React, { useEffect, useMemo, useRef, useState } from "react";

import { Ban, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext.jsx";
import SatsUpgradeCard from "./SatsUpgradeCard";

const STATUS_ICON = {
  sent: "single",
  delivered: "double",
  failed: "failed",
  burned: "failed",
};

const TYPING_DOT_DELAYS = ["0s", "0.15s", "0.3s"];
const SATS_HINT_PREFIX = "🎉 I just linked a Bitcoin wallet!";
const SATS_SENT_PREFIX = "[SATS_SENT]";
const SAFETY_CHANGED_PREFIX = "[SAFETY_CHANGED]";
const JOINED_PREFIX = "[JOINED]";

function TypingIndicatorBubble() {
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="max-w-[120px] rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
        <span className="sr-only">Peer is typing</span>
        <div className="flex items-center gap-1">
          {TYPING_DOT_DELAYS.map((delay) => (
            <span
              key={delay}
              className="h-2.5 w-2.5 rounded-full bg-muted-foreground/70 animate-pulse"
              style={{ animationDelay: delay }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function useRelativeTime(timestamp) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!timestamp) return "";

  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 60) return `${diffSeconds}s`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

function MessageBubble({
  message,
  isOwnMessage,
  bubbleTone,
  deliveryStatus,
}) {
  const { textScale = "md" } = useTheme();
  const textSizeClass =
    textScale === "sm" ? "text-xs" : textScale === "lg" ? "text-base" : "text-sm";
  const metaTextSizeClass =
    textScale === "sm" ? "text-[10px]" : textScale === "lg" ? "text-sm" : "text-xs";
  const relativeTime = useRelativeTime(message.timestamp);

  return (
    <div className={`max-w-lg rounded-2xl px-4 py-2 shadow-sm ${bubbleTone} ${textSizeClass}`}>
      <div className="flex flex-col gap-1">
        <div className="break-words">{message.text}</div>
        <div className={`flex items-center justify-end gap-1.5 opacity-70 ${metaTextSizeClass}`}>
          <span>{relativeTime}</span>
          {isOwnMessage && (
            <>
              {deliveryStatus === "double" ? (
                <div className="flex items-center -space-x-1">
                  <Check className="h-3 w-3 stroke-[1.5]" />
                  <Check className="h-3 w-3 stroke-[1.5]" />
                </div>
              ) : deliveryStatus === "failed" ? (
                <Ban className="h-3 w-3 stroke-[1.5]" />
              ) : (
                <Check className="h-3 w-3 stroke-[1.5]" />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ThreadMessageList({
  messages = [],
  participantPubKey,
  showTypingIndicator = false,
  dimmed = false,
  onOpenSatsSupport,
  onSendSats,
  peerName,
  isSendingSats = false,
}) {
  const scrollRef = useRef(null);
  const [dismissedCards, setDismissedCards] = useState(new Set());

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const normalisedMessages = useMemo(
    () =>
      messages.map((message) => ({
        ...message,
        delivery: message.delivery || "sent",
      })),
    [messages],
  );

  return (
    <div
      ref={scrollRef}
      className={`flex-1 overflow-y-auto bg-background px-4 py-2 transition ${dimmed ? "pointer-events-none filter blur-sm" : ""}`}
    >
      <div className="space-y-4">
        {normalisedMessages.map((message) => {
          const isOwnMessage = participantPubKey && message.author === participantPubKey;

          const isSatsSentSystem =
            typeof message.text === "string" &&
            message.text.startsWith(SATS_SENT_PREFIX);

          const isSafetyChangedSystem =
            typeof message.text === "string" &&
            message.text.startsWith(SAFETY_CHANGED_PREFIX);

          const isJoinedSystem =
            typeof message.text === "string" &&
            message.text.startsWith(JOINED_PREFIX);

          if (isSafetyChangedSystem) {
            const label = peerName || 'This contact';
            return (
              <div key={message.id} className="flex justify-center">
                <div className="w-full max-w-lg rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive text-center">
                  {`Security warning: ${label}'s verified safety number changed. Treat this conversation as unverified until you re-verify their safety number.`}
                </div>
              </div>
            );
          }

          if (isJoinedSystem) {
            const label = isOwnMessage ? 'You' : (peerName || 'This contact');
            const text = isOwnMessage
              ? `${label} joined this chat.`
              : `${label} joined this chat.`;

            return (
              <div key={message.id} className="flex justify-center">
                <div className="max-w-xs rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground text-center">
                  {text}
                </div>
              </div>
            );
          }

          if (isSatsSentSystem) {
            const payload = message.text.slice(SATS_SENT_PREFIX.length);
            let amountLabel = null;

            if (payload.startsWith('amount=')) {
              const raw = payload.slice('amount='.length);
              const parsed = Number(raw);
              if (Number.isFinite(parsed) && parsed > 0) {
                amountLabel = `${parsed} sats`;
              }
            }

            const displayText = isOwnMessage
              ? amountLabel
                ? `You sent ${amountLabel} to this contact via your wallet.`
                : 'You sent sats to this contact via your wallet.'
              : amountLabel
                ? `This contact sent you ${amountLabel}. Your wallet accepted the payment automatically.`
                : 'This contact sent you sats via their wallet. Your wallet accepted the payment automatically.';

            return (
              <div key={message.id} className="flex justify-center">
                <div className="max-w-xs rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground text-center">
                  {displayText}
                </div>
              </div>
            );
          }
          const alignment = isOwnMessage
            ? "items-end text-right"
            : "items-start text-left";
          const bubbleTone = isOwnMessage
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground";
          const deliveryStatus = STATUS_ICON[message.delivery] || "single";
          const isSatsHint =
            !isOwnMessage &&
            typeof message.text === "string" &&
            message.text.startsWith(SATS_HINT_PREFIX);

          // Show prominent celebration card for sats hints (unless dismissed)
          if (isSatsHint && onSendSats && !dismissedCards.has(message.id)) {
            return (
              <div key={message.id} className="my-2">
                <SatsUpgradeCard
                  peerName={peerName || 'This contact'}
                  onSendSats={onSendSats}
                  onDismiss={() => {
                    setDismissedCards(prev => new Set([...prev, message.id]))
                  }}
                  isSending={isSendingSats}
                />
              </div>
            );
          }

          return (
            <div
              key={message.id}
              className={`flex flex-col ${alignment} gap-1`}
            >
              <MessageBubble
                message={message}
                isOwnMessage={isOwnMessage}
                bubbleTone={bubbleTone}
                deliveryStatus={deliveryStatus}
              />
              {isSatsHint && onOpenSatsSupport && dismissedCards.has(message.id) && (
                <div className="mt-1 flex justify-start">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={onOpenSatsSupport}
                    className="px-3 py-1.5 text-xs h-auto"
                  >
                    Send sats
                  </Button>
                </div>
              )}
            </div>
          );
        })}
        {showTypingIndicator && <TypingIndicatorBubble />}
      </div>
    </div>
  );
}
