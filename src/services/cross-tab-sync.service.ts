import { Event } from 'nostr-tools'

/**
 * Cross-tab synchronization for the current account's own state.
 *
 * When the user has Jumble open in two pages (tabs/windows) with the same
 * account, changes made in one page — following someone, editing the profile,
 * updating a list, marking notifications as seen — are published as nostr
 * events and applied to that page's in-memory state, but the other page keeps
 * its stale state until it is refreshed. This service bridges that gap: the
 * page that applies a change broadcasts it over a BroadcastChannel, and every
 * other page applies the same change to its own state.
 *
 * Only the account's own replaceable events and the notifications seen-at
 * timestamp are synchronized. The receiving page re-validates everything
 * through the same "latest event wins" storage path used for local changes,
 * so stale or out-of-order messages can never roll state backwards.
 */

export type TCrossTabSyncMessage =
  | { type: 'own-replaceable-event'; event: Event }
  | { type: 'notifications-seen-at'; pubkey: string; seenAt: number }

export type TCrossTabSyncListener = (message: TCrossTabSyncMessage) => void

export interface IBroadcastChannelLike {
  postMessage: (message: TCrossTabSyncMessage) => void
  addEventListener: (type: 'message', listener: (event: { data: unknown }) => void) => void
  removeEventListener: (type: 'message', listener: (event: { data: unknown }) => void) => void
  close: () => void
}

export const CROSS_TAB_SYNC_CHANNEL_NAME = 'jumble:cross-tab-sync'

const createDefaultChannel = (): IBroadcastChannelLike | null => {
  if (typeof BroadcastChannel === 'undefined') return null
  try {
    return new BroadcastChannel(CROSS_TAB_SYNC_CHANNEL_NAME)
  } catch {
    return null
  }
}

function isCrossTabSyncMessage(data: unknown): data is TCrossTabSyncMessage {
  if (!data || typeof data !== 'object') return false
  const message = data as { type?: unknown }
  if (message.type === 'own-replaceable-event') {
    const event = (data as { event?: unknown }).event
    return (
      !!event &&
      typeof event === 'object' &&
      typeof (event as Event).id === 'string' &&
      typeof (event as Event).pubkey === 'string' &&
      typeof (event as Event).kind === 'number'
    )
  }
  if (message.type === 'notifications-seen-at') {
    return (
      typeof (data as { pubkey?: unknown }).pubkey === 'string' &&
      typeof (data as { seenAt?: unknown }).seenAt === 'number'
    )
  }
  return false
}

export class CrossTabSyncService {
  private channel: IBroadcastChannelLike | null = null
  private channelResolved = false
  private listeners = new Set<TCrossTabSyncListener>()

  constructor(
    private readonly createChannel: () => IBroadcastChannelLike | null = createDefaultChannel
  ) {}

  private handleChannelMessage = (event: { data: unknown }) => {
    const message = event.data
    if (!isCrossTabSyncMessage(message)) return
    this.listeners.forEach((listener) => {
      listener(message)
    })
  }

  private ensureChannel(): IBroadcastChannelLike | null {
    if (!this.channelResolved) {
      this.channelResolved = true
      this.channel = this.createChannel()
      this.channel?.addEventListener('message', this.handleChannelMessage)
    }
    return this.channel
  }

  broadcast(message: TCrossTabSyncMessage) {
    this.ensureChannel()?.postMessage(message)
  }

  broadcastOwnReplaceableEvent(event: Event) {
    this.broadcast({ type: 'own-replaceable-event', event })
  }

  broadcastNotificationsSeenAt(pubkey: string, seenAt: number) {
    this.broadcast({ type: 'notifications-seen-at', pubkey, seenAt })
  }

  subscribe(listener: TCrossTabSyncListener): () => void {
    this.ensureChannel()
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}

const crossTabSyncService = new CrossTabSyncService()
export default crossTabSyncService
