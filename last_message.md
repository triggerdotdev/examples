> brainiall-diarized-transcription@0.1.0 test
> tsx --test tests/**/*.test.ts

TAP version 13
# Subtest: sends the fixed BRAINIALL multipart contract without returning the key
ok 1 - sends the fixed BRAINIALL multipart contract without returning the key
  ---
  duration_ms: 8.930875
  type: 'test'
  ...
# Subtest: maps authorization failures without returning the response body
ok 2 - maps authorization failures without returning the response body
  ---
  duration_ms: 0.514667
  type: 'test'
  ...
# Subtest: rejects empty keys before making a request
ok 3 - rejects empty keys before making a request
  ---
  duration_ms: 0.075167
  type: 'test'
  ...
# Subtest: redacts details from network errors
ok 4 - redacts details from network errors
  ---
  duration_ms: 0.214458
  type: 'test'
  ...
# Subtest: parses word timestamps and renders speaker-labelled SRT and VTT
ok 5 - parses word timestamps and renders speaker-labelled SRT and VTT
  ---
  duration_ms: 0.707208
  type: 'test'
  ...
# Subtest: joins punctuation without introducing spaces
ok 6 - joins punctuation without introducing spaces
  ---
  duration_ms: 0.053875
  type: 'test'
  ...
# Subtest: reconstructs text when the API text field is blank
ok 7 - reconstructs text when the API text field is blank
  ---
  duration_ms: 0.062917
  type: 'test'
  ...
# Subtest: splits a cue after a long silence even for the same speaker
ok 8 - splits a cue after a long silence even for the same speaker
  ---
  duration_ms: 0.130958
  type: 'test'
  ...
# Subtest: rejects responses without valid timestamped words
ok 9 - rejects responses without valid timestamped words
  ---
  duration_ms: 0.210834
  type: 'test'
  ...
# Subtest: accepts only exact allowlisted public HTTPS hosts
ok 10 - accepts only exact allowlisted public HTTPS hosts
  ---
  duration_ms: 3.545167
  type: 'test'
  ...
# Subtest: downloads allowed audio without exposing the query in its result
ok 11 - downloads allowed audio without exposing the query in its result
  ---
  duration_ms: 9.536125
  type: 'test'
  ...
# Subtest: redacts source URLs from network errors
ok 12 - redacts source URLs from network errors
  ---
  duration_ms: 0.216417
  type: 'test'
  ...
# Subtest: redacts source URLs from response body read errors
ok 13 - redacts source URLs from response body read errors
  ---
  duration_ms: 0.428917
  type: 'test'
  ...
# Subtest: redacts source URLs from reader cancellation errors
ok 14 - redacts source URLs from reader cancellation errors
  ---
  duration_ms: 0.272125
  type: 'test'
  ...
# Subtest: revalidates every redirect against the hostname allowlist
ok 15 - revalidates every redirect against the hostname allowlist
  ---
  duration_ms: 0.420375
  type: 'test'
  ...
# Subtest: rejects oversized audio before reading a declared body
ok 16 - rejects oversized audio before reading a declared body
  ---
  duration_ms: 0.205709
  type: 'test'
  ...
# Subtest: rejects malformed declared content lengths
ok 17 - rejects malformed declared content lengths
  ---
  duration_ms: 0.447542
  type: 'test'
  ...
# Subtest: enforces the size limit while streaming when content-length is absent
ok 18 - enforces the size limit while streaming when content-length is absent
  ---
  duration_ms: 0.781958
  type: 'test'
  ...
# Subtest: rejects HTML or a generic response without an audio extension
ok 19 - rejects HTML or a generic response without an audio extension
  ---
  duration_ms: 0.740709
  type: 'test'
  ...
# Subtest: requires an explicit rights and consent confirmation before network access
ok 20 - requires an explicit rights and consent confirmation before network access
  ---
  duration_ms: 0.503834
  type: 'test'
  ...
# Subtest: rejects unsupported languages before network access
ok 21 - rejects unsupported languages before network access
  ---
  duration_ms: 0.0655
  type: 'test'
  ...
# Subtest: requires a server-side API key before network access
ok 22 - requires a server-side API key before network access
  ---
  duration_ms: 0.057375
  type: 'test'
  ...
1..22
# tests 22
# suites 0
# pass 22
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 183.320208
