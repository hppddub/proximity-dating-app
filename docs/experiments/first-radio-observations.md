# First physical radio observations

Reviewed October 30, 2026. Test material is dated October 28, 2026. This is a
de-identified evidence summary, not a completed feasibility study.

## Setup and provenance

- Advertiser: user-reported Samsung Galaxy S26 Ultra running Proximity Lab in
  `peripheral` mode. Exact Android/One UI version and installed build hash were not
  supplied; “most up to date” is not an exact OS version.
- Observer: friend's iPhone, possibly an iPhone 13; model and iOS version remain
  unconfirmed. nRF Connect was used, not our native iOS client.
- Placement: phones together on a table. Exact separation not measured.
- Evidence: four nRF Connect screenshots, the owner's qualitative report, and a
  Samsung diagnostic export containing 19 JSONL records. Raw uploads are outside
  Git; do not commit images/logs containing device identifiers or credentials.
- The owner reports discovery in less than a few seconds and fresh observations.
  There is no synchronized entry-time record, repeated-trial denominator or exact
  lock-state annotation. Samsung locked duration and USB connectivity changes
  have been requested for clarification.

## Findings

| Observation | Evidence and interpretation |
| --- | --- |
| Our service was visible on a real iPhone | All four screenshots display `7B9E1000-29C4-4A91-8C65-66D9384A1000`. This supports Samsung advertisement visibility to a foreground iPhone scanner in this setup. |
| Advertising startup succeeded repeatedly | The export contains three `discovery_started` and three `advertising_started` events, all in the Android foreground-service, LOW_POWER, peripheral variant. No advertising/scan/service failure events are present in this export. |
| More than a cached device name was observed | Screenshots show RSSI time series and packet entries; the owner reports fresh observations. A systematic pause/restart control and exact lock-state timeline were not supplied. |
| Signal varied with nominally close phones | Visual readings are approximately −50 to −73 dBm. This is an approximate range read from screenshots, not statistics calculated from exported packet samples. It does not establish metres or a usable near/far threshold. |
| PC coordinator connectivity failed near the end | Six `refresh_failed`, two `action_failed` and one `pause_pending` record report failure to connect to `localhost/127.0.0.1:8787`. The cause is unknown: disconnected USB/adb forwarding, stopped server or PC sleep are possible explanations, not established facts. |
| No authenticated encounter was demonstrated | No `hello_received`, `exchange_complete` or `proof_accepted` events appear in the supplied log. This is expected for scanner-only nRF Connect use and does not identify a protocol defect. |

The remaining event counts are one `enrolled` and three `discovery_stopped`. Those
counts plus the events above account for all 19 records. The three starts/stops
are separate activity periods; they must not be described as one continuous
locked-phone trial. The current Android export does not record lock transitions.

The scanner's millisecond/second interval readouts are not time from entering the
test area to discovery or to notification. Its “Connectable: Yes” flag is not proof
that a GATT connection or our challenge/response succeeded. The iPhone battery
percentages shown in screenshots do not establish the app's incremental battery use.

## Decision and next experiment

Treat this as an encouraging first advertisement smoke test. It supports moving
toward the full native-client exchange; it does not pass the locked, bilateral
introduction or battery gates in the [brief](../product/cafe-encounter-and-feasibility.md).

Do not spend the next session collecting more unlabelled RSSI screenshots. First
close the lock-state gap with one bounded control if it has not already been run:

1. Keep nRF Connect open on the iPhone and verify fresh observations of our service.
2. Lock the Samsung for five minutes; record whether new observations continue,
   with approximate observation times. Keep the foreground-service variant explicit.
3. Pause Samsung discovery and check that new observations stop, then resume and
   verify that they restart. A cached scanner row alone is insufficient.

This remains a one-direction, iPhone-foreground test. If that control has already
been completed, annotate the evidence and proceed without repeating it.

Next, use the Mac to install our own iOS client and give both native apps access
to the same functioning HTTPS coordinator. Start with Samsung peripheral and
iPhone central, both screens unlocked. Seek `exchange_complete` on the clients
and `proof_accepted` from coordinator submission, then repeated fresh exchanges
spanning the dwell rule and an offer. This establishes the missing authenticated
transport step before repeating it with both phones locked.

Resolve the observed coordinator reachability failure before interpreting an
end-to-end failure as a Bluetooth failure. Record exact phone/OS versions and build
identity for that session. The reverse discovery direction and other device pairs,
negative controls, delivery timing and untethered battery measurements remain open.
