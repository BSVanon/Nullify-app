import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ISO_TIME = '2025-11-08T12:00:00.000Z';

vi.mock('@/lib/messaging/storage', () => ({
  getThreadMetadata: vi.fn(),
  saveThreadMetadata: vi.fn(),
  updateThreadMetadata: vi.fn(),
  purgeVaultForThread: vi.fn(),
  updateJoinReceipt: vi.fn(),
  saveJoinReceipt: vi.fn(),
}));

vi.mock('@/lib/messaging/threadControlToken', () => ({
  mintThreadControlToken: vi.fn(),
  burnThreadControlToken: vi.fn(),
}));

vi.mock('@/lib/messaging/threadDataToken', () => ({
  mintThreadDataTokens: vi.fn(),
}));

import { mintThreadCT, burnThreadAction } from '@/hooks/messaging/useGuestThreads/threadLifecycle';
import {
  getThreadMetadata,
  saveThreadMetadata,
  updateThreadMetadata,
  updateJoinReceipt,
} from '@/lib/messaging/storage';
import { mintThreadControlToken, burnThreadControlToken } from '@/lib/messaging/threadControlToken';
import { mintThreadDataTokens } from '@/lib/messaging/threadDataToken';

const isoTimestamp = new Date(ISO_TIME).toISOString();
const threadId = 'thread-123';

describe('mintThreadCT integration', () => {
  let overlayPublish;
  let overlayClientRef;
  let setReceiptsByThread;
  let applyConversationUpdate;
  let receiptsState;
  let conversationState;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(ISO_TIME));
    vi.clearAllMocks();

    const initialMetadata = {
      threadId,
      encKeyWrap: 'enc-wrap',
      blobHash: 'blob-hash',
      hintURL: '',
      policy: 'mutual',
      dtIssuances: [],
      rawKeyBase64: 'raw-thread-key',
    };

    getThreadMetadata.mockResolvedValue(initialMetadata);
    saveThreadMetadata.mockImplementation(async (_threadId, metadata) => metadata);
    updateThreadMetadata.mockResolvedValue(undefined);

    mintThreadControlToken.mockResolvedValue({
      txid: 'ct-txid',
      vout: 1,
      broadcast: { txid: 'ct-txid', outputs: [{ vout: 1 }] },
      artifacts: { txHex: '0101' },
    });

    mintThreadDataTokens.mockResolvedValue({
      txid: 'dt-txid',
      outputs: [
        { recipientPubkey: 'holder-key', vout: 0 },
        { recipientPubkey: 'guest-key', vout: 1 },
      ],
      broadcast: { txid: 'dt-txid', outputs: [] },
      artifacts: { txHex: '0202' },
    });

    receiptsState = {
      [threadId]: {
        threadId,
        label: 'Test thread',
        policy: 'mutual',
        holderPublicKey: 'holder-key',
        guestPublicKey: 'guest-key',
        identityKind: 'holder',
      },
    };

    setReceiptsByThread = vi.fn((updater) => {
      receiptsState =
        typeof updater === 'function' ? updater(receiptsState) : updater;
      return receiptsState;
    });

    conversationState = [{ id: threadId }];
    applyConversationUpdate = vi.fn((updater) => {
      conversationState = updater(conversationState);
      return conversationState;
    });

    overlayPublish = vi.fn();
    overlayClientRef = { current: { publishControl: overlayPublish } };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mints CT and DT, updates storage, receipts, and publishes control events', async () => {
    const metadata = await mintThreadCT(
      threadId,
      receiptsState[threadId],
      setReceiptsByThread,
      applyConversationUpdate,
      overlayClientRef,
      { rawThreadKeyBase64: 'raw-thread-key' },
    );

    expect(mintThreadControlToken).toHaveBeenCalledWith({
      threadId,
      encKeyWrap: 'enc-wrap',
      blobHash: 'blob-hash',
      hintURL: '',
      policy: 'mutual',
    });

    expect(mintThreadDataTokens).toHaveBeenCalledWith({
      ctTxid: 'ct-txid',
      ctVout: 1,
      recipientPubkeys: ['holder-key', 'guest-key'],
      threadKeyBase64: 'raw-thread-key',
    });

    expect(saveThreadMetadata).toHaveBeenCalledWith(
      threadId,
      expect.objectContaining({
        ctTxid: 'ct-txid',
        ctVout: 1,
        mintedAt: isoTimestamp,
        dtIssuances: expect.arrayContaining([
          expect.objectContaining({ txid: 'dt-txid' }),
        ]),
        // SECURITY: rawKeyBase64 is intentionally NOT persisted after DT minting
      }),
    );
    
    // Verify rawKeyBase64 is NOT in the saved metadata (security fix)
    const savedMetadata = saveThreadMetadata.mock.calls[0][1];
    expect(savedMetadata.rawKeyBase64).toBeUndefined();

    expect(metadata.mintedAt).toBe(isoTimestamp);
    expect(metadata.dtIssuances).toHaveLength(1);
    expect(metadata.dtIssuances[0]).toEqual(
      expect.objectContaining({
        txid: 'dt-txid',
        outputs: expect.arrayContaining([
          expect.objectContaining({ recipientPubkey: 'holder-key' }),
          expect.objectContaining({ recipientPubkey: 'guest-key' }),
        ]),
        issuedAt: isoTimestamp,
      }),
    );

    const updatedReceipt = receiptsState[threadId];
    expect(updatedReceipt.ctTxid).toBe('ct-txid');
    expect(updatedReceipt.dtIssuances).toHaveLength(1);
    
    // SECURITY: rawThreadKeyBase64 should be in memory for invite generation
    // but NOT persisted to storage
    expect(updatedReceipt.rawThreadKeyBase64).toBe('raw-thread-key');

    const updatedConversation = conversationState.find((item) => item.id === threadId);
    expect(updatedConversation?.dtRecipientCount).toBe(2);
    expect(updatedConversation?.dtRecipients).toEqual(
      expect.arrayContaining(['holder-key', 'guest-key']),
    );

    expect(overlayPublish).toHaveBeenCalledTimes(2);
    const [firstCall, secondCall] = overlayPublish.mock.calls;
    expect(firstCall).toEqual([
      threadId,
      expect.objectContaining({
        action: 'mint-dt',
        issuance: expect.objectContaining({ txid: 'dt-txid' }),
      }),
    ]);
    expect(secondCall).toEqual([
      threadId,
      expect.objectContaining({
        action: 'mint-ct',
        txid: 'ct-txid',
        vout: 1,
      }),
    ]);
  });

  it('throws when raw key unavailable (DT minting is mandatory)', async () => {
    getThreadMetadata.mockResolvedValueOnce({
      threadId,
      encKeyWrap: 'enc-wrap',
      blobHash: 'blob-hash',
      hintURL: '',
      policy: 'mutual',
      dtIssuances: [],
      rawKeyBase64: null,
    });

    mintThreadDataTokens.mockClear();

    // DT minting is now mandatory - should throw when raw key is missing
    await expect(
      mintThreadCT(
        threadId,
        receiptsState[threadId],
        setReceiptsByThread,
        applyConversationUpdate,
        overlayClientRef,
        {},
      )
    ).rejects.toThrow(/Cannot mint DTs|missing rawKeyBase64/i);

    expect(mintThreadDataTokens).not.toHaveBeenCalled();
  });
});

describe('burnThreadAction integration', () => {
  const threadId = 'thread-123';

  let receiptsState;
  let conversationState;
  let setReceiptsByThread;
  let applyConversationUpdate;
  let overlayClientRef;
  let overlayPublish;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(ISO_TIME));
    vi.clearAllMocks();

    receiptsState = {
      [threadId]: {
        threadId,
        label: 'Test thread',
        policy: 'mutual',
        holderPublicKey: 'holder-key',
        guestPublicKey: 'guest-key',
        identityKind: 'holder',
        status: 'ready',
        ctTxid: 'ct-txid',
        ctVout: 1,
      },
    };

    conversationState = [{ id: threadId }];

    setReceiptsByThread = vi.fn((updater) => {
      receiptsState =
        typeof updater === 'function' ? updater(receiptsState) : updater;
      return receiptsState;
    });

    applyConversationUpdate = vi.fn((updater) => {
      conversationState = updater(conversationState);
      return conversationState;
    });

    overlayPublish = vi.fn();
    overlayClientRef = { current: { publishControl: overlayPublish } };

    getThreadMetadata.mockResolvedValue({
      threadId,
      ctTxid: 'ct-txid',
      ctVout: 1,
      ctArtifacts: { txHex: '0101' },
      ctBroadcast: { txid: 'ct-txid', outputs: [{ vout: 1 }] },
    });

    burnThreadControlToken.mockResolvedValue({ burnTxid: 'burn-txid' });

    updateJoinReceipt.mockImplementation(async (_threadId, updates) => ({
      ...receiptsState[_threadId],
      ...updates,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('burns CT, marks receipt as burned, updates metadata and conversations, and publishes burn control event', async () => {
    const updatedReceipt = await burnThreadAction(
      threadId,
      receiptsState[threadId],
      applyConversationUpdate,
      setReceiptsByThread,
      overlayClientRef,
    );

    expect(burnThreadControlToken).toHaveBeenCalledWith({
      ctTxid: 'ct-txid',
      ctVout: 1,
      artifacts: { txHex: '0101' },
      broadcast: { txid: 'ct-txid', outputs: [{ vout: 1 }] },
    });

    expect(updateJoinReceipt).toHaveBeenCalledWith(
      threadId,
      expect.objectContaining({
        status: 'burned',
        burnedBy: 'self',
        burnTxid: 'burn-txid',
      }),
    );

    expect(updateThreadMetadata).toHaveBeenCalledWith(
      threadId,
      expect.objectContaining({
        burnTxid: 'burn-txid',
        burnedBy: 'self',
      }),
    );

    expect(updatedReceipt.status).toBe('burned');
    expect(updatedReceipt.burnTxid).toBe('burn-txid');

    const storedReceipt = receiptsState[threadId];
    expect(storedReceipt.status).toBe('burned');

    const conversation = conversationState.find((c) => c.id === threadId);
    expect(conversation).toBeDefined();
    expect(conversation.status).toBe('burned');
    expect(conversation.burnedBy).toBe('self');

    expect(overlayPublish).toHaveBeenCalledWith(
      threadId,
      expect.objectContaining({
        action: 'burn',
        actor: 'self',
        burnTxid: 'burn-txid',
      }),
    );
  });
});
