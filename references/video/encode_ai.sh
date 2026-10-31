#!/bin/bash
set -e
S="$1"; F="$2"; cd "$(dirname "$0")/../../nexpot"
CROP="crop=356:712:24:124"; OUT="scale=712:1424:flags=lanczos,unsharp=5:5:0.7,format=yuv420p"
ENC=(-c:v libx264 -preset slow -crf 25 -movflags +faststart -an -r 30)
ffmpeg -v error -y -ss 172 -i "$F" -frames:v 1 -vf "$CROP,drawbox=x=72:y=222:w=26:h=28:color=white:t=fill" $S/clip/c3.png
ffmpeg -v error -y -loop 1 -framerate 30 -t 2 -i $S/clip/c1.png -loop 1 -framerate 30 -t 2.5 -i $S/clip/c2.png -loop 1 -framerate 30 -t 6 -i $S/clip/c3.png -filter_complex "[0:v][1:v]xfade=transition=fade:duration=0.25:offset=1.75[x];[x][2:v]xfade=transition=fade:duration=0.25:offset=4,$OUT[o]" -map "[o]" "${ENC[@]}" video/ai.mp4
ffmpeg -v error -y -ss 7 -i video/ai.mp4 -frames:v 1 -q:v 4 img/poster-ai.jpg
