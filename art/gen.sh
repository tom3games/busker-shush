#!/bin/zsh
# 切り絵の元画像を生成する。生画像はリポジトリの外（_art_raw/busker-shush）に置く
cd ~/Desktop/claudecode/busker-shush/art
G=~/.claude/skills/3d-homepage/scripts/codex_imagegen.py
R=~/Desktop/claudecode/_art_raw/busker-shush
run() { python3 $G $R/$1.png prompts/$1.md ${@:2} --quality high --size 1536x1024 > logs/$1.log 2>&1 && echo "$1 ok" || echo "$1 FAIL" }
if [[ $1 == 1 ]]; then
  for k in mus_a you_a folks_a folks_b; do run $k & done; wait
elif [[ $1 == 2 ]]; then
  run mus_b $R/mus_a.png & run mus_c $R/mus_a.png & wait
else
  for k in ${@:2}; do if [[ $k == mus_b || $k == mus_c ]]; then run $k $R/mus_a.png & else run $k & fi; done; wait
fi
# 3: 主人公（電話なし）と告白の相手の反応
if [[ $1 == 3 ]]; then
  run you_b $R/you_a.png & run date_b $R/folks_b.png & wait
fi
