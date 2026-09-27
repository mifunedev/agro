def tail_patterns: [
  "once you answer",
  "\\btell me (to|which)\\b",
  "\\bshould i\\b",
  "\\bdecisions? (for you|needed)\\b",
  "\\byour call\\b",
  "\\ballow me to\\b",
  "\\brun (this|these)( yourself|:| command)",
  "(^|\\n)[^a-z0-9\\n]*([0-9]+\\.\\s*)?confirm\\b|\\b(please|you|to) confirm\\b"
];
(.result // "") | if type == "string" then
  sub("\\s+$"; "") as $t
  | ($t | endswith("?")) or ($t[-1500:] as $tail | any(tail_patterns[]; . as $p | $tail | test($p; "i")))
else false end
