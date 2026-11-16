import { Event } from 'nostr-tools'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CrossTabSyncService,
  IBroadcastChannelLike,
  TCrossTabSyncMessage
} from './cross-tab-sync.service'

/**
 * Simulates the browser's BroadcastChannel bus: every channel created here is
 * a peer, and a message posted on one peer is delivered to all *other* peers
 * (a real BroadcastChannel never echoes back to the object that posted it).
 */
class FakeBroadcastChannel implements IBroadcastChannelLike {
  static peers = new Set<FakeBroadcastChannel>()
  private handlers = new Set<(event: { data: unknown }) => void>()

  constructor() {
    FakeBroadcastChannel.peers.add(this)
  }

  postMessage(message: TCrossTabSyncMessage) {
    FakeBroadcastChannel.peers.forEach((peer) => {
      if (peer !== this) peer.deliver(message)
    })
  }

  deliver(data: unknown) {
    this.handlers.forEach((handler) => handler({ data }))
  }

  addEventListener(_type: 'message', listener: (event: { data: unknown }) => void) {
    this.handlers.add(listener)
  }

  removeEventListener(_type: 'message', listener: (event: { data: unknown }) => void) {
    this.handlers.delete(listener)
  }

  close() {
    FakeBroadcastChannel.peers.delete(this)
    this.handlers.clear()
  }
}

const createFakeChannel = () => new FakeBroadcastChannel()

const followListEvent = {
  id: 'follow-list-event-id',
  pubkey: 'account-pubkey',
  kind: 3,
  created_at: 1_700_000_000,
  tags: [['p', 'followed-pubkey']],
  content: '',
  sig: 'signature'
} as Event

describe('CrossTabSyncService', () => {
  beforeEach(() => {
    FakeBroadcastChannel.peers.clear()
  })

  it('delivers an own replaceable event broadcast from one tab to the other tab only', () => {
    const tabA = new CrossTabSyncService(createFakeChannel)
    const tabB = new CrossTabSyncService(createFakeChannel)
    const listenerA = vi.fn()
    const listenerB = vi.fn()
    tabA.subscribe(listenerA)
    tabB.subscribe(listenerB)

    tabA.broadcastOwnReplaceableEvent(followListEvent)

    expect(listenerB).toHaveBeenCalledTimes(1)
    expect(listenerB).toHaveBeenCalledWith({
      type: 'own-replaceable-event',
      event: followListEvent
    })
    // BroadcastChannel never echoes a message back to the tab that sent it.
    expect(listenerA).not.toHaveBeenCalled()
  })

  it('delivers notifications seen-at broadcasts', () => {
    const tabA = new CrossTabSyncService(createFakeChannel)
    const tabB = new CrossTabSyncService(createFakeChannel)
    const listenerB = vi.fn()
    tabB.subscribe(listenerB)

    tabA.broadcastNotificationsSeenAt('account-pubkey', 1_700_000_100)

    expect(listenerB).toHaveBeenCalledWith({
      type: 'notifications-seen-at',
      pubkey: 'account-pubkey',
      seenAt: 1_700_000_100
    })
  })

  it('stops delivering after unsubscribe', () => {
    const tabA = new CrossTabSyncService(createFakeChannel)
    const tabB = new CrossTabSyncService(createFakeChannel)
    const listenerB = vi.fn()
    const unsubscribe = tabB.subscribe(listenerB)

    unsubscribe()
    tabA.broadcastOwnReplaceableEvent(followListEvent)

    expect(listenerB).not.toHaveBeenCalled()
  })

  it('ignores malformed messages from other pages on the same channel', () => {
    const tabA = new CrossTabSyncService(createFakeChannel)
    const listenerA = vi.fn()
    tabA.subscribe(listenerA)
    const rogueChannel = new FakeBroadcastChannel()

    rogueChannel.postMessage('not-a-sync-message' as unknown as TCrossTabSyncMessage)
    rogueChannel.postMessage({
      type: 'own-replaceable-event',
      event: { nope: true }
    } as unknown as TCrossTabSyncMessage)
    rogueChannel.postMessage({
      type: 'notifications-seen-at',
      pubkey: 'account-pubkey',
      seenAt: 'yesterday'
    } as unknown as TCrossTabSyncMessage)

    expect(listenerA).not.toHaveBeenCalled()
  })

  it('is a safe no-op when BroadcastChannel is unavailable', () => {
    const service = new CrossTabSyncService(() => null)
    const listener = vi.fn()

    expect(() => {
      const unsubscribe = service.subscribe(listener)
      service.broadcastOwnReplaceableEvent(followListEvent)
      service.broadcastNotificationsSeenAt('account-pubkey', 1)
      unsubscribe()
    }).not.toThrow()
    expect(listener).not.toHaveBeenCalled()
  })
})
