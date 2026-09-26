#!/usr/bin/env bash
set -euo pipefail

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly EXP_DIR
readonly STE_SKILL=.agro/skills/ste
readonly VERB_DOC=docs/lifecycle-commands.md

export LC_ALL=C

usage() {
  cat >&2 <<'USAGE'
Usage: verify-prd.sh <prd.md> <revision> <case-id>

Score the grounding of one plan against one repository revision and print one
JSON object with the booleans g1_paths, g2_trackable, g3_commands,
g4_structure, pass, and a details object.

Repository path: an inline code span with no whitespace, after the strip of a
leading "./" and a trailing ":<suffix>", whose first segment is a top-level
entry of <revision>. A span with a placeholder or glob character is skipped.
A path resolves through each tracked symlink of <revision>.

Exempt lines: lines under "## Out of Scope", "## Open Questions", and
"## Lessons", and each line that names another repository of the same GitHub
owner (for example mifunedev/agro-web). g1 and g3 skip exempt lines.

Declared new: a repository path that
  - is on a line with the word new, add, create, introduce, or scaffold
    (any inflection), or
  - is on a checklist line ("- [ ]") with the word exists, holds, records,
    or contains, or
  - has a basename that a declaring line (either rule above) names as the
    first word of an inline code span, or
  - is under "## Storage" or in the "## Test Plan (TDD)" section, or
  - is under a declared-new directory that does not exist at <revision>, or
  - is the task folder .agro/tasks/<slug>/ or its prd.md or prd.json.

Declared absent: a repository path on a line that says "does not exist",
"do not exist", "no longer exist", "absent", or "missing".

g1_paths      each repository path on a non-exempt line exists at <revision>,
              is ignored by the .gitignore files of <revision> (a local
              runtime path), is declared new, or is declared absent.
g2_trackable  the .gitignore files of <revision> ignore no declared-new path
              that does not exist at <revision>. The task contract files
              .agro/tasks/<slug>/prd.md and prd.json are exempt. A path on a
              line that says worktree, ignored, gitignored, untracked, or
              "not tracked" is exempt.
g3_commands   on non-exempt lines, in fenced blocks and in inline spans with
              whitespace: each script path (the argument of bash, sh, source,
              or ".", or a token that ends in .sh) that is a repository path
              exists at <revision> or is declared new; each "agro <verb>"
              names a verb that docs/lifecycle-commands.md at <revision>
              names, or a verb on a line that declares it new. Without that
              document the verb check is skipped and details.g3.verb_skip
              records the reason.
g4_structure  ste-check.sh of <revision> exits 0 on the plan, each template
              section heading is present in template order, and "## Lessons"
              is the last level-2 heading.

Exit 0 when the JSON was printed, pass or fail. Exit 2 on bad arguments,
a missing file, or an unknown revision.
USAGE
}

work=""
cleanup() {
  if [ -n "$work" ]; then
    rm -rf "$work"
  fi
}
trap cleanup EXIT

case "${1:-}" in
  -h|--help) usage; exit 0 ;;
esac
if [ "$#" -ne 3 ]; then
  usage
  exit 2
fi

plan="$1"
revision="$2"
case_id="$3"

if [ ! -f "$plan" ]; then
  printf 'verify-prd.sh: not a readable file: %s\n' "$plan" >&2
  exit 2
fi
repo_root="$(git -C "$EXP_DIR" rev-parse --show-toplevel)"
resolved="$(git -C "$repo_root" rev-parse --verify --quiet "$revision^{commit}" || true)"
if [ -z "$resolved" ]; then
  printf 'verify-prd.sh: unknown revision: %s\n' "$revision" >&2
  exit 2
fi
origin_url="$(git -C "$repo_root" remote get-url origin 2>/dev/null || true)"
repo_slug="$(sed -nE 's#^.*github\.com[:/]([^/]+/[^/]+)$#\1#p' <<<"${origin_url%.git}")"

work="$(mktemp -d)"
git -C "$repo_root" ls-tree -r "$resolved" >"$work/ls-tree"
cut -f2- "$work/ls-tree" >"$work/tree"
git -C "$repo_root" ls-tree --name-only "$resolved" >"$work/top"
: >"$work/links"
while IFS=$'\t' read -r meta path; do
  set -- $meta
  if [ "$1" = 120000 ]; then
    printf '%s\t%s\n' "$path" "$(git -C "$repo_root" cat-file -p "$3")" >>"$work/links"
  fi
done <"$work/ls-tree"

mkdir -p "$work/ignore" "$work/ste"
git -C "$work/ignore" init -q .
mapfile -t ignore_files < <(grep -E '(^|/)\.gitignore$' "$work/tree" || true)
if [ "${#ignore_files[@]}" -gt 0 ]; then
  git -C "$repo_root" archive "$resolved" -- "${ignore_files[@]}" | tar -x -C "$work/ignore"
fi

ste_exit=2
ste_output="ste-check.sh is missing at the revision"
if grep -qxF "$STE_SKILL/scripts/ste-check.sh" "$work/tree"; then
  git -C "$repo_root" archive "$resolved" -- "$STE_SKILL" | tar -x -C "$work/ste"
  set +e
  ste_output="$(bash "$work/ste/$STE_SKILL/scripts/ste-check.sh" "$plan" 2>&1)"
  ste_exit=$?
  set -e
fi
printf '%s\n' "$ste_output" >"$work/ste-output"

verb_doc_present=0
if grep -qxF "$VERB_DOC" "$work/tree"; then
  git -C "$repo_root" show "$resolved:$VERB_DOC" >"$work/verbs.md"
  verb_doc_present=1
fi

WORK="$work" PLAN="$plan" CASE_ID="$case_id" REVISION="$resolved" REPO_SLUG="$repo_slug" \
  STE_EXIT="$ste_exit" VERB_DOC_PRESENT="$verb_doc_present" VERB_DOC_PATH="$VERB_DOC" \
  perl -MJSON::PP -MFile::Path=make_path -e '
use strict;
use warnings;

my $work = $ENV{WORK};
my @template = ("User Stories", "Summary", "Key Integration Points",
  "Interface Integration Points", "Storage", "Architectural Decisions",
  "Test Plan (TDD)", "Design Principles", "Out of Scope", "Open Questions",
  "Acceptance Criteria", "Lessons");
my %exempt_section = map { $_ => 1 } ("Out of Scope", "Open Questions", "Lessons");
my %new_section = map { $_ => 1 } ("Storage", "Test Plan (TDD)");
my $new_re = qr/\b(?:new|newly|adds?|added|adding|creates?|created|creating|introduces?|introduced|introducing|scaffolds?|scaffolded|scaffolding)\b/i;
my $check_new_re = qr/\b(?:exists?|holds?|records?|contains?)\b/i;
my $untracked_re = qr/\b(?:worktrees?|gitignored|ignored|untracked|not tracked|does not track)\b/i;
my $absent_re = qr/(?:does not exist|do not exist|no longer exists?|\babsent\b|\bmissing\b)/i;
my $verb_re = qr/(?:^|[^A-Za-z0-9\/._-])agro\s+([a-z][a-z-]*(?:\|[a-z][a-z-]*)*)/;
my ($owner, $repo) = split m{/}, ($ENV{REPO_SLUG} // ""), 2;
my $external_re = defined $repo && $repo ne ""
  ? qr/\b\Q$owner\E\/(?!\Q$repo\E\b)[A-Za-z0-9._-]+/i
  : qr/(?!)/;

sub slurp_lines {
  my ($path) = @_;
  open my $fh, "<", $path or return ();
  my @l = <$fh>;
  close $fh;
  chomp @l;
  return @l;
}

my %file = map { $_ => 1 } slurp_lines("$work/tree");
my %dir;
for my $f (keys %file) {
  my @parts = split m{/}, $f;
  pop @parts;
  my $p = "";
  for my $part (@parts) { $p = $p eq "" ? $part : "$p/$part"; $dir{$p} = 1; }
}
my %top = map { $_ => 1 } slurp_lines("$work/top");
my %link;
for my $l (slurp_lines("$work/links")) {
  my ($path, $target) = split /\t/, $l, 2;
  $link{$path} = $target;
}

sub canonical {
  my ($p) = @_;
  my @out;
  for my $seg (split m{/}, $p) {
    next if $seg eq "" || $seg eq ".";
    if ($seg eq "..") { pop @out; next; }
    push @out, $seg;
  }
  return join "/", @out;
}

sub resolve_links {
  my ($p) = @_;
  for my $hop (1 .. 8) {
    my @segs = split m{/}, $p;
    my $changed = 0;
    for my $i (0 .. $#segs) {
      my $prefix = join "/", @segs[0 .. $i];
      next unless exists $link{$prefix};
      my $parent = $i > 0 ? join("/", @segs[0 .. $i - 1]) : "";
      my $rest = $i < $#segs ? join("/", @segs[$i + 1 .. $#segs]) : "";
      my $target = $link{$prefix};
      my $base = $target =~ m{^/} ? $target : ($parent eq "" ? $target : "$parent/$target");
      $p = canonical($rest eq "" ? $base : "$base/$rest");
      $changed = 1;
      last;
    }
    last unless $changed;
  }
  return $p;
}

sub exists_at_rev {
  my ($p) = @_;
  (my $bare = $p) =~ s{/+$}{};
  return 1 if $file{$bare} || $dir{$bare};
  my $r = resolve_links($bare);
  return $file{$r} || $dir{$r} ? 1 : 0;
}

sub parent_exists {
  my ($p) = @_;
  (my $bare = $p) =~ s{/+$}{};
  $bare =~ s{/[^/]+$}{} or return 1;
  return exists_at_rev($bare);
}

sub normalize {
  my ($t) = @_;
  $t =~ s/^\.\///;
  $t =~ s/:[^\/]*$//;
  $t =~ s{/{2,}}{/}g;
  return "" if $t eq "";
  return "" if $t =~ m{[<>*?{}\[\]\$~|()=,;\x27"\\@#!]};
  return "" if $t =~ m{://} || $t =~ m{^[/-]} || $t =~ m{\.\.\.};
  return "" unless $t =~ m{/};
  my ($first) = split m{/}, $t;
  return "" unless $top{$first};
  return $t;
}

sub task_contract {
  my ($p) = @_;
  return $p =~ m{^\.agro/tasks/(?!archive/)[^/]+/(?:prd\.(?:md|json))?$} ? 1 : 0;
}

my @lines = slurp_lines($ENV{PLAN});
my ($fence, $section) = ("", "");
my (@headings, @span_paths, @cmd_texts, %new_decl, %new_base, %untracked_decl, %absent_decl, %verb_new);
my $exempt_count = 0;
my $lineno = 0;
for my $line (@lines) {
  $lineno++;
  my $exempt = ($exempt_section{$section} || $line =~ $external_re) ? 1 : 0;
  if ($fence ne "") {
    if ($line =~ /^\s*(`{3,}|~{3,})\s*$/ && substr($1, 0, 1) eq substr($fence, 0, 1) && length($1) >= length($fence)) {
      $fence = "";
    } elsif (!$exempt) {
      push @cmd_texts, [$line, $lineno];
    }
    next;
  }
  if ($line =~ /^\s*(`{3,}|~{3,})/) { $fence = $1; next; }
  if ($line =~ /^##\s+(.+?)\s*$/ && $line !~ /^###/) {
    $section = $1;
    push @headings, $section;
    next;
  }
  my $is_new_line = ($line =~ $new_re || ($line =~ /^\s*[-*]\s+\[[ xX]\]/ && $line =~ $check_new_re)) ? 1 : 0;
  my $is_absent_line = $line =~ $absent_re ? 1 : 0;
  if ($is_new_line) {
    while ($line =~ /$verb_re/g) { $verb_new{$_} = 1 for split /\|/, $1; }
  }
  while ($line =~ /(`+)(.+?)\1/g) {
    my $span = $2;
    $span =~ s/^\s+|\s+$//g;
    if ($span =~ /\s/) {
      push @cmd_texts, [$span, $lineno] unless $exempt;
      my ($head) = split /\s+/, $span;
      $new_base{$head} = 1 if $is_new_line && $head !~ m{/};
      next;
    }
    $new_base{$span} = 1 if $is_new_line && $span !~ m{/};
    my $p = normalize($span);
    next if $p eq "";
    $new_decl{$p} = 1 if $is_new_line || $new_section{$section};
    $absent_decl{$p} = 1 if $is_absent_line;
    $untracked_decl{$p} = 1 if $line =~ $untracked_re;
    if ($exempt) { $exempt_count++; next; }
    push @span_paths, [$p, $lineno];
  }
}

my @new_dirs = grep { !exists_at_rev($_) } keys %new_decl;
sub declared_new {
  my ($p) = @_;
  return 1 if $new_decl{$p} || task_contract($p);
  (my $base = $p) =~ s{/+$}{};
  $base =~ s{^.*/}{};
  return 1 if $new_base{$base};
  for my $d (@new_dirs) {
    (my $base = $d) =~ s{/+$}{};
    return 1 if index($p, "$base/") == 0;
  }
  return 0;
}

my %materialized;
sub ignored_paths {
  my (@paths) = @_;
  return {} unless @paths;
  my %query;
  for my $p (@paths) {
    (my $bare = $p) =~ s{/+$}{};
    my $abs = "$work/ignore/$bare";
    if (!$materialized{$bare}++) {
      if ($p =~ m{/$}) {
        make_path($abs) unless -e $abs;
      } else {
        (my $parent = $abs) =~ s{/[^/]+$}{};
        make_path($parent) unless -d $parent;
        if (!-e $abs) { open my $t, ">", $abs or die "touch $abs: $!"; close $t; }
      }
    }
    $query{$bare} = $p;
  }
  open my $in, ">", "$work/ignore-input" or die;
  print $in "$_\n" for sort keys %query;
  close $in;
  my %hit;
  for my $o (`git -C "$work/ignore" check-ignore --no-index -v --stdin < "$work/ignore-input"`) {
    chomp $o;
    my ($src, $path) = split /\t/, $o, 2;
    my (undef, undef, $pattern) = split /:/, $src, 3;
    next if $pattern =~ /^!/;
    $hit{$query{$path} // $path} = $pattern;
  }
  return \%hit;
}

my (%seen1, @g1_new, @g1_absent, @g1_unresolved);
my $g1_checked = 0;
for my $e (@span_paths) {
  my ($p, $ln) = @$e;
  next if $seen1{$p}++;
  $g1_checked++;
  next if exists_at_rev($p);
  if (declared_new($p)) { push @g1_new, $p; next; }
  if ($absent_decl{$p}) { push @g1_absent, $p; next; }
  push @g1_unresolved, [$p, $ln];
}
my $local_hits = ignored_paths(map { $_->[0] } @g1_unresolved);
my (@g1_missing, @g1_local);
for my $u (@g1_unresolved) {
  my ($p, $ln) = @$u;
  if (exists $local_hits->{$p}) { push @g1_local, $p; next; }
  push @g1_missing, { path => $p, line => $ln, parent_exists => parent_exists($p) ? JSON::PP::true : JSON::PP::false };
}

my @to_check = sort grep { !task_contract($_) && !$untracked_decl{$_} } @g1_new;
my $new_hits = ignored_paths(@to_check);
my @g2_ignored = map { { path => $_, pattern => $new_hits->{$_} } } grep { exists $new_hits->{$_} } @to_check;

my (%seen3, @g3_missing, @g3_skipped);
my $g3_scripts = 0;
my (%verbs_seen, @g3_unknown_verbs, %doc_verbs, $verb_skip);
if ($ENV{VERB_DOC_PRESENT}) {
  for my $l (slurp_lines("$work/verbs.md")) {
    while ($l =~ /$verb_re/g) { $doc_verbs{$_} = 1 for split /\|/, $1; }
  }
} else {
  $verb_skip = "$ENV{VERB_DOC_PATH} is missing at the revision";
}
for my $c (@cmd_texts) {
  my ($text, $ln) = @$c;
  my @tok = split /\s+/, $text;
  for my $i (0 .. $#tok) {
    my $t = $tok[$i];
    $t =~ s/^["\x27(]+|["\x27;&|)]+$//g;
    my $is_script = 0;
    if ($i > 0) {
      my $prev = $tok[$i - 1];
      $prev =~ s/^.*[;&|(]//;
      $is_script = 1 if $prev =~ /^(?:bash|sh|source|\.)$/;
    }
    $is_script = 1 if $t =~ /\.sh$/;
    next unless $is_script;
    my $p = normalize($t);
    if ($p eq "") {
      push @g3_skipped, $t if $t ne "" && !$seen3{"skip:$t"}++;
      next;
    }
    next if $seen3{$p}++;
    $g3_scripts++;
    next if exists_at_rev($p) || declared_new($p);
    push @g3_missing, { path => $p, line => $ln };
  }
  while ($text =~ /$verb_re/g) {
    for my $v (split /\|/, $1) {
      next if $verbs_seen{$v}++;
      next if defined $verb_skip;
      next if $doc_verbs{$v} || $verb_new{$v};
      push @g3_unknown_verbs, { verb => $v, line => $ln };
    }
  }
}

my %pos;
for my $i (0 .. $#headings) { $pos{$headings[$i]} //= $i; }
my @missing_h = grep { !exists $pos{$_} } @template;
my $last = -1;
my $order_ok = 1;
for my $h (@template) {
  next unless exists $pos{$h};
  $order_ok = 0 if $pos{$h} < $last;
  $last = $pos{$h};
}
my $lessons_last = (@headings && $headings[-1] eq "Lessons") ? 1 : 0;
my %in_template = map { $_ => 1 } @template;
my @extra = grep { !$in_template{$_} } @headings;
my @ste_findings = grep { /:\d+:/ } slurp_lines("$work/ste-output");

my $b = sub { $_[0] ? JSON::PP::true : JSON::PP::false };
my $g1 = !@g1_missing;
my $g2 = !@g2_ignored;
my $g3 = !@g3_missing && !@g3_unknown_verbs;
my $g4 = $ENV{STE_EXIT} == 0 && !@missing_h && $order_ok && $lessons_last;

my $result = {
  g1_paths => $b->($g1),
  g2_trackable => $b->($g2),
  g3_commands => $b->($g3),
  g4_structure => $b->($g4),
  pass => $b->($g1 && $g2 && $g3 && $g4),
  details => {
    case_id => $ENV{CASE_ID},
    revision => $ENV{REVISION},
    g1 => { checked => $g1_checked, missing => \@g1_missing, declared_new => [sort @g1_new],
            declared_absent => [sort @g1_absent], ignored_local => [sort @g1_local],
            exempt_spans => $exempt_count },
    g2 => { checked => scalar(@to_check), ignored => \@g2_ignored },
    g3 => { scripts_checked => $g3_scripts, missing_scripts => \@g3_missing, skipped_tokens => [sort @g3_skipped],
            verbs_checked => [sort keys %verbs_seen], unknown_verbs => \@g3_unknown_verbs,
            verb_skip => $verb_skip },
    g4 => { ste_exit => $ENV{STE_EXIT} + 0, ste_findings => scalar(@ste_findings),
            ste_first => [@ste_findings[0 .. ($#ste_findings < 2 ? $#ste_findings : 2)]],
            headings => \@headings, missing_headings => \@missing_h, order_ok => $b->($order_ok),
            lessons_last => $b->($lessons_last), extra_headings => \@extra },
  },
};
print JSON::PP->new->canonical->encode($result), "\n";
'
