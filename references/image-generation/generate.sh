#!/bin/bash
# 使い方: ./generate.sh hero （ChatGPTでログイン済みのCodex CLIが必要）
G="$(cd "$(dirname "$0")" && pwd)"; N="$1"
P="$(cat "$G/common.txt")

$(cat "$G/prompts/$N.txt")"
codex exec --skip-git-repo-check -s read-only -m gpt-5.6-terra -c model_reasoning_effort="low" -C "$G" "$P" < /dev/null
# 生成された画像は ~/.codex/generated_images/<スレッドID>/ に保存される
