import { Event, kinds } from 'nostr-tools'
import { describe, expect, it } from 'vitest'
import { createHideFollowedFilterFn } from './feed-filter'

const hex = (n: number) => n.toString(16).padStart(64, '0')

function note(id: number, author: number, overrides: Partial<Event> = {}): Event {
  return {
    id: hex(id),
    pubkey: hex(author),
    kind: kinds.ShortTextNote,
    created_at: id,
    content: '',
    tags: [],
    sig: '',
    ...overrides
  }
}

describe('createHideFollowedFilterFn', () => {
  const followed = hex(1)
  const stranger = hex(2)
  const filterFn = createHideFollowedFilterFn(new Set([followed]))

  it('hides notes authored by someone in the following set', () => {
    expect(filterFn(note(10, 1))).toBe(false)
  })

  it('shows notes authored by someone not in the following set', () => {
    expect(filterFn(note(11, 2))).toBe(true)
  })

  it('shows everything when the following set is empty', () => {
    const showAll = createHideFollowedFilterFn(new Set())
    expect(showAll(note(12, 1))).toBe(true)
    expect(showAll(note(13, 2))).toBe(true)
  })

  it('judges a repost by the reposter, not the original author', () => {
    // A followed user reposting a stranger's note is hidden.
    expect(filterFn(note(14, 1, { kind: kinds.Repost }))).toBe(false)
    // A stranger reposting a followed user's note is still shown.
    expect(filterFn(note(15, 2, { kind: kinds.Repost }))).toBe(true)
  })

  it('reflects later mutations of the following set', () => {
    const followingSet = new Set<string>()
    const fn = createHideFollowedFilterFn(followingSet)
    expect(fn(note(16, 1))).toBe(true)
    followingSet.add(followed)
    expect(fn(note(16, 1))).toBe(false)
    expect(stranger).not.toBe(followed)
  })
})
