/**
 * normalizeNarrative(narrative)
 *
 * Converts a document conforming to narrative.schema.json into the internal
 * view consumed by all storysense primitives.
 *
 * Input: top-level narrative object (title, story, events, participants, …)
 * Output: NarrativeView — all foreign-key references resolved, events ordered
 *         by story.eventIds, and a categorical color palette assigned per participant.
 *
 * Primitives access this via ctx.data. Nothing in the primitives should ever
 * touch the raw narrative — always use the normalized view.
 */

import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const PALETTE = d3.schemeTableau10;

/**
 * @param {object} narrative  Raw narrative document (narrative.schema.json)
 * @returns {NarrativeView}
 */
export function normalizeNarrative(narrative) {
  if (!narrative || typeof narrative !== 'object') {
    throw new Error('storysense: normalizeNarrative() received a non-object argument.');
  }
  if (!narrative.story) {
    throw new Error('storysense: narrative is missing required field "story".');
  }

  const participants = narrative.participants ?? [];
  const locations    = narrative.locations    ?? [];
  const times        = narrative.times        ?? [];
  const rawEvents    = narrative.events       ?? [];

  const participantById = new Map(participants.map(p => [p.id, p]));
  const locationById    = new Map(locations.map(l => [l.id, l]));
  const timeById        = new Map(times.map(t => [t.id, t]));
  const rawEventById    = new Map(rawEvents.map(e => [e.id, e]));

  const colorIndex = new Map(participants.map((p, i) => [p.id, i]));
  const colorOf = id => PALETTE[(colorIndex.get(id) ?? 0) % PALETTE.length];

  const storyEventIds = narrative.story.eventIds ?? rawEvents.map(e => e.id);

  const events = storyEventIds.flatMap(eid => {
    const e = rawEventById.get(eid);
    if (!e) return [];

    const participations = (e.participations ?? [])
      .slice()
      .sort((a, b) => a.entryOrder - b.entryOrder)
      .flatMap(p => {
        const participant = participantById.get(p.participantId);
        return participant ? [{ ...p, participant }] : [];
      });

    const interactions = (e.interactions ?? [])
      .slice()
      .sort((a, b) => a.temporalOrder - b.temporalOrder)
      .flatMap(ix => {
        const fromParticipant = participantById.get(ix.fromParticipantId);
        const toParticipant   = participantById.get(ix.toParticipantId);
        return (fromParticipant && toParticipant)
          ? [{ ...ix, fromParticipant, toParticipant }]
          : [];
      });

    return [{
      id:             e.id,
      title:          e.title          ?? '',
      description:    e.description    ?? null,
      location:       locationById.get(e.locationId) ?? null,
      time:           timeById.get(e.timeId)         ?? null,
      participations,
      interactions,
      participantIds: new Set(participations.map(p => p.participantId)),
    }];
  });

  return {
    title:        narrative.title        ?? '',
    description:  narrative.description  ?? null,
    participants,
    events,
    locations,
    times,
    participantById,
    locationById,
    timeById,
    /** Returns the categorical fill colour for a participant id */
    colorOf,
  };
}
