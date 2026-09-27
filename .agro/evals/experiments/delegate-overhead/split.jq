def price($m):
  ($m // "" | ascii_downcase) as $n
  | if ($n | test("opus")) then $prices.opus
    elif ($n | test("sonnet")) then $prices.sonnet
    elif ($n | test("haiku")) then $prices.haiku
    else null end;
def side($events):
  [$events[] | select(.type == "assistant" and (.message.id // null) != null)]
  | group_by(.message.id) | map(last)
  | map(.message as $m | ($m.usage // {}) as $u | price($m.model) as $p | {
      input: ($u.input_tokens // 0),
      output: ($u.output_tokens // 0),
      cache_write: ($u.cache_creation_input_tokens // 0),
      cache_read: ($u.cache_read_input_tokens // 0),
      priced: ($p != null),
      usd: (if $p == null then 0 else
        (($u.input_tokens // 0) * $p.input + ($u.output_tokens // 0) * $p.output
         + ($u.cache_creation_input_tokens // 0) * $p.cache_write
         + ($u.cache_read_input_tokens // 0) * $p.cache_read) / 1000000 end)})
  | {messages: length,
     input_tokens: (map(.input) | add // 0),
     output_tokens: (map(.output) | add // 0),
     cache_creation_input_tokens: (map(.cache_write) | add // 0),
     cache_read_input_tokens: (map(.cache_read) | add // 0),
     unpriced_messages: (map(select(.priced | not)) | length),
     est_usd: (map(.usd) | add // 0)};
. as $all
| side([$all[] | select((.parent_tool_use_id // null) == null)]) as $adv
| side([$all[] | select((.parent_tool_use_id // null) != null)]) as $wrk
| ($adv.est_usd + $wrk.est_usd) as $est
| ([$all[] | select((.parent_tool_use_id // null) != null) | .parent_tool_use_id] | unique | length) as $threads
| {field: "parent_tool_use_id",
   advisor: $adv,
   workers: ($wrk + {threads: $threads}),
   est_total_usd: $est,
   advisor_share: (if $est > 0 then $adv.est_usd / $est else null end)}
