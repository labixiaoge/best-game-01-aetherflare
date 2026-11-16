// A small seeded random generator (mulberry32) so screenshot scenes and the
// title backdrop are the same every run for the same seed, while real games
// seed from the clock. Every world random draw goes through this one object.

/** Create a generator seeded by a 32-bit integer. */
export function createRandom(seed) {
  let value = seed >>> 0;
  return {
    /** A float in [0, 1). */
    next() {
      value = (value + 0x6d2b79f5) >>> 0;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** A float in [min, max). */
    range(min, max) {
      return min + this.next() * (max - min);
    },
    /** An integer in [min, max] inclusive. */
    int(min, max) {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    /** One element of an array, uniformly. */
    pick(list) {
      return list[Math.floor(this.next() * list.length)];
    },
  };
}
