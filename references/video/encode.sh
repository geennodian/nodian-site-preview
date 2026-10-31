#!/bin/bash
set -e
S="$1"; F="$2"; cd "$(dirname "$0")/../../nexpot"
CROP="crop=356:712:24:124"; OUT="scale=712:1424:flags=lanczos,unsharp=5:5:0.7,format=yuv420p"
ENC=(-c:v libx264 -preset slow -crf 25 -movflags +faststart -an -r 30)
ffmpeg -v error -y -ss 113 -t 8 -i "$F" -vf "$CROP,$OUT" "${ENC[@]}" video/nav.mp4
ffmpeg -v error -y -ss 34 -i "$F" -frames:v 1 -vf "$CROP,delogo=x=216:y=502:w=26:h=30" $S/clip/audio_base.png
ffmpeg -v error -y -ss 31 -t 14 -i "$F" -loop 1 -i $S/clip/audio_base.png -filter_complex "[0:v]$CROP,split=2[a][b];[a]crop=150:44:100:405[w];[b]crop=330:28:15:455[p];[1:v][w]overlay=100:405[x];[x][p]overlay=15:455:shortest=1,$OUT[o]" -map "[o]" -t 14 "${ENC[@]}" video/audio.mp4
ffmpeg -v error -y -ss 164 -i "$F" -frames:v 1 -vf "$CROP,delogo=x=220:y=598:w=26:h=30" $S/clip/c1.png
ffmpeg -v error -y -ss 166 -i "$F" -frames:v 1 -vf "$CROP,delogo=x=136:y=388:w=26:h=30" $S/clip/c2.png
ffmpeg -v error -y -ss 172 -i "$F" -frames:v 1 -vf "$CROP,delogo=x=70:y=222:w=26:h=30" $S/clip/c3.png
ffmpeg -v error -y -loop 1 -framerate 30 -t 2 -i $S/clip/c1.png -loop 1 -framerate 30 -t 2.5 -i $S/clip/c2.png -loop 1 -framerate 30 -t 6 -i $S/clip/c3.png -filter_complex "[0:v][1:v]xfade=transition=fade:duration=0.25:offset=1.75[x];[x][2:v]xfade=transition=fade:duration=0.25:offset=4,$OUT[o]" -map "[o]" "${ENC[@]}" video/ai.mp4
ffmpeg -v error -y -i video/nav.mp4 -frames:v 1 -q:v 4 img/poster-nav.jpg
ffmpeg -v error -y -i video/audio.mp4 -frames:v 1 -q:v 4 img/poster-audio.jpg
ffmpeg -v error -y -ss 7 -i video/ai.mp4 -frames:v 1 -q:v 4 img/poster-ai.jpg
ls -la video img/poster-*
ffmpeg -v error -y -ss 7 -i video/audio.mp4 -frames:v 1 -vf scale=356:-1 $S/clip/ck_audio.png
ffmpeg -v error -y -ss 3 -i video/ai.mp4 -frames:v 1 -vf scale=356:-1 $S/clip/ck_ai2.png
ffmpeg -v error -y -ss 8 -i video/ai.mp4 -frames:v 1 -vf scale=356:-1 $S/clip/ck_ai3.png
ffmpeg -v error -y -ss 4 -i video/nav.mp4 -frames:v 1 -vf scale=356:-1 $S/clip/ck_nav.png
