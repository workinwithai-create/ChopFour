# ChopFour

Four-bar live nylon chop desk for bedroom producers and AI-music finishers.

Suno, Udio, and loop DAWs leave the pocket on roots and full chords.
Session players add nylon chops on the ands so the four bars lock and the track can finish.

Live samples only — FluidR3 acoustic grand, upright bass, nylon guitar, trumpet, violin, and acoustic kit from the PreEight bank pinned to commit `d58301e4a494555f411a2afbc448b724136eee76`.

No oscillators.
Audio never leaves the tab.

## Distinct from yesterday and the rest of the line

| Tool | Job |
| --- | --- |
| TagFour | Four-bar last-line tag |
| ModEight | Last-chorus key change |
| LiftTwo | Two bars of climb into the hook |
| PreEight | Eight bars before the hook |
| AfterHook | Eight bars after the hook |
| EndEight | Last eight bars of the record |
| LastHook | Last chorus is the money chorus |
| **ChopFour** | Four bars of nylon chops that lock a straight pocket |

Yesterday's ships were form desks.
ChopFour is the missing rhythmic guitar on the pocket you already have.

## Form

1–4 pocket · 5–8 chop

## Play

* A · Pocket loop
* B · Pocket + chop
* 8 · Chop only

## Pricing recommendation

One-time **$19** on Gumroad (or Lemon Squeezy).
This is a desk, not a recurring studio.
Do not subscribe.
Forge Pass stays $24 for the cloud tools.

Best place to sell: Gumroad next to the other live-chair desks, with a pinned X demo.

## Stack

Static HTML/CSS/JS.
Deploy on Vercel team `release-forge`.

## Samples

Pinned commit SHA only.
Never `@main` or `@gh-pages`.

## Export

Default bounce is 48 kHz, 24-bit stereo.
At 92 BPM and 8 bars the loop file is exactly 1,001,739 samples (`Math.round(8 * 4 * 60 / 92 * 48000)`), first downbeat at sample 0.
Tail folded for seamless loop.
Peak ≤ −1 dBFS.
Filenames: `chopfour-recipe-<bpm>bpm-<key>.wav` and matching `.mid`.

## License

MIT.
workinwithai-create.

## Acceptance (section 9)

1) Export at 92 BPM, 8 bars, 48 kHz → exactly 1,001,739 samples; first transient at sample 0.
2) Import at bar 1 of a 92 BPM DAW session and loop 4× → no clicks, no drift.
3) Play, switch tab 30 s, return → stopped cleanly, no stacked notes.
4) Change recipe / mutes / BPM while playing → heard within one bar, no restart.
5) Block sample host + reload → UI names missing instruments.
6) Hold the longest pad at the slowest preset tempo. It sustains to the end of the note.
7) Grep the code: no @main or @gh-pages, no Math.random in the export path, and no voice name that doesn't match its sample.

This desk makes sound.
All rules in sections 1–4 followed in the scheduler and state model.
