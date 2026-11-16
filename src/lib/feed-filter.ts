import { Event } from 'nostr-tools'
import { getEventAuthorPubkey } from './event-core'

/**
 * Creates a filter function (for NoteList's `filterFn` prop) that hides
 * notes whose author is in the given following set.
 *
 * The author is resolved with `getEventAuthorPubkey` — the same helper
 * NoteList uses for its built-in mute filtering — so a repost is judged
 * by the reposter and a zap receipt by its sender, not by the author of
 * the embedded note.
 *
 * Returns `true` to show the note, `false` to hide it.
 */
export function createHideFollowedFilterFn(followingSet: Set<string>) {
  return (event: Event) => !followingSet.has(getEventAuthorPubkey(event))
}
